// Daybreak — js/features/train.js — the session runner.
//
// This screen is used one-handed, at 5:40 AM, with sweaty hands and possibly no reading
// glasses. Every decision here bends toward one thing: logging a set should be ONE TAP.
// Numbers arrive pre-filled from what she did last time; she only touches them when
// something actually changed. Every set is written to IndexedDB the instant it is logged —
// nothing is batched, so closing the app mid-session can never lose work.

import { DB } from '../core/db.js';
import { Store } from '../core/store.js';
import { Router } from '../core/router.js';
import { byId, search as searchExercises } from '../data/exercises.js';
import { nextTarget, adjustForReadiness, estimate1RM } from '../engine/progression.js';
import { readinessScore, readinessAdvice } from '../engine/readiness.js';
import { planFor } from '../engine/sessionplan.js';
import { buildWeek } from '../engine/scheduler.js';
import { weeklyShapeMap } from '../engine/shapemap.js';
import { warmupFor, renderWarmup } from './warmup.js';
import { takeReadiness } from './today.js';
import { RestTimer } from '../ui/timer.js';
import { infoButton, infoActions } from '../ui/infosheet.js';
import { voiceSupported, listen, parseSet, describeSet } from '../ui/voice.js';
import { DIAGRAMS } from '../data/diagrams.js';
import { diagramKeyFor, howToUrl } from '../data/info.js';
 import { card, btn, sheet, closeSheet, toast, confirmDialog, fmt } from '../ui/components.js';

export const id = 'train';
export const title = 'Train';

// ------------------------------------------------------------- module state

let view = 'idle';              // idle | warmup | active | done
let focusIndex = 0;
let plan = null;                // resolved {name, type, items[]}
let targets = new Map();        // exerciseId -> progression target
let drafts = new Map();         // exerciseId -> {weight, reps, seconds, distance}
let setRowOpen = false;         // the steppers are opt-in; the compact bar is the default
let listening = false;          // mic state, so the button can show it
let stopListening = null;       // abort handle for an in-flight recognition
let timer = null;
let timerLeft = 0;
let restingFor = null;
let warmupTeardown = null;
let lastSummary = null;
let elapsedTicker = null;
let restDefault = 90;        // her setting from Me; the programme item overrides it per exercise

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function mondayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return DB.todayISO(dt);
}

function mmss(sec) {
  const s = Math.max(0, Math.round(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function elapsedOf(session) {
  if (!session || !session.startedAt) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000));
}

// --------------------------------------------------------------- scheduling

async function todaysScheduledSession(profile, dials) {
  const today = DB.todayISO();
  const classes = await DB.getAll('classes');
  const week = buildWeek(profile, classes || [], dials, mondayOf(today));
  const day = week.find((d) => d.date === today);
  return day && day.session ? day.session : null;
}

// ------------------------------------------------------------- set plumbing

function setsFor(exerciseId) {
  return (Store.get('activeSets') || [])
    .filter((s) => s.exerciseId === exerciseId && !s.isWarmup)
    .sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0));
}

function draftFor(item) {
  if (drafts.has(item.exerciseId)) return drafts.get(item.exerciseId);

  const t = targets.get(item.exerciseId);
  const logged = setsFor(item.exerciseId);
  const last = logged.length ? logged[logged.length - 1] : null;

  const d = {
    weight: last ? last.weight : (t && t.weight != null ? t.weight : null),
    reps: last ? last.reps : (t && t.reps != null ? t.reps : (item.reps ? item.reps[0] : 10)),
    seconds: last ? last.seconds : 30,
    distance: last && last.distance != null ? last.distance : null,
  };
  drafts.set(item.exerciseId, d);
  return d;
}

function stepFor(exercise) {
  const eq = exercise.equipment || [];
  if (eq.includes('dumbbell')) return 2.5;
  if (eq.includes('band') || eq.includes('bodyweight')) return 1;
  return 5;
}

// ----------------------------------------------------------- rest timer glue

function paintTimer() {
  const node = document.getElementById('rest-clock');
  if (node) node.textContent = mmss(timerLeft);
  const bar = document.getElementById('rest-fill');
  if (bar && timer && timer.total) {
    bar.style.width = Math.max(0, Math.min(100, (1 - timerLeft / timer.total) * 100)) + '%';
  }
}

function startRest(seconds, exerciseId) {
  stopRest();
  const total = Math.max(15, seconds || 90);
  restingFor = exerciseId;
  timerLeft = total;
  timer = new RestTimer({
    seconds: total,
    onTick: (left) => { timerLeft = left; paintTimer(); },
    onDone: () => {
      timerLeft = 0;
      restingFor = null;
      timer = null;
      const host = document.getElementById('rest-host');
      if (host) host.innerHTML = '<p class="rest-done">Rest is up. Go when you are ready.</p>';
    },
  });
  timer.total = total;
  timer.start();
  paintTimer();
}

function stopRest() {
  if (timer) { try { timer.stop(); } catch (_) { /* already stopped */ } }
  timer = null;
  restingFor = null;
  timerLeft = 0;
}

