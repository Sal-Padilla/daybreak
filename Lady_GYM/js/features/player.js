// Lady_GYM — js/features/player.js — the workout itself, full screen: warm-up, sets, rest, celebration.
//
// Used one-handed at 5:40 AM with sweaty hands. So:
//   - a moving picture of the exercise fills the top of the screen;
//   - every set is a row with its weight and reps already filled in from last time, and one
//     big round tick to log it — the tick is the whole interaction most of the time;
//   - changing a number opens a keypad with thumb-sized keys, not the tiny iOS keyboard;
//   - the rest timer is a ring that counts down by itself and gets out of the way;
//   - every set is saved the instant it is ticked, so closing the app loses nothing.
//
// The training logic is Daybreak's, unchanged: progression targets, readiness adjustment,
// the warm-up protocol, personal bests and the Shape Map summary.

import { DB } from '../core/db.js';
import { Store } from '../core/store.js';
import { Nav } from '../core/nav.js';
import { byId, search as searchExercises } from '../data/exercises.js';
import { nextTarget, adjustForReadiness, estimate1RM } from '../engine/progression.js';
import { readinessScore, readinessAdvice } from '../engine/readiness.js';
import { planFor, programOf } from '../engine/sessionplan.js';
import { weeklyShapeMap } from '../engine/shapemap.js';
import { warmupFor, WARMUP_SHAPE, PART_LABEL } from '../data/warmup.js';
import { diagramKeyFor, howToUrl } from '../data/info.js';
import { figureAnim } from '../art/figure.js';
import { workoutArt } from '../art/scenes.js';
import { RestTimer } from '../ui/timer.js';
import { icon } from '../ui/icons.js';
import { rings } from '../ui/rings.js';
import {
  esc, fmt, button, toast, sheet, closeSheet, confirmAlert, actionSheet, numberPad, haptic, confetti,
} from '../ui/kit.js';
import { weekContext, heroKeyFor, typeLabel, minutesOf } from './shared.js';
import { todaysReadiness } from './today.js';
import { exThumb } from './workouts.js';

/* ------------------------------------------------------------------ state */

let view = 'intro';         // intro | warmup | active | done
let spec = null;            // the session we are about to start (scheduled or chosen)
let plan = null;            // {name, type, items[]}
let focus = 0;              // index into plan.items
let targets = new Map();    // exerciseId -> progression target
let drafts = new Map();     // exerciseId -> [{weight, reps, seconds, distance}] per planned row
let effortAsked = new Set();
let includeWarmup = true;
let warm = null;            // {plan, i}
let rest = null;            // {timer, total, left, exerciseId}
let summary = null;
let ticker = null;

function reset() {
  view = 'intro'; spec = null; plan = null; focus = 0;
  targets = new Map(); drafts = new Map(); effortAsked = new Set();
  includeWarmup = true; warm = null; stopRest(); summary = null;
  if (ticker) { clearInterval(ticker); ticker = null; }
}

/* ------------------------------------------------------------------ open */

/**
 * Open the player.
 *   {}                      today's scheduled workout (or resume one in progress)
 *   {programDayKey}         a specific day of the plan
 *   {short: true}           the ~30 minute version
 *   {empty: true}           build-your-own
 */
export async function openPlayer(opts = {}) {
  const active = Store.get('activeSession');
  reset();
  const profile = Store.get('profile');
  if (active && !active.complete) {
    view = 'active';
    plan = await resolvePlanForSession(profile, active);
    await refreshTargets();
    return Nav.present(playerPage, {});
  }
  if (opts.empty) {
    spec = { name: 'My workout', type: 'full', blockSize: 'full', programDayKey: null, estMinutes: 0, focus: [] };
  } else if (opts.programDayKey) {
    const day = (programOf(profile).days || []).find((d) => d.key === opts.programDayKey);
    if (day) {
      spec = { programDayKey: day.key, name: day.name, type: day.type, focus: day.focus,
        estMinutes: minutesOf(day.estMinutes, opts.short ? 'short' : 'full'), blockSize: opts.short ? 'short' : 'full' };
    }
  } else {
    const ctx = await weekContext();
    const s = ctx.day && ctx.day.session;
    if (s && s.type !== 'recovery') {
      const size = opts.short ? 'short' : s.blockSize;
      // a short version of today's plan is re-estimated from the program, not the full-length slot
      const day = (programOf(profile).days || []).find((d) => d.key === s.programDayKey);
      spec = { ...s, blockSize: size, estMinutes: opts.short && day ? minutesOf(day.estMinutes, 'short') : minutesOf(s.estMinutes, size) };
    }
  }
  if (!spec) {
    // Nothing scheduled: let her pick a day from her plan.
    const days = programOf(profile).days || [];
    const pick = await actionSheet('Which workout?', days.map((d) => ({ id: d.key, label: d.name }))
      .concat([{ id: '__empty', label: 'Build my own' }]));
    if (!pick) return null;
    if (pick === '__empty') return openPlayer({ empty: true });
    return openPlayer({ programDayKey: pick, short: opts.short });
  }
  plan = spec.programDayKey ? planFor(profile, spec) : { name: spec.name, type: spec.type, items: [], estMinutes: 0 };
  return Nav.present(playerPage, {});
}

