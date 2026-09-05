// Daybreak — js/engine/progression.js — Double-progression targets, Epley 1RM, and readiness autoregulation.

/*
 * BUILD_CONTRACT §5.2. Three exports, nothing else.
 *
 *   estimate1RM(weight, reps)              Epley, capped at 12 reps, null when it cannot be known.
 *   nextTarget(history, exercise, dials)   What to do on the next set of this movement.
 *   adjustForReadiness(target, readiness)  Scale that target for how she actually woke up.
 *
 * DESIGN NOTES (the parts that are behaviour, not decoration)
 *
 * 1. Warm-up sets are invisible here. `isWarmup === true` is stripped before anything is grouped,
 *    counted or compared. A session of nothing but ramp sets reads as "no history".
 *
 * 2. Double progression, and only double progression. Load moves when EVERY working set in the
 *    last session reached the top of the rep range. Otherwise the bar stays where it is and she
 *    chases one more rep. That rule survives a missed week, which is the whole point of it.
 *
 * 3. Nothing in this file throws. Empty history, null weights, a bodyweight movement with no load
 *    at all, a malformed set object, a missing `dials` — every one of them returns a usable target.
 *    This code runs at 5:40 AM on a phone in a concrete room; a thrown error is a lost session.
 *
 * 4. Never mutate an input. `adjustForReadiness` returns a new object; the caller keeps the
 *    un-adjusted target so the UI can show "adjusted for today" honestly.
 *
 * REP UNITS follow `exercise.track` (exercises.js): weight_reps / bodyweight_reps / reps_only are
 * repetitions and step by 1; time_hold is seconds and steps by 5; time_distance is minutes.
 */

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_REP_RANGE = [8, 12];
const DEFAULT_RIR = [2, 3];
const DEFAULT_SETS = 3;
const MAX_SETS = 8;

// SHAPE_TARGETS keys, split by where the load actually sits. Drives the load increment.
const LOWER_BODY = new Set(['gluteMax', 'gluteMed', 'hamstrings', 'quads', 'calves']);
const UPPER_BODY = new Set(['delts', 'back', 'triceps', 'chest', 'biceps']);

const STEP_LOWER = 5;      // lb — lower-body / tier-1 compounds
const STEP_UPPER = 2.5;    // lb — upper-body and isolation work

const ROUND_BARBELL = 5;   // lb — barbell, machine, cable, smith, trap bar
const ROUND_DUMBBELL = 2.5; // lb — dumbbells and kettlebells (logged per hand)

const READINESS_FACTORS = { good: 1, fair: 0.95, poor: 0.9 };

const READINESS_MESSAGES = {
  good: '',
  fair: 'Middling readiness — 5% off the top sets today.',
  poor: 'Rough night. Taking 10% off your top sets and dropping the last set of each movement.',
};

/* -------------------------------------------------------------------------- */
/* Small, defensive helpers                                                    */
/* -------------------------------------------------------------------------- */

// Every number that reaches this module is treated as untrusted until it passes through here.
function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function isObj(v) {
  return !!v && typeof v === 'object';
}

// Trim float noise and drop a trailing .0 when formatting for copy.
function round1(v) {
  return Math.round(v * 10) / 10;
}

// 100 -> '100', 102.5 -> '102.5'. Never '102.50', never '100.0'.
function fmtNum(v) {
  return String(round1(v));
}

function roundToStep(value, step) {
  const s = num(step) && step > 0 ? step : ROUND_BARBELL;
  return round1(Math.round(value / s) * s);
}

// [lo, hi] with lo <= hi, or null.
function asRange(v) {
  if (!Array.isArray(v) || v.length < 2) return null;
  const a = num(v[0]);
  const b = num(v[1]);
  if (a === null || b === null) return null;
  return a <= b ? [a, b] : [b, a];
}

// 'dumbbell-hip-thrust' -> 'Dumbbell Hip Thrust'. Used only in swap copy; the id is returned too.
function humanizeId(id) {
  if (typeof id !== 'string' || !id) return '';
  return id
    .split('-')
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === 'rdl') return 'RDL';
      if (lower === 'db') return 'Dumbbell';
      if (lower === 'kb') return 'Kettlebell';
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/* -------------------------------------------------------------------------- */
/* Exercise interrogation                                                      */
/* -------------------------------------------------------------------------- */

