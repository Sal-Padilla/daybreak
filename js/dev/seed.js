// Daybreak — js/dev/seed.js — a believable past, so the app can be judged with data in it.
//
// An empty fitness app tells you nothing. Every interesting behaviour — progression, personal
// bests, the strength trend lines, "moving up" in the weekly report, waist-to-hip drift, the
// deload countdown — only appears once there is history behind it.
//
// This generates that history for Rocio: fourteen weeks of training, built from the REAL
// program definitions so every exercise id is valid by construction, with progression that
// slows down the way real progression does, sessions she missed, and measurements that show
// recomposition rather than weight loss.
//
// Deterministic: the same seed always produces the same past, so a bug found in the demo data
// can be reproduced exactly.

import { DB } from '../core/db.js';
import { PROGRAMS } from '../data/programs.js';
import { byId } from '../data/exercises.js';
import { classById } from '../data/classes.js';
import { dialsFor } from '../engine/lifestage.js';

/* --------------------------------------------------------------- utilities */

/** Mulberry32 — small, fast, and seeded, so the demo past is always the same past. */
function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shiftDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return DB.todayISO(dt);
}

function mondayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return DB.todayISO(dt);
}

/** An ISO timestamp at a given local clock time on a given local date. */
function stampAt(iso, hhmm, minutesIn = 0) {
  const [y, m, d] = iso.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi + minutesIn).toISOString();
}

const roundTo = (n, step) => Math.round(n / step) * step;

/* ------------------------------------------------------- starting weights */

/**
 * A plausible first working weight for a woman new to lifting, per exercise.
 * Derived from the movement itself so a library change cannot leave a stale table behind.
 */
function startingWeight(exercise, bodyweightLb) {
  if (!exercise || exercise.track !== 'weight_reps') return null;
  const bw = bodyweightLb || 150;
  const eq = exercise.equipment || [];
  const primary = (exercise.primary || [])[0];

  // Fraction of bodyweight a novice woman typically starts a movement at.
  const byTarget = {
    gluteMax: 0.45, hamstrings: 0.28, quads: 0.42,
    back: 0.44, delts: 0.11, chest: 0.24, triceps: 0.16,
    biceps: 0.10, core: 0.15, gluteMed: 0.12, calves: 0.35,
  };
  let frac = byTarget[primary] != null ? byTarget[primary] : 0.2;

  // Dumbbell entries are per-hand, so the number on the card is much smaller.
  if (eq.includes('dumbbell')) frac *= 0.28;
  if (eq.includes('cable')) frac *= 0.55;
  if (eq.includes('machine')) frac *= 1.15;
  if (exercise.unilateral) frac *= 0.5;
  if (exercise.tier === 3) frac *= 0.75;

  const step = eq.includes('dumbbell') ? 2.5 : 5;
  return Math.max(step, roundTo(bw * frac, step));
}

/* ------------------------------------------------------------- the seeder */

const SEED_FLAG = 'demo:seeded';

/**
 * Build the demo past.
 * @param {object} opts
 * @param {number} [opts.weeks=14]
 * @param {number} [opts.seed=20260906]
 * @param {string} [opts.name='Rocio']
 * @returns {Promise<object>} a summary of what was written
 */
