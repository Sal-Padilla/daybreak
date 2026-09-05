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
  if (!day || !day.blocks) return empty;

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
