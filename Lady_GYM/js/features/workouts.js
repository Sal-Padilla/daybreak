// Lady_GYM — js/features/workouts.js — the Workouts tab: your plan as pictures, every exercise explained.
//
// "Picture friendly" here means you can choose a workout, and understand every movement in
// it, without reading a paragraph. Every tile is an illustration; every exercise page opens on
// a moving picture of a woman doing it.

import { DB } from '../core/db.js';
import { Store } from '../core/store.js';
import { EXERCISES, byId, SHAPE_TARGETS } from '../data/exercises.js';
import { exerciseInfo, diagramKeyFor, howToUrl } from '../data/info.js';
import { estimate1RM } from '../engine/progression.js';
import { readinessScore, readinessAdvice } from '../engine/readiness.js';
import { figureSvg, figureAnim, diagramSetup } from '../art/figure.js';
import { workoutArt, workoutTheme, themeBg } from '../art/scenes.js';
import { icon, tile } from '../ui/icons.js';
import { sparkline } from '../ui/rings.js';
import { esc, fmt, button, group, sectionTitle, haptic } from '../ui/kit.js';
import {
  weekContext, resolvePlan, heroKeyFor, programDays, avatarButton, typeLabel, minutesOf,
  TYPE_COLOR, AREA_COLOR,
} from './shared.js';
import { todaysReadiness } from './today.js';

/* ------------------------------------------------------------------ pieces */

export function exThumb(ex, { size = '' } = {}) {
  const key = diagramKeyFor(ex);
  const svg = key ? figureSvg(key, { frame: 'finish', labels: false }) : '';
  return '<span class="ex-thumb' + (size ? ' is-' + size : '') + '">' + (svg ||
    '<span class="ex-thumb-blank">' + icon('workouts', 26) + '</span>') + '</span>';
}

function schemeLabel(item, dropLastSet) {
  const ex = item.exercise;
  // After a rough check-in the player drops the last set of each movement; show the same count.
  const sets = dropLastSet && item.sets > 1 ? item.sets - 1 : item.sets;
  if (ex.track === 'time_hold') return sets + ' × hold';
  if (ex.track === 'time_distance') return sets > 1 ? sets + ' rounds' : 'Steady';
  return sets + ' × ' + item.reps[0] + '–' + item.reps[1];
}

function areaChips(ex) {
  const keys = [...new Set([...(ex.primary || [])])].slice(0, 3);
  return keys.map((k) => '<span class="chip chip-' + (AREA_COLOR[k] || 'pink') + '">' +
    esc((SHAPE_TARGETS[k] && SHAPE_TARGETS[k].label) || k) + '</span>').join('');
}

const AREAS = [
  { id: 'glutes', label: 'Glutes & Hips', fig: 'hip-thrust', color: 'pink', test: (e) => has(e, ['gluteMax', 'gluteMed']) },
  { id: 'legs', label: 'Legs', fig: 'split-squat', color: 'orange', test: (e) => has(e, ['quads', 'hamstrings', 'calves']) },
  { id: 'back', label: 'Back', fig: 'lat-pulldown', color: 'violet', test: (e) => has(e, ['back']) },
  { id: 'shoulders', label: 'Shoulders', fig: 'lateral-raise', color: 'blue', test: (e) => has(e, ['delts']) },
  { id: 'arms', label: 'Arms & Chest', fig: 'bicep-curl', color: 'berry', test: (e) => has(e, ['triceps', 'biceps', 'chest']) },
  { id: 'core', label: 'Core', fig: 'supine-core', color: 'teal', test: (e) => has(e, ['core']) },
  { id: 'cardio', label: 'Cardio', fig: 'bike', color: 'sun', test: (e) => e.pattern === 'cardio' || e.pattern === 'plyo' },
  { id: 'all', label: 'Everything', fig: 'kettlebell-swing', color: 'lilac', test: () => true },
];

function has(e, keys) {
  return (e.primary || []).some((k) => keys.includes(k));
}

// Deep stops (from THEMES) so the white labels on these tiles stay readable.
const AREA_BG = {
  pink: ['#D6185E', '#B8145E'], orange: ['#C2410C', '#B23A0A'], violet: ['#6A3BD8', '#7E3FCF'],
  blue: ['#1A5FC9', '#1556B5'], berry: ['#B0144F', '#C21A5B'], teal: ['#00796B', '#00695F'],
  sun: ['#A85A00', '#9A5200'], lilac: ['#8A2BB8', '#A3228F'],
};

