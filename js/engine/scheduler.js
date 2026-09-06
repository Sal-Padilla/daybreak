// Daybreak — js/engine/scheduler.js — builds the week around her classes: the Stack, the complement rules, and conflict detection.

import { PROGRAMS, programFor } from '../data/programs.js';
import { classById } from '../data/classes.js';

/*
 * THE STACK
 * ---------
 * Bay Club Redondo Beach opens 5:30 AM Mon–Fri and 7:00 AM Sat–Sun; weekday classes run
 * 6:00–7:00, weekend classes start 8:00. So on a class morning she is in the building a full
 * half hour before the class starts, and that half hour is training. That is the Stack:
 * doors open → short complementary lift → class. Never the reverse, and never a session type
 * the class will ruin.
 *
 * Rules, in the order the contract states them (BUILD_CONTRACT §5.4):
 *   R0  zero classes → the program's days spread Mon/Wed/Fri, Saturday sprints, Sunday walk.
 *   R1  a class that morning → dayType 'stack', blockSize 'short', session at club open.
 *   R2  the session type comes from the class's pairWith, never from its blocks.
 *   R3  no lower-body session inside recoveryHours after a high / very-high legFatigue class.
 *   R4  low-intensity classes are buffers — keep them between the heavy days where we can.
 *
 * WARNING CODES this file emits, and the fix action each carries:
 *   HEAVY_LOWER_TOO_SOON  → { action:'move-session', payload:{ programDayKey, fromDayIndex,
 *                             fromDate, toDayIndex, toDate, classId } }
 *   BACK_TO_BACK_HEAVY    → { action:'move-session', payload: same shape }
 *   TOO_MANY_HEAVY        → { action:'drop-session', payload:{ dayIndex, date, programDayKey } }
 *   NO_IMPACT             → { action:'add-impact',   payload:{ dayIndex, date } }
 *
 * CONVENTIONS
 *   - Week entries are Monday first. `dayIndex` is 0=Mon … 6=Sun; `dayOfWeek` is the JavaScript
 *     number (0=Sun … 6=Sat) so it lines up with the `dayOfWeek` index on the classes store.
 *   - Stored class records may number their day either way (0=Sun or 1=Mon). Both are read
 *     correctly: 0 and 7 mean Sunday, 1–6 mean Mon–Sat in both conventions.
 *   - Every date is built from local calendar parts. No toISOString, no getUTC* — those shift
 *     the day either side of midnight and would put her Monday session on Sunday.
 */

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const JS_DOW = [1, 2, 3, 4, 5, 6, 0]; // Monday-first index → JS Date.getDay()

const OPEN_WEEKDAY = 5 * 60 + 30;     // 05:30
const OPEN_WEEKEND = 7 * 60;          // 07:00

const FULL_BLOCK_MIN = 55;            // contract: a full block is 55–65 min of lifting
const SHORT_BLOCK_MIN = 25;           // contract: a short block is 25–35 min
const MIN_STACK_WINDOW = 20;          // below this there is no room to lift before the class
const SPRINT_BLOCK_MIN = 16;          // 6–8 × 20 s with 2 min easy between
const WALK_MINUTES = 50;              // Sunday walk, 45–60 min

const LOWER_TYPES = new Set(['lower', 'lower-heavy', 'glute']);
const LIFT_TYPES = new Set(['lower', 'lower-heavy', 'glute', 'upper', 'full']);
const SESSION_TYPES = ['lower', 'lower-heavy', 'upper', 'full', 'glute', 'conditioning', 'recovery'];
const HIGH_LEG = new Set(['high', 'very-high']);

// Where the program's days sit in a class-free week. Index 2 → Mon/Wed/Fri, which is R0.
const CANONICAL_SPREAD = { 0: [], 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] };