async function resolvePlanForSession(profile, session) {
  const p = planFor(profile, {
    programDayKey: session.programDayKey, blockSize: session.blockSize, type: session.type,
    name: session.name, estMinutes: session.estMinutes, note: session.note, focus: session.focus,
  });
  // Exercises added mid-session (or a build-your-own session) live only in the logged sets.
  const logged = await DB.getSessionSets(session.id);
  const ids = p.items.map((i) => i.exerciseId);
  for (const s of logged) {
    if (!ids.includes(s.exerciseId)) {
      const it = itemFromExercise(byId(s.exerciseId));
      if (it) { p.items.push(it); ids.push(s.exerciseId); }
    }
  }
  if (!p.name) p.name = session.name || 'Workout';
  return p;
}

function itemFromExercise(ex) {
  if (!ex) return null;
  return {
    exerciseId: ex.id, exercise: ex, sets: 3, reps: ex.defaultReps || [8, 12],
    rir: null, tier: ex.tier || 3, restSec: ex.tier === 1 ? 150 : 90, note: null,
  };
}

async function refreshTargets() {
  targets = new Map();
  const session = Store.get('activeSession');
  const dials = Store.get('dials') || {};
  const readiness = session && session.readiness ? readinessAdvice(readinessScore(session.readiness)) : null;
  for (const item of plan.items) {
    const history = await DB.getExerciseSets(item.exerciseId);
    const prior = (history || []).filter((s) => s.sessionId !== (session && session.id) && !s.isWarmup);
    let t = nextTarget(prior, item.exercise, { ...dials, topSetReps: item.reps });
    if (readiness) t = adjustForReadiness(t, readiness);
    targets.set(item.exerciseId, t);
  }
}

async function createSession() {
  const readiness = await todaysReadiness();
  const session = {
    id: DB.uid(),
    date: DB.todayISO(),
    startedAt: new Date().toISOString(),
    endedAt: null,
    type: spec.type || 'full',
    name: spec.name || 'Workout',
    programDayKey: spec.programDayKey || null,
    blockSize: spec.blockSize || 'full',
    estMinutes: minutesOf(spec.estMinutes, spec.blockSize),
    focus: spec.focus || [],
    classId: null,
    readiness,
    notes: '',
    complete: false,
  };
  await DB.put('sessions', session);
  Store.set('activeSession', session);
  Store.set('activeSets', []);
  await refreshTargets();
  if (readiness) {
    const advice = readinessAdvice(readinessScore(readiness));
    if (advice.band !== 'good') toast(advice.message, { tone: 'warn', ic: 'info', ms: 4200 });
  }
}

/* ------------------------------------------------------------------ sets */

function setsFor(exerciseId) {
  return (Store.get('activeSets') || [])
    .filter((s) => s.exerciseId === exerciseId && !s.isWarmup)
    .sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0));
}

function stepFor(ex) {
  const eq = ex.equipment || [];
  if (eq.includes('dumbbell') || eq.includes('kettlebell')) return 2.5;
  if (eq.includes('band') || eq.includes('bodyweight')) return 1;
  return 5;
}

/** Pre-filled values for planned row i: the set before it, else the target, else sensible. */
function rowDraft(item, i) {
  if (!drafts.has(item.exerciseId)) drafts.set(item.exerciseId, []);
  const list = drafts.get(item.exerciseId);
  if (list[i]) return list[i];
  const logged = setsFor(item.exerciseId);
  const prev = logged[i - 1] || logged[logged.length - 1] || list[i - 1] || null;
  const t = targets.get(item.exerciseId) || {};
  const d = {
    weight: prev && prev.weight != null ? prev.weight : (t.weight != null ? t.weight : null),
    reps: prev && prev.reps != null ? prev.reps : (t.reps != null ? t.reps : (item.reps ? item.reps[1] : 10)),
    seconds: prev && prev.seconds != null ? prev.seconds : (t.seconds != null ? t.seconds : 30),
    distance: prev && prev.distance != null ? prev.distance : null,
  };
  list[i] = d;
  return d;
}

function currentItem() {
  return plan && plan.items.length ? plan.items[Math.min(focus, plan.items.length - 1)] : null;
}

function startingWeights(ex) {
  const eq = ex.equipment || [];
  if (eq.includes('barbell')) return [35, 45, 65, 75, 95];
  if (eq.includes('kettlebell')) return [10, 15, 20, 25, 35];
  if (eq.includes('dumbbell')) return [5, 8, 10, 12, 15, 20];
  if (eq.includes('machine') || eq.includes('cable')) return [20, 30, 40, 50, 60, 70];
  return [5, 10, 15, 20];
}

/* ------------------------------------------------------------------ rest timer */

function startRest(seconds, exerciseId) {
  stopRest();
  const total = Math.max(15, seconds || 90);
  const timer = new RestTimer({
    seconds: total,
    onTick: (left) => { if (rest) { rest.left = left; paintRest(); } },
    onDone: () => {
      if (!rest) return;
      rest.left = 0;
      paintRest();
      toast('Rest is up — next set when you’re ready', { ic: 'timer', ms: 2400 });
    },
  });
  rest = { timer, total, left: total, exerciseId };
  timer.start();
}

function stopRest() {
  if (rest && rest.timer) { try { rest.timer.stop(); } catch (_) { /* stopped */ } }
  rest = null;
}