function trackOf(exercise) {
  const t = isObj(exercise) ? exercise.track : null;
  return typeof t === 'string' && t ? t : 'weight_reps';
}

function tierOf(exercise) {
  return isObj(exercise) ? num(exercise.tier) : null;
}

function listOf(v) {
  return Array.isArray(v) ? v : [];
}

function isLoadable(exercise) {
  const track = trackOf(exercise);
  return track === 'weight_reps' || track === 'time_hold';
}

// One rep, or 5 seconds on a hold.
function repStepFor(exercise) {
  return trackOf(exercise) === 'time_hold' ? 5 : 1;
}

// True when the logged number is a repetition count, false when it is seconds or minutes.
function countsReps(exercise) {
  const track = trackOf(exercise);
  return track === 'weight_reps' || track === 'bodyweight_reps' || track === 'reps_only';
}

function unitWordFor(exercise) {
  const track = trackOf(exercise);
  if (track === 'time_hold') return 'seconds';
  if (track === 'time_distance') return 'minutes';
  return 'reps';
}

// Where the reps/seconds live on a stored set (BUILD_CONTRACT §4.5).
function repValue(set, exercise) {
  if (!isObj(set)) return null;
  if (trackOf(exercise) === 'time_hold') {
    return num(set.seconds) !== null ? num(set.seconds) : num(set.reps);
  }
  return num(set.reps) !== null ? num(set.reps) : num(set.seconds);
}

/*
 * Rep range. dials.topSetReps is the life-stage prescription and governs tier 1 and 2 lifts; a
 * tier-3 accessory keeps its own defaultReps, because 5 reps of a cable abduction is not a thing.
 * A time-based movement ALWAYS keeps its own range — dials.topSetReps counts repetitions, and a
 * 60-second plank measured against an 8–12 "rep" range reads as permanently past the top.
 */
function repRangeFor(exercise, dials) {
  const fromExercise = asRange(isObj(exercise) ? exercise.defaultReps : null);
  const fromDials = asRange(isObj(dials) ? dials.topSetReps : null);
  if (!countsReps(exercise) && fromExercise) return fromExercise;
  if (tierOf(exercise) === 3 && fromExercise) return fromExercise;
  return fromDials || fromExercise || DEFAULT_REP_RANGE.slice();
}

/*
 * Load increment. The contract is "+5 lb lower / +2.5 lb upper"; the build note adds "or tier-1"
 * to the +5 side and "or isolation" to the +2.5 side, which collide on a tier-1 upper lift.
 * Resolved in favour of the contract: anything upper-body, isolation, or tier-3 takes the small
 * jump. An unknown exercise also takes the small jump — under-shooting a load is recoverable.
 */
function incrementFor(exercise) {
  const primary = listOf(isObj(exercise) ? exercise.primary : null);
  const tier = tierOf(exercise);
  const pattern = isObj(exercise) ? exercise.pattern : null;

  const isIsolation = tier === 3 || pattern === 'iso';
  const hitsUpper = primary.some((k) => UPPER_BODY.has(k));
  const hitsLower = primary.some((k) => LOWER_BODY.has(k));

  if (isIsolation || hitsUpper) return STEP_UPPER;
  if (hitsLower || tier === 1) return STEP_LOWER;
  return STEP_UPPER;
}

// Rounding grain for readiness scaling: dumbbells and kettlebells come in 2.5 lb steps per hand.
function roundingFor(exercise) {
  const equipment = listOf(isObj(exercise) ? exercise.equipment : null);
  if (equipment.includes('dumbbell') || equipment.includes('kettlebell')) return ROUND_DUMBBELL;
  return ROUND_BARBELL;
}

function rirFor(dials, easier) {
  const range = asRange(isObj(dials) ? dials.rirTarget : null) || DEFAULT_RIR.slice();
  return easier ? range[1] : range[0];
}

/* -------------------------------------------------------------------------- */
/* History → sessions                                                          */
/* -------------------------------------------------------------------------- */

/*
 * history is prior working+warm-up sets for ONE exercise, oldest first. Group into sessions,
 * newest last, dropping warm-ups entirely. Sets missing a sessionId fall back to the logged date,
 * then to a single bucket — a bad group is still better than a thrown error.
 */