// Layout scoring. Hard rules cost enough that no arrangement of soft preferences can outvote them.
const COST_BLOCKED = 1000;        // R2 — the class forbids this session type
const COST_RECOVERY = 500;        // R3 — legs will not be recovered
const COST_BACK_TO_BACK = 200;    // two lower days with no day between
const COST_OVERRIDE_HONOURED = 500; // a hand-moved session outranks every automatic preference
const COST_OVERRIDE_IGNORED  = 500;
const COST_STACK_MATCH = 10;      // stacking costs volume, so only stack when the week is tight
const COST_STACK_MISMATCH = 45;   // stacking onto a class that did not ask for this type
const COST_ADJACENT = 12;         // any two lift days on consecutive mornings
const COST_ORDER = 5;             // per pair of program days run out of their written order
const COST_DRIFT = 3;             // per day away from the canonical spread — the tie-breaker
const BONUS_BUFFER = -4;          // R4 — a low-intensity class sitting between two lift days

// Used when a stored class points at a format we do not ship. Assume it costs her legs something.
const UNKNOWN_FORMAT = {
  id: 'other',
  name: 'Class',
  intensity: 'moderate',
  legFatigue: 'moderate',
  cnsCost: 'moderate',
  counts: { conditioning: 0.5, resistance: 0 },
  pairWith: ['upper'],
  blocks: ['lower-heavy'],
  recoveryHours: 12,
  shapeContribution: {},
  typicalStart: '06:00',
  durationMin: 45,
  note: 'Daybreak does not know this format, so it assumes it costs your legs something.'
};

// Only reached if programs.js hands back nothing usable. The week must never come back empty.
const FALLBACK_PROGRAM = {
  id: 'fallback-3day',
  name: 'Three-day strength',
  weeks: 4,
  days: [
    { key: 'lower-a', name: 'Lower A', type: 'lower', focus: ['gluteMax', 'hamstrings'] },
    { key: 'upper-a', name: 'Upper', type: 'upper', focus: ['delts', 'back', 'triceps'] },
    { key: 'lower-b', name: 'Lower B', type: 'lower', focus: ['gluteMed', 'quads'] }
  ]
};

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

function num(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function round5(n) {
  return Math.round(n / 5) * 5;
}

/** Local calendar date → 'YYYY-MM-DD'. Local parts only. */
function isoOf(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 'YYYY-MM-DD' (or a Date) → a Date at LOCAL midnight, or null. */
function parseLocalDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(value == null ? '' : value));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

/** The Monday of the week `date` falls in — so a mid-week weekStart still returns Monday first. */
function mondayOf(date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/** '06:30', '6:30', '6:30 AM', 390 → minutes past local midnight, or null. */
function parseTime(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(1439, Math.round(value)));
  }
  const s = String(value == null ? '' : value).trim().toLowerCase();
  if (!s) return null;
  const m = /^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return h * 60 + min;
}

