// Daybreak — js/data/standards.js — FEMALE strength standards as bodyweight multiples, with a mild age adjustment.

/*
 * This file exists because IronPulse shipped
 *   strengthLevel(exercise, oneRM, bodyweight = 180, gender = 'male')
 * and quietly graded a woman against male norms. That is the specific defect being fixed here.
 * Every number below is a FEMALE standard. There is no gender parameter, no bodyweight default,
 * and no fallback: if we do not know her bodyweight we return null rather than invent one.
 *
 * Thresholds are the one-rep-max expressed as a multiple of bodyweight, and each number is the
 * point at which she ENTERS that level. Below the novice threshold the level reads 'untrained'.
 * Figures are drawn from published female lifting-standard distributions (Strength Level / ExRx
 * female tables) and rounded to sane, coachable values.
 *
 * Load basis matters and is recorded per lift:
 *   'barbell'   — total weight on the bar, including the bar
 *   'machine'   — the weight shown on the stack or sled
 *   'per-hand'  — one dumbbell, which is what the set logger stores for dumbbell work
 */

export const LEVELS = ['untrained', 'novice', 'intermediate', 'advanced', 'elite'];

const STANDARDS = {
  // ---- Hinge / glute --------------------------------------------------------
  'barbell-hip-thrust': {
    name: 'Barbell Hip Thrust',
    basis: 'barbell',
    // Runs far higher than any other lift here — a strong woman thrusting 2x bodyweight is normal.
    thresholds: { novice: 1.00, intermediate: 1.50, advanced: 2.00, elite: 2.60 }
  },
  'conventional-deadlift': {
    name: 'Conventional Deadlift',
    basis: 'barbell',
    thresholds: { novice: 0.90, intermediate: 1.25, advanced: 1.75, elite: 2.25 }
  },
  'sumo-deadlift': {
    name: 'Sumo Deadlift',
    basis: 'barbell',
    // Wide stance suits most female hip structures; standards sit a touch above conventional.
    thresholds: { novice: 0.95, intermediate: 1.30, advanced: 1.80, elite: 2.30 }
  },
  'trap-bar-deadlift': {
    name: 'Trap-Bar Deadlift',
    basis: 'barbell',
    // More upright, shorter moment arm — typically 5–10% more than conventional.
    thresholds: { novice: 1.00, intermediate: 1.40, advanced: 1.90, elite: 2.45 }
  },
  'romanian-deadlift': {
    name: 'Romanian Deadlift',
    basis: 'barbell',
    // Submaximal by design: hamstring stretch, not a floor pull. ~75% of a conventional deadlift.
    thresholds: { novice: 0.65, intermediate: 0.95, advanced: 1.35, elite: 1.75 }
  },

  // ---- Squat patterns ------------------------------------------------------
  'back-squat': {
    name: 'Back Squat',
    basis: 'barbell',
    thresholds: { novice: 0.75, intermediate: 1.00, advanced: 1.50, elite: 2.00 }
  },
  'front-squat': {
    name: 'Front Squat',
    basis: 'barbell',
    // Roughly 85% of the back squat once the rack position stops being the limiter.
    thresholds: { novice: 0.60, intermediate: 0.85, advanced: 1.25, elite: 1.65 }
  },
  'goblet-squat': {
    name: 'Goblet Squat',
    basis: 'per-hand',
    // Capped by what she can hold at the chest, not by her legs. Ceilings are real here.
    thresholds: { novice: 0.30, intermediate: 0.45, advanced: 0.62, elite: 0.80 }
  },
  'leg-press': {
    name: 'Leg Press',
    basis: 'machine',
    // Supported back, short range, sled assistance — the highest numbers on the floor.
    thresholds: { novice: 1.25, intermediate: 1.90, advanced: 2.75, elite: 3.75 }
  },

  // ---- Press ---------------------------------------------------------------
  'bench-press': {
    name: 'Bench Press',
    basis: 'barbell',
    thresholds: { novice: 0.50, intermediate: 0.70, advanced: 1.00, elite: 1.30 }
  },
  'incline-dumbbell-press': {
    name: 'Incline Dumbbell Press',
    basis: 'per-hand',
    // Per dumbbell, matching how the set logger records dumbbell work.
    thresholds: { novice: 0.17, intermediate: 0.25, advanced: 0.35, elite: 0.46 }
  },
  'overhead-press': {
    name: 'Overhead Press',
    basis: 'barbell',
    thresholds: { novice: 0.35, intermediate: 0.50, advanced: 0.70, elite: 0.90 }
  },

  // ---- Pull ----------------------------------------------------------------
  'lat-pulldown': {
    name: 'Lat Pulldown',
    basis: 'machine',
    thresholds: { novice: 0.55, intermediate: 0.75, advanced: 1.00, elite: 1.25 }
  },
  'seated-row': {
    name: 'Seated Row',
    basis: 'machine',
    thresholds: { novice: 0.50, intermediate: 0.70, advanced: 0.95, elite: 1.20 }
  },
  'barbell-row': {
    name: 'Barbell Row',
    basis: 'barbell',
    thresholds: { novice: 0.50, intermediate: 0.70, advanced: 0.95, elite: 1.20 }
  }
};

/*
 * Exercise ids are authored in exercises.js; these aliases absorb the common spellings so a
 * lookup never fails on a naming near-miss.
 */