function restBlock(item) {
  if (!timer || restingFor !== item.exerciseId) return '';
  return (
    '<div class="rest-timer" id="rest-host">' +
      '<div class="rest-head"><span class="rest-label">Rest</span>' +
        '<span class="rest-clock num" id="rest-clock">' + mmss(timerLeft) + '</span></div>' +
      '<div class="rest-track"><span class="rest-fill" id="rest-fill"></span></div>' +
      '<div class="rest-actions">' +
        btn({ label: '−15s', action: 'rest-less', variant: 'ghost', size: 'md' }) +
        btn({ label: '+15s', action: 'rest-more', variant: 'ghost', size: 'md' }) +
        btn({ label: 'Skip rest', action: 'rest-skip', variant: 'ghost', size: 'md' }) +
      '</div>' +
    '</div>'
  );
}

// ------------------------------------------------------------- the set row

function stepper(label, action, value, unit, id) {
  return (
    '<div class="set-field">' +
      '<span class="set-field-label">' + esc(label) + '</span>' +
      '<div class="stepper">' +
        '<button type="button" class="stepper-btn" data-action="' + action + '-down" ' +
          'aria-label="Decrease ' + esc(label) + '">−</button>' +
        // data-on="input" so the value commits as she types. Without it the Router waits for
        // `change`, and whether that lands before the log tap depends on blur ordering.
        '<input class="stepper-input num" type="number" inputmode="decimal" id="' + id + '" ' +
          'data-action="' + action + '-set" data-on="input" ' +
          'value="' + (value == null ? '' : esc(value)) + '" ' +
          'aria-label="' + esc(label) + '">' +
        '<button type="button" class="stepper-btn" data-action="' + action + '-up" ' +
          'aria-label="Increase ' + esc(label) + '">+</button>' +
      '</div>' +
      (unit ? '<span class="set-field-unit">' + esc(unit) + '</span>' : '') +
    '</div>'
  );
}

function logButton() {
  return (
    '<button type="button" class="set-log" data-action="log-set" aria-label="Log this set">' +
      '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" ' +
        'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 12.5l5.5 5.5L20 7"/></svg>' +
    '</button>'
  );
}

/** The microphone. Absent entirely on a browser that cannot listen, rather than dead. */
function micButton() {
  if (!voiceSupported()) return '';
  return (
    '<button type="button" class="set-mic' + (listening ? ' is-listening' : '') + '" ' +
      'data-action="set-voice" aria-label="Say the set out loud">' +
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="9" y="2.5" width="6" height="11" rx="3"/>' +
        '<path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>' +
    '</button>'
  );
}

/** What the draft currently says, in one short line, for the collapsed bar. */
function draftSummary(item) {
  const d = draftFor(item);
  const track = item.exercise.track;
  if (track === 'weight_reps') {
    return (d.weight == null ? '—' : fmt.num(d.weight) + ' lb') +
      ' <span class="set-bar-x">×</span> ' + (d.reps == null ? '—' : d.reps);
  }
  if (track === 'time_hold') return (d.seconds == null ? '—' : d.seconds + ' sec');
  if (track === 'time_distance') {
    return (d.seconds ? Math.round(d.seconds / 60) + ' min' : '—') +
      (d.distance ? ' · ' + fmt.num(d.distance) + ' mi' : '');
  }
  return (d.reps == null ? '—' : d.reps + ' reps');
}

function inputRow(item) {
  const d = draftFor(item);
  const track = item.exercise.track;

  // Collapsed is the default, and it is the whole point. Expanded, this row is 187px of
  // steppers pinned over the movement she is trying to look at — she reported it as
  // "weight and reps is in the way". Collapsed it is one 64px line: the numbers, the
  // microphone, and the tick. Tap the numbers to get the steppers back.
  if (!setRowOpen) {
    return (
      '<div class="set-row set-row-compact">' +
        '<button type="button" class="set-bar" data-action="set-expand" ' +
          'aria-expanded="false" aria-label="Change the weight or reps">' +
          '<span class="set-bar-val num">' + draftSummary(item) + '</span>' +
          '<span class="set-bar-hint">tap to change</span>' +
        '</button>' +
        micButton() +
        logButton() +
      '</div>'
    );
  }

  let fields = '';
  if (track === 'weight_reps') {
    fields = stepper('Weight', 'weight', d.weight, 'lb', 'f-weight') +
             stepper('Reps', 'reps', d.reps, '', 'f-reps');
  } else if (track === 'bodyweight_reps' || track === 'reps_only') {
    fields = stepper('Reps', 'reps', d.reps, '', 'f-reps');
  } else if (track === 'time_hold') {
    fields = stepper('Hold', 'seconds', d.seconds, 'sec', 'f-seconds');
  } else if (track === 'time_distance') {
    fields = stepper('Minutes', 'minutes', d.seconds ? Math.round(d.seconds / 60) : null, 'min', 'f-min') +
             stepper('Distance', 'distance', d.distance, 'mi', 'f-dist');
  } else {
    fields = stepper('Reps', 'reps', d.reps, '', 'f-reps');
  }

  return '<div class="set-row set-row-open' +
      (fields.split('set-field').length - 1 === 1 ? ' one-field' : '') + '">' +
    '<button type="button" class="set-collapse" data-action="set-expand" aria-expanded="true" ' +
      'aria-label="Hide the steppers">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
        'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M6 9l6 6 6-6"/></svg>' +
    '</button>' +
    fields + micButton() + logButton() + '</div>';
}