/** 350 → '05:50'. The stored/display form for startTime and classStart. */
function fmt24(minutes) {
  const m = Math.max(0, Math.min(1439, Math.round(minutes)));
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** 390 → '6:30'. Everything here happens before noon, so no meridiem in the copy. */
function fmtHuman(minutes) {
  const m = Math.max(0, Math.min(1439, Math.round(minutes)));
  return `${Math.floor(m / 60)}:${pad2(m % 60)}`;
}

function titleize(key) {
  return String(key || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ') || 'Session';
}

/** 0/7 → Sunday, 1–6 → Mon–Sat: correct for both getDay() and ISO numbering. Names accepted too. */
function normalizeDayIndex(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.round(value);
    if (n === 0 || n === 7) return 6;
    if (n >= 1 && n <= 6) return n - 1;
    return null;
  }
  const s = String(value == null ? '' : value).trim().toLowerCase();
  if (!s) return null;
  if (/^\d+$/.test(s)) return normalizeDayIndex(Number(s));
  const stem = s.slice(0, 3);
  const i = DAY_NAMES.findIndex((n) => n.toLowerCase().startsWith(stem));
  return i >= 0 ? i : null;
}

/** Session types share a family so 'lower' can satisfy a pairWith of 'lower-heavy'. */
function familyOf(type) {
  if (LOWER_TYPES.has(type)) return 'lower';
  return type || 'full';
}

/** Position of a session type in a pairWith list, matching by family. -1 when absent. */
function pairIndex(pairWith, type) {
  const list = Array.isArray(pairWith) ? pairWith : [];
  const fam = familyOf(type);
  for (let i = 0; i < list.length; i++) {
    const want = String(list[i] || '').toLowerCase();
    if (want === type || familyOf(want) === fam) return i;
  }
  return -1;
}

/** blocks is checked exactly — classes.js lists every forbidden variant explicitly. */
function isBlocked(format, type) {
  const list = Array.isArray(format && format.blocks) ? format.blocks : [];
  return list.indexOf(type) >= 0;
}

/* ------------------------------------------------------------------ *
 * Input normalisation
 * ------------------------------------------------------------------ */

function normalizeDials(dials) {
  const d = dials && typeof dials === 'object' ? dials : {};
  const pos = (v, fb) => {
    const n = num(v, NaN);
    return Number.isFinite(n) && n >= 0 ? n : fb;
  };
  return {
    heavyDaysPerWeek: Math.max(1, Math.round(pos(d.heavyDaysPerWeek, 3))),
    impactSessionsPerWeek: Math.round(pos(d.impactSessionsPerWeek, 1)),
    sprintSessionsPerWeek: Math.round(pos(d.sprintSessionsPerWeek, 1)),
    warmupMinutes: Math.max(5, Math.round(pos(d.warmupMinutes, 12)))
  };
}

function resolveProgram(profile) {
  const usable = (p) => !!(p && Array.isArray(p.days) && p.days.length);
  const table = PROGRAMS && typeof PROGRAMS === 'object' ? PROGRAMS : null;

  let program = null;
  try {
    const r = programFor(profile);
    program = typeof r === 'string' ? (table ? table[r] : null) : r;
  } catch (err) {
    console.error('Daybreak scheduler: programFor(profile) failed.', err);
    program = null;
  }
  if (usable(program)) return program;

  if (table && profile && profile.programId && usable(table[profile.programId])) {
    return table[profile.programId];
  }
  if (table) {
    const first = Object.keys(table).map((k) => table[k]).find(usable);
    if (first) return first;
  }
  return FALLBACK_PROGRAM;
}

function normalizeSessionType(type, key) {
  const t = String(type == null ? '' : type).trim().toLowerCase();
  if (SESSION_TYPES.indexOf(t) >= 0) return t;
  const k = String(key == null ? '' : key).toLowerCase();
  if (k.includes('glute')) return 'glute';
  if (k.includes('lower')) return 'lower';
  if (k.includes('upper')) return 'upper';
  return 'full';
}

function normalizeProgramDays(program) {
  const rows = Array.isArray(program && program.days) ? program.days : [];
  return rows
    .filter((d) => d && typeof d === 'object')
    .slice(0, 5)
    .map((d, i) => {
      const key = String(d.key || d.id || `day-${i + 1}`);
      return {
        key,
        name: String(d.name || titleize(key)),
        type: normalizeSessionType(d.type, key),
        focus: Array.isArray(d.focus) ? d.focus.slice() : []
      };
    });
}

/**
 * Stored class records → the shape the scheduler works in.
 * Tolerant about field names because the class editor and older exports disagree.
 */
function normalizeClasses(classes) {
  const rows = Array.isArray(classes) ? classes : [];
  const out = [];

  rows.forEach((raw) => {
    if (!raw || typeof raw !== 'object') return;
    if (raw.active === false || raw.enabled === false) return;

    const dayIndex = normalizeDayIndex(
      raw.dayOfWeek != null ? raw.dayOfWeek
        : raw.day != null ? raw.day
          : raw.dow != null ? raw.dow : raw.weekday
    );
    if (dayIndex === null) return;

    const format =
      classById(raw.formatId) ||
      classById(raw.format) ||
      classById(raw.classFormatId) ||
      classById(raw.type) ||
      classById(raw.classId) ||
      classById(raw.id) ||
      classById(raw.name) ||
      UNKNOWN_FORMAT;

    const open = dayIndex >= 5 ? OPEN_WEEKEND : OPEN_WEEKDAY;
    const startMin = parseTime(
      raw.time != null ? raw.time
        : raw.startTime != null ? raw.startTime
          : raw.start != null ? raw.start : format.typicalStart
    );
    const start = startMin === null ? open + 30 : startMin;

    const duration = Math.max(10, Math.min(120, Math.round(num(
      raw.durationMin != null ? raw.durationMin : (raw.duration != null ? raw.duration : format.durationMin),
      45
    ))));

    out.push({
      id: raw.id != null ? raw.id : (raw.classId != null ? raw.classId : format.id),
      formatId: format.id,
      name: String(raw.name || format.name || 'Class'),
      dayIndex,
      startMin: start,
      endMin: Math.min(1439, start + duration),
      durationMin: duration,
      format
    });
  });

  return out;
}

/* ------------------------------------------------------------------ *
 * Placement
 * ------------------------------------------------------------------ */

/** Ordered subsets of size k from 0…n-1, lexicographic. C(5,3) = 10 — exhaustive is free here. */
function combos(n, k) {
  const out = [];
  const cur = [];
  (function walk(start) {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let i = start; i < n; i++) { cur.push(i); walk(i + 1); cur.pop(); }
  })(0);
  return out;
}