const ALIASES = {
  'hip-thrust': 'barbell-hip-thrust',
  'barbell-hipthrust': 'barbell-hip-thrust',
  'deadlift': 'conventional-deadlift',
  'barbell-deadlift': 'conventional-deadlift',
  'conventional-barbell-deadlift': 'conventional-deadlift',
  'barbell-sumo-deadlift': 'sumo-deadlift',
  'trapbar-deadlift': 'trap-bar-deadlift',
  'trap-bar-dl': 'trap-bar-deadlift',
  'hex-bar-deadlift': 'trap-bar-deadlift',
  'rdl': 'romanian-deadlift',
  'barbell-romanian-deadlift': 'romanian-deadlift',
  'barbell-rdl': 'romanian-deadlift',
  'barbell-back-squat': 'back-squat',
  'squat': 'back-squat',
  'barbell-front-squat': 'front-squat',
  'dumbbell-goblet-squat': 'goblet-squat',
  'kettlebell-goblet-squat': 'goblet-squat',
  'machine-leg-press': 'leg-press',
  'leg-press-machine': 'leg-press',
  'barbell-bench-press': 'bench-press',
  'flat-bench-press': 'bench-press',
  'incline-db-press': 'incline-dumbbell-press',
  'dumbbell-incline-press': 'incline-dumbbell-press',
  'incline-dumbbell-bench-press': 'incline-dumbbell-press',
  'ohp': 'overhead-press',
  'barbell-overhead-press': 'overhead-press',
  'standing-overhead-press': 'overhead-press',
  'military-press': 'overhead-press',
  'cable-lat-pulldown': 'lat-pulldown',
  'wide-grip-lat-pulldown': 'lat-pulldown',
  'seated-cable-row': 'seated-row',
  'cable-seated-row': 'seated-row',
  'machine-seated-row': 'seated-row',
  'barbell-bent-over-row': 'barbell-row',
  'bent-over-row': 'barbell-row',
  'bent-over-barbell-row': 'barbell-row'
};

// Display copy. 'untrained' is a true category, but nothing in this app calls a woman untrained
// to her face — the message says "Starting out" instead. See BUILD_CONTRACT §7.
const LEVEL_COPY = {
  untrained: 'Starting out',
  novice: 'Novice',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  elite: 'Elite'
};

const EPSILON = 1e-9;

function normalizeId(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/-{2,}/g, '-');
}

function resolveId(raw) {
  const key = normalizeId(raw);
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(STANDARDS, key)) return key;
  const aliased = ALIASES[key];
  if (aliased && Object.prototype.hasOwnProperty.call(STANDARDS, aliased)) return aliased;
  return null;
}

/*
 * Age adjustment: 0.5% off the required ratio for every year past 40, floored at 15% off
 * (reached at 70). Deliberately mild — the LIFTMOR trial had postmenopausal women training
 * above 85% 1RM safely, so age lowers the bar a little; it does not move it out of reach.
 */
function ageFactor(age) {
  const a = Number(age);
  if (!Number.isFinite(a) || a <= 40) return 1;
  return 1 - Math.min(0.15, (a - 40) * 0.005);
}

function round(n, places) {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

/**
 * Grade a one-rep max against female strength standards.
 *
 * @param {string} exerciseId  exercise id from exercises.js (aliases tolerated)
 * @param {number} oneRM       estimated or tested 1RM, in pounds, on this lift's load basis
 * @param {number} bodyweightLb her bodyweight in pounds — required, never defaulted
 * @param {number} [age]       age in years; ages over 40 relax the thresholds slightly
 * @returns {{level:string, ratio:number, nextLevel:(string|null), toNextLb:(number|null),
 *            nextRatio:(number|null), exerciseId:string, name:string, basis:string,
 *            ageFactor:number, message:string}|null}
 *          null for an unknown exercise or unusable numbers — never throws.
 */
export function strengthLevel(exerciseId, oneRM, bodyweightLb, age) {
  const key = resolveId(exerciseId);
  if (!key) return null;

  const rm = Number(oneRM);
  const bw = Number(bodyweightLb);
  if (!Number.isFinite(rm) || rm < 0) return null;
  if (!Number.isFinite(bw) || bw <= 0) return null;

  const entry = STANDARDS[key];
  const factor = ageFactor(age);
  const ratio = rm / bw;

  // Index 0 is 'untrained' and needs no threshold; the rest are scaled by the age factor.
  const scaled = LEVELS.map((lvl, i) => (i === 0 ? 0 : entry.thresholds[lvl] * factor));

  let idx = 0;
  for (let i = 1; i < LEVELS.length; i += 1) {
    if (ratio + EPSILON >= scaled[i]) idx = i;
  }

  const level = LEVELS[idx];
  const isTop = idx === LEVELS.length - 1;
  const nextLevel = isTop ? null : LEVELS[idx + 1];
  const nextRatio = isTop ? null : round(scaled[idx + 1], 2);
  const toNextLb = isTop ? null : Math.max(0, Math.ceil(scaled[idx + 1] * bw - rm));

  const shownRatio = round(ratio, 2);
  const message = isTop
    ? `${LEVEL_COPY[level]} on ${entry.name} — ${shownRatio.toFixed(2)}x bodyweight.`
    : `${LEVEL_COPY[level]} on ${entry.name} at ${shownRatio.toFixed(2)}x bodyweight. ${toNextLb} lb to ${nextLevel}.`;

  return {
    level,
    ratio: shownRatio,
    nextLevel,
    toNextLb,
    nextRatio,
    exerciseId: key,
    name: entry.name,
    basis: entry.basis,
    ageFactor: round(factor, 3),
    message
  };
}