function restHtml() {
  if (!rest) return '';
  const pct = rest.total ? rest.left / rest.total : 0;
  return '<div class="rest" id="rest">' +
    '<div class="rest-ring">' + rings([{ pct, color: 'var(--brand-fill)', track: 'var(--brand-soft)' }],
      { size: 64, stroke: 7, label: 'Rest' }) +
      '<span class="rest-time num" id="rest-time">' + fmt.mmss(rest.left) + '</span></div>' +
    '<div class="rest-text"><p class="rest-title">' + (rest.left > 0 ? 'Rest' : 'Rest is up!') + '</p>' +
      '<p class="rest-sub">' + (rest.left > 0 ? 'Breathe. Sip some water.' : 'Go when you’re ready.') + '</p></div>' +
    '<div class="rest-btns">' +
      '<button type="button" class="rest-btn" data-action="rest-add" aria-label="Add 15 seconds">+15</button>' +
      '<button type="button" class="rest-btn is-skip" data-action="rest-skip">' + (rest.left > 0 ? 'Skip' : 'OK') + '</button>' +
    '</div></div>';
}

function paintRest() {
  const host = document.getElementById('rest-host');
  if (host) host.innerHTML = restHtml();
}

/* ------------------------------------------------------------------ views */

function introView() {
  const items = plan.items;
  const warmPlan = warmupFor(Store.get('dials') || {}, spec.type);
  const mins = minutesOf(spec.estMinutes, spec.blockSize) || minutesOf(plan.estMinutes, spec.blockSize);
  return '<div class="pl-intro">' +
    '<div class="pl-hero">' + workoutArt(spec.type, heroKeyFor(plan), { label: plan.name }) +
      '<div class="pl-hero-text"><p class="pl-kicker">' + esc(typeLabel(spec.type)) + '</p>' +
      '<h1>' + esc(plan.name || spec.name) + '</h1>' +
      '<p>' + esc([mins ? '~' + mins + ' min' : '', items.length ? fmt.plural(items.length, 'exercise') : 'Add exercises as you go'].filter(Boolean).join(' · ')) + '</p></div></div>' +
    (items.length ? '<div class="pl-strip">' + items.map((it) => '<span class="pl-strip-item">' + exThumb(it.exercise) +
      '<span>' + esc(it.exercise.name) + '</span></span>').join('') + '</div>' : '') +
    '<div class="group-body pl-warm">' +
      '<div class="row"><span class="row-lead"><span class="ic-tile" style="--tile:var(--orange-fill);width:34px;height:34px">' +
        icon('flame', 20) + '</span></span>' +
      '<span class="row-main"><span class="row-title">Guided warm-up</span>' +
      '<span class="row-sub">' + warmPlan.totalMinutes + ' min · recommended this early in the day</span></span>' +
      '<label class="switch"><input type="checkbox" data-action="toggle-warm" ' + (includeWarmup ? 'checked' : '') +
        ' aria-label="Include the warm-up"><span></span></label></div></div>' +
    '<div class="pl-cta">' + button({ label: 'Let’s Go!', action: 'begin', kind: 'primary', icon: 'play' }) + '</div>' +
    '</div>';
}

function warmupView() {
  const it = warm.plan.items[warm.i];
  const key = WARMUP_SHAPE[it.name];
  const left = warm.left == null ? it.seconds : warm.left;
  const pct = it.seconds ? left / it.seconds : 0;
  return '<div class="pl-warmup">' +
    '<div class="pl-dots">' + warm.plan.items.map((_, i) =>
      '<span class="' + (i < warm.i ? 'is-done' : i === warm.i ? 'is-on' : '') + '"></span>').join('') + '</div>' +
    '<p class="pl-kicker center">Warm-up · ' + esc(PART_LABEL[it.part] || '') + '</p>' +
    '<div class="pl-figure">' + (key ? figureAnim(key) : '') + '</div>' +
    '<h1 class="pl-name center">' + esc(it.name) + '</h1>' +
    '<p class="pl-cue center">' + esc(it.cue) + '</p>' +
    '<div class="pl-count">' + rings([{ pct, color: 'var(--orange-fill)', track: 'var(--orange-soft)' }],
      { size: 96, stroke: 10, label: 'Time left' }) + '<span class="num" id="warm-time">' + fmt.mmss(left) + '</span></div>' +
    '<div class="pl-row">' +
      button({ label: 'Skip Warm-up', action: 'warm-skip', kind: 'plain', size: 'md', full: false }) +
      button({ label: warm.i === warm.plan.items.length - 1 ? 'Start Workout' : 'Next', action: 'warm-next', kind: 'primary', size: 'md', full: false }) +
    '</div></div>';
}

function targetLine(item) {
  const t = targets.get(item.exerciseId);
  const ex = item.exercise;
  const parts = [];
  if (ex.track === 'time_hold') parts.push(item.sets + ' holds');
  else if (ex.track === 'time_distance') parts.push(item.sets > 1 ? item.sets + ' rounds' : 'Steady pace');
  else parts.push(item.sets + ' sets × ' + item.reps[0] + '–' + item.reps[1] + ' reps');
  if (t && t.weight != null && ex.track === 'weight_reps') parts.push('aim ' + fmt.num(t.weight) + ' lb');
  return parts.join(' · ');
}