function loggedRows(item) {
  const rows = setsFor(item.exerciseId);
  if (!rows.length) return '';
  const track = item.exercise.track;

  const body = rows.map((s, i) => {
    let val;
    if (track === 'weight_reps') val = fmt.num(s.weight) + ' lb × ' + s.reps;
    else if (track === 'time_hold') val = s.seconds + ' sec';
    else if (track === 'time_distance') {
      val = (s.seconds ? Math.round(s.seconds / 60) + ' min' : '') +
            (s.distance ? ' · ' + fmt.num(s.distance) + ' mi' : '');
    } else val = s.reps + ' reps';

    return '<button type="button" class="logged-set" data-action="edit-set" data-set="' + esc(s.id) + '">' +
      '<span class="logged-num num">' + (i + 1) + '</span>' +
      '<span class="logged-val num">' + esc(val) + '</span>' +
      '<span class="logged-edit" aria-hidden="true">Edit</span>' +
    '</button>';
  }).join('');

  return '<div class="logged-list">' + body + '</div>';
}

// ------------------------------------------------------------ exercise card

function diagramThumb(ex) {
  const key = diagramKeyFor(ex);
  const d = key && DIAGRAMS[key];
  if (!d || !d.svg) return '';
  return '<button type="button" class="ex-thumb" data-action="show-info" data-kind="exercise" ' +
    'data-id="' + esc(ex.id) + '" aria-label="See how to do ' + esc(ex.name) + '">' + d.svg + '</button>';
}

function exerciseCard(item) {
  const ex = item.exercise;
  const t = targets.get(item.exerciseId);
  const done = setsFor(item.exerciseId).length;
  const breath = (ex.cues || []).find((c) => /exhale|breath/i.test(c));
  const showCues = item.tier <= 2;

  let targetLine = '';
  if (t) {
    const parts = [];
    if (t.weight != null) parts.push(fmt.num(t.weight) + ' lb');
    if (t.reps != null) parts.push(t.reps + ' reps');
    parts.push(item.sets + ' sets');
    if (t.rir != null) parts.push('leave ' + t.rir + ' in the tank');
    targetLine = '<p class="exercise-target">' + esc(parts.join(' · ')) + '</p>';
  }

  return (
    '<article class="exercise-card">' +
      '<header class="exercise-head">' +
        '<div>' +
          '<h2 class="exercise-name display">' + esc(ex.name) + '</h2>' +
          '<p class="exercise-meta">' + esc(item.sets + ' × ' + item.reps[0] + '–' + item.reps[1]) +
            ' · ' + esc(done + ' logged') + '</p>' +
        '</div>' +
        '<div class="exercise-actions">' +
          infoButton('exercise', ex.id, ex.name) +
          '<button type="button" class="exercise-swap" data-action="swap">Swap</button>' +
        '</div>' +
      '</header>' +

      // The picture of the movement, on the card itself. Mid-session is exactly when
      // "what does this actually look like" matters, and the info sheet is one tap too far.
      diagramThumb(ex) +
      targetLine +
      (t && t.message ? '<p class="exercise-why">' + esc(t.message) + '</p>' : '') +
      (item.note ? '<p class="exercise-note">' + esc(item.note) + '</p>' : '') +

      (showCues && breath
        ? '<p class="cue cue-breath"><strong>Breathe:</strong> ' + esc(breath) + '</p>' : '') +
      (showCues && (ex.cues || []).length > 1
        ? '<ul class="exercise-cues">' + ex.cues.filter((c) => c !== breath)
            .map((c) => '<li class="cue">' + esc(c) + '</li>').join('') + '</ul>' : '') +

      loggedRows(item) +
      restBlock(item) +

      '<div class="exercise-foot">' +
        '<a class="link-quiet" href="' + esc(howToUrl(ex) || '#') + '" target="_blank" rel="noopener noreferrer">Watch how</a>' +
        '<button type="button" class="link-quiet" data-action="add-exercise">Add an exercise</button>' +
        '<button type="button" class="link-quiet" data-action="next-exercise">Skip this one</button>' +
      '</div>' +

      // The set row goes LAST and is pinned to the bottom of the scroll area. At a large system
      // font everything above it can easily run past the fold, and the one control that must
      // never be hunted for is the one that logs the set.
      inputRow(item) +
    '</article>'
  );
}

// ------------------------------------------------------------------- views