function areaTile(a) {
  const [c1, c2] = AREA_BG[a.color];
  return '<button type="button" class="area" style="background:linear-gradient(135deg,' + c1 + ',' + c2 + ')" ' +
    'data-action="nav-push" data-page="library" data-area="' + a.id + '">' +
    '<span class="area-fig">' + figureSvg(a.fig, { frame: 'finish', labels: false, panel: false }) + '</span>' +
    '<span class="area-label">' + esc(a.label) + '</span></button>';
}

function dayTile(day, profile, isToday) {
  const plan = resolvePlan(profile, { programDayKey: day.key, type: day.type, name: day.name, blockSize: 'full', focus: day.focus, estMinutes: day.estMinutes });
  return '<button type="button" class="wtile" data-action="nav-push" data-page="workout" data-key="' + esc(day.key) + '">' +
    '<span class="wtile-art">' + workoutArt(day.type, heroKeyFor(plan), { label: day.name }) + '</span>' +
    (isToday ? '<span class="wtile-badge">Today</span>' : '') +
    '<span class="wtile-text"><span class="wtile-name">' + esc(day.name) + '</span>' +
    '<span class="wtile-meta">' + esc('~' + minutesOf(day.estMinutes) + ' min · ' +
      fmt.plural(plan ? plan.items.length : 0, 'exercise')) + '</span></span></button>';
}

/* ------------------------------------------------------------------ Workouts tab */

export const page = {
  id: 'workouts',
  title: 'Workouts',
  large: true,
  accessory: () => avatarButton(),

  async render() {
    const ctx = await weekContext();
    const profile = ctx.profile;
    const days = programDays(profile);
    const todayKey = ctx.day && ctx.day.session ? ctx.day.session.programDayKey : null;

    // next lift: today if not done, else the next planned day this week
    let next = null;
    for (const d of ctx.week) {
      if (d.date < ctx.today || !d.session || d.session.type === 'recovery') continue;
      if (d.date === ctx.today && ctx.doneOn(d.date).length) continue;
      next = d; break;
    }

    let upNext = '';
    if (next) {
      const plan = resolvePlan(profile, next.session);
      const isToday = next.date === ctx.today;
      upNext = '<article class="hero hero-sm" style="background:' + themeBg(workoutTheme(next.session.type)) + '">' +
        '<div class="hero-art">' + workoutArt(next.session.type, heroKeyFor(plan), { label: next.session.name, bare: true }) + '</div>' +
        '<div class="hero-content">' +
          '<span class="hero-kicker">' + esc(isToday ? 'Up next · Today' : 'Up next · ' + next.dayName) + '</span>' +
          '<h2 class="hero-title">' + esc(next.session.name) + '</h2>' +
          '<p class="hero-meta">' + esc('~' + minutesOf(next.session.estMinutes, next.session.blockSize) + ' min · ' + typeLabel(next.session.type)) + '</p>' +
          '<div class="hero-actions">' +
            (isToday ? button({ label: 'Start', action: 'start-today', kind: 'white', icon: 'play', full: false }) : '') +
            button({ label: 'View Workout', action: 'nav-push', kind: isToday ? 'glass' : 'white', full: false,
              data: { page: 'workout', key: next.session.programDayKey || '', type: next.session.type, name: next.session.name,
                mins: minutesOf(next.session.estMinutes, next.session.blockSize), today: isToday ? '1' : '' } }) +
          '</div></div></article>';
    }

    const sessions = ((await DB.getAll('sessions')) || []).filter((s) => s.complete)
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).slice(0, 4);

    return '<div class="workouts">' +
      upNext +
      sectionTitle('Your plan') +
      '<p class="section-lede">' + esc(fmt.plural(days.length, 'workout')) + ' a week, made for you. Tap one to see it.</p>' +
      '<div class="hscroll">' + days.map((d) => dayTile(d, profile, d.key === todayKey)).join('') + '</div>' +
      '<div class="quick">' +
        '<button type="button" class="quick-btn" data-action="start-short">' + tile('timer', 'var(--orange-fill)', 38) +
          '<span><b>Short on time?</b><span>Today’s workout in ~30 min</span></span></button>' +
        '<button type="button" class="quick-btn" data-action="start-empty">' + tile('plus', 'var(--violet-fill)', 38) +
          '<span><b>Build your own</b><span>Pick exercises as you go</span></span></button>' +
      '</div>' +
      sectionTitle('Explore exercises') +
      '<div class="areas">' + AREAS.map(areaTile).join('') + '</div>' +
      (sessions.length
        ? sectionTitle('Recent', { action: 'nav-push', actionLabel: 'See All', data: { page: 'history' } }) +
          historyRows(sessions)
        : '') +
      '</div>';
  },

  actions: {
    async 'start-today'() {
      haptic();
      const { openPlayer } = await import('./player.js');
      return openPlayer();
    },
    async 'start-short'() {
      haptic();
      const { openPlayer } = await import('./player.js');
      return openPlayer({ short: true });
    },
    async 'start-empty'() {
      haptic();
      const { openPlayer } = await import('./player.js');
      return openPlayer({ empty: true });
    },
  },
};