function setRow(item, i, logged) {
  const ex = item.exercise;
  const done = logged[i] || null;
  const d = done || rowDraft(item, i);
  const track = ex.track;
  const cell = (field, value, unit, label) =>
    '<button type="button" class="cell' + (done ? ' is-done' : '') + '" data-action="edit-cell" data-i="' + i +
    '" data-field="' + field + '" aria-label="' + esc(label) + ' ' + (value == null ? 'not set' : value) + '">' +
    (value == null ? '<span class="cell-empty">Tap to set</span>' :
      '<span class="num">' + esc(field === 'seconds' ? fmt.mmss(value) : fmt.num(value)) + '</span>') +
    (unit && value != null ? '<small>' + esc(unit) + '</small>' : '') + '</button>';
  let cells = '';
  if (track === 'weight_reps') cells = cell('weight', d.weight, 'lb', 'Weight') + cell('reps', d.reps, 'reps', 'Reps');
  else if (track === 'time_hold') cells = cell('seconds', d.seconds, '', 'Hold time');
  else if (track === 'time_distance') cells = cell('minutes', d.seconds ? Math.round(d.seconds / 60) : null, 'min', 'Minutes') +
    cell('distance', d.distance, 'mi', 'Distance');
  else cells = cell('reps', d.reps, 'reps', 'Reps');
  const isNext = !done && i === logged.length;
  return '<div class="setrow' + (done ? ' is-done' : '') + (isNext ? ' is-next' : '') + '">' +
    '<span class="setrow-n">' + (i + 1) + '</span>' +
    '<div class="setrow-cells">' + cells + '</div>' +
    (done
      ? '<span class="tick is-done" aria-label="Set ' + (i + 1) + ' done">' + icon('check', 22) + '</span>'
      : '<button type="button" class="tick" data-action="log-set" data-i="' + i + '" aria-label="Log set ' + (i + 1) + '"' +
        (isNext ? '' : ' tabindex="-1"') + '>' + icon('check', 22) + '</button>') +
    '</div>';
}

function effortHtml(item, logged) {
  if (!logged.length || logged.length < item.sets || effortAsked.has(item.exerciseId)) return '';
  if (item.exercise.track !== 'weight_reps' && item.exercise.track !== 'bodyweight_reps') return '';
  const opts = [['😌', 'Easy', 4], ['🙂', 'Good', 3], ['😤', 'Hard', 1], ['🥵', 'Max', 0]];
  return '<div class="effort"><p class="effort-q">How did that feel?</p><div class="effort-opts">' +
    opts.map(([e, l, rir]) => '<button type="button" class="effort-btn" data-action="effort" data-rir="' + rir + '">' +
      '<span class="effort-e">' + e + '</span><span>' + l + '</span></button>').join('') + '</div></div>';
}

function activeView() {
  const session = Store.get('activeSession');
  if (!plan || !plan.items.length) {
    return '<div class="pl-empty"><div class="empty"><p class="empty-title">Add your first exercise</p>' +
      '<p class="empty-sub">Pick anything from the library. I’ll keep track of every set.</p></div>' +
      button({ label: 'Add Exercise', action: 'add-exercise', kind: 'primary', icon: 'plus' }) + '</div>';
  }
  const item = currentItem();
  const ex = item.exercise;
  const logged = setsFor(item.exerciseId);
  const rowsCount = Math.max(item.sets, logged.length);
  const key = diagramKeyFor(ex);
  const t = targets.get(item.exerciseId);
  const breath = (ex.cues || []).find((c) => /exhale|breath/i.test(c));
  const isLast = focus >= plan.items.length - 1;
  const allDone = logged.length >= item.sets;

  return '<div class="pl-active">' +
    '<div class="pl-progress" aria-label="Exercise ' + (focus + 1) + ' of ' + plan.items.length + '">' +
      plan.items.map((it, i) => {
        const n = setsFor(it.exerciseId).length;
        const full = n >= it.sets;
        return '<button type="button" class="seg-bar' + (i === focus ? ' is-on' : '') + (full ? ' is-full' : n ? ' is-part' : '') +
          '" data-action="go-ex" data-i="' + i + '" aria-label="' + esc(it.exercise.name) + '"></button>';
      }).join('') + '</div>' +
    '<div class="pl-head">' +
      '<button type="button" class="pl-figure-card" data-action="ex-info" aria-label="How to do ' + esc(ex.name) + '">' +
        (key ? figureAnim(key) : '<div class="ex-thumb-blank big">' + icon('workouts', 48) + '</div>') +
        '<span class="pl-info" aria-hidden="true">' + icon('info', 20) + '</span></button>' +
      '<div class="pl-head-text">' +
        '<p class="pl-pos">' + (focus + 1) + ' of ' + plan.items.length + '</p>' +
        '<h1 class="pl-name">' + esc(ex.name) + '</h1>' +
        '<p class="pl-target">' + esc(targetLine(item)) + '</p>' +
        '<button type="button" class="pl-how" data-action="ex-info">' + icon('play', 12) + ' How to do it</button>' +
      '</div>' +
    '</div>' +
    (t && t.message ? '<p class="pl-msg">' + icon('sparkle', 14) + esc(t.message) + '</p>' : '') +
    '<div class="sets">' +
      '<div class="sets-head"><span>Set</span><span>' + (ex.track === 'weight_reps' ? 'Weight & reps' : ex.track === 'time_hold' ? 'Hold' : ex.track === 'time_distance' ? 'Time & distance' : 'Reps') + '</span><span>Done</span></div>' +
      Array.from({ length: rowsCount }, (_, i) => setRow(item, i, logged)).join('') +
      '<button type="button" class="add-set" data-action="add-set">' + icon('plus', 16) + ' Add a set</button>' +
    '</div>' +
    effortHtml(item, logged) +
    (breath ? '<div class="breath">' + icon('drop', 18) + '<p><b>Breathe:</b> ' + esc(breath) + '</p></div>' : '') +
    '<div class="pl-foot">' +
      '<div id="rest-host">' + restHtml() + '</div>' +
      (isLast
        ? button({ label: allDone ? 'Finish Workout' : 'Finish Workout', action: 'finish', kind: allDone ? 'good' : 'primary', icon: 'check' })
        : button({ label: 'Next: ' + plan.items[focus + 1].exercise.name, action: 'next-ex', kind: allDone ? 'primary' : 'tinted', icon: 'chevronRight' })) +
    '</div>' +
    '</div>';
}