function groupSessions(history, exercise) {
  const rows = Array.isArray(history) ? history : [];
  const order = [];
  const byKey = new Map();

  for (const set of rows) {
    if (!isObj(set)) continue;
    if (set.isWarmup === true) continue;

    let key = null;
    if (typeof set.sessionId === 'string' && set.sessionId) key = set.sessionId;
    else if (typeof set.sessionId === 'number') key = `s${set.sessionId}`;
    else if (typeof set.loggedAt === 'string' && set.loggedAt) key = `d${set.loggedAt.slice(0, 10)}`;
    else key = 'ungrouped';

    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key).push(set);
  }

  return order.map((key) => summarizeSession(key, byKey.get(key), exercise));
}

function summarizeSession(key, sets, exercise) {
  let topWeight = null;
  let minReps = null;
  let maxReps = null;
  let totalReps = 0;
  let repsAtTopWeight = null;
  let countedReps = 0;

  for (const set of sets) {
    const w = num(set.weight);
    if (w !== null && (topWeight === null || w > topWeight)) topWeight = w;

    const r = repValue(set, exercise);
    if (r !== null) {
      countedReps += 1;
      totalReps += r;
      if (minReps === null || r < minReps) minReps = r;
      if (maxReps === null || r > maxReps) maxReps = r;
    }
  }

  // Best effort at the top load — what she actually did with the heaviest weight of the session.
  if (topWeight !== null) {
    for (const set of sets) {
      if (num(set.weight) !== topWeight) continue;
      const r = repValue(set, exercise);
      if (r !== null && (repsAtTopWeight === null || r > repsAtTopWeight)) repsAtTopWeight = r;
    }
  }

  return {
    key,
    sets,
    setCount: sets.length,
    countedReps,
    topWeight,
    minReps,
    maxReps,
    totalReps,
    repsAtTopWeight,
  };
}

// Every working set reached the top of the range. A set with no recorded reps fails the test.
function hitTopOnEverySet(session, hi) {
  if (!session || session.setCount === 0) return false;
  if (session.countedReps !== session.setCount) return false;
  return session.minReps !== null && session.minReps >= hi;
}

// Did `b` beat `a` on load, or on reps at the same load?
function improved(a, b) {
  const aw = a.topWeight === null ? 0 : a.topWeight;
  const bw = b.topWeight === null ? 0 : b.topWeight;
  if (bw > aw) return true;
  if (bw < aw) return false;

  const ar = a.repsAtTopWeight === null ? (a.maxReps || 0) : a.repsAtTopWeight;
  const br = b.repsAtTopWeight === null ? (b.maxReps || 0) : b.repsAtTopWeight;
  if (br > ar) return true;
  return b.totalReps > a.totalReps;
}

// Three sessions on the board and not one of them moved. Rotate, don't grind.
function isStalled(sessions) {
  if (sessions.length < 3) return false;
  const last3 = sessions.slice(-3);
  for (let i = 1; i < last3.length; i += 1) {
    if (improved(last3[i - 1], last3[i])) return false;
  }
  return !improved(last3[0], last3[last3.length - 1]);
}

/* -------------------------------------------------------------------------- */
/* estimate1RM                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Epley: 1RM ≈ weight × (1 + reps / 30).
 * Returns null above 12 reps (the formula stops being honest there) or without a real weight.
 * @param {number} weight lb
 * @param {number} reps
 * @returns {number|null} lb, one decimal
 */
export function estimate1RM(weight, reps) {
  const w = num(weight);
  const r = num(reps);
  if (w === null || w <= 0) return null;
  if (r === null || r < 1 || r > 12) return null;
  return round1(w * (1 + r / 30));
}

/* -------------------------------------------------------------------------- */
/* nextTarget                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * What to do on this movement next, by double progression.
 *
 * @param {Array}  history  prior sets for THIS exercise, newest last. Warm-ups are ignored.
 * @param {Object} exercise an EXERCISES entry (may be null — the target degrades, it does not throw)
 * @param {Object} dials    dialsFor(profile) — topSetReps and rirTarget are read
 * @returns {{weight:number|null, reps:number, sets:number, rir:number, reason:string,
 *            message:string, exerciseId:string|null, track:string, repRange:number[],
 *            increment:number, roundTo:number, dropLastSet:boolean, swapTo:string|null,
 *            lastWeight:number|null, lastReps:number|null}}
 */
