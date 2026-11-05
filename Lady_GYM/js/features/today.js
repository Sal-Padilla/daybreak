// Lady_GYM — js/features/today.js — the first screen: today's picture, one big button, the week at a glance.
//
// Daybreak's Today was 252 words over four screens of scrolling. This one answers three
// things before the first scroll: what am I doing, how do I start it, how is my week going.
// Everything else is one tap further, not on the page.

import { DB } from '../core/db.js';
import { Store } from '../core/store.js';
import { Nav } from '../core/nav.js';
import { readinessScore, readinessAdvice } from '../engine/readiness.js';
import { classById } from '../data/classes.js';
import { workoutArt, classArt, restArt, workoutTheme, classTheme, themeBg, THEMES } from '../art/scenes.js';
import { icon, tile } from '../ui/icons.js';
import { rings } from '../ui/rings.js';
import { esc, fmt, toast, sheet, closeSheet, haptic, button, confetti } from '../ui/kit.js';
import {
  weekContext, resolvePlan, heroKeyFor, greeting, avatarButton, typeLabel, focusChips, minutesOf,
  PILLAR_COLOR, PILLAR_LABEL, TYPE_COLOR,
} from './shared.js';
import { installCard } from './install.js';

/* ------------------------------------------------------------------ readiness (3 taps) */

const FACES = ['😣', '😕', '😐', '🙂', '😊'];
const QUESTIONS = [
  { key: 'sleep', q: 'How did you sleep?', ends: ['Badly', 'Great'] },
  { key: 'energy', q: 'Energy right now?', ends: ['Empty', 'Buzzing'] },
  { key: 'soreness', q: 'Any soreness?', ends: ['Very sore', 'None'], invert: true },
];

let readiness = null;

async function loadReadiness() {
  readiness = await DB.getPref('readiness:' + DB.todayISO(), null);
  return readiness;
}

/** For the workout player: today's answers if all three are in, else null. */
export async function todaysReadiness() {
  const r = await loadReadiness();
  return r && r.sleep && r.energy && r.soreness ? r : null;
}

function checkInCard() {
  const r = readiness || {};
  const complete = r.sleep && r.energy && r.soreness;
  if (complete) {
    const advice = readinessAdvice(readinessScore(r));
    const tone = advice.band === 'good' ? 'mint' : advice.band === 'fair' ? 'sun' : 'orange';
    return '<div class="card checkin is-done">' +
      '<div class="checkin-done"><span class="checkin-badge tone-' + tone + '">' +
        (advice.band === 'good' ? '💪' : advice.band === 'fair' ? '🙂' : '🫶') + '</span>' +
      '<div><p class="card-title">' + (advice.band === 'good' ? 'Ready to go' : advice.band === 'fair' ? 'A little lighter today' : 'Easy does it today') + '</p>' +
      '<p class="card-sub">' + esc(advice.message) + '</p></div></div>' +
      '<button type="button" class="link" data-action="checkin-reset">Change answers</button></div>';
  }
  return '<div class="card checkin">' +
    '<p class="card-title">How are you feeling?</p>' +
    '<p class="card-sub">Three taps. I’ll adjust today’s weights to match.</p>' +
    QUESTIONS.map((q) => {
      const val = r[q.key];
      return '<div class="checkin-q"><p class="checkin-label">' + esc(q.q) + '</p>' +
        '<div class="faces" role="radiogroup" aria-label="' + esc(q.q) + '">' +
        FACES.map((f, i) => {
          // soreness is stored 1 = none … 5 = very sore, but drawn happy-to-the-right like the others
          const stored = q.invert ? 5 - i : i + 1;
          const on = val === stored;
          return '<button type="button" class="face' + (on ? ' is-on' : '') + '" role="radio" aria-checked="' + on +
            '" aria-label="' + (i + 1) + ' of 5" data-action="checkin" data-key="' + q.key + '" data-v="' + stored + '">' + f + '</button>';
        }).join('') + '</div>' +
        '<div class="faces-ends"><span>' + esc(q.ends[0]) + '</span><span>' + esc(q.ends[1]) + '</span></div></div>';
    }).join('') + '</div>';
}

/* ------------------------------------------------------------------ hero */

function startButtons(active) {
  return '<div class="hero-actions">' +
    button({ label: active ? 'Resume Workout' : 'Start Workout', action: 'start-workout', kind: 'white', icon: 'play', full: false, cls: 'hero-go' }) +
    (active ? '' : button({ label: 'Preview', action: 'preview-workout', kind: 'glass', full: false, size: 'lg' })) +
    '</div>';
}

