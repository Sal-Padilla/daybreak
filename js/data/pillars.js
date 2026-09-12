// Daybreak — js/data/pillars.js — the four things a training week has to cover.
//
// The Shape Map answers "which muscles". This answers the bigger question: is the WEEK
// balanced? Four sessions of hip thrusts is a full Shape Map and a badly built week.
//
//   Resistive   load against muscle — the part that builds and keeps tissue and bone
//   Control     stability, mobility, balance, deep core — the part that keeps you training
//   Cardio      heart, lungs, conditioning — the part that changes body composition
//   Shape       the targeted work: glutes, hips, shoulder cap, waist
//
// Every exercise and every class scores 0–1 on each. The week is graded against life-stage
// targets, and the recommendation engine spends its advice on whichever pillar is furthest down.

import { SHAPE_TARGETS } from './exercises.js';

export const PILLARS = {
  resistive: {
    id: 'resistive',
    name: 'Resistive training',
    short: 'Strength',
    tone: 'accent',
    blurb: 'Loading muscle hard enough that it has to adapt.',
    why: 'This is the non-negotiable one. Through perimenopause you can lose ten to twenty percent of your lean muscle, and muscle is what holds your metabolism, your strength and your bone density up. Heavy loading is the only signal that reliably reverses it — and heavy means genuinely heavy, not a light bar for sixty reps.'
  },
  control: {
    id: 'control',
    name: 'Control training',
    short: 'Control',
    tone: 'calm',
    blurb: 'Stability, mobility, balance and deep core.',
    why: 'The quiet pillar, and the one that decides whether you are still training in five years. Deep core and pelvic floor coordination make heavy lifting safe; hip and thoracic mobility decide how well you can squat and press at all; balance and single-leg control are what actually prevent falls later. It costs almost nothing to train and it protects everything else.'
  },
  cardio: {
    id: 'cardio',
    name: 'Cardio',
    short: 'Cardio',
    tone: 'signal',
    blurb: 'Heart, lungs and conditioning.',
    why: 'Where most of the fat-loss and heart-health return lives. The useful version for you is polarised — a couple of genuinely hard, short interval sessions, and the rest genuinely easy. The trap is the middle: long moderate cardio every day eats into your recovery and blunts your strength work without giving you much back.'
  },
  shape: {
    id: 'shape',
    name: 'Lady improvements',
    short: 'Shape',
    tone: 'brand',
    blurb: 'Glutes, hips, shoulder cap and waist.',
    why: 'The targeted work. Building the glutes and side-hip, capping the shoulders and keeping the waist tight is what changes your outline — and the shoulder-to-waist contrast does more for how you look than losing weight does. This is deliberately steered: heavy shrugs and loaded twists are kept low precisely because they thicken the neck and waist.'
  }
};

export const PILLAR_IDS = ['resistive', 'control', 'cardio', 'shape'];

/* --------------------------------------------------------------------------
 * Weekly targets, expressed as "pillar points" a week. One hard working set of a
 * strongly-resistive lift is roughly 1 resistive point; a 50-minute class contributes
 * its pillar score scaled by length. Targets are tuned so a well-built week lands near
 * 100% on all four without any single session having to do everything.
 * -------------------------------------------------------------------------- */

const BASE_TARGETS = {
  cycling:    { resistive: 30, control: 10, cardio: 12, shape: 24 },
  transition: { resistive: 34, control: 12, cardio: 14, shape: 28 },
  post:       { resistive: 40, control: 14, cardio: 14, shape: 32 }
};

export function pillarTargets(dials) {
  const stage = (dials && dials.stage) || 'transition';
  const base = BASE_TARGETS[stage] || BASE_TARGETS.transition;
  // A beginner is doing fewer, lighter sets. Scale the bar to the program she is actually on
  // so her first month does not open with four red bars.
  const factor = dials && dials.experience === 'new' ? 0.7 : 1;
  const out = {};
  for (const id of PILLAR_IDS) out[id] = Math.round(base[id] * factor);
  return out;
}

/* --------------------------------------------------------------------------
 * Scoring
 * -------------------------------------------------------------------------- */

const CONTROL_PATTERNS = new Set(['core', 'carry']);
const PRIMARY_SHAPE = new Set(
  Object.entries(SHAPE_TARGETS).filter(([, v]) => v.tier === 'primary').map(([k]) => k)
);