function idleView(session, resolved) {
  if (!session) {
    return '<div class="train">' + card({
      tone: 'calm',
      title: 'Nothing scheduled today',
      body: '<p class="lede">Rest is doing real work. But if you want to move, start something here.</p>',
      footer:
        btn({ label: 'Start an empty session', action: 'start-empty', variant: 'primary', size: 'lg', full: true }) +
        btn({ label: 'Pick a session', action: 'pick-session', variant: 'ghost', size: 'md', full: true }),
    }) + '</div>';
  }

  const list = resolved.items.map((it) => (
    '<li class="plan-item">' +
      '<span class="plan-name">' + esc(it.exercise.name) + '</span>' +
      '<span class="plan-scheme num">' + it.sets + ' × ' + it.reps[0] + '–' + it.reps[1] + '</span>' +
      infoButton('exercise', it.exercise.id, it.exercise.name) +
    '</li>'
  )).join('');

  // "0 exercises" is a nonsense subtitle for a sprint or a walk — those are not exercise lists.
  const countLabel = resolved.items.length
    ? resolved.items.length + ' exercise' + (resolved.items.length === 1 ? '' : 's')
    : (session.type === 'conditioning' ? 'Intervals'
      : session.type === 'recovery' ? 'Easy movement'
      : 'Build it as you go');

  return '<div class="train">' + card({
    tone: 'accent',
    title: resolved.name,
    subtitle: (resolved.estMinutes ? '~' + resolved.estMinutes + ' min · ' : '') + countLabel,
    body:
      (resolved.note ? '<p class="lede">' + esc(resolved.note) + '</p>' : '') +
      (list ? '<ul class="plan-list">' + list + '</ul>' : ''),
    footer: btn({ label: 'Start warm-up', action: 'start-warmup', variant: 'primary', size: 'lg', full: true }),
  }) +
  '<div class="train-alt">' +
    btn({ label: 'Skip the warm-up', action: 'start-session', variant: 'ghost', size: 'md', full: true }) +
    btn({ label: 'Pick a different session', action: 'pick-session', variant: 'ghost', size: 'md', full: true }) +
    btn({ label: 'Start an empty session', action: 'start-empty', variant: 'ghost', size: 'md', full: true }) +
  '</div></div>';
}

function activeView(session) {
  if (!plan || !plan.items.length) {
    return '<div class="train">' + card({
      title: 'Empty session',
      body: '<p class="lede">Add the first exercise and start logging.</p>',
      footer: btn({ label: 'Add an exercise', action: 'add-exercise', variant: 'primary', size: 'lg', full: true }),
    }) +
    btn({ label: 'Finish', action: 'finish', variant: 'ghost', size: 'md', full: true }) + '</div>';
  }

  const i = Math.min(focusIndex, plan.items.length - 1);
  const item = plan.items[i];
  const totalSets = (Store.get('activeSets') || []).filter((s) => !s.isWarmup).length;

  return (
    '<div class="train is-active">' +
      '<header class="session-bar">' +
        '<div class="session-bar-main">' +
          '<span class="session-bar-name">' + esc(plan.name) + '</span>' +
          '<span class="session-bar-meta num" id="session-elapsed">' + mmss(elapsedOf(session)) +
            ' · ' + totalSets + ' sets</span>' +
        '</div>' +
        '<button type="button" class="btn btn-ghost btn-md" data-action="finish">Finish</button>' +
      '</header>' +

      '<nav class="exercise-nav">' +
        '<button type="button" class="exercise-step" data-action="prev-exercise" ' +
          (i === 0 ? 'disabled ' : '') + 'aria-label="Previous exercise">‹</button>' +
        '<span class="exercise-pos num">' + (i + 1) + ' of ' + plan.items.length + '</span>' +
        '<button type="button" class="exercise-step" data-action="next-exercise" ' +
          (i === plan.items.length - 1 ? 'disabled ' : '') + 'aria-label="Next exercise">›</button>' +
      '</nav>' +

      exerciseCard(item) +
    '</div>'
  );
}

function doneView() {
  const s = lastSummary;
  if (!s) return '<div class="train"></div>';

  const moved = s.moved.length
    ? '<div class="chip-row">' + s.moved.map((m) =>
        '<span class="chip chip-quiet">' + esc(m.label) + ' +' + fmt.num(m.sets) + '</span>').join('') + '</div>'
    : '';

  const prs = s.prs.length
    ? '<ul class="pr-list">' + s.prs.map((p) =>
        '<li><strong>' + esc(p.name) + '</strong> — ' + esc(fmt.lb(p.weight)) + ' × ' + p.reps + '</li>').join('') + '</ul>'
    : '';

  return '<div class="train">' + card({
    tone: 'win',
    title: 'Done.',
    subtitle: mmss(s.seconds) + ' · ' + s.sets + ' sets · ' + s.exercises + ' exercises',
    body:
      '<p class="lede">' + esc(s.line) + '</p>' +
      (prs ? '<h3 class="section-label">New best</h3>' + prs : '') +
      (moved ? '<h3 class="section-label">Shape Map moved</h3>' + moved : '') +
      '<p class="muted">Protein in the next hour — 25 to 30 grams. It matters more right after ' +
      'you train than at any other point in the day.</p>',
    footer:
      btn({ label: 'Back to Today', action: 'go-today', variant: 'primary', size: 'lg', full: true }) +
      btn({ label: 'See the Shape Map', action: 'go-shape', variant: 'ghost', size: 'md', full: true }),
  }) + '</div>';
}

// -------------------------------------------------------------------- render