/**
 * The worst R3 violation for a lower-body session starting on `dayIndex`, or null.
 * Classes recur weekly, so each one is also tested at dayIndex − 7: a Sunday cycle class
 * really does sit 21 hours before Monday's lift.
 */
function recoveryConflict(dayIndex, ctx) {
  const startAbs = dayIndex * 1440 + ctx.startMinFor(dayIndex, !!ctx.dayClass[dayIndex]);
  let worst = null;

  ctx.classRows.forEach((c) => {
    if (!HIGH_LEG.has(c.format.legFatigue)) return;
    const need = num(c.format.recoveryHours, 24);
    if (need <= 0) return;

    [0, -7].forEach((offset) => {
      const endAbs = (c.dayIndex + offset) * 1440 + c.endMin;
      if (endAbs > startAbs) return;                 // class comes after the lift — the Stack, fine
      const gap = (startAbs - endAbs) / 60;
      if (gap >= need) return;
      const shortfall = need - gap;
      if (!worst || shortfall > worst.shortfall) worst = { cls: c, gap, need, shortfall };
    });
  });

  return worst;
}

/** Cost of one candidate layout. Lower is better; ties keep the earlier (more canonical) one. */
function scoreLayout(assign, ctx) {
  let cost = 0;
  const canonical = CANONICAL_SPREAD[assign.length] || [];
  const usedSlots = assign.map((a) => a.slot);
  const overrides = ctx.overrides || {};

  assign.forEach((a, i) => {
    // If she has moved a session by hand, that beats everything the scorer would otherwise
    // prefer. Without this the "Move it" button writes a preference nothing reads.
    const want = overrides[a.day.key];
    if (Number.isFinite(want)) {
      cost += a.slot === want ? -COST_OVERRIDE_HONOURED : COST_OVERRIDE_IGNORED;
    }

    cost += COST_DRIFT * Math.abs(a.slot - (canonical[i] == null ? a.slot : canonical[i]));

    const cls = ctx.dayClass[a.slot];
    if (cls) {
      if (isBlocked(cls.format, a.day.type)) cost += COST_BLOCKED;
      else if (pairIndex(cls.format.pairWith, a.day.type) >= 0) cost += COST_STACK_MATCH;
      else cost += COST_STACK_MISMATCH;
    }

    if (LOWER_TYPES.has(a.day.type) && recoveryConflict(a.slot, ctx)) cost += COST_RECOVERY;
  });

  for (let i = 1; i < assign.length; i++) {
    const gap = assign[i].slot - assign[i - 1].slot;
    if (gap === 1) {
      cost += COST_ADJACENT;
      if (LOWER_TYPES.has(assign[i].day.type) && LOWER_TYPES.has(assign[i - 1].day.type)) {
        cost += COST_BACK_TO_BACK;
      }
    }
  }

  // R4 — a low-intensity class morning left free between two lift days is a buffer, not a gap.
  for (let s = 0; s < 5; s++) {
    const cls = ctx.dayClass[s];
    if (!cls || cls.format.intensity !== 'low') continue;
    if (usedSlots.indexOf(s) >= 0) continue;
    const before = usedSlots.some((u) => u < s);
    const after = usedSlots.some((u) => u > s);
    if (before && after) cost += BONUS_BUFFER;
  }

  return cost;
}

