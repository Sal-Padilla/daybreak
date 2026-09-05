// Daybreak — js/engine/shapemap.js — Weekly hard sets per shape target: what she actually trained, against what her life stage asks for.

/*
 * THE SHAPE MAP (BUILD_CONTRACT §5.3, PROJECT_PLAN §5.3)
 *
 * This replaces total-volume-in-pounds. Volume in pounds rewards the squat and makes a lateral
 * raise look like nothing, which is exactly backwards for the goal. The unit here is the hard set.
 *
 * COUNTING RULES — all of them
 *   · A logged working set credits 1.0 to every key in its exercise's `primary` array and
 *     0.5 to every key in its `secondary` array.
 *   · A key listed in both arrays of one exercise is credited once, at 1.0. (Data guard.)
 *   · Warm-up sets never count. A set whose exerciseId does not resolve is skipped silently.
 *   · An attended class credits `shapeContribution` × `counts.resistance` per key. Cycle is
 *     resistance 0, so it credits nothing; Body Pump is 0.5, so its quads:2 lands as 1.0.
 *   · Unknown keys in a class's shapeContribution are ignored — SHAPE_TARGETS is the whole world.
 *
 * WHAT `totalSets` MEANS: logged working sets, as a count of set records. It is not the sum of
 * shape credits, and it deliberately does not include class credit — a class is not a set she
 * logged. The per-target numbers are where class credit shows up.
 *
 * `pct` IS A FRACTION (0–1.5), NOT A PERCENTAGE. The CSS `--pct` custom property is read as
 * 0–100, so multiply by 100 at the point of use. It is clamped at 1.5 so one enormous week
 * cannot blow out a bar chart, and a target of 0 yields pct 1 rather than Infinity or NaN.
 *
 * Nothing in here throws. Empty arrays, missing dials, malformed records and unknown ids all
 * return a fully-populated, zeroed structure — the Shape screen renders on day one with no data.
 */

import { SHAPE_TARGETS, byId } from '../data/exercises.js';
import { classById } from '../data/classes.js';

/* -------------------------------------------------------------------------- */
/* Small helpers                                                               */
/* -------------------------------------------------------------------------- */

const SHAPE_KEYS = Object.keys(SHAPE_TARGETS);

const PCT_CEILING = 1.5;   // pct is clamped here so a huge week cannot break a chart
const SURPLUS_AT = 1.4;    // done > target × this reads as "you can spend that effort elsewhere"

/** Finite number or fallback. Strings from storage are coerced; NaN/Infinity never survive. */
function num(v, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Non-negative finite number, for targets and credits. */
function nonNeg(v, fallback = 0) {
  const n = num(v, fallback);
  return n > 0 ? n : 0;
}

/** One decimal place, with -0 normalised to 0. */
function round1(n) {
  const r = Math.round(num(n, 0) * 10) / 10;
  return r === 0 ? 0 : r;
}

function clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n;
}

/** Anything that is not a real array reads as an empty one. */
function arr(v) {
  return Array.isArray(v) ? v : [];
}