export async function render(el) {
  const profile = Store.get('profile') || await DB.getProfile();
  const dials = Store.get('dials');
  if (!profile || !profile.name) { el.innerHTML = ''; return; }

  if (elapsedTicker) { clearInterval(elapsedTicker); elapsedTicker = null; }
  restDefault = (await DB.getPref('rest:default', 90)) || 90;

  const session = Store.get('activeSession');
  const open = session && !session.complete;

  if (view === 'done') { el.innerHTML = doneView(); return; }

  if (view === 'warmup') {
    const scheduled = await todaysScheduledSession(profile, dials);
    const wPlan = warmupFor(dials, scheduled ? scheduled.type : 'lower');
    if (warmupTeardown) { warmupTeardown(); warmupTeardown = null; }
    warmupTeardown = renderWarmup(el, wPlan, () => { actions['start-session'](); });
    return;
  }

  if (open) {
    view = 'active';
    if (!plan) plan = await resolvePlanForSession(profile, session);
    await refreshTargets(dials);
    el.innerHTML = activeView(session);

    elapsedTicker = setInterval(() => {
      const node = document.getElementById('session-elapsed');
      if (!node) { clearInterval(elapsedTicker); elapsedTicker = null; return; }
      const total = (Store.get('activeSets') || []).filter((s) => !s.isWarmup).length;
      node.textContent = mmss(elapsedOf(session)) + ' · ' + total + ' sets';
    }, 1000);
    return;
  }

  view = 'idle';
  const scheduled = await todaysScheduledSession(profile, dials);
  const resolved = scheduled ? planFor(profile, scheduled) : null;
  el.innerHTML = idleView(scheduled, resolved || { items: [], name: '', estMinutes: 0 });
}

async function resolvePlanForSession(profile, session) {
  if (session.programDayKey) {
    const p = planFor(profile, {
      programDayKey: session.programDayKey,
      blockSize: session.blockSize,
      type: session.type,
      name: session.name,
      estMinutes: session.estMinutes,
    });
    if (p.items.length) return p;
  }
  // Empty or ad-hoc session: rebuild the item list from whatever has been logged.
  const logged = await DB.getSessionSets(session.id);
  const seen = [];
  for (const s of logged) {
    if (!seen.includes(s.exerciseId)) seen.push(s.exerciseId);
  }
  return {
    name: session.name || 'Session',
    type: session.type || 'lower',
    blockSize: session.blockSize || 'full',
    estMinutes: session.estMinutes || 0,
    note: null,
    focus: [],
    items: seen.map((eid) => itemFromExercise(byId(eid))).filter(Boolean),
  };
}

function itemFromExercise(ex) {
  if (!ex) return null;
  const reps = ex.defaultReps || [8, 12];
  return {
    exerciseId: ex.id, exercise: ex, sets: 3, reps,
    rir: null, tier: ex.tier || 3,
    restSec: ex.tier === 1 ? 150 : 90, note: null,
  };
}

async function refreshTargets(dials) {
  targets = new Map();
  const session = Store.get('activeSession');
  const readiness = session && session.readiness ? readinessAdvice(readinessScore(session.readiness)) : null;

  for (const item of plan.items) {
    const history = await DB.getExerciseSets(item.exerciseId);
    const prior = (history || []).filter((s) => s.sessionId !== (session && session.id) && !s.isWarmup);
    let t = nextTarget(prior, item.exercise, { ...dials, topSetReps: item.reps });
    if (readiness) t = adjustForReadiness(t, readiness);
    targets.set(item.exerciseId, t);
  }
}

// ------------------------------------------------------------------- actions

function currentItem() {
  if (!plan || !plan.items.length) return null;
  return plan.items[Math.min(focusIndex, plan.items.length - 1)];
}

function bump(field, delta) {
  const item = currentItem();
  if (!item) return;
  const d = draftFor(item);
  const step = field === 'weight' ? stepFor(item.exercise)
    : field === 'seconds' ? 5
    : field === 'minutes' ? 1
    : field === 'distance' ? 0.1 : 1;
  const base = field === 'minutes' ? (d.seconds ? d.seconds / 60 : 0) : (d[field] || 0);
  let next = Math.round((base + delta * step) * 100) / 100;
  if (next < 0) next = 0;
  if (field === 'minutes') d.seconds = next * 60; else d[field] = next;
  return Router.refresh();
}

function setField(field, raw) {
  const item = currentItem();
  if (!item) return;
  const d = draftFor(item);
  const n = parseFloat(raw);
  const v = Number.isFinite(n) ? n : null;
  if (field === 'minutes') d.seconds = v == null ? null : v * 60; else d[field] = v;
}