/**
 * Where a session sits on a day that may carry a class.
 * With a class: lift at club open and the class follows (R1). If the class starts at the door
 * there is no room, so the lift moves after it rather than being dropped.
 */
function placeAroundClass(dayIndex, cls, wantMinutes, ctx) {
  const open = dayIndex >= 5 ? OPEN_WEEKEND : OPEN_WEEKDAY;
  if (!cls) {
    return {
      startMin: ctx.startMinFor(dayIndex, false),
      estMinutes: wantMinutes,
      order: 'solo',
      blockSize: 'full'
    };
  }
  const window = cls.startMin - open;
  if (window >= MIN_STACK_WINDOW) {
    return {
      startMin: open,
      estMinutes: Math.max(MIN_STACK_WINDOW, Math.min(wantMinutes, window)),
      order: 'before-class',
      blockSize: 'short'
    };
  }
  return {
    startMin: cls.endMin,
    estMinutes: Math.min(wantMinutes, 40),
    order: 'after-class',
    blockSize: 'short'
  };
}

/**
 * A day this session could move to. Weekdays only, must be free, must not be blocked by a class
 * there. `strict` also demands recovery is clear and no lower day sits either side.
 */
function findMoveTarget(week, fromIndex, ctx, strict) {
  const session = week[fromIndex] && week[fromIndex].session;
  if (!session) return null;
  const lower = LOWER_TYPES.has(session.type);

  const order = [];
  for (let d = 1; d <= 6; d++) {
    if (fromIndex + d <= 4) order.push(fromIndex + d);
    if (fromIndex - d >= 0) order.push(fromIndex - d);
  }

  for (let i = 0; i < order.length; i++) {
    const j = order[i];
    if (j < 0 || j > 4) continue;
    const day = week[j];
    if (!day || day.session) continue;

    const cls = ctx.dayClass[j];
    if (cls && isBlocked(cls.format, session.type)) continue;

    if (lower) {
      if (recoveryConflict(j, ctx)) continue;
      if (strict) {
        const neighbourIsLower = (n) =>
          !!n && n !== week[fromIndex] && !!n.session && LOWER_TYPES.has(n.session.type);
        if (neighbourIsLower(week[j - 1]) || neighbourIsLower(week[j + 1])) continue;
      }
    }
    return j;
  }
  return null;
}

function moveFix(week, fromIndex, toIndex, classId) {
  const session = week[fromIndex].session;
  return {
    action: 'move-session',
    payload: {
      programDayKey: session ? session.programDayKey : null,
      fromDayIndex: fromIndex,
      fromDate: week[fromIndex].date,
      toDayIndex: toIndex,
      toDate: toIndex === null ? null : week[toIndex].date,
      classId: classId == null ? null : classId
    }
  };
}

/* ------------------------------------------------------------------ *
 * buildWeek
 * ------------------------------------------------------------------ */

/**
 * Build the seven-day plan.
 *
 * @param {object} profile  the stored profile (programId, experience, trainTime, pelvicFloor…)
 * @param {Array}  classes  stored class records: { id, formatId, dayOfWeek, time, durationMin, active }
 * @param {object} dials    dialsFor(profile) from lifestage.js
 * @param {string} weekStartISO  any date in the week, 'YYYY-MM-DD'; snapped to that Monday
 * @returns {Array} exactly 7 entries, Monday first
 */
