// Daybreak — js/engine/sessionplan.js — turn a scheduled day into the actual list of exercises.
//
// The scheduler decides WHAT and WHEN (which program day, full or short block, what time).
// This resolves that into the concrete movements, so Today and Train agree on exactly one
// answer rather than each deriving their own.

import { PROGRAMS, programFor } from '../data/programs.js';
import { byId } from '../data/exercises.js';

/** The program object for a profile, always something usable. */
export function programOf(profile) {
  const explicit = profile && profile.programId ? PROGRAMS[profile.programId] : null;
  return explicit || programFor(profile) || PROGRAMS['on-ramp'];
}

/** The program day matching a scheduled session, or null for conditioning/recovery days. */
export function programDayFor(profile, session) {
  if (!session || !session.programDayKey) return null;
  const program = programOf(profile);
  if (!program || !Array.isArray(program.days)) return null;
  return program.days.find((d) => d.key === session.programDayKey) || null;
}

/**
 * planFor(profile, session) -> {
 *   name, type, blockSize, estMinutes, note, focus,
 *   items: [{ exerciseId, exercise, sets, reps, rir, tier, restSec, note }]
 * }
 *
 * Items whose exerciseId no longer resolves are dropped rather than rendered as a blank
 * row — an exercise library edit should never strand her mid-session.
 */
/**
 * The two weekend sessions the scheduler creates have no program day — they are not
 * lifting days, so programDayFor() returns null for them by design. Nothing downstream
 * ever filled that gap, so planFor() returned zero items and the Train screen rendered
 * Saturday's "Sprint intervals" and Sunday's "Walk + weekly report" as "Empty session.
 * Add the first exercise and start logging." Two of her seven days, both weekend
 * mornings, and the note describing exactly what to do was never shown.
 *
 * These give each one real content. One movement, because that IS the session — and the
 * protocol rides on the item note where the exercise card actually displays it. Either
 * can be swapped for its sibling (rower for bike, treadmill for outside) from the card.
 */
const WEEKEND_BLOCKS = {
  conditioning: {
    exerciseId: 'bike-sprint-intervals',
    sets: 1,
    note: 'Six to eight rounds: 20 seconds all-out, two minutes easy between. Log the '
        + 'total time when you are done. Short is the point — it costs your lifting '
        + 'almost nothing. Swap to the rower if the bikes are taken.',
  },
  recovery: {
    exerciseId: 'outdoor-walk',
    sets: 1,
    note: 'Forty-five to sixty minutes easy, outside if you can. Conversational pace — '
        + 'you should be able to talk the whole way. Then read your week back.',
  },
};

/** A plan for a session that has no program day: the weekend conditioning and walk. */
function weekendPlan(session) {
  const spec = WEEKEND_BLOCKS[session.type];
  if (!spec) return null;
  const exercise = byId(spec.exerciseId);
  if (!exercise) {
    console.warn('Daybreak: weekend block references a missing exercise —', spec.exerciseId);
    return null;
  }
  return {
    name: session.name || 'Session',
    type: session.type,
    blockSize: session.blockSize === 'short' ? 'short' : 'full',
    estMinutes: session.estMinutes || 0,
    note: session.note || null,
    focus: session.focus || [],
    items: [{
      exerciseId: spec.exerciseId,
      exercise,
      sets: spec.sets,
      reps: exercise.defaultReps || [1, 1],
      rir: null,
      tier: exercise.tier || 3,
      restSec: 0,
      note: spec.note,
    }],
  };
}

export function planFor(profile, session) {
  const empty = {
    name: session && session.name ? session.name : 'Session',
    type: session ? session.type : 'lower',
    blockSize: session ? session.blockSize : 'full',
    estMinutes: session ? session.estMinutes : 0,
    note: session ? session.note : null,
    focus: session && session.focus ? session.focus : [],
    items: [],
  };
  if (!session) return empty;

  const day = programDayFor(profile, session);
  if (!day || !day.blocks) return weekendPlan(session) || empty;

  const size = session.blockSize === 'short' ? 'short' : 'full';
  const list = day.blocks[size] || day.blocks.full || [];

  const items = [];
  for (const it of list) {
    const exercise = byId(it.exerciseId);
    if (!exercise) {
      console.warn('Daybreak: program references a missing exercise —', it.exerciseId);
      continue;
    }
    items.push({
      exerciseId: it.exerciseId,
      exercise,
      sets: it.sets || 3,
      reps: it.reps || exercise.defaultReps || [8, 12],
      rir: it.rir,
      tier: it.tier || exercise.tier || 3,
      restSec: it.restSec || (exercise.tier === 1 ? 150 : 90),
      note: it.note || null,
    });
  }

  return {
    name: day.name || empty.name,
    type: day.type || empty.type,
    blockSize: size,
    estMinutes: session.estMinutes || day.estMinutes || 0,
    note: session.note || day.description || null,
    focus: day.focus || empty.focus,
    items,
  };
}

/** How many exercises a scheduled session will actually contain. */
export function exerciseCount(profile, session) {
  return planFor(profile, session).items.length;
}