export function nextTarget(history, exercise, dials) {
  const range = repRangeFor(exercise, dials);
  const lo = range[0];
  const hi = range[1];
  const track = trackOf(exercise);
  const increment = incrementFor(exercise);
  const roundTo = roundingFor(exercise);
  const step = repStepFor(exercise);
  const loadable = isLoadable(exercise);
  const exerciseId = isObj(exercise) && typeof exercise.id === 'string' ? exercise.id : null;
  const unit = unitWordFor(exercise);

  const base = {
    exerciseId,
    track,
    repRange: [lo, hi],
    increment,
    roundTo,
    dropLastSet: false,
    swapTo: null,
    lastWeight: null,
    lastReps: null,
  };

  const sessions = groupSessions(history, exercise);
  const last = sessions.length ? sessions[sessions.length - 1] : null;

  /* --- No history (or nothing but warm-ups) -------------------------------- */
  if (!last || last.setCount === 0) {
    return {
      ...base,
      weight: null,
      reps: lo,
      sets: DEFAULT_SETS,
      rir: rirFor(dials, true),
      reason: 'first-time',
      message: 'First time — pick a weight you could do about 12 times and stop 4 short.',
    };
  }

  const lastWeight = last.topWeight;
  const lastReps = last.minReps !== null ? last.minReps : last.maxReps;
  const sets = Math.min(MAX_SETS, Math.max(1, last.setCount));
  const carried = { ...base, lastWeight, lastReps };

  /* --- Earned the load ----------------------------------------------------- */
  if (hitTopOnEverySet(last, hi)) {
    const canAddLoad = loadable && lastWeight !== null && lastWeight > 0;
    const weight = canAddLoad ? round1(lastWeight + increment) : lastWeight;
    // Reps only reset when the load actually went up; otherwise resetting would be a step back.
    const reps = canAddLoad ? lo : hi;

    let message;
    if (canAddLoad) {
      message =
        `Every set hit ${fmtNum(hi)} ${unit} last time. Up ${fmtNum(increment)} lb to ` +
        `${fmtNum(weight)} lb, back down to ${fmtNum(lo)} ${unit}.`;
    } else if (track === 'weight_reps') {
      // Loaded movement, but the weight never got written down — ask once, without scolding.
      message =
        `Every set hit ${fmtNum(hi)} ${unit} last time. Log the weight you use today so the next ` +
        `${fmtNum(increment)} lb jump lands in the right place.`;
    } else {
      message =
        `Every set hit ${fmtNum(hi)} ${unit} last time — the top of the range. ` +
        'Hold a dumbbell, add a vest, or move to the harder variation.';
    }

    return {
      ...carried,
      weight: canAddLoad ? weight : lastWeight,
      reps,
      sets,
      rir: rirFor(dials, true),
      reason: 'add-load',
      message,
    };
  }

  /* --- Stalled ------------------------------------------------------------- */
  if (isStalled(sessions)) {
    const swaps = listOf(isObj(exercise) ? exercise.swaps : null).filter(
      (id) => typeof id === 'string' && id
    );
    const swapTo = swaps.length ? swaps[0] : null;
    const swapName = humanizeId(swapTo);
    const message = swapTo
      ? `Three sessions at the same numbers. Rotate to ${swapName} for a few weeks — the pattern ` +
        'keeps progressing even when one movement stops.'
      : 'Three sessions at the same numbers. Rotate to a different movement in this pattern for a ' +
        'few weeks rather than grinding this one.';

    return {
      ...carried,
      weight: lastWeight,
      reps: lastReps !== null ? Math.min(hi, Math.max(1, lastReps)) : lo,
      sets,
      rir: rirFor(dials, true),
      reason: 'stalled',
      swapTo,
      message,
    };
  }

  /* --- Hold the load, chase a rep ------------------------------------------ */
  const reps =
    lastReps !== null ? Math.min(hi, Math.max(1, lastReps + step)) : lo;

  let message;
  if (lastWeight !== null && lastWeight > 0) {
    message =
      `Hold ${fmtNum(lastWeight)} lb and go for ${fmtNum(reps)} ${unit} on every set. ` +
      `Load moves when all ${sets} sets reach ${fmtNum(hi)}.`;
  } else {
    message =
      `Same setup, ${fmtNum(reps)} ${unit} on every set. ` +
      `It gets harder when all ${sets} sets reach ${fmtNum(hi)}.`;
  }

  return {
    ...carried,
    weight: lastWeight,
    reps,
    sets,
    rir: rirFor(dials, false),
    reason: 'add-reps',
    message,
  };
}