export function buildWeek(profile, classes, dials, weekStartISO, options) {
  const prof = profile && typeof profile === 'object' ? profile : {};
  const D = normalizeDials(dials);
  const monday = mondayOf(parseLocalDate(weekStartISO) || new Date());
  const trainMin = parseTime(prof.trainTime);

  const classRows = normalizeClasses(classes);
  const dayClass = new Array(7).fill(null);
  classRows.forEach((c) => {
    const current = dayClass[c.dayIndex];
    if (!current || c.startMin < current.startMin) dayClass[c.dayIndex] = c;
  });

  /** Session start: club open, or her own later train time on a day with no class to catch. */
  const startMinFor = (dayIndex, hasClass) => {
    const open = dayIndex >= 5 ? OPEN_WEEKEND : OPEN_WEEKDAY;
    if (hasClass) return open;
    return trainMin === null ? open : Math.max(open, trainMin);
  };

  const overrides = (options && options.overrides) || {};
  const ctx = { classRows, dayClass, startMinFor, dials: D, overrides };

  // ---- the seven days -------------------------------------------------
  const week = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const cls = dayClass[i];
    week.push({
      date: isoOf(date),
      dayOfWeek: JS_DOW[i],
      dayIndex: i,
      dayName: DAY_NAMES[i],
      dayShort: DAY_SHORT[i],
      isWeekend: i >= 5,
      dayType: 'rest',
      classId: cls ? cls.id : null,
      classFormatId: cls ? cls.formatId : null,
      className: cls ? cls.name : null,
      classStart: cls ? fmt24(cls.startMin) : null,
      classEnd: cls ? fmt24(cls.endMin) : null,
      session: null,
      note: null,
      warnings: []
    });
  }

  // ---- lift days: exhaustive over Mon–Fri, program order preserved ----
  const programDays = normalizeProgramDays(resolveProgram(prof));
  const wantFull = round5(D.warmupMinutes + FULL_BLOCK_MIN);
  const wantShort = round5(D.warmupMinutes + SHORT_BLOCK_MIN);

  let best = null;
  combos(5, Math.min(programDays.length, 5)).forEach((slots) => {
    const assign = programDays.map((day, i) => ({ day, slot: slots[i] }));
    const cost = scoreLayout(assign, ctx);
    if (best === null || cost < best.cost) best = { cost, assign };
  });

  if (best) {
    best.assign.forEach(({ day, slot }) => {
      const cls = dayClass[slot];
      const place = placeAroundClass(slot, cls, cls ? wantShort : wantFull, ctx);
      let note = null;
      if (place.order === 'before-class') {
        note = `Doors at ${fmtHuman(slot >= 5 ? OPEN_WEEKEND : OPEN_WEEKDAY)}, ${cls.name} at ${fmtHuman(cls.startMin)}. Warm up, hit the two main lifts, leave the accessories.`;
      } else if (place.order === 'after-class') {
        note = `${cls.name} starts when the doors open, so the lift comes after it. You will already be warm — two ramp sets and in.`;
      }
      week[slot].session = {
        programDayKey: day.key,
        name: day.name,
        type: day.type,
        focus: day.focus.slice(),
        blockSize: place.blockSize,
        startTime: fmt24(place.startMin),
        estMinutes: place.estMinutes,
        order: place.order,
        impact: false,
        note
      };
    });
  }

  // ---- Saturday: sprint intervals in the 7:00–8:00 hour ---------------
  const satClass = dayClass[5];
  if (D.sprintSessionsPerWeek > 0) {
    const fmt = satClass ? satClass.format : null;
    const coveredByClass = !!fmt && (
      num(fmt.counts && fmt.counts.conditioning, 0) >= 0.5 ||
      HIGH_LEG.has(fmt.legFatigue) ||
      isBlocked(fmt, 'conditioning')
    );
    if (!coveredByClass) {
      const place = placeAroundClass(5, satClass, round5(D.warmupMinutes + SPRINT_BLOCK_MIN), ctx);
      week[5].session = {
        programDayKey: null,
        name: 'Sprint intervals',
        type: 'conditioning',
        focus: [],
        blockSize: place.blockSize,
        startTime: fmt24(place.startMin),
        estMinutes: place.estMinutes,
        order: place.order,
        impact: false,
        note: 'Six to eight rounds: 20 seconds all-out on the bike or rower, two minutes easy between. Short is the point — it costs your lifting almost nothing.'
      };
    } else if (satClass) {
      week[5].note = `${satClass.name} covers your conditioning this week.`;
    }
  }

  // ---- Sunday: walk and the weekly report -----------------------------
  const sunClass = dayClass[6];
  const sunPlace = placeAroundClass(6, sunClass, WALK_MINUTES, ctx);
  week[6].session = {
    programDayKey: null,
    name: 'Walk + weekly report',
    type: 'recovery',
    focus: [],
    blockSize: sunPlace.blockSize,
    startTime: fmt24(sunPlace.startMin),
    estMinutes: sunPlace.estMinutes,
    order: sunPlace.order,
    impact: false,
    note: 'Forty-five to sixty minutes easy, outside if you can. Then read the week back.'
  };

  // ---- day types (R1: a class that morning makes the day a stack) -----
  week.forEach((day) => {
    if (day.classId) day.dayType = 'stack';
    else if (day.session) day.dayType = day.isWeekend ? 'weekend' : 'solo';
    else day.dayType = 'rest';

    if (day.classId && !day.session && !day.note) {
      day.note = `${day.className} is your training this morning — nothing lifts well before it.`;
    }
  });

  // ---- impact: bone responds to landing, so somebody has to carry it --
  if (D.impactSessionsPerWeek > 0) {
    const gentle = prof.pelvicFloor === 'often' || prof.pelvicFloor === 'sometimes';
    const line = gentle
      ? 'Finish with low landings — 3 × 8 pogo hops or step-downs, exhaling on the effort.'
      : 'Finish with impact work — 3 × 8 box jumps or pogo hops.';

    const carriers = [];
    week.forEach((day, i) => {
      const s = day.session;
      if (!s || s.blockSize !== 'full') return;
      if (LOWER_TYPES.has(s.type) || s.type === 'full') carriers.push(i);
    });
    carriers.reverse(); // the last lower day of the week carries it first

    const take = Math.min(D.impactSessionsPerWeek, carriers.length);
    for (let k = 0; k < take; k++) {
      const s = week[carriers[k]].session;
      s.impact = true;
      s.note = s.note ? `${s.note} ${line}` : line;
    }

    if (take === 0) {
      const cond = week.findIndex((d) => d.session && d.session.type === 'conditioning');
      if (cond >= 0) {
        const s = week[cond].session;
        s.impact = true;
        s.note = `${s.note} Run these on the turf rather than the bike if your knees are happy — landing is what bone responds to.`;
      }
    }
  }

  // ---- warnings -------------------------------------------------------
  addWarnings(week, ctx, D);
  return week;
}