function heroLift(ctx, plan, active) {
  const s = ctx.day.session;
  const art = workoutArt(s.type, heroKeyFor(plan), { label: s.name, bare: true });
  const n = plan ? plan.items.length : 0;
  const mins = minutesOf(s.estMinutes, s.blockSize) || minutesOf(plan && plan.estMinutes, s.blockSize);
  const meta = [
    mins ? '~' + mins + ' min' : '',
    n ? fmt.plural(n, 'exercise') : typeLabel(s.type),
  ].filter(Boolean).join(' · ');
  return '<article class="hero" style="background:' + themeBg(workoutTheme(s.type)) + '">' +
    '<div class="hero-art">' + art + '</div>' +
    '<div class="hero-content">' +
      '<span class="hero-kicker">' + icon('clock', 14) + ' Today · ' + esc(fmt.clock(s.startTime || '05:30')) + '</span>' +
      '<h2 class="hero-title">' + esc(s.name) + '</h2>' +
      '<p class="hero-meta">' + esc(meta) + '</p>' +
      '<div class="chip-row">' + focusChips(s.focus) + '</div>' +
      startButtons(active) +
    '</div></article>';
}

function heroDone(ctx, doneToday) {
  const lift = doneToday.find((s) => !(s.classId || s.type === 'class')) || doneToday[0];
  const mins = lift && lift.startedAt && lift.endedAt
    ? Math.round((new Date(lift.endedAt) - new Date(lift.startedAt)) / 60000) : 0;
  const sets = ctx.sets.filter((x) => doneToday.some((s) => s.id === x.sessionId)).length;
  const t = lift.type === 'class' || lift.classId ? 'class' : lift.type || 'full';
  return '<article class="hero hero-done" style="background:' + themeBg(THEMES.mint) + '">' +
    '<div class="hero-art">' + workoutArt(t, null, { bare: true }) + '</div>' +
    '<div class="hero-content">' +
      '<span class="hero-check">' + icon('check', 26) + '</span>' +
      '<h2 class="hero-title">You did it! 🎉</h2>' +
      '<p class="hero-meta">' + esc(lift.name || 'Workout') +
        (mins > 1 ? ' · ' + mins + ' min' : '') + (sets ? ' · ' + fmt.plural(sets, 'set') : '') + '</p>' +
      '<p class="hero-note">Have some protein in the next hour — it’s when it counts most.</p>' +
    '</div></article>';
}

function heroClass(ctx) {
  const d = ctx.day;
  const f = classById(d.classFormatId) || {};
  const cls = ctx.classesOn(ctx.today).find((c) => c.formatId === d.classFormatId) || {};
  return '<article class="hero" style="background:' + themeBg(classTheme(d.classFormatId)) + '">' +
    '<div class="hero-art">' + classArt(d.classFormatId, { label: f.name || 'Class', bare: true }) + '</div>' +
    '<div class="hero-content">' +
      '<span class="hero-kicker">' + icon('classes', 14) + ' Class today · ' + esc(fmt.clock(d.classStart)) + '</span>' +
      '<h2 class="hero-title">' + esc(d.className || f.name || 'Class') + '</h2>' +
      '<p class="hero-meta">The class is your workout today. Enjoy it!</p>' +
      '<div class="hero-actions">' +
        button({ label: 'I Went', action: 'log-class', kind: 'white', icon: 'check', full: false,
          data: { classid: cls.id || '', name: d.className || f.name || 'Class', format: d.classFormatId || '' } }) +
        button({ label: 'Lift Instead', action: 'pick-workout', kind: 'glass', full: false }) +
      '</div>' +
    '</div></article>';
}

function heroRest() {
  return '<article class="hero" style="background:' + themeBg(THEMES.lilac) + '">' +
    '<div class="hero-art">' + restArt({ bare: true }) + '</div>' +
    '<div class="hero-content">' +
      '<span class="hero-kicker">' + icon('moon', 14) + ' Rest day</span>' +
      '<h2 class="hero-title">Rest & recharge</h2>' +
      '<p class="hero-meta">Muscle is built while you rest. A walk is perfect today.</p>' +
      '<div class="hero-actions">' +
        button({ label: 'Log a Walk', action: 'log-walk', kind: 'white', icon: 'leaf', full: false }) +
        button({ label: 'Work Out Anyway', action: 'pick-workout', kind: 'glass', full: false }) +
      '</div>' +
    '</div></article>';
}