/** First non-empty string among the arguments, trimmed. Used for tolerant id resolution. */
function firstId(...candidates) {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/* -------------------------------------------------------------------------- */
/* Targets                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The weekly set target for every canonical shape key, straight off the life-stage dials.
 *
 * Primary keys (the seven that drive the look) get `dials.weeklySetsPerPrimary`; the four
 * secondary keys get `dials.weeklySetsPerSecondary`. Missing or nonsense dials degrade to 0,
 * which the map reads as "no target set" rather than crashing.
 *
 * @param {object} dials result of dialsFor(profile); may be null
 * @returns {Object<string, number>} one entry per SHAPE_TARGETS key
 */
export function targetsFor(dials) {
  const d = dials && typeof dials === 'object' ? dials : {};
  const primary = nonNeg(d.weeklySetsPerPrimary, 0);
  const secondary = nonNeg(d.weeklySetsPerSecondary, 0);

  const out = {};
  for (const key of SHAPE_KEYS) {
    out[key] = SHAPE_TARGETS[key].tier === 'primary' ? primary : secondary;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Class resolution                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A session names its class by id. That id is either a CLASS_FORMATS id ('cycle') or the id of
 * one of her saved class records, which in turn names a format. Both are resolved here, and a
 * saved record that carries its own shapeContribution is honoured as a format in its own right,
 * so a custom class she adds later still feeds the Shape Map.
 *
 * @param {object} session
 * @param {Map<string, object>} savedById her configured classes, keyed by id
 * @returns {object|null} something with shapeContribution + counts, or null
 */
function resolveClassFormat(session, savedById) {
  const id = firstId(session.classId, session.classFormatId, session.formatId, session.classFormat);
  if (!id) return null;

  // Direct hit on the format library — classById is already casing/whitespace tolerant.
  const direct = classById(id);
  if (direct) return direct;

  const saved = savedById.get(id.toLowerCase());
  if (!saved) return null;

  const viaSaved = classById(
    firstId(saved.formatId, saved.classFormatId, saved.format, saved.type, saved.id)
  );
  if (viaSaved) return viaSaved;

  // A saved record that describes its own contribution is usable as-is.
  return saved.shapeContribution && typeof saved.shapeContribution === 'object' ? saved : null;
}

/**
 * How much resistance credit a class earns, 0–1.
 * A real format always ships `counts`. A custom record that states shapeContribution but no
 * counts is taken at face value (1.0) — she wrote those numbers meaning them.
 */
function resistanceOf(format) {
  const counts = format && typeof format.counts === 'object' && format.counts ? format.counts : null;
  if (!counts) return 1;
  return clamp(nonNeg(counts.resistance, 0), 0, 1);
}

function isClassSession(session) {
  return session.type === 'class' || Boolean(firstId(session.classId, session.classFormatId));
}

/* -------------------------------------------------------------------------- */
/* The map                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Build one week of the Shape Map.
 *
 * Callers pass the week's records; this function does no date filtering of its own — every set
 * handed in is counted, so the caller owns the window.
 *
 * @param {Array<object>} sessions the week's sessions (lifts and classes)
 * @param {Array<object>} sets     the week's set records
 * @param {Array<object>} classes  her configured class records, for resolving session.classId
 * @param {object} dials           life-stage dials, for the targets
 * @returns {{
 *   targets: Object<string, {done:number, target:number, pct:number, label:string, tier:string}>,
 *   totalSets: number,
 *   primaryOnTarget: number,
 *   primaryCount: number,
 *   impactSessions: number,
 *   shortfalls: Array<{key:string, label:string, short:number}>,
 *   surplus: Array<{key:string, label:string, over:number}>
 * }}
 */
export function weeklyShapeMap(sessions, sets, classes, dials) {
  const targets = targetsFor(dials);

  // Running credit per key. Every canonical key exists from the start, so an empty week still
  // returns a complete structure.
  const done = {};
  for (const key of SHAPE_KEYS) done[key] = 0;

  const credit = (key, amount) => {
    if (amount > 0 && Object.prototype.hasOwnProperty.call(done, key)) done[key] += amount;
  };

  /* ---- logged working sets ---------------------------------------------- */

  let totalSets = 0;
  const impactSessionIds = new Set();

  for (const s of arr(sets)) {
    if (!s || typeof s !== 'object') continue;
    if (s.isWarmup) continue;

    const exercise = byId(typeof s.exerciseId === 'string' ? s.exerciseId : '');
    if (!exercise) continue; // unknown id — skip it, never throw

    totalSets += 1;

    const primary = arr(exercise.primary);
    const seen = new Set();

    for (const key of primary) {
      if (typeof key !== 'string' || seen.has(key)) continue;
      seen.add(key);
      credit(key, 1);
    }
    for (const key of arr(exercise.secondary)) {
      if (typeof key !== 'string' || seen.has(key)) continue;
      seen.add(key);
      credit(key, 0.5);
    }

    if (exercise.impact) {
      // Orphan sets (no sessionId) share one bucket rather than each counting as a session.
      impactSessionIds.add(firstId(s.sessionId) || '__unassigned__');
    }
  }

  /* ---- attended classes -------------------------------------------------- */

  const savedById = new Map();
  for (const c of arr(classes)) {
    if (c && typeof c === 'object' && typeof c.id === 'string' && c.id.trim()) {
      savedById.set(c.id.trim().toLowerCase(), c);
    }
  }

  const countedSessions = new Set();

  for (const session of arr(sessions)) {
    if (!session || typeof session !== 'object') continue;
    if (!isClassSession(session)) continue;

    // Guard against the same session appearing twice in the input.
    const sid = firstId(session.id);
    if (sid) {
      if (countedSessions.has(sid)) continue;
      countedSessions.add(sid);
    }

    const format = resolveClassFormat(session, savedById);
    if (!format) continue;

    const resistance = resistanceOf(format);
    if (resistance <= 0) continue; // Cycle: real conditioning, zero resistance credit

    const contribution = format.shapeContribution;
    if (!contribution || typeof contribution !== 'object') continue;

    for (const key of SHAPE_KEYS) {
      const raw = nonNeg(contribution[key], 0);
      if (raw > 0) credit(key, raw * resistance);
    }
  }

  /* ---- assemble ---------------------------------------------------------- */

  const out = {};
  const shortfalls = [];
  const surplus = [];
  let primaryCount = 0;
  let primaryOnTarget = 0;

  for (const key of SHAPE_KEYS) {
    const meta = SHAPE_TARGETS[key];
    const target = nonNeg(targets[key], 0);
    const doneRounded = round1(done[key]);

    // A target of 0 reads as "nothing asked of you here" — full pct, never a shortfall,
    // and never a division by zero.
    const pct = target > 0 ? clamp(doneRounded / target, 0, PCT_CEILING) : 1;

    out[key] = {
      done: doneRounded,
      target: round1(target),
      pct,
      label: meta.label,
      tier: meta.tier,
    };

    if (meta.tier !== 'primary') continue;

    primaryCount += 1;

    if (target <= 0 || doneRounded >= target) {
      primaryOnTarget += 1;
    } else {
      const short = round1(target - doneRounded);
      if (short > 0) shortfalls.push({ key, label: meta.label, short });
      else primaryOnTarget += 1; // rounds to level — call it hit rather than nag over 0.04
    }

    if (target > 0 && doneRounded > target * SURPLUS_AT) {
      surplus.push({ key, label: meta.label, over: round1(doneRounded - target) });
    }
  }

  // Biggest gap first: the shortfall list is read top-down when picking accessory work.
  shortfalls.sort((a, b) => b.short - a.short || a.label.localeCompare(b.label));
  surplus.sort((a, b) => b.over - a.over || a.label.localeCompare(b.label));

  return {
    targets: out,
    totalSets,
    primaryOnTarget,
    primaryCount,
    impactSessions: impactSessionIds.size,
    shortfalls,
    surplus,
  };
}