function historyRows(sessions) {
  return '<div class="group-body">' + sessions.map((s) => {
    const isClass = s.classId || s.type === 'class';
    const color = TYPE_COLOR[isClass ? 'class' : s.type] || 'pink';
    const mins = s.startedAt && s.endedAt ? Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 60000) : 0;
    return '<button type="button" class="row is-tappable" data-action="nav-push" data-page="session" data-id="' + esc(s.id) + '">' +
      '<span class="row-lead">' + tile(isClass ? 'classes' : s.type === 'recovery' ? 'leaf' : s.type === 'conditioning' ? 'bolt' : 'workouts',
        'var(--' + color + '-fill)', 34) + '</span>' +
      '<span class="row-main"><span class="row-title">' + esc(s.name || typeLabel(s.type)) + '</span>' +
      '<span class="row-sub">' + esc(fmt.shortDate(s.date) + (mins > 1 ? ' · ' + mins + ' min' : '')) + '</span></span>' +
      '<span class="row-chev">' + icon('chevronRight', 16) + '</span></button>';
  }).join('') + '</div>';
}

/* ------------------------------------------------------------------ workout detail */

export const workoutPage = {
  id: 'workout',
  title: (p) => {
    const day = programDays(Store.get('profile')).find((d) => d.key === p.key);
    return day ? day.name : (p.name || 'Workout');
  },

  async render(params) {
    const profile = Store.get('profile');
    const days = programDays(profile);
    // Saturday's sprints have no program day, so callers pass the session's type and name.
    // Falling back to the first day previewed a 30-minute bike session as "Glutes & Hamstrings".
    const day = days.find((d) => d.key === params.key) ||
      (!params.key && params.type ? { key: '', name: params.name || typeLabel(params.type), type: params.type,
        focus: [], estMinutes: Number(params.mins) || 0 } : null) ||
      days[0];
    if (!day) return '<div class="empty"><p class="empty-title">No workout found</p></div>';
    const short = params.short === '1';
    const checkIn = await todaysReadiness();
    const dropLastSet = !!(checkIn && readinessAdvice(readinessScore(checkIn)).dropLastSet);
    const plan = resolvePlan(profile, {
      programDayKey: day.key, type: day.type, name: day.name, focus: day.focus,
      estMinutes: day.estMinutes, blockSize: short ? 'short' : 'full',
    }) || { items: [] };
    const equip = [...new Set(plan.items.flatMap((i) => (i.exercise.equipment || [])))]
      .filter((e) => e !== 'bodyweight').slice(0, 4);

    return '<div class="wdetail">' +
      '<div class="wdetail-hero">' + workoutArt(day.type, heroKeyFor(plan), { label: day.name }) + '</div>' +
      '<h1 class="wdetail-title">' + esc(day.name) + '</h1>' +
      '<div class="wdetail-stats">' +
        stat('clock', '~' + minutesOf(day.estMinutes, short ? 'short' : 'full') + ' min', 'orange') +
        stat('workouts', fmt.plural(plan.items.length, 'exercise'), 'pink') +
        stat('flame', typeLabel(day.type), 'violet') +
      '</div>' +
      (day.description ? '<p class="wdetail-desc">' + esc(friendly(day.description)) + '</p>' : '') +
      '<div class="segmented wdetail-seg">' +
        '<button type="button" class="seg' + (!short ? ' is-on' : '') + '" data-action="len" data-v="0">Full</button>' +
        '<button type="button" class="seg' + (short ? ' is-on' : '') + '" data-action="len" data-v="1">Short (~' + minutesOf(day.estMinutes, 'short') + ' min)</button>' +
      '</div>' +
      // Start with no program day starts today's session, so a weekend day offers it only on the day.
      (day.key || params.today === '1' ? '<div class="wdetail-cta">' +
        button({ label: 'Start This Workout', action: 'start', kind: 'primary', icon: 'play', data: { key: day.key } }) +
      '</div>' : '') +
      (equip.length ? '<p class="wdetail-equip">' + icon('workouts', 16) + ' You’ll use: ' + esc(equip.join(', ')) + '</p>' : '') +
      '<div class="group-body exlist">' + plan.items.map((it, i) =>
        '<button type="button" class="exrow" data-action="nav-push" data-page="exercise" data-id="' + esc(it.exerciseId) + '">' +
          exThumb(it.exercise) +
          '<span class="exrow-main"><span class="exrow-n">' + (i + 1) + '</span>' +
            '<span class="exrow-name">' + esc(it.exercise.name) + '</span>' +
            '<span class="exrow-meta">' + esc(schemeLabel(it, dropLastSet)) + '</span></span>' +
          '<span class="row-chev">' + icon('chevronRight', 16) + '</span></button>').join('') +
      '</div>' +
      '</div>';
  },

  actions: {
    len(node, data, ctx) {
      ctx.params.short = node.dataset.v;
      return ctx.refresh();
    },
    async start(node, data, ctx) {
      haptic();
      const { openPlayer } = await import('./player.js');
      return openPlayer({ programDayKey: node.dataset.key, short: ctx.params.short === '1' });
    },
  },
};