/* ------------------------------------------------------------------ week strip + rings */

function weekStrip(ctx) {
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return '<div class="weekstrip">' + ctx.week.map((d, i) => {
    const done = ctx.doneOn(d.date);
    const planned = d.session ? (TYPE_COLOR[d.session.type] || 'pink') : (d.classId ? 'blue' : null);
    const isToday = d.date === ctx.today;
    const color = done.length ? (TYPE_COLOR[done[0].classId || done[0].type === 'class' ? 'class' : done[0].type] || 'pink') : planned;
    const cls = 'wday' + (isToday ? ' is-today' : '') + (done.length ? ' is-done' : '') + (planned && !done.length ? ' is-planned' : '');
    return '<button type="button" class="' + cls + '" data-action="day" data-date="' + d.date + '"' +
      (color ? ' style="--c:var(--' + color + '-fill)"' : '') + ' aria-label="' + esc(d.dayName +
      (done.length ? ', done' : planned ? ', planned' : ', rest')) + '">' +
      '<span class="wday-l">' + letters[i] + '</span>' +
      '<span class="wday-dot">' + (done.length ? icon('check', 16) : '<span>' + Number(d.date.slice(8)) + '</span>') + '</span>' +
      '</button>';
  }).join('') + '</div>';
}

function ringsCard(ctx) {
  const ids = ['resistive', 'cardio', 'control', 'shape'];
  const P = ctx.pillars.pillars;
  const list = ids.map((id) => ({
    pct: P[id].target ? P[id].done / P[id].target : 0,
    color: 'var(--' + PILLAR_COLOR[id] + '-fill)',
    track: 'var(--' + PILLAR_COLOR[id] + '-soft)',
  }));
  return '<button type="button" class="card ringscard" data-action="nav-tab" data-tab="progress">' +
    rings(list, { size: 118, stroke: 11, gap: 3, label: 'This week’s training balance' }) +
    '<div class="ringscard-legend">' + ids.map((id) => {
      const p = P[id];
      const pct = p.target ? Math.min(100, Math.round((p.done / p.target) * 100)) : 100;
      return '<div class="legend-row"><span class="legend-dot" style="background:var(--' + PILLAR_COLOR[id] + '-fill)"></span>' +
        '<span class="legend-name">' + esc(PILLAR_LABEL[id]) + '</span>' +
        '<span class="legend-val num" style="color:var(--' + PILLAR_COLOR[id] + '-ink)">' + pct + '%</span></div>';
    }).join('') + '</div></button>';
}

/* ------------------------------------------------------------------ small cards */

async function proteinCard(profile) {
  const target = profile.proteinTargetG;
  const v = await DB.getPref('protein:' + DB.todayISO(), null);
  const head = '<div class="mini-head">' + tile('drop', 'var(--teal-fill)', 34) +
    '<div><p class="card-title">Protein today</p><p class="card-sub">' +
    (target ? 'Goal ' + target + ' g — about ' + Math.round(target / 4) + ' g a meal' : 'Aim for some at every meal') + '</p></div></div>';
  if (v === true) {
    return '<div class="card mini">' + head + '<p class="mini-yes">' + icon('check', 18) + ' Nice — goal hit!</p>' +
      '<button type="button" class="link" data-action="protein" data-v="">Undo</button></div>';
  }
  return '<div class="card mini">' + head + '<div class="mini-actions">' +
    button({ label: 'I Hit It', action: 'protein', kind: 'tinted', size: 'md', data: { v: '1' }, full: false }) +
    button({ label: 'Not Today', action: 'protein', kind: 'plain', size: 'md', data: { v: '0' }, full: false }) +
    '</div></div>';
}

function classesRow(ctx) {
  // the next few class occurrences this week, from today on
  const items = [];
  for (const d of ctx.week) {
    if (d.date < ctx.today) continue;
    for (const c of ctx.classesOn(d.date)) {
      const f = classById(c.formatId);
      if (f) items.push({ c, f, d });
    }
  }
  if (!items.length) {
    return '<button type="button" class="card cta-card" data-action="nav-tab" data-tab="classes">' +
      tile('calendarPlus', 'var(--blue-fill)', 40) +
      '<div class="cta-text"><p class="card-title">Add your favourite classes</p>' +
      '<p class="card-sub">Pilates, Cycle, Yoga… I’ll plan your lifting around them.</p></div>' +
      icon('chevronRight', 18, 'row-chev') + '</button>';
  }
  return '<div class="hscroll">' + items.slice(0, 6).map(({ c, f, d }) =>
    '<button type="button" class="ctile" data-action="nav-push" data-page="class" data-format="' + esc(f.id) + '">' +
      '<span class="ctile-art">' + classArt(f.id, { square: true, label: f.name }) + '</span>' +
      '<span class="ctile-name">' + esc(f.name) + '</span>' +
      '<span class="ctile-when">' + esc((d.date === ctx.today ? 'Today' : d.dayShort) + ' · ' + fmt.clock(c.time)) + '</span>' +
    '</button>').join('') + '</div>';
}