/* -------------------------------------------------------------------------- */
/* adjustForReadiness                                                          */
/* -------------------------------------------------------------------------- */

/*
 * Accepts either the advice object from readiness.js — {band, factor, message} — or the raw
 * {sleep, energy, soreness} triple, so a caller that has not scored yet still gets sane output.
 * readiness.js owns the scoring; the fallback below only exists so this module never depends on
 * being called in the right order.
 */
function normalizeReadiness(readiness) {
  const fallback = { band: 'good', factor: 1, message: '', dropLastSet: false, score: null };
  if (!isObj(readiness)) return fallback;

  let band = typeof readiness.band === 'string' ? readiness.band.toLowerCase() : null;
  let factor = num(readiness.factor);
  let score = num(readiness.score);

  // Raw {sleep, energy, soreness}: soreness inverted, summed, scaled 0–100 (BUILD_CONTRACT §5.5).
  if (band === null && factor === null) {
    const sleep = num(readiness.sleep);
    const energy = num(readiness.energy);
    const soreness = num(readiness.soreness);
    if (sleep !== null || energy !== null || soreness !== null) {
      const s = sleep === null ? 3 : sleep;
      const e = energy === null ? 3 : energy;
      const so = soreness === null ? 3 : soreness;
      const total = s + e + (6 - so);
      score = Math.max(0, Math.min(100, Math.round(((total - 3) / 12) * 100)));
      band = score >= 67 ? 'good' : score >= 34 ? 'fair' : 'poor';
    }
  }

  if (band !== 'good' && band !== 'fair' && band !== 'poor') {
    // Derive the band from a bare factor if that is all we were given.
    if (factor !== null) band = factor >= 0.99 ? 'good' : factor >= 0.93 ? 'fair' : 'poor';
    else band = 'good';
  }

  if (factor === null) factor = READINESS_FACTORS[band];
  factor = Math.max(0.5, Math.min(1, factor));

  const dropLastSet =
    typeof readiness.dropLastSet === 'boolean' ? readiness.dropLastSet : band === 'poor';

  const message =
    typeof readiness.message === 'string' && readiness.message
      ? readiness.message
      : READINESS_MESSAGES[band];

  return { band, factor, message, dropLastSet, score };
}

/**
 * Scale a target for how she actually woke up. Returns a NEW object; the input is never touched.
 * A null weight — bodyweight work, or a first-time target — is left null.
 *
 * @param {Object} target   a nextTarget() result (or anything target-shaped)
 * @param {Object} readiness readinessAdvice() output, or a raw {sleep, energy, soreness}
 * @returns {Object} a copy of target with weight scaled, dropLastSet set, and the advice appended
 */
export function adjustForReadiness(target, readiness) {
  const src = isObj(target) ? target : {};
  const advice = normalizeReadiness(readiness);

  const out = { ...src };
  if (Array.isArray(src.repRange)) out.repRange = src.repRange.slice();

  const weight = num(src.weight);
  if (weight === null) {
    out.weight = src.weight === undefined ? null : src.weight;
  } else if (advice.factor === 1) {
    out.weight = weight;
  } else {
    const grain = num(src.roundTo) !== null && src.roundTo > 0 ? src.roundTo : ROUND_BARBELL;
    const scaled = roundToStep(weight * advice.factor, grain);
    out.weight = scaled > 0 ? scaled : round1(grain);
  }

  out.dropLastSet = advice.dropLastSet;
  out.readiness = {
    band: advice.band,
    factor: advice.factor,
    score: advice.score,
  };
  out.adjusted = out.weight !== src.weight || advice.dropLastSet === true;

  const baseMessage = typeof src.message === 'string' ? src.message : '';
  out.message = advice.message
    ? baseMessage
      ? `${baseMessage} ${advice.message}`
      : advice.message
    : baseMessage;

  return out;
}
