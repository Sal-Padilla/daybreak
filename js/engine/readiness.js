// Daybreak — js/engine/readiness.js — the 3-tap morning check, scored 0–100, turned into a load adjustment.

/**
 * Three taps at the top of the session: sleep, energy, soreness. Each 1–5.
 * Soreness is inverted — 5 means very sore, which is a bad input, not a good
 * one.
 *
 * Sleep carries the most weight. At a 4:00 AM wake and a 5:30 AM lift, short
 * sleep is the single best predictor of a session that will not go well, and
 * it is the one input she cannot fix in the moment.
 *
 * Nothing here is ever framed as a failure. Poor readiness means the app
 * takes weight off the bar and she still trains.
 */

const WEIGHTS = { sleep: 0.5, energy: 0.3, soreness: 0.2 };

/**
 * The three bands, worst first, with their score range, load factor and
 * message variants.
 *
 * Variants run from the low end of the band to the high end, so the message
 * matches how the score actually reads. Selection is by score alone, so the
 * same morning always says the same thing — no reshuffling on re-render.
 * Messages never claim a specific input ("you slept badly"), because a score
 * can reach any band by several different routes.
 */
const BANDS = [
  {
    band: 'poor',
    lo: 0,
    hi: 39,
    factor: 0.9,
    dropLastSet: true,
    messages: [
      'Rough night. Taking 10% off your top sets today.',
      'Not much in the tank. Ten percent lighter, and we drop the last set.',
      'Low readiness today. Going lighter, not skipping — this still counts.',
      'Close to a normal day, but not quite. 10% off the top sets and one set less at the end.'
    ]
  },
  {
    band: 'fair',
    lo: 40,
    hi: 66,
    factor: 0.95,
    dropLastSet: false,
    messages: [
      'Middling morning. Taking 5% off your top sets.',
      'A little flat today. Top sets come down 5%, the sets stay.',
      'Fine, not great. We trim 5% and keep the whole session.',
      'Nearly there. Five percent off the top sets, everything else as written.'
    ]
  },
  {
    band: 'good',
    lo: 67,
    hi: 100,
    factor: 1,
    dropLastSet: false,
    messages: [
      'Good numbers this morning. Train the plan as written.',
      'Green light. Full load, full sets.',
      'Nothing to adjust today. Take the top set as prescribed.',
      'Everything reads well. Full load, and no reason to hold back today.'
    ]
  }
];

/** Clamp to 1–5. Anything missing or unreadable reads as a neutral 3. */
function rate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  if (n < 1) return 1;
  if (n > 5) return 5;
  return n;
}

/** 1–5 to 0–1. */
function normal(value) {
  return (rate(value) - 1) / 4;
}

/**
 * Score a readiness check.
 *
 * @param {{sleep:number, energy:number, soreness:number}} r  each 1–5;
 *        soreness inverted (5 = very sore). Missing fields read as 3.
 * @returns {number} 0–100, integer. All threes scores 50.
 */
export function readinessScore(r) {
  const input = r && typeof r === 'object' ? r : {};
  const sleep = normal(input.sleep);
  const energy = normal(input.energy);
  const soreness = 1 - normal(input.soreness); // inverted: sore is bad
  const score =
    WEIGHTS.sleep * sleep + WEIGHTS.energy * energy + WEIGHTS.soreness * soreness;
  return Math.round(score * 100);
}

/**
 * Turn a score into the day's adjustment.
 *
 * @param {number|object} score  0–100. A readiness object is accepted too and
 *        is scored first, so a caller cannot get this wrong.
 * @returns {{band:'good'|'fair'|'poor', factor:number, dropLastSet:boolean,
 *           score:number, message:string}}
 */
export function readinessAdvice(score) {
  let value;
  if (score && typeof score === 'object') {
    value = readinessScore(score);
  } else {
    value = Number(score);
    if (!Number.isFinite(value)) value = 50;
  }
  if (value < 0) value = 0;
  if (value > 100) value = 100;
  const rounded = Math.round(value);

  let entry = BANDS[BANDS.length - 1];
  for (const b of BANDS) {
    if (rounded <= b.hi) { entry = b; break; }
  }

  const span = entry.hi - entry.lo + 1;
  const count = entry.messages.length;
  let slot = Math.floor(((rounded - entry.lo) * count) / span);
  if (slot < 0) slot = 0;
  if (slot > count - 1) slot = count - 1;

  return {
    band: entry.band,
    factor: entry.factor,
    dropLastSet: entry.dropLastSet,
    score: rounded,
    message: entry.messages[slot]
  };
}