const TIPS = [
  { t: 'Lift heavier than you think', b: 'Light weights for lots of reps won’t change your shape. The last two reps of every set should feel hard — that’s the signal your muscles answer.' },
  { t: 'The scale can lie', b: 'Building muscle while losing fat can leave your weight unchanged for weeks. Your waist measurement and how your jeans fit tell the real story.' },
  { t: 'Breathe out on the effort', b: 'Exhale as you push or lift. Holding your breath presses down on your pelvic floor — breathing out protects it.' },
  { t: 'Protein early', b: 'After a morning workout, have 25–30 g of protein within the hour: Greek yogurt, eggs, or a shake all work.' },
  { t: 'Sleep is training too', b: 'Most of the change happens while you sleep. A rough night? Go a little lighter — it still counts.' },
  { t: 'Glutes need both', b: 'Hip thrusts and squats grow your glutes equally well. That’s why your plan has both.' },
  { t: 'Warm up a little longer at dawn', b: 'Your body is stiffest first thing in the morning. A few extra minutes of warm-up is the best injury insurance there is.' },
];

function tipCard() {
  // Her calendar day, not UTC's (which turns over at 4–5 pm in California).
  const d = new Date();
  const i = Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) % TIPS.length;
  const tip = TIPS[i];
  return '<div class="card tip"><span class="tip-ic">' + icon('sparkle', 20) + '</span>' +
    '<div><p class="tip-kicker">Tip of the day</p><p class="card-title">' + esc(tip.t) + '</p>' +
    '<p class="card-sub">' + esc(tip.b) + '</p></div></div>';
}

/* ------------------------------------------------------------------ page */

