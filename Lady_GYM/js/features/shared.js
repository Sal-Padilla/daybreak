// Lady_GYM — js/features/shared.js — the week as the screens need it, computed once per render.
//
// Every tab asks the same questions — what is today, what is this week, what has she done —
// so they are answered here, from the same engine Daybreak used, and the screens only draw.

import { DB } from '../core/db.js';
import { Store, currentProgramWeek } from '../core/store.js';
import { buildWeek, detectConflicts } from '../engine/scheduler.js';
import { weeklyShapeMap } from '../engine/shapemap.js';
import { planFor, programOf } from '../engine/sessionplan.js';
import { weeklyPillars } from '../data/pillars.js';
import { byId } from '../data/exercises.js';
import { classById } from '../data/classes.js';
import { classesForWeek, classesOnDate, addDays, mondayOf, isoOf } from '../data/schedule.js';
import { diagramKeyFor } from '../data/info.js';
import { avatarArt } from '../art/scenes.js';
import { esc } from '../ui/kit.js';

export { mondayOf, addDays, isoOf };

export const PILLAR_COLOR = {
  resistive: 'pink',
  control: 'violet',
  cardio: 'orange',
  shape: 'teal',
};

export const PILLAR_LABEL = {
  resistive: 'Strength',
  control: 'Balance & Core',
  cardio: 'Cardio',
  shape: 'Tone & Shape',
};

// Session type → the colour it wears everywhere (week strip, history, cards).
export const TYPE_COLOR = {
  lower: 'pink',
  'lower-heavy': 'pink',
  upper: 'violet',
  full: 'orange',
  conditioning: 'orange',
  recovery: 'mint',
  class: 'blue',
};

export const AREA_COLOR = {
  gluteMax: 'pink', gluteMed: 'pink', hamstrings: 'pink', quads: 'orange', calves: 'orange',
  delts: 'violet', back: 'violet', triceps: 'violet', chest: 'violet', biceps: 'violet',
  core: 'teal',
};

export function todayISO() { return DB.todayISO(); }

/**
 * Minutes for a plan or session. Program days store {full, short}; the scheduler hands over a
 * plain number. Every screen goes through this so neither shape leaks onto the page.
 */
export function minutesOf(v, size = 'full') {
  if (v && typeof v === 'object') return Number(v[size] || v.full || 0) || 0;
  return Number(v) || 0;
}

export function greeting(name) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Up early' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return name ? part + ', ' + name : part;
}

/** Everything about one Monday-to-Sunday week. */
export async function weekContext(anyDateISO) {
  const profile = Store.get('profile') || {};
  const dials = Store.get('dials') || {};
  const today = todayISO();
  const weekStart = mondayOf(anyDateISO || today);
  const weekEnd = addDays(weekStart, 6);
  const classes = (await DB.getAll('classes')) || [];
  const overrides = (await DB.getPref('session:overrides', {})) || {};
  const week = buildWeek(profile, classesForWeek(classes, weekStart), dials, weekStart, { overrides });
  const sessions = (await DB.getSessionsInRange(weekStart, weekEnd)) || [];
  const done = sessions.filter((s) => s.complete);
  const sets = [];
  for (const s of done) {
    const rows = await DB.getSessionSets(s.id);
    for (const r of rows) if (!r.isWarmup) sets.push(r);
  }
  const pillars = weeklyPillars(done, sets, byId, classById, dials);
  const shape = weeklyShapeMap(done, sets, classes, dials);
  const day = week.find((d) => d.date === today) || null;
  let conflicts = [];
  try { conflicts = detectConflicts(week) || []; } catch (_) { conflicts = []; }

  return {
    profile, dials, today, weekStart, weekEnd, classes, week, sessions, done, sets, pillars, shape,
    day, conflicts,
    programWeek: currentProgramWeek(profile),
    doneOn: (iso) => done.filter((s) => s.date === iso),
    classesOn: (iso) => classesOnDate(classes, iso),
  };
}

/** The resolved plan for a scheduled session: name, minutes, exercise items. */
export function resolvePlan(profile, session) {
  if (!session) return null;
  try { return planFor(profile, session); } catch (err) { console.error(err); return null; }
}

/** The diagram key for the first exercise that has a picture, for hero art. */
export function heroKeyFor(plan) {
  if (!plan || !plan.items) return null;
  for (const it of plan.items) {
    const k = diagramKeyFor(it.exercise);
    if (k) return k;
  }
  return null;
}

export function programDays(profile) {
  try { return (programOf(profile) || {}).days || []; } catch (_) { return []; }
}

/** Consecutive weeks (ending this week, or last week if this one is empty so far) with a workout. */
export async function weekStreak() {
  const all = (await DB.getAll('sessions')) || [];
  const weeks = new Set(all.filter((s) => s.complete).map((s) => mondayOf(s.date)));
  let cursor = mondayOf(todayISO());
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
  let n = 0;
  while (weeks.has(cursor)) { n++; cursor = addDays(cursor, -7); }
  return { weeks: n, total: all.filter((s) => s.complete).length };
}

export async function avatarHtml(profile) {
  const photo = await DB.getPref('avatar', null);
  if (photo) return '<img src="' + esc(photo) + '" alt="">';
  return avatarArt((profile && profile.name) || '');
}

export async function avatarButton() {
  const profile = Store.get('profile') || {};
  return '<button type="button" class="avatar-btn" data-action="nav-push" data-page="profile" aria-label="Your profile">' +
    await avatarHtml(profile) + '</button>';
}

/** Short, friendly description of a session's type. */
export function typeLabel(type) {
  return {
    lower: 'Lower body', 'lower-heavy': 'Lower body · heavy', upper: 'Upper body', full: 'Full body',
    conditioning: 'Cardio intervals', recovery: 'Easy movement', class: 'Class',
  }[type] || 'Workout';
}

export function focusChips(focus, max = 3) {
  const labels = {
    gluteMax: 'Glutes', gluteMed: 'Hips', hamstrings: 'Hamstrings', quads: 'Quads', calves: 'Calves',
    delts: 'Shoulders', back: 'Back', triceps: 'Arms', biceps: 'Arms', chest: 'Chest', core: 'Core',
  };
  const seen = new Set();
  const out = [];
  for (const f of focus || []) {
    const l = labels[f];
    if (!l || seen.has(l)) continue;
    seen.add(l);
    out.push('<span class="chip chip-glass">' + esc(l) + '</span>');
    if (out.length >= max) break;
  }
  return out.join('');
}

export function sessionsDoneLabel(ctx) {
  const lifts = ctx.done.filter((s) => !(s.classId || s.type === 'class')).length;
  const classes = ctx.done.length - lifts;
  return { lifts, classes, total: ctx.done.length };
}