export const actions = {
  ...infoActions,

  'go-today': () => { view = 'idle'; lastSummary = null; return Router.go('today'); },
  'go-shape': () => { view = 'idle'; lastSummary = null; return Router.go('shape'); },

  'start-warmup'() { view = 'warmup'; return Router.refresh(); },

  async 'start-session'() {
    const profile = Store.get('profile');
    const dials = Store.get('dials');
    const scheduled = await todaysScheduledSession(profile, dials);
    await createSession(profile, scheduled);
  },

  async 'start-empty'() {
    const profile = Store.get('profile');
    await createSession(profile, null);
  },

  async 'pick-session'() {
    const profile = Store.get('profile');
    const { programOf } = await import('../engine/sessionplan.js');
    const program = programOf(profile);
    const body = (program.days || []).map((d) =>
      '<button type="button" class="option-row" data-action="pick-day" data-key="' + esc(d.key) + '">' +
        '<span class="option-row-main"><span class="option-row-label">' + esc(d.name) + '</span>' +
        '<span class="option-row-note">' + esc(d.description || '') + '</span></span></button>'
    ).join('');
    sheet('Pick a session', '<div class="option-list">' + body + '</div>', {
      actions: {
        async 'pick-day'(node) {
          const key = node.dataset.key;
          const day = program.days.find((x) => x.key === key);
          closeSheet();
          await createSession(profile, {
            programDayKey: key, name: day.name, type: day.type,
            blockSize: 'full', estMinutes: day.estMinutes, focus: day.focus,
          });
        },
      },
    });
  },

  'prev-exercise'() { if (focusIndex > 0) { focusIndex--; stopRest(); } return Router.refresh(); },
  'next-exercise'() {
    if (plan && focusIndex < plan.items.length - 1) { focusIndex++; stopRest(); }
    return Router.refresh();
  },

  'set-expand'() {
    setRowOpen = !setRowOpen;
    return Router.refresh();
  },

  // Speak the set. Fills the draft and shows what was heard; logging stays one deliberate
  // tap away, because a misheard "fifty" for "fifteen" must never write itself to history.
  'set-voice'() {
    const item = currentItem();
    if (!item) return;

    if (listening) {
      if (stopListening) stopListening();
      listening = false;
      return Router.refresh();
    }

    const track = item.exercise.track;
    listening = true;
    Router.refresh();

    stopListening = listen({
      onResult(best, alts) {
        // Take the first alternative that parses to anything usable.
        let parsed = null;
        for (const a of (alts && alts.length ? alts : [best])) {
          parsed = parseSet(a, track);
          if (parsed) break;
        }
        if (!parsed) {
          toast('Heard "' + String(best).slice(0, 40) + '" — try "one sixty five by five".', 'signal');
          return;
        }
        const d = draftFor(item);
        if (parsed.weight != null) d.weight = parsed.weight;
        if (parsed.reps != null) d.reps = parsed.reps;
        if (parsed.seconds != null) d.seconds = parsed.seconds;
        if (parsed.distance != null) d.distance = parsed.distance;
        toast(describeSet(parsed) + ' — tap the tick to log it.', 'accent');
      },
      onState(state, detail) {
        if (state === 'listening') return;
        listening = false;
        stopListening = null;
        if (state === 'error' && detail) toast(detail, 'signal');
        Router.refresh();
      },
    });
  },

  'weight-up': () => bump('weight', 1),
  'weight-down': () => bump('weight', -1),
  'weight-set': (n) => setField('weight', n.value),
  'reps-up': () => bump('reps', 1),
  'reps-down': () => bump('reps', -1),
  'reps-set': (n) => setField('reps', n.value),
  'seconds-up': () => bump('seconds', 1),
  'seconds-down': () => bump('seconds', -1),
  'seconds-set': (n) => setField('seconds', n.value),
  'minutes-up': () => bump('minutes', 1),
  'minutes-down': () => bump('minutes', -1),
  'minutes-set': (n) => setField('minutes', n.value),
  'distance-up': () => bump('distance', 1),
  'distance-down': () => bump('distance', -1),
  'distance-set': (n) => setField('distance', n.value),

  'rest-less'() { if (timer) { timer.add(-15); timerLeft = Math.max(0, timerLeft - 15); paintTimer(); } },
  'rest-more'() { if (timer) { timer.add(15); timerLeft += 15; paintTimer(); } },
  'rest-skip'() { stopRest(); return Router.refresh(); },

  async 'log-set'() {
    const item = currentItem();
    const session = Store.get('activeSession');
    if (!item || !session) return;

    const d = draftFor(item);
    const track = item.exercise.track;

    if (track === 'weight_reps' && (d.weight == null || !d.reps)) {
      toast('Add a weight and reps first.', 'signal'); return;
    }
    if ((track === 'bodyweight_reps' || track === 'reps_only') && !d.reps) {
      toast('How many reps?', 'signal'); return;
    }
    if (track === 'time_hold' && !d.seconds) { toast('How long did you hold it?', 'signal'); return; }

    const existing = setsFor(item.exerciseId);
    const record = {
      id: DB.uid(),
      sessionId: session.id,
      exerciseId: item.exerciseId,
      setNumber: existing.length + 1,
      weight: track === 'weight_reps' ? d.weight : null,
      reps: (track === 'weight_reps' || track === 'bodyweight_reps' || track === 'reps_only') ? d.reps : null,
      seconds: (track === 'time_hold' || track === 'time_distance') ? d.seconds : null,
      distance: track === 'time_distance' ? d.distance : null,
      rir: null,
      isWarmup: false,
      loggedAt: new Date().toISOString(),
    };

    await DB.put('sets', record);          // written immediately — never batched
    await Store.reloadActiveSets();

    if (navigator.vibrate) { try { navigator.vibrate(30); } catch (_) { /* unsupported */ } }
    startRest(item.restSec || restDefault, item.exerciseId);

    // Last planned set of this exercise → ask for effort, once.
    if (existing.length + 1 >= item.sets) askEffort(item);

    return Router.refresh();
  },

  async 'edit-set'(node) {
    const setId = node.dataset.set;
    const record = await DB.get('sets', setId);
    if (!record) return;
    const ex = byId(record.exerciseId);
    const body =
      '<p class="lede">' + esc(ex ? ex.name : 'Set') + ' · set ' + record.setNumber + '</p>' +
      '<div class="sheet-fields">' +
        (record.weight != null
          ? '<div class="field"><label class="field-label" for="e-w">Weight (lb)</label>' +
            '<input class="input num" id="e-w" type="number" inputmode="decimal" value="' + record.weight + '"></div>' : '') +
        (record.reps != null
          ? '<div class="field"><label class="field-label" for="e-r">Reps</label>' +
            '<input class="input num" id="e-r" type="number" inputmode="numeric" value="' + record.reps + '"></div>' : '') +
        (record.seconds != null
          ? '<div class="field"><label class="field-label" for="e-s">Seconds</label>' +
            '<input class="input num" id="e-s" type="number" inputmode="numeric" value="' + record.seconds + '"></div>' : '') +
      '</div>' +
      btn({ label: 'Save', action: 'save-set', variant: 'primary', size: 'lg', full: true }) +
      btn({ label: 'Delete this set', action: 'delete-set', variant: 'danger', size: 'md', full: true });

    sheet('Edit set', body, {
      actions: {
        async 'save-set'() {
          const w = document.getElementById('e-w');
          const r = document.getElementById('e-r');
          const s = document.getElementById('e-s');
          if (w) record.weight = parseFloat(w.value);
          if (r) record.reps = parseInt(r.value, 10);
          if (s) record.seconds = parseInt(s.value, 10);
          await DB.put('sets', record);
          await Store.reloadActiveSets();
          closeSheet();
          Router.refresh();
        },
        async 'delete-set'() {
          await DB.del('sets', setId);
          await Store.reloadActiveSets();
          closeSheet();
          toast('Set removed.');
          Router.refresh();
        },
      },
    });
  },

  async swap() {
    const item = currentItem();
    if (!item) return;
    const alternatives = (item.exercise.swaps || []).map(byId).filter(Boolean);

    const rows = (list) => list.map((ex) =>
      '<button type="button" class="option-row" data-action="do-swap" data-eid="' + esc(ex.id) + '">' +
        '<span class="option-row-main"><span class="option-row-label">' + esc(ex.name) + '</span>' +
        '<span class="option-row-note">' + esc((ex.equipment || []).join(', ')) + '</span></span>' +
      '</button>').join('');

    sheet('Swap ' + item.exercise.name,
      (alternatives.length
        ? '<h3 class="section-label">Same job, different tool</h3><div class="option-list">' +
          rows(alternatives) + '</div>' : '') +
      '<h3 class="section-label">Or search everything</h3>' +
      '<input class="input" type="search" id="swap-q" placeholder="Search exercises">' +
      '<div class="option-list" id="swap-results"></div>',
      {
        actions: {
          'do-swap'(node) {
            const ex = byId(node.dataset.eid);
            if (!ex) return;
            const replacement = itemFromExercise(ex);
            replacement.sets = item.sets;
            replacement.reps = item.reps;
            plan.items[focusIndex] = replacement;
            drafts.delete(item.exerciseId);
            closeSheet();
            refreshTargets(Store.get('dials')).then(() => Router.refresh());
          },
        },
      });
    wireSearch('swap-q', 'swap-results', rows);
  },

  'add-exercise'() {
    const rows = (list) => list.map((ex) =>
      '<button type="button" class="option-row" data-action="do-add" data-eid="' + esc(ex.id) + '">' +
        '<span class="option-row-main"><span class="option-row-label">' + esc(ex.name) + '</span>' +
        '<span class="option-row-note">' + esc((ex.primary || []).join(', ')) + '</span></span>' +
      '</button>').join('');

    sheet('Add an exercise',
      '<input class="input" type="search" id="add-q" placeholder="Search exercises">' +
      '<div class="option-list" id="add-results">' + rows(searchExercises('', {}).slice(0, 20)) + '</div>',
      {
        actions: {
          'do-add'(node) {
            const ex = byId(node.dataset.eid);
            if (!ex) return;
            const item = itemFromExercise(ex);
            if (!plan) plan = { name: 'Session', items: [], type: 'lower', blockSize: 'full' };
            plan.items.push(item);
            focusIndex = plan.items.length - 1;
            closeSheet();
            refreshTargets(Store.get('dials')).then(() => Router.refresh());
          },
        },
      });
    wireSearch('add-q', 'add-results', rows);
  },

  async finish() {
    const session = Store.get('activeSession');
    if (!session) return;
    const sets = (Store.get('activeSets') || []).filter((s) => !s.isWarmup);

    if (!sets.length) {
      const drop = await confirmDialog('Nothing logged yet. Discard this session?', {
        confirmLabel: 'Discard', danger: true,
      });
      if (!drop) return;
      await DB.del('sessions', session.id);
      Store.set('activeSession', null);
      Store.set('activeSets', []);
      stopRest();
      plan = null; drafts.clear(); focusIndex = 0; view = 'idle';
      return Router.go('today');
    }

    session.complete = true;
    session.endedAt = new Date().toISOString();
    await DB.put('sessions', session);

    lastSummary = await buildSummary(session, sets);

    Store.set('activeSession', null);
    Store.set('activeSets', []);
    stopRest();
    plan = null; drafts.clear(); targets.clear(); focusIndex = 0;
    view = 'done';
    return Router.refresh();
  },
};