export async function seedDemoData(opts = {}) {
  const weeks = opts.weeks || 14;
  const rand = rng(opts.seed || 20260906);
  const name = opts.name || 'Rocio';

  const today = DB.todayISO();
  const startMonday = mondayOf(shiftDays(today, -((weeks - 1) * 7)));

  const bodyweightStart = 158;

  // Wipe first. Seeding on top of existing data interleaves two different pasts and produces
  // nonsense trend lines — the UI promises this replaces what is there, so it must.
  for (const store of ['sessions', 'sets', 'measurements', 'classes', 'cycleLog', 'reports']) {
    await DB.clear(store);
  }

  /* ---- profile ---------------------------------------------------------- */
  // Fourteen weeks in: she finished the On-Ramp and is on the ongoing program.
  const profile = {
    id: 'me',
    name,
    lifeStage: 'transition',
    experience: 'returning',
    birthYear: 1979,
    heightIn: 65,
    weightLb: 154,
    goal: 'recomp',
    pelvicFloor: 'sometimes',
    wakeTime: '04:00',
    trainTime: '05:30',
    theme: 'auto',
    programId: 'transition-3day',
    programWeek: weeks - 4,
    startedOn: startMonday,
    units: 'lb',
  };
  const dials = dialsFor(profile);
  profile.proteinTargetG = Math.round((profile.weightLb / 2.2046) * dials.proteinGPerKg);
  await DB.saveProfile(profile);

  /* ---- classes she actually goes to ------------------------------------- */
  const herClasses = [
    { formatId: 'mat-pilates', dayOfWeek: 2, time: '06:30' },
    { formatId: 'core-and-more', dayOfWeek: 4, time: '06:30' },
  ];
  for (const c of herClasses) {
    const f = classById(c.formatId);
    await DB.put('classes', {
      id: DB.uid(), formatId: c.formatId, dayOfWeek: c.dayOfWeek, time: c.time,
      durationMin: f ? f.durationMin : 50, active: true,
    });
  }

  /* ---- per-exercise running load --------------------------------------- */
  const bases = new Map();      // exerciseId -> starting working weight
  const loads = new Map();      // exerciseId -> weight actually used, most recent
  const stalls = new Map();     // exerciseId -> weeks currently stalled

  /**
   * How far a movement travels in fourteen weeks for a woman new to lifting.
   * Novice gains are large and lower-body compounds move furthest — a hip thrust
   * genuinely can more than double in a first block, where a lateral raise cannot.
   */
  function ceilingMultiple(ex) {
    const primary = (ex.primary || [])[0];
    const lowerCompound = ['gluteMax', 'quads', 'hamstrings'].includes(primary);
    if (lowerCompound && ex.tier === 1) return 2.5;
    if (lowerCompound) return 2.0;
    if (['back', 'chest'].includes(primary)) return 1.9;
    if (['delts', 'triceps', 'biceps', 'gluteMed'].includes(primary)) return 2.1;
    return 1.5;
  }

  /**
   * Progress as it actually looks: fast at the start, decelerating, never quite flat.
   * A pure random walk under-shoots badly over a long block, which is what made the
   * first version of this produce a 75 lb hip thrust after fourteen weeks.
   */
  function weightAt(item, weekIndex) {
    const ex = item.exercise;
    if (ex.track !== 'weight_reps') return null;

    if (!bases.has(ex.id)) bases.set(ex.id, startingWeight(ex, bodyweightStart));
    const base = bases.get(ex.id);
    if (base == null) return null;

    const ceiling = base * ceilingMultiple(ex);
    const span = ceiling - base;

    // Exponential approach: ~63% of the total gain by week 5, ~86% by week 10.
    const progress = 1 - Math.exp(-weekIndex / 5);

    // Stalls happen. Two or three weeks where the bar simply does not move.
    let stall = stalls.get(ex.id) || 0;
    if (stall > 0) stall -= 1;
    else if (weekIndex > 3 && rand() < 0.12) stall = 1 + Math.floor(rand() * 2);
    stalls.set(ex.id, stall);
    const held = stall > 0 ? Math.exp(-Math.max(0, weekIndex - 1) / 5) - Math.exp(-weekIndex / 5) : 0;

    const eq = ex.equipment || [];
    const step = eq.includes('dumbbell') ? 2.5
      : (['delts', 'triceps', 'biceps'].includes((ex.primary || [])[0]) || ex.tier === 3) ? 2.5 : 5;

    const w = roundTo(base + span * Math.max(0, progress - held), step);
    loads.set(ex.id, w);
    return Math.max(step, w);
  }

  /** Reps cycle up through the range between load jumps, the way double progression works. */
  function repsAt(item, weekIndex) {
    const [lo, hi] = item.reps;
    const cycle = (weekIndex + item.exerciseId.length) % (hi - lo + 1);
    return lo + cycle;
  }

  /* ---- resolve a program day into concrete items ------------------------ */
  function itemsFor(programId, dayKey, blockSize) {
    const program = PROGRAMS[programId];
    if (!program) return [];
    const day = (program.days || []).find((d) => d.key === dayKey);
    if (!day || !day.blocks) return [];
    const list = day.blocks[blockSize] || day.blocks.full || [];
    return list.map((it) => {
      const exercise = byId(it.exerciseId);
      if (!exercise) return null;
      return {
        exerciseId: it.exerciseId, exercise,
        sets: it.sets || 3,
        reps: it.reps || exercise.defaultReps || [8, 12],
        tier: it.tier || exercise.tier || 3,
      };
    }).filter(Boolean);
  }

  /* ---- the weeks -------------------------------------------------------- */
  const sessions = [];
  const sets = [];
  const measurements = [];
  const proteinDays = [];

  let weightNow = bodyweightStart;
  let waist = 34.0;
  let hip = 41.5;
  let thigh = 23.0;
  let arm = 11.5;

  for (let w = 0; w < weeks; w++) {
    const weekStart = shiftDays(startMonday, w * 7);
    const onRamp = w < 4;
    const programId = onRamp ? 'on-ramp' : 'transition-3day';
    const program = PROGRAMS[programId];
    const dayKeys = (program.days || []).map((d) => d.key);

    // Mon / Wed / Fri, in program order.
    const liftDays = [0, 2, 4];

    for (let i = 0; i < liftDays.length; i++) {
      const date = shiftDays(weekStart, liftDays[i]);
      if (date > today) continue;                       // never write the future

      const dayKey = dayKeys[i % dayKeys.length];
      // Real life: about one session in twelve does not happen.
      const missed = rand() < 0.085;
      if (missed) continue;

      // Tuesday's Mat Pilates does not clash; Monday is a solo full block.
      const blockSize = 'full';
      const items = itemsFor(programId, dayKey, blockSize);
      if (!items.length) continue;

      const dayDef = (program.days || []).find((d) => d.key === dayKey);
      const startedAt = stampAt(date, '05:30');
      const durationMin = 52 + Math.round(rand() * 18);

      const session = {
        id: DB.uid(),
        date,
        startedAt,
        endedAt: stampAt(date, '05:30', durationMin),
        type: dayDef ? dayDef.type : 'lower',
        name: dayDef ? dayDef.name : 'Session',
        programDayKey: dayKey,
        blockSize,
        estMinutes: durationMin,
        classId: null,
        readiness: {
          sleep: 2 + Math.floor(rand() * 4),
          energy: 2 + Math.floor(rand() * 4),
          soreness: 1 + Math.floor(rand() * 4),
        },
        notes: '',
        complete: true,
      };
      sessions.push(session);

      for (const item of items) {
        const weight = weightAt(item, w);
        const targetReps = repsAt(item, w);

        // Occasionally she cuts the last accessory short — the day ran out.
        const setCount = (item.tier === 3 && rand() < 0.18) ? item.sets - 1 : item.sets;

        for (let s = 1; s <= setCount; s++) {
          // Reps drift down across sets, the way they actually do.
          const fatigue = s === 1 ? 0 : (rand() < 0.55 ? 1 : 0);
          const reps = Math.max(item.reps[0] - 1, targetReps - fatigue);

          const track = item.exercise.track;
          sets.push({
            id: DB.uid(),
            sessionId: session.id,
            exerciseId: item.exerciseId,
            setNumber: s,
            weight: track === 'weight_reps' ? weight : null,
            reps: (track === 'weight_reps' || track === 'bodyweight_reps' || track === 'reps_only') ? reps : null,
            seconds: track === 'time_hold' ? 25 + Math.round(rand() * 20) : null,
            distance: null,
            rir: s === setCount ? Math.max(0, dials.rirTarget[0] - Math.floor(rand() * 2)) : null,
            isWarmup: false,
            loggedAt: stampAt(date, '05:30', 8 + items.indexOf(item) * 7 + s * 2),
          });
        }

        // weightAt() already advanced the trajectory for this week.
      }
    }

    /* ---- classes attended ---------------------------------------------- */
    for (const c of herClasses) {
      const offset = (c.dayOfWeek + 6) % 7;              // Monday-first index
      const date = shiftDays(weekStart, offset);
      if (date > today) continue;
      if (rand() < 0.28) continue;                       // she misses some
      const fmt = classById(c.formatId);
      sessions.push({
        id: DB.uid(),
        date,
        startedAt: stampAt(date, c.time),
        endedAt: stampAt(date, c.time, fmt ? fmt.durationMin : 50),
        type: 'class',
        name: fmt ? fmt.name : 'Class',
        programDayKey: null,
        blockSize: 'full',
        estMinutes: fmt ? fmt.durationMin : 50,
        classId: c.formatId,
        classFormatId: c.formatId,
        readiness: null,
        notes: '',
        complete: true,
      });
    }

    /* ---- Saturday sprints, most weeks ----------------------------------- */
    const satDate = shiftDays(weekStart, 5);
    if (satDate <= today && rand() < 0.62) {
      sessions.push({
        id: DB.uid(),
        date: satDate,
        startedAt: stampAt(satDate, '07:00'),
        endedAt: stampAt(satDate, '07:00', 28),
        type: 'conditioning',
        name: 'Sprint intervals',
        programDayKey: null,
        blockSize: 'full',
        estMinutes: 28,
        classId: null,
        readiness: null,
        notes: '',
        complete: true,
      });
    }

    /* ---- Sunday walk ----------------------------------------------------- */
    const sunDate = shiftDays(weekStart, 6);
    if (sunDate <= today && rand() < 0.7) {
      sessions.push({
        id: DB.uid(),
        date: sunDate,
        startedAt: stampAt(sunDate, '08:00'),
        endedAt: stampAt(sunDate, '08:00', 45),
        type: 'recovery',
        name: 'Walk',
        programDayKey: null,
        blockSize: 'full',
        estMinutes: 45,
        classId: null,
        readiness: null,
        notes: 'Esplanade loop',
        complete: true,
      });
    }

    /* ---- protein, logged most days -------------------------------------- */
    for (let d = 0; d < 7; d++) {
      const date = shiftDays(weekStart, d);
      if (date > today) continue;
      if (rand() < 0.2) continue;                        // some days not logged
      // Adherence improves as the habit sticks.
      const hitChance = 0.5 + Math.min(0.35, w * 0.03);
      proteinDays.push({ date, hit: rand() < hitChance });
    }

    /* ---- measurements every fortnight ------------------------------------ */
    if (w % 2 === 0) {
      const date = shiftDays(weekStart, 0);
      if (date <= today) {
        // The point of the demo: waist falls, hips grow, the scale barely moves.
        // That is recomposition, and it is exactly what a scale-only view hides.
        waist -= 0.18 + rand() * 0.16;
        hip += 0.055 + rand() * 0.05;
        thigh += 0.03 + rand() * 0.04;
        arm += 0.015 + rand() * 0.025;
        weightNow -= 0.22 + rand() * 0.28;

        measurements.push({
          id: DB.uid(),
          date,
          waistIn: Math.round(waist * 4) / 4,
          hipIn: Math.round(hip * 4) / 4,
          thighIn: Math.round(thigh * 4) / 4,
          armIn: Math.round(arm * 4) / 4,
          weightLb: Math.round(weightNow * 2) / 2,
          note: '',
        });
      }
    }
  }

  /* ---- write it all ------------------------------------------------------ */
  await DB.putAll('sessions', sessions);
  await DB.putAll('sets', sets);
  await DB.putAll('measurements', measurements);
  for (const p of proteinDays) await DB.setPref('protein:' + p.date, p.hit);
  await DB.setPref('backup:at', new Date(stampAt(shiftDays(today, -9), '20:00')).toISOString());
  await DB.setPref(SEED_FLAG, true);

  // Keep the profile's current weight consistent with the last measurement.
  if (measurements.length) {
    const last = measurements[measurements.length - 1];
    await DB.saveProfile({ weightLb: last.weightLb });
  }

  const bests = [...loads.entries()]
    .map(([id, w]) => ({ name: (byId(id) || {}).name || id, weight: w }))
    .filter((x) => x.weight)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);

  return {
    name,
    weeks,
    sessions: sessions.length,
    sets: sets.length,
    measurements: measurements.length,
    classes: herClasses.length,
    proteinDaysLogged: proteinDays.length,
    from: startMonday,
    to: today,
    endingLoads: bests,
  };
}

/** True when this device is showing generated history rather than real training. */
export async function isDemoData() {
  return !!(await DB.getPref(SEED_FLAG, false));
}

/** Wipe everything, including the demo flag. */
export async function clearDemoData() {
  await DB.clearAll();
}