export const page = {
  id: 'today',
  title: 'Today',
  large: true,
  largeTitle: () => {
    const p = Store.get('profile') || {};
    return greeting(p.name);
  },
  pre: () => fmt.longDate(DB.todayISO()),
  accessory: () => avatarButton(),

  async render() {
    const ctx = await weekContext();
    await loadReadiness();
    const profile = ctx.profile;
    const active = Store.get('activeSession');
    const doneToday = ctx.doneOn(ctx.today);
    const d = ctx.day;

    let hero;
    let showCheckin = false;
    if (active && !active.complete) {
      const plan = resolvePlan(profile, active) || { items: [] };
      hero = heroLift({ ...ctx, day: { ...d, session: { ...active, startTime: d && d.session ? d.session.startTime : '05:30' } } }, plan, true);
    } else if (doneToday.length) {
      hero = heroDone(ctx, doneToday);
    } else if (d && d.session && d.session.type !== 'recovery') {
      hero = heroLift(ctx, resolvePlan(profile, d.session), false);
      showCheckin = true;
    } else if (d && d.classId) {
      hero = heroClass(ctx);
    } else {
      hero = heroRest();
    }

    const stats = ctx.done.length;
    return '<div class="today">' +
      hero +
      (showCheckin ? checkInCard() : '') +
      '<div class="section-title"><h2>Your week</h2><span class="section-note">' +
        esc(stats ? fmt.plural(stats, 'workout') + ' done' : 'Let’s get started') + '</span></div>' +
      '<div class="card">' + weekStrip(ctx) + '</div>' +
      ringsCard(ctx) +
      '<div class="section-title"><h2>Your classes</h2><button type="button" class="link" data-action="nav-tab" data-tab="classes">See All</button></div>' +
      classesRow(ctx) +
      '<div class="two-up">' + await proteinCard(profile) + '</div>' +
      (await installCard()) +
      tipCard() +
      '</div>';
  },

  actions: {
    async checkin(node) {
      haptic();
      const r = (await DB.getPref('readiness:' + DB.todayISO(), null)) || {};
      r[node.dataset.key] = Number(node.dataset.v);
      await DB.setPref('readiness:' + DB.todayISO(), r);
      readiness = r;
      return Nav.refresh();
    },
    async 'checkin-reset'() {
      await DB.setPref('readiness:' + DB.todayISO(), {});
      return Nav.refresh();
    },
    async 'start-workout'() {
      haptic();
      const { openPlayer } = await import('./player.js');
      return openPlayer();
    },
    async 'preview-workout'() {
      const ctx = await weekContext();
      if (!ctx.day || !ctx.day.session) return;
      const s = ctx.day.session;
      // type and name let the page show a day with no program day (Saturday's sprints).
      return Nav.push('workout', { key: s.programDayKey || '', today: '1', type: s.type, name: s.name,
        mins: minutesOf(s.estMinutes, s.blockSize) });
    },
    'pick-workout'() { return Nav.tab('workouts'); },
    async 'log-class'(node) {
      haptic();
      const now = new Date().toISOString();
      await DB.put('sessions', {
        id: DB.uid(), date: DB.todayISO(), startedAt: now, endedAt: now,
        type: 'class', name: node.dataset.name || 'Class', programDayKey: null, blockSize: 'full',
        classId: node.dataset.classid || null, classFormatId: node.dataset.format || null,
        readiness: null, notes: '', complete: true,
      });
      confetti({ count: 80 });
      toast('Class logged — that counts!', { tone: 'good' });
      return Nav.invalidate();
    },
    async 'log-walk'() {
      haptic();
      const now = new Date().toISOString();
      await DB.put('sessions', {
        id: DB.uid(), date: DB.todayISO(), startedAt: now, endedAt: now, type: 'recovery', name: 'Walk',
        programDayKey: null, blockSize: 'full', classId: null, readiness: null, notes: 'Walk', complete: true,
      });
      toast('Walk logged. Lovely!', { tone: 'good', ic: 'leaf' });
      return Nav.invalidate();
    },
    async protein(node) {
      haptic();
      const v = node.dataset.v === '1' ? true : node.dataset.v === '0' ? false : null;
      await DB.setPref('protein:' + DB.todayISO(), v);
      if (v) toast('Protein goal hit!', { tone: 'good', ic: 'drop' });
      return Nav.refresh();
    },
    async day(node) {
      const ctx = await weekContext();
      const d = ctx.week.find((x) => x.date === node.dataset.date);
      if (!d) return;
      const done = ctx.doneOn(d.date);
      const classes = ctx.classesOn(d.date);
      const rows = [];
      for (const s of done) {
        rows.push('<div class="dayrow">' + tile('check', 'var(--mint-fill)', 34) + '<div><p class="card-title">' +
          esc(s.name || typeLabel(s.type)) + '</p><p class="card-sub">Done</p></div></div>');
      }
      if (d.session && !done.some((s) => s.programDayKey === d.session.programDayKey)) {
        rows.push('<button type="button" class="dayrow" data-sheet="open-workout" data-key="' + esc(d.session.programDayKey || '') +
          '" data-type="' + esc(d.session.type) + '" data-name="' + esc(d.session.name) + '" data-mins="' +
          minutesOf(d.session.estMinutes, d.session.blockSize) + '" data-today="' + (d.date === ctx.today ? '1' : '') + '">' +
          tile('workouts', 'var(--' + (TYPE_COLOR[d.session.type] || 'pink') + '-fill)', 34) +
          '<div><p class="card-title">' + esc(d.session.name) + '</p><p class="card-sub">' +
          esc(fmt.clock(d.session.startTime) + ' · ~' + minutesOf(d.session.estMinutes, d.session.blockSize) + ' min') + '</p></div>' +
          icon('chevronRight', 16, 'row-chev') + '</button>');
      }
      for (const c of classes) {
        const f = classById(c.formatId);
        rows.push('<div class="dayrow">' + tile('classes', classTheme(c.formatId).a, 34) + '<div><p class="card-title">' +
          esc(f ? f.name : 'Class') + '</p><p class="card-sub">' + esc(fmt.clock(c.time)) + '</p></div></div>');
      }
      if (!rows.length) rows.push('<p class="muted" style="padding:12px 4px">Rest day. Enjoy it!</p>');
      const warn = (d.warnings || []).map((w) => '<p class="warnline">' + icon('info', 16) + esc(w.message) + '</p>').join('');
      sheet({
        title: fmt.longDate(d.date),
        body: '<div class="daylist">' + rows.join('') + '</div>' + warn,
        actions: {
          'open-workout'(n) {
            closeSheet();
            const { key, type, name, mins, today } = n.dataset;
            Nav.push('workout', { key, type, name, mins, today });
          },
        },
      });
    },
  },
};