/* ------------------------------------------------------------------ *
 * Warnings
 * ------------------------------------------------------------------ */

function addWarnings(week, ctx, D) {
  // R3 — heavy lower too soon after a leg-expensive class.
  week.forEach((day, i) => {
    const s = day.session;
    if (!s || !LOWER_TYPES.has(s.type)) return;
    const conflict = recoveryConflict(i, ctx);
    if (!conflict) return;

    let target = findMoveTarget(week, i, ctx, true);
    if (target === null) target = findMoveTarget(week, i, ctx, false);

    const cls = conflict.cls;
    const head = `You have ${cls.name} ${DAY_NAMES[cls.dayIndex]} ${fmtHuman(cls.startMin)} and ${s.name} ${DAY_NAMES[i]}. Your legs will not be recovered.`;
    const tail = target === null
      ? 'Move it later in the week, or take 10% off the top set.'
      : `Move ${s.name} to ${DAY_NAMES[target]}?`;

    day.warnings.push({
      code: 'HEAVY_LOWER_TOO_SOON',
      message: `${head} ${tail}`,
      fix: moveFix(week, i, target, cls.id)
    });
  });

  // Two lower days with nothing between them.
  for (let i = 1; i < 7; i++) {
    const a = week[i - 1].session;
    const b = week[i].session;
    if (!a || !b) continue;
    if (!LOWER_TYPES.has(a.type) || !LOWER_TYPES.has(b.type)) continue;

    let target = findMoveTarget(week, i, ctx, true);
    if (target === null) target = findMoveTarget(week, i, ctx, false);

    const head = `${a.name} ${DAY_NAMES[i - 1]} and ${b.name} ${DAY_NAMES[i]} are back to back. Glutes and hamstrings want a day between them.`;
    const tail = target === null
      ? 'Move one of them, or keep the second one light.'
      : `Move ${b.name} to ${DAY_NAMES[target]}?`;

    week[i].warnings.push({
      code: 'BACK_TO_BACK_HEAVY',
      message: `${head} ${tail}`,
      fix: moveFix(week, i, target, null)
    });
  }

  // More lifting days than the life-stage plan calls for.
  const liftDays = [];
  week.forEach((day, i) => {
    if (day.session && LIFT_TYPES.has(day.session.type)) liftDays.push(i);
  });
  if (liftDays.length > D.heavyDaysPerWeek) {
    const last = liftDays[liftDays.length - 1];
    const s = week[last].session;
    week[last].warnings.push({
      code: 'TOO_MANY_HEAVY',
      message: `That is ${liftDays.length} lifting days against the ${D.heavyDaysPerWeek} your plan calls for. Drop ${s.name} ${DAY_NAMES[last]}, or carry it into next week.`,
      fix: { action: 'drop-session', payload: { dayIndex: last, date: week[last].date, programDayKey: s.programDayKey } }
    });
  }

  // No landings anywhere in the week.
  if (D.impactSessionsPerWeek > 0) {
    const hasImpact = week.some((d) => d.session && d.session.impact);
    if (!hasImpact) {
      let target = -1;
      for (let i = 6; i >= 0; i--) {
        const s = week[i].session;
        if (s && LOWER_TYPES.has(s.type)) { target = i; break; }
      }
      if (target < 0) target = liftDays.length ? liftDays[liftDays.length - 1] : -1;
      if (target < 0) target = week.findIndex((d) => !!d.session);

      const where = target >= 0 ? ` Add box jumps or pogo hops to ${DAY_NAMES[target]}.` : ' Add a short jumping finisher to one of your lower days.';
      const day = week[target >= 0 ? target : 0];
      day.warnings.push({
        code: 'NO_IMPACT',
        message: `No impact work this week. Bone responds to landing, not just load.${where}`,
        fix: { action: 'add-impact', payload: { dayIndex: target >= 0 ? target : 0, date: day.date } }
      });
    }
  }
}

/* ------------------------------------------------------------------ *
 * detectConflicts
 * ------------------------------------------------------------------ */

/**
 * Flatten every warning in the week, tagged with the day it belongs to.
 * @param {Array} week  the array from buildWeek()
 * @returns {Array} [{ code, message, fix, dayIndex, date }]
 */
export function detectConflicts(week) {
  const rows = Array.isArray(week) ? week : [];
  const out = [];
  rows.forEach((day, i) => {
    if (!day || typeof day !== 'object') return;
    const warnings = Array.isArray(day.warnings) ? day.warnings : [];
    warnings.forEach((w) => {
      if (!w || typeof w !== 'object') return;
      out.push({
        code: w.code,
        message: w.message,
        fix: w.fix || null,
        dayIndex: typeof day.dayIndex === 'number' ? day.dayIndex : i,
        date: day.date || null
      });
    });
  });
  return out;
}