/**
 * How much one working set of an exercise contributes to each pillar.
 * Derived from the exercise's own metadata so a new exercise is scored automatically.
 * @returns {{resistive:number, control:number, cardio:number, shape:number}}
 */
export function pillarScore(exercise) {
  if (!exercise) return { resistive: 0, control: 0, cardio: 0, shape: 0 };

  const eq = exercise.equipment || [];
  const loaded = eq.some((e) => ['barbell', 'dumbbell', 'machine', 'cable', 'smith', 'kettlebell', 'trapbar'].includes(e));
  const isCardio = exercise.track === 'time_distance' || exercise.pattern === 'cardio';

  // Resistive: loaded compounds score highest, bodyweight less, cardio none.
  let resistive = 0;
  if (!isCardio) {
    resistive = loaded ? 1 : 0.5;
    if (exercise.tier === 1) resistive *= 1.2;
    else if (exercise.tier === 3) resistive *= 0.8;
  }

  // Control: core and carry patterns, unilateral work, and unloaded stability work.
  let control = 0;
  if (CONTROL_PATTERNS.has(exercise.pattern)) control += 0.8;
  if (exercise.unilateral) control += 0.4;
  if (!loaded && !isCardio) control += 0.2;
  if (exercise.pattern === 'plyo') control += 0.3;

  // Cardio: only real conditioning work.
  const cardio = isCardio ? 1 : (exercise.pattern === 'plyo' ? 0.3 : 0);

  // Shape: credit for hitting the primary "lady improvements" targets.
  let shape = 0;
  for (const t of exercise.primary || []) if (PRIMARY_SHAPE.has(t)) shape += 1;
  for (const t of exercise.secondary || []) if (PRIMARY_SHAPE.has(t)) shape += 0.5;
  shape = Math.min(shape, 2);

  return {
    resistive: round2(resistive),
    control: round2(Math.min(control, 1.2)),
    cardio: round2(cardio),
    shape: round2(shape)
  };
}

/** A class's pillar contribution, scaled by its length against a nominal 50-minute session. */
export function classPillarScore(format) {
  if (!format || !format.pillars) return { resistive: 0, control: 0, cardio: 0, shape: 0 };
  const minutes = format.durationMin || 50;
  const scale = (minutes / 50) * 6;   // a full-length class is worth ~6 points of its pillar mix
  const out = {};
  for (const id of PILLAR_IDS) out[id] = round2((format.pillars[id] || 0) * scale);
  return out;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Roll a week up into pillar totals.
 * @param {Array} sessions completed sessions for the week
 * @param {Array} sets     logged working sets (isWarmup already filtered, or not — we filter)
 * @param {Function} exerciseById  byId from exercises.js
 * @param {Function} formatById    classById from classes.js
 * @param {object} dials
 */
export function weeklyPillars(sessions, sets, exerciseById, formatById, dials) {
  const targets = pillarTargets(dials);
  const done = { resistive: 0, control: 0, cardio: 0, shape: 0 };

  for (const s of sets || []) {
    if (!s || s.isWarmup) continue;
    const ex = exerciseById(s.exerciseId);
    if (!ex) continue;
    const score = pillarScore(ex);
    for (const id of PILLAR_IDS) done[id] += score[id];
  }

  for (const s of sessions || []) {
    if (!s || !s.complete) continue;
    if (s.classId || s.type === 'class') {
      const fmt = formatById(s.classFormatId || s.classId);
      if (fmt) {
        const score = classPillarScore(fmt);
        for (const id of PILLAR_IDS) done[id] += score[id];
      }
    } else if (s.type === 'conditioning') {
      done.cardio += 6;
    } else if (s.type === 'recovery') {
      done.control += 2;
      done.cardio += 1.5;
    }
  }

  const out = {};
  for (const id of PILLAR_IDS) {
    const target = targets[id] || 0;
    const value = round2(done[id]);
    out[id] = {
      id,
      name: PILLARS[id].name,
      short: PILLARS[id].short,
      tone: PILLARS[id].tone,
      done: value,
      target,
      pct: target > 0 ? Math.min(value / target, 1.5) : 1,
      met: target === 0 || value >= target
    };
  }

  const weakest = PILLAR_IDS
    .filter((id) => !out[id].met)
    .sort((a, b) => out[a].pct - out[b].pct)[0] || null;

  return { pillars: out, targets, weakest, metCount: PILLAR_IDS.filter((id) => out[id].met).length };
}