function doneView() {
  const s = summary;
  return '<div class="pl-done">' +
    '<div class="pl-done-badge">' + icon('check', 54) + '</div>' +
    '<h1>Workout complete!</h1>' +
    '<p class="pl-done-line">' + esc(s.line) + '</p>' +
    '<div class="pl-stats">' +
      '<div><b class="num">' + fmt.mmss(s.seconds) + '</b><span>Time</span></div>' +
      '<div><b class="num">' + s.sets + '</b><span>Sets</span></div>' +
      '<div><b class="num">' + (s.volume ? fmt.num(s.volume, 0) : s.exercises) + '</b><span>' + (s.volume ? 'lb lifted' : 'Exercises') + '</span></div>' +
    '</div>' +
    (s.prs.length ? '<div class="pl-prs">' + s.prs.map((p) =>
      '<div class="pr">' + '<span class="pr-ic">' + icon('trophy', 26) + '</span>' +
      '<div><p class="pr-k">New personal best!</p><p class="pr-v">' + esc(p.name) + ' · ' + esc(fmt.num(p.weight)) + ' lb × ' + p.reps + '</p></div></div>').join('') + '</div>' : '') +
    (s.moved.length ? '<p class="pl-moved-k">You worked</p><div class="chip-row center">' + s.moved.map((m) =>
      '<span class="chip chip-pink">' + esc(m.label) + '</span>').join('') + '</div>' : '') +
    '<div class="pl-protein">' + icon('drop', 20) + '<p>Protein in the next hour — 25 to 30 g. It counts most right now.</p></div>' +
    '<div class="pl-done-btns">' +
      button({ label: 'Share', action: 'share-done', kind: 'tinted', icon: 'share' }) +
      button({ label: 'Done', action: 'close-done', kind: 'primary' }) +
    '</div></div>';
}

/* ------------------------------------------------------------------ the page */