function stat(ic, text, color) {
  return '<span class="wstat"><span class="wstat-ic" style="color:var(--' + color + '-ink);background:var(--' + color + '-soft)">' +
    icon(ic, 16) + '</span>' + esc(text) + '</span>';
}

/** Program descriptions were written for a coach. Keep the first sentence, which is the plan. */
function friendly(text) {
  const m = String(text).match(/^[^.]*\./);          // first sentence; no lookbehind (iOS < 16.4)
  const first = m ? m[0] : String(text);
  return first.replace(/hip-dip/gi, 'hip dip');
}

/* ------------------------------------------------------------------ exercise detail */

export const exercisePage = {
  id: 'exercise',
  title: (p) => { const e = byId(p.id); return e ? e.name : 'Exercise'; },

  async render(params) {
    const ex = byId(params.id);
    if (!ex) return '<div class="empty"><p class="empty-title">Exercise not found</p></div>';
    const info = exerciseInfo(ex) || {};
    const key = diagramKeyFor(ex);
    const steps = key ? diagramSetup(key) : [];
    const cues = ex.cues || [];
    const breath = cues.find((c) => /exhale|breath/i.test(c));
    const others = cues.filter((c) => c !== breath);

    // history
    const sets = ((await DB.getExerciseSets(ex.id)) || []).filter((s) => !s.isWarmup);
    let history = '';
    if (sets.length && ex.track === 'weight_reps') {
      // estimate1RM() is null above 12 reps by design. Without an estimate on both sides the
      // heavier set wins, then the one with more reps — not "the first set ever logged".
      const beats = (a, b) => {
        const ea = estimate1RM(a.weight, a.reps);
        const eb = estimate1RM(b.weight, b.reps);
        if (ea != null && eb != null) return ea > eb;
        return (a.weight || 0) > (b.weight || 0) || ((a.weight || 0) === (b.weight || 0) && (a.reps || 0) > (b.reps || 0));
      };
      const bySession = new Map();
      for (const s of sets) {
        const cur = bySession.get(s.sessionId);
        if (!cur || beats(s, cur.s)) bySession.set(s.sessionId, { e1: estimate1RM(s.weight, s.reps) || 0, s });
      }
      const series = [...bySession.values()].sort((a, b) => (a.s.loggedAt < b.s.loggedAt ? -1 : 1));
      const best = series.reduce((m, x) => (beats(x.s, m.s) ? x : m), series[0]);
      const byE1 = series.every((x) => x.e1 > 0);   // else the line follows the weight
      const last = series[series.length - 1];
      history = sectionTitle('Your progress') +
        '<div class="card hist">' +
          '<div class="hist-nums">' +
            '<div><p class="hist-k">Best set</p><p class="hist-v num">' + esc(fmt.num(best.s.weight)) + '<small> lb × ' + esc(best.s.reps) + '</small></p></div>' +
            '<div><p class="hist-k">Last time</p><p class="hist-v num">' + esc(fmt.num(last.s.weight)) + '<small> lb × ' + esc(last.s.reps) + '</small></p></div>' +
          '</div>' +
          (series.length > 1 ? sparkline(series.map((x) => (byE1 ? x.e1 : x.s.weight)), { color: 'var(--pink-fill)', width: 300, height: 56 }) : '') +
          '<p class="card-sub">' + esc(fmt.plural(series.length, 'workout')) + ' logged</p>' +
        '</div>';
    }

    const swaps = (ex.swaps || []).map(byId).filter(Boolean).slice(0, 6);

    return '<div class="exdetail">' +
      '<div class="exdetail-fig">' + (key ? figureAnim(key) : '<div class="ex-thumb-blank big">' + icon('workouts', 48) + '</div>') + '</div>' +
      (key ? '<p class="exdetail-hint">' + icon('play', 12) + ' The picture shows the start and finish of the move</p>' : '') +
      '<h1 class="exdetail-title">' + esc(ex.name) + '</h1>' +
      '<div class="chip-row">' + areaChips(ex) +
        ((ex.equipment || []).filter((e) => e !== 'bodyweight').slice(0, 2).map((e) => '<span class="chip chip-blue">' + esc(e) + '</span>').join('')) +
        (ex.beginner ? '<span class="chip chip-mint">Beginner friendly</span>' : '') +
      '</div>' +
      (steps.length ? sectionTitle('How to do it') + '<ol class="steps">' +
        steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>' : '') +
      (breath ? '<div class="breath">' + icon('drop', 18) + '<p><b>Breathe:</b> ' + esc(breath) + '</p></div>' : '') +
      (others.length ? sectionTitle('Tips') + '<ul class="cues">' +
        others.map((c) => '<li>' + icon('check', 16) + '<span>' + esc(c) + '</span></li>').join('') + '</ul>' : '') +
      (info.why ? sectionTitle('Why it’s in your plan') + '<p class="card why">' + esc(info.why) + '</p>' : '') +
      '<a class="btn btn-tinted btn-lg btn-full video-btn" href="' + esc(howToUrl(ex)) + '" target="_blank" rel="noopener noreferrer">' +
        icon('play', 18) + '<span>Watch a video demo</span></a>' +
      history +
      (swaps.length ? sectionTitle('Similar exercises') + '<div class="hscroll">' + swaps.map((s) =>
        '<button type="button" class="mini-ex" data-action="nav-push" data-page="exercise" data-id="' + esc(s.id) + '">' +
          exThumb(s) + '<span>' + esc(s.name) + '</span></button>').join('') + '</div>' : '') +
      '</div>';
  },
};

/* ------------------------------------------------------------------ library */

function libraryResults(params) {
  const area = AREAS.find((a) => a.id === params.area) || AREAS[AREAS.length - 1];
  const q = (params.q || '').toLowerCase().trim();
  const eq = params.eq || 'all';
  const list = EXERCISES.filter(area.test)
    .filter((e) => !q || e.name.toLowerCase().includes(q))
    .filter((e) => eq === 'all' || (e.equipment || []).includes(eq))
    .sort((a, b) => (diagramKeyFor(b) ? 1 : 0) - (diagramKeyFor(a) ? 1 : 0) || a.name.localeCompare(b.name));
  return '<p class="section-lede">' + esc(fmt.plural(list.length, 'exercise')) + '</p>' +
    (list.length ? '<div class="exgrid">' + list.map((e) =>
      '<button type="button" class="exgrid-item" data-action="nav-push" data-page="exercise" data-id="' + esc(e.id) + '">' +
        exThumb(e, { size: 'grid' }) + '<span class="exgrid-name">' + esc(e.name) + '</span></button>').join('') + '</div>'
      : '<div class="empty"><p class="empty-title">Nothing matches</p><p class="empty-sub">Try a shorter word, or another filter.</p></div>');
}

export const libraryPage = {
  id: 'library',
  title: (p) => (AREAS.find((a) => a.id === p.area) || AREAS[AREAS.length - 1]).label,

  render(params) {
    const area = AREAS.find((a) => a.id === params.area) || AREAS[AREAS.length - 1];
    const eq = params.eq || 'all';
    const equipments = ['all', 'dumbbell', 'machine', 'bodyweight', 'barbell', 'cable', 'band', 'kettlebell'];
    return '<div class="library">' +
      '<label class="search">' + icon('search', 18) +
        '<input type="search" placeholder="Search ' + esc(area.label.toLowerCase()) + '" value="' + esc(params.q || '') +
        '" data-action="lib-q" data-on="input" enterkeyhint="search" autocomplete="off" aria-label="Search exercises"></label>' +
      '<div class="filter-row">' + equipments.map((e) =>
        '<button type="button" class="fchip' + (e === eq ? ' is-on' : '') + '" data-action="lib-eq" data-v="' + e + '">' +
        esc(e === 'all' ? 'All' : e[0].toUpperCase() + e.slice(1)) + '</button>').join('') + '</div>' +
      '<div class="lib-results">' + libraryResults(params) + '</div></div>';
  },

  actions: {
    // Update the results only. Re-rendering the page would rebuild the search box and drop
    // the keyboard on every letter.
    'lib-q'(node, data, ctx) {
      ctx.params.q = node.value;
      const host = ctx.el.querySelector('.lib-results');
      if (host) host.innerHTML = libraryResults(ctx.params);
    },
    'lib-eq'(node, data, ctx) {
      ctx.params.eq = node.dataset.v;
      for (const b of ctx.el.querySelectorAll('.fchip')) b.classList.toggle('is-on', b === node);
      const host = ctx.el.querySelector('.lib-results');
      if (host) host.innerHTML = libraryResults(ctx.params);
    },
  },
};

/* ------------------------------------------------------------------ history */

export const historyPage = {
  id: 'history',
  title: 'History',
  async render() {
    const all = ((await DB.getAll('sessions')) || []).filter((s) => s.complete)
      .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    if (!all.length) {
      return '<div class="empty"><p class="empty-title">No workouts yet</p><p class="empty-sub">Your finished workouts will show up here.</p></div>';
    }
    const months = new Map();
    for (const s of all) {
      const [y, m] = s.date.split('-');
      const k = new Date(+y, +m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      if (!months.has(k)) months.set(k, []);
      months.get(k).push(s);
    }
    return [...months.entries()].map(([k, list]) =>
      '<section class="group"><h2 class="group-header">' + esc(k) + ' · ' + list.length + '</h2>' + historyRows(list) + '</section>').join('');
  },
};

export const sessionPage = {
  id: 'session',
  title: 'Workout',
  async render(params) {
    const s = await DB.get('sessions', params.id);
    if (!s) return '<div class="empty"><p class="empty-title">Not found</p></div>';
    const sets = ((await DB.getSessionSets(s.id)) || []).filter((x) => !x.isWarmup)
      .sort((a, b) => (a.loggedAt < b.loggedAt ? -1 : 1));
    const byEx = new Map();
    for (const x of sets) {
      if (!byEx.has(x.exerciseId)) byEx.set(x.exerciseId, []);
      byEx.get(x.exerciseId).push(x);
    }
    const mins = s.startedAt && s.endedAt ? Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 60000) : 0;
    const volume = sets.reduce((m, x) => m + (x.weight || 0) * (x.reps || 0), 0);
    const theme = workoutTheme(s.classId || s.type === 'class' ? 'class' : s.type);
    return '<div class="sdetail">' +
      '<div class="sdetail-head" style="background:linear-gradient(135deg,' + theme.da + ',' + theme.db + ')">' +
        '<p class="sdetail-date">' + esc(fmt.longDate(s.date)) + '</p>' +
        '<h1>' + esc(s.name || typeLabel(s.type)) + '</h1>' +
        '<div class="sdetail-stats">' +
          (mins > 1 ? '<span><b class="num">' + mins + '</b> min</span>' : '') +
          (sets.length ? '<span><b class="num">' + sets.length + '</b> ' + (sets.length === 1 ? 'set' : 'sets') + '</span>' : '') +
          (volume ? '<span><b class="num">' + fmt.num(volume, 0) + '</b> lb lifted</span>' : '') +
        '</div></div>' +
      [...byEx.entries()].map(([eid, list]) => {
        const ex = byId(eid);
        return '<div class="card sdetail-ex">' +
          '<button type="button" class="sdetail-exhead" data-action="nav-push" data-page="exercise" data-id="' + esc(eid) + '">' +
            (ex ? exThumb(ex) : '') + '<span class="card-title">' + esc(ex ? ex.name : eid) + '</span>' +
            icon('chevronRight', 16, 'row-chev') + '</button>' +
          '<div class="setlist">' + list.map((x, i) => '<span class="setpill"><b>' + (i + 1) + '</b> ' +
            esc(x.weight != null ? fmt.num(x.weight) + ' lb × ' + x.reps : x.reps != null ? x.reps + ' reps' :
              x.seconds ? fmt.mmss(x.seconds) : '✓') + '</span>').join('') + '</div></div>';
      }).join('') +
      '</div>';
  },
};