// ------------------------------------------------------------------ helpers

/**
 * Sheets delegate clicks only, so a live search box inside one needs its own listener.
 * Called right after sheet() so the node exists.
 */
function wireSearch(inputId, resultsId, renderRows) {
  const input = document.getElementById(inputId);
  const host = document.getElementById(resultsId);
  if (!input || !host) return;
  input.addEventListener('input', () => {
    host.innerHTML = renderRows(searchExercises(input.value, {}).slice(0, 25));
  });
}

async function createSession(profile, scheduled) {
  const readiness = takeReadiness();
  const session = {
    id: DB.uid(),
    date: DB.todayISO(),
    startedAt: new Date().toISOString(),
    endedAt: null,
    type: scheduled ? scheduled.type : 'lower',
    name: scheduled ? scheduled.name : 'Free session',
    programDayKey: scheduled ? scheduled.programDayKey : null,
    blockSize: scheduled ? scheduled.blockSize : 'full',
    estMinutes: scheduled ? scheduled.estMinutes : 0,
    classId: null,
    readiness,
    notes: '',
    complete: false,
  };
  await DB.put('sessions', session);
  Store.set('activeSession', session);
  Store.set('activeSets', []);

  plan = await resolvePlanForSession(profile, session);
  drafts.clear();
  focusIndex = 0;
  view = 'active';

  if (readiness) {
    const advice = readinessAdvice(readinessScore(readiness));
    if (advice.band !== 'good') toast(advice.message, advice.band === 'poor' ? 'signal' : 'accent');
  }
  return Router.refresh();
}