export const playerPage = {
  id: 'player',
  cls: 'is-player',
  closeLabel: false,
  title: () => {
    if (view === 'active') return plan ? plan.name : 'Workout';
    if (view === 'warmup') return 'Warm-up';
    if (view === 'done') return '';
    return '';
  },

  right: () => {
    if (view === 'active') {
      return '<button type="button" class="nav-icon-btn" data-action="more" aria-label="More options">' + icon('more', 24) + '</button>';
    }
    return '';
  },

  async render() {
    if (view === 'intro') return introView();
    if (view === 'warmup') return warmupView();
    if (view === 'done') return doneView();
    return activeView();
  },

  mount(entry) {
    // left bar button: Cancel before starting, End while running
    const left = entry.el.querySelector('.navbar-left');
    if (left) {
      left.innerHTML = view === 'done' ? '' :
        '<button type="button" class="nav-text" data-action="' + (view === 'intro' ? 'cancel' : 'end') + '">' +
        (view === 'intro' ? 'Cancel' : 'End') + '</button>';
    }
    if (view === 'active') {
      const session = Store.get('activeSession');
      const title = entry.el.querySelector('.navbar-title');
      if (ticker) clearInterval(ticker);
      const paint = () => {
        if (!session || !title) return;
        const sec = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000);
        title.innerHTML = '<span class="pl-clock num">' + fmt.mmss(sec) + '</span>';
      };
      paint();
      ticker = setInterval(paint, 1000);
    }
    if (view === 'warmup' && warm && !warm.timer) startWarmTimer();
  },

  unmount() {
    if (ticker) { clearInterval(ticker); ticker = null; }
  },

  actions: {
    'toggle-warm'(node) { includeWarmup = node.checked; },
    async cancel() { reset(); return Nav.dismiss(); },
    async begin() {
      haptic();
      await createSession();
      if (includeWarmup) {
        warm = { plan: warmupFor(Store.get('dials') || {}, spec.type), i: 0, left: null, timer: null };
        view = 'warmup';
      } else {
        view = 'active';
      }
      return Nav.refresh();
    },
    'warm-next'() {
      haptic();
      return advanceWarm();
    },
    'warm-skip'() {
      stopWarm();
      view = 'active';
      return Nav.refresh();
    },
    'go-ex'(node) {
      focus = Number(node.dataset.i) || 0;
      stopRest();
      return Nav.refresh().then(scrollTop);
    },
    'next-ex'() {
      haptic();
      if (plan && focus < plan.items.length - 1) focus++;
      stopRest();
      return Nav.refresh().then(scrollTop);
    },
    async 'edit-cell'(node) {
      const item = currentItem();
      if (!item) return;
      const i = Number(node.dataset.i);
      const field = node.dataset.field;
      const logged = setsFor(item.exerciseId);
      const rec = logged[i] || null;
      const d = rec || rowDraft(item, i);
      const cfg = {
        weight: { title: 'Weight', unit: 'lb', step: stepFor(item.exercise), value: d.weight, decimals: true },
        reps: { title: 'Reps', unit: 'reps', step: 1, value: d.reps, decimals: false },
        seconds: { title: 'Hold (seconds)', unit: 'sec', step: 5, value: d.seconds, decimals: false },
        minutes: { title: 'Minutes', unit: 'min', step: 1, value: d.seconds ? Math.round(d.seconds / 60) : null, decimals: false },
        distance: { title: 'Distance', unit: 'mi', step: 0.1, value: d.distance, decimals: true },
      }[field];
      const t = targets.get(item.exerciseId);
      const quick = field === 'weight' && cfg.value != null
        ? [cfg.value - cfg.step * 2, cfg.value - cfg.step, cfg.value + cfg.step, cfg.value + cfg.step * 2].filter((v) => v > 0)
        : field === 'reps' ? [item.reps[0], Math.round((item.reps[0] + item.reps[1]) / 2), item.reps[1]] : [];
      if (field === 'weight' && t && t.weight != null && !quick.includes(t.weight)) quick.unshift(t.weight);
      // First time on this lift: offer typical starting weights for the equipment.
      if (field === 'weight' && cfg.value == null && !quick.length) quick.push(...startingWeights(item.exercise));
      const v = await numberPad({ ...cfg, quick });
      if (v == null) return;
      if (rec) {
        if (field === 'minutes') rec.seconds = v * 60; else rec[field] = v;
        await DB.put('sets', rec);
        await Store.reloadActiveSets();
      } else {
        if (field === 'minutes') d.seconds = v * 60; else d[field] = v;
        // carry a changed weight forward to the rows below that have not been logged yet
        if (field === 'weight' || field === 'reps') {
          const list = drafts.get(item.exerciseId) || [];
          for (let k = i + 1; k < list.length; k++) if (list[k] && !logged[k]) list[k][field] = v;
        }
      }
      return Nav.refresh();
    },
    async 'log-set'(node) {
      const item = currentItem();
      const session = Store.get('activeSession');
      if (!item || !session) return;
      const logged = setsFor(item.exerciseId);
      const i = logged.length;                  // always log the next row, in order
      const d = rowDraft(item, i);
      const track = item.exercise.track;
      if (track === 'weight_reps' && (d.weight == null || !d.reps)) {
        toast('Tap the weight to set it first', { tone: 'warn', ic: 'info' });
        return;
      }
      haptic();
      const record = {
        id: DB.uid(), sessionId: session.id, exerciseId: item.exerciseId, setNumber: i + 1,
        weight: track === 'weight_reps' ? d.weight : null,
        reps: (track === 'weight_reps' || track === 'bodyweight_reps' || track === 'reps_only') ? d.reps : null,
        seconds: (track === 'time_hold' || track === 'time_distance') ? d.seconds : null,
        distance: track === 'time_distance' ? d.distance : null,
        rir: null, isWarmup: false, loggedAt: new Date().toISOString(),
      };
      await DB.put('sets', record);           // saved now — never batched
      await Store.reloadActiveSets();
      if (i + 1 < item.sets) startRest(item.restSec || (await DB.getPref('rest:default', 90)) || 90, item.exerciseId);
      else stopRest();
      return Nav.refresh();
    },
    'add-set'() {
      const item = currentItem();
      if (!item) return;
      item.sets = Math.max(item.sets, setsFor(item.exerciseId).length) + 1;
      return Nav.refresh();
    },
    async effort(node) {
      const item = currentItem();
      if (!item) return;
      haptic();
      const rows = setsFor(item.exerciseId);
      const last = rows[rows.length - 1];
      if (last) { last.rir = Number(node.dataset.rir); await DB.put('sets', last); await Store.reloadActiveSets(); }
      effortAsked.add(item.exerciseId);
      toast('Got it — I’ll use that next time', { ic: 'sparkle', ms: 1800 });
      return Nav.refresh();
    },
    'rest-add'() { if (rest) { rest.timer.add(15); rest.total += 15; rest.left += 15; paintRest(); } },
    'rest-skip'() { stopRest(); paintRest(); },
    async 'ex-info'() {
      const item = currentItem();
      if (!item) return;
      const ex = item.exercise;
      const { exerciseInfo } = await import('../data/info.js');
      const { diagramSetup } = await import('../art/figure.js');
      const key = diagramKeyFor(ex);
      const steps = key ? diagramSetup(key) : [];
      const info = exerciseInfo(ex) || {};
      sheet({
        title: ex.name,
        large: true,
        body: '<div class="exdetail-fig">' + (key ? figureAnim(key) : '') + '</div>' +
          (steps.length ? '<h3 class="sheet-h">How to do it</h3><ol class="steps">' + steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>' : '') +
          ((ex.cues || []).length ? '<h3 class="sheet-h">Tips</h3><ul class="cues">' + ex.cues.map((c) => '<li>' + icon('check', 16) + '<span>' + esc(c) + '</span></li>').join('') + '</ul>' : '') +
          (info.why ? '<h3 class="sheet-h">Why it’s in your plan</h3><p class="card why">' + esc(info.why) + '</p>' : '') +
          '<a class="btn btn-tinted btn-lg btn-full video-btn" href="' + esc(howToUrl(ex)) + '" target="_blank" rel="noopener noreferrer">' +
          icon('play', 18) + '<span>Watch a video demo</span></a>',
      });
    },
    async more() {
      const item = currentItem();
      const opts = [];
      if (item) opts.push({ id: 'swap', label: 'Swap this exercise' });
      opts.push({ id: 'add', label: 'Add an exercise' });
      if (item) opts.push({ id: 'video', label: 'Watch a video demo' });
      if (item && plan.items.length > 1) opts.push({ id: 'skip', label: 'Skip this exercise' });
      opts.push({ id: 'discard', label: 'Discard workout', danger: true });
      const pick = await actionSheet(item ? item.exercise.name : '', opts);
      if (pick === 'swap') return swapExercise();
      if (pick === 'add') return addExercise();
      if (pick === 'video' && item) { window.open(howToUrl(item.exercise), '_blank', 'noopener'); return; }
      if (pick === 'skip') { if (focus < plan.items.length - 1) focus++; stopRest(); return Nav.refresh(); }
      if (pick === 'discard') return discard();
    },
    'add-exercise'() { return addExercise(); },
    async end() {
      const sets = (Store.get('activeSets') || []).filter((s) => !s.isWarmup);
      if (!sets.length) {
        const ok = await confirmAlert('End without saving?', 'Nothing has been logged yet.', { ok: 'End Workout', danger: true });
        if (ok) return discard(true);
        return;
      }
      const ok = await confirmAlert('Finish this workout?', fmt.plural(sets.length, 'set') + ' logged. Great work!', { ok: 'Finish' });
      if (ok) return finish();
    },
    finish() { return finish(); },
    async 'share-done'() {
      const s = summary;
      const text = 'I just finished ' + (s.name || 'my workout') + ' with Lady_GYM: ' + fmt.mmss(s.seconds) + ', ' + s.sets + ' sets' +
        (s.prs.length ? ' and a new personal best on ' + s.prs[0].name : '') + '! 💪';
      try {
        if (navigator.share) await navigator.share({ text });
        else { await navigator.clipboard.writeText(text); toast('Copied — paste it anywhere'); }
      } catch (_) { /* she closed the share sheet */ }
    },
    async 'close-done'() {
      reset();
      await Nav.dismiss();
      return Nav.invalidate();
    },
  },
};

function scrollTop() {
  const top = Nav.top();
  if (top && top.scrollEl) top.scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ------------------------------------------------------------------ warm-up timing */

function startWarmTimer() {
  const it = warm.plan.items[warm.i];
  warm.left = it.seconds;
  warm.timer = new RestTimer({
    seconds: it.seconds,
    onTick: (left) => {
      if (!warm) return;
      warm.left = left;
      const t = document.getElementById('warm-time');
      if (t) t.textContent = fmt.mmss(left);
      const arc = document.querySelector('.pl-count .ring-arc');
      if (arc) {
        const r = parseFloat(arc.getAttribute('r'));
        const circ = Math.PI * 2 * r;
        arc.setAttribute('stroke-dasharray', (circ * (left / it.seconds)).toFixed(1) + ' ' + circ.toFixed(1));
        arc.style.animation = 'none';
      }
    },
    onDone: () => { if (warm) setTimeout(() => { if (warm) advanceWarm(); }, 900); },
  });
  warm.timer.start();
}

function stopWarm() {
  if (warm && warm.timer) { try { warm.timer.stop(); } catch (_) { /* stopped */ } }
  warm = null;
}

function advanceWarm() {
  if (!warm) return Nav.refresh();
  if (warm.timer) { try { warm.timer.stop(); } catch (_) { /* stopped */ } }
  if (warm.i >= warm.plan.items.length - 1) {
    stopWarm();
    view = 'active';
    toast('Warmed up! Let’s lift.', { ic: 'flame' });
    return Nav.refresh();
  }
  warm.i++;
  warm.timer = null;
  warm.left = null;
  return Nav.refresh();
}

/* ------------------------------------------------------------------ swap / add */

function pickerRows(list, action) {
  return list.map((ex) => '<button type="button" class="pick-row" data-action="' + action + '" data-eid="' + esc(ex.id) + '">' +
    exThumb(ex) + '<span class="pick-main"><span class="pick-name">' + esc(ex.name) + '</span>' +
    '<span class="pick-sub">' + esc((ex.equipment || []).filter((e) => e !== 'bodyweight').join(', ') || 'No equipment') + '</span></span></button>').join('');
}

function swapExercise() {
  const item = currentItem();
  if (!item) return;
  const alts = (item.exercise.swaps || []).map(byId).filter(Boolean);
  const h = sheet({
    title: 'Swap ' + item.exercise.name,
    large: true,
    body: (alts.length ? '<h3 class="sheet-h">Same muscles, different equipment</h3><div class="pick-list">' + pickerRows(alts, 'do-swap') + '</div>' : '') +
      '<h3 class="sheet-h">Or search everything</h3>' +
      '<label class="search">' + icon('search', 18) + '<input type="search" placeholder="Search exercises" data-action="pick-q"></label>' +
      '<div class="pick-list" id="pick-results"></div>',
    actions: {
      'pick-q'(n, d, hh) { hh.el.querySelector('#pick-results').innerHTML = pickerRows(searchExercises(n.value, {}).slice(0, 25), 'do-swap'); },
      async 'do-swap'(n) {
        const ex = byId(n.dataset.eid);
        if (!ex) return;
        const rep = itemFromExercise(ex);
        rep.sets = item.sets; rep.reps = item.reps;
        plan.items[focus] = rep;
        drafts.delete(item.exerciseId);
        closeSheet();
        await refreshTargets();
        toast('Swapped to ' + ex.name, { ic: 'swap' });
        return Nav.refresh();
      },
    },
  });
  return h;
}

function addExercise() {
  return sheet({
    title: 'Add an exercise',
    large: true,
    body: '<label class="search">' + icon('search', 18) + '<input type="search" placeholder="Search exercises" data-action="pick-q"></label>' +
      '<div class="pick-list" id="pick-results">' + pickerRows(searchExercises('', {}).filter((e) => diagramKeyFor(e)).slice(0, 30), 'do-add') + '</div>',
    actions: {
      'pick-q'(n, d, hh) { hh.el.querySelector('#pick-results').innerHTML = pickerRows(searchExercises(n.value, {}).slice(0, 25), 'do-add'); },
      async 'do-add'(n) {
        const ex = byId(n.dataset.eid);
        if (!ex) return;
        if (!plan) plan = { name: 'My workout', type: 'full', items: [] };
        plan.items.push(itemFromExercise(ex));
        focus = plan.items.length - 1;
        closeSheet();
        await refreshTargets();
        return Nav.refresh().then(scrollTop);
      },
    },
  });
}

/* ------------------------------------------------------------------ finish */

async function discard(skipConfirm) {
  if (!skipConfirm) {
    const ok = await confirmAlert('Discard this workout?', 'Sets you logged in it will be deleted.', { ok: 'Discard', danger: true });
    if (!ok) return;
  }
  const session = Store.get('activeSession');
  if (session) {
    for (const s of await DB.getSessionSets(session.id)) await DB.del('sets', s.id);
    await DB.del('sessions', session.id);
  }
  Store.set('activeSession', null);
  Store.set('activeSets', []);
  reset();
  await Nav.dismiss();
  return Nav.invalidate();
}

async function finish() {
  const session = Store.get('activeSession');
  if (!session) return;
  const sets = (Store.get('activeSets') || []).filter((s) => !s.isWarmup);
  if (!sets.length) return discard(true);
  session.complete = true;
  session.endedAt = new Date().toISOString();
  await DB.put('sessions', session);
  summary = await buildSummary(session, sets);
  Store.set('activeSession', null);
  Store.set('activeSets', []);
  stopRest();
  view = 'done';
  haptic();
  await Nav.refresh();
  confetti();
}

async function buildSummary(session, sets) {
  const seconds = Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 1000);
  const ids = [...new Set(sets.map((s) => s.exerciseId))];
  const shape = weeklyShapeMap([session], sets, [], Store.get('dials'));
  const moved = Object.values(shape.targets).filter((v) => v.done > 0).sort((a, b) => b.done - a.done)
    .slice(0, 4).map((v) => ({ label: v.label, sets: v.done }));
  const prs = [];
  for (const eid of ids) {
    const ex = byId(eid);
    if (!ex || ex.track !== 'weight_reps') continue;
    const mine = sets.filter((s) => s.exerciseId === eid && s.weight != null);
    if (!mine.length) continue;
    const best = mine.reduce((a, b) => ((estimate1RM(b.weight, b.reps) || 0) > (estimate1RM(a.weight, a.reps) || 0) ? b : a));
    const prior = ((await DB.getExerciseSets(eid)) || []).filter((s) => s.sessionId !== session.id && !s.isWarmup && s.weight != null);
    const priorBest = prior.reduce((m, s) => Math.max(m, estimate1RM(s.weight, s.reps) || 0), 0);
    if (prior.length && (estimate1RM(best.weight, best.reps) || 0) > priorBest) prs.push({ name: ex.name, weight: best.weight, reps: best.reps });
  }
  const volume = sets.reduce((m, s) => m + (s.weight || 0) * (s.reps || 0), 0);
  const name = (Store.get('profile') || {}).name || '';
  let line;
  if (prs.length) line = 'Stronger than ever on ' + prs[0].name + '. Amazing, ' + name + '!';
  else if (moved.length) line = 'Great session for your ' + moved.slice(0, 2).map((m) => m.label.toLowerCase()).join(' and ') + '. Showing up is what changes things.';
  else line = 'Logged and counted. Every session adds up.';
  return { name: session.name, seconds, sets: sets.length, exercises: ids.length, moved, prs, volume, line };
}