function askEffort(item) {
  let buttons = '';
  for (let n = 1; n <= 5; n++) {
    buttons += '<button type="button" class="scale-dot" data-action="effort" data-value="' + n + '">' + n + '</button>';
  }
  sheet('How hard was that?',
    '<p class="lede">Last set of ' + esc(item.exercise.name) + '.</p>' +
    '<div class="scale-dots">' + buttons + '</div>' +
    '<div class="scale-ends"><span>Easy — plenty left</span><span>All out</span></div>',
    {
      actions: {
        async effort(node) {
          const rir = Math.max(0, 5 - parseInt(node.dataset.value, 10));
          const rows = setsFor(item.exerciseId);
          const last = rows[rows.length - 1];
          if (last) { last.rir = rir; await DB.put('sets', last); await Store.reloadActiveSets(); }
          closeSheet();
        },
      },
    });
}

async function buildSummary(session, sets) {
  const seconds = session.endedAt && session.startedAt
    ? Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 1000) : 0;

  const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))];
  const dials = Store.get('dials');
  const shape = weeklyShapeMap([session], sets, [], dials);
  const moved = Object.entries(shape.targets)
    .filter(([, v]) => v.done > 0)
    .sort((a, b) => b[1].done - a[1].done)
    .slice(0, 4)
    .map(([, v]) => ({ label: v.label, sets: v.done }));

  // A PR is a heavier top set than anything logged for that lift before today.
  const prs = [];
  for (const eid of exerciseIds) {
    const ex = byId(eid);
    if (!ex || ex.track !== 'weight_reps') continue;
    const mine = sets.filter((s) => s.exerciseId === eid && s.weight != null);
    if (!mine.length) continue;
    const best = mine.reduce((a, b) => (estimate1RM(b.weight, b.reps) || 0) > (estimate1RM(a.weight, a.reps) || 0) ? b : a);
    const all = await DB.getExerciseSets(eid);
    const prior = (all || []).filter((s) => s.sessionId !== session.id && !s.isWarmup && s.weight != null);
    const priorBest = prior.reduce((m, s) => Math.max(m, estimate1RM(s.weight, s.reps) || 0), 0);
    if (prior.length && (estimate1RM(best.weight, best.reps) || 0) > priorBest) {
      prs.push({ name: ex.name, weight: best.weight, reps: best.reps });
    }
  }

  let line;
  if (prs.length) line = 'You went heavier than you ever have on ' + prs[0].name + '. That is the whole point.';
  else if (moved.length) line = moved[0].label.toLowerCase() + ' took ' + fmt.num(moved[0].sets) + ' sets today. Consistency is what moves it.';
  else line = 'Logged. Showing up on the days you do not feel like it is most of the game.';

  return { seconds, sets: sets.length, exercises: exerciseIds.length, moved, prs, line };
}
