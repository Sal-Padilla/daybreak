// Daybreak — js/data/programs.js — The two training programs and the standalone session templates the scheduler drops into Stack days.

/*
 * BUILD_CONTRACT §4.4 is the shape. Two programs ship:
 *
 *   'on-ramp'          4 weeks, forExperience ['new'].  THE DEFAULT for our user — perimenopausal,
 *                      currently walks and jogs, has never trained with weights. Every movement in
 *                      it is `beginner:true` in exercises.js, RIR 4, reps 8–12, machines / dumbbells
 *                      / cables ahead of barbells, and ZERO `axialLoad:true` movements anywhere.
 *                      The job of these four weeks is pattern literacy and confidence, not load.
 *
 *   'transition-3day'  the ongoing program, forExperience ['returning','experienced'].
 *                      Lower A glute-dominant · Upper shoulder-cap + back · Lower B quad + bone.
 *
 * SESSION TEMPLATES. Both programs carry the same `sessionTemplates` map, keyed by the session
 * `type` values the scheduler uses (BUILD_CONTRACT §4.4: lower | lower-heavy | upper | full |
 * glute | conditioning | recovery). On a Stack morning the scheduler reads the class's `pairWith`,
 * picks the matching template and runs its `short` block. Reach them with
 * `programFor(profile).sessionTemplates[type]` or `PROGRAMS['transition-3day'].sessionTemplates`.
 *
 * BLOCKS. Every day and every template exposes both a `full` and a `short` list.
 *   full   5–6 exercises, 55–65 min
 *   short  3–4 exercises, 25–35 min — keeps the tier-1 lift and the day's primary shape target,
 *          drops the tier-3 accessories and trims sets on what remains. Triaged, not watered down.
 *
 * PRESCRIPTION ITEM
 *   { exerciseId, sets, reps:[lo,hi], rir, tier, restSec, note? }
 *
 *   tier      the movement's ROLE IN THIS SESSION — 1 lead lift · 2 secondary · 3 accessory.
 *             It is not always the library tier: a library tier-1 lift used as a secondary here
 *             carries tier 2, and that is what drives the short-block triage.
 *   reps      units follow the exercise's `track` field in exercises.js —
 *               weight_reps / bodyweight_reps / reps_only → repetitions
 *               time_hold                                 → seconds
 *               time_distance                             → minutes
 *               carries                                   → lengths
 *   rir       reps in reserve. `null` where the idea does not apply: impact work, sprint
 *             intervals and walks are quality- or clock-governed, never taken near failure.
 *   restSec   a starting point for RestTimer, not a rule.
 *
 * DELIBERATE OMISSIONS, carried through from exercises.js and PROJECT_PLAN §5.3: the Upper day has
 * no shrugs and no heavy upright row. Trap bulk shortens the neckline, which is the opposite of what
 * the delt/lat work on that day is for. Loaded rotation and side-bends are absent for the same reason.
 */

import { byId } from './exercises.js';

/* -------------------------------------------------------------------------- */
/* Prescription helper                                                         */
/* -------------------------------------------------------------------------- */

const REST_BY_TIER = { 1: 150, 2: 105, 3: 60 };

/**
 * Build one prescription item.
 * @param {string} exerciseId  must exist in exercises.js — validated at the bottom of this file
 * @param {number} sets
 * @param {number[]} reps      [lo, hi], units per the exercise's `track`
 * @param {number|null} rir
 * @param {number} tier        role in this session: 1 lead · 2 secondary · 3 accessory
 * @param {object} [extra]     e.g. { note, restSec }
 */
function item(exerciseId, sets, reps, rir, tier, extra) {
  return {
    exerciseId,
    sets,
    reps: [reps[0], reps[1]],
    rir,
    tier,
    restSec: REST_BY_TIER[tier] || 90,
    ...(extra || {}),
  };
}

/* ========================================================================== */
/* SESSION TEMPLATES — keyed by session type, for Stack days and substitutions */
/* ========================================================================== */

const SESSION_TEMPLATES = {

  /* ---- upper ------------------------------------------------------------- */
  // The default complement to a leg-heavy class (Cycle, HIIT, Box n Burn).
  upper: {
    key: 'upper',
    name: 'Shoulders & Back',
    type: 'upper',
    focus: ['back', 'delts', 'triceps'],
    description: 'Back and shoulder cap. Nothing here asks anything of the legs.',
    estMinutes: { full: 58, short: 30 },
    blocks: {
      full: [
        item('lat-pulldown', 4, [8, 12], 2, 1, { note: 'Elbows to the ribs. The width you build here is what makes the waist read smaller.' }),
        item('machine-shoulder-press', 3, [10, 12], 2, 3),
        item('chest-supported-row', 3, [8, 12], 2, 2),
        item('dumbbell-lateral-raise', 4, [12, 15], 2, 2, { note: 'Light and clean. Four sets of honest reps beats two heavy sloppy ones.' }),
        item('face-pull', 3, [15, 20], 3, 2),
        item('rope-pushdown', 3, [10, 15], 3, 3),
      ],
      short: [
        item('lat-pulldown', 4, [8, 12], 2, 1),
        item('chest-supported-row', 3, [8, 12], 2, 2),
        item('dumbbell-lateral-raise', 3, [12, 15], 2, 2),
        item('face-pull', 2, [15, 20], 3, 2),
      ],
    },
  },

  /* ---- lower ------------------------------------------------------------- */
  // Moderate, glute-biased lower work. Not the heavy day.
  lower: {
    key: 'lower',
    name: 'Glutes & Legs',
    type: 'lower',
    focus: ['gluteMax', 'hamstrings', 'gluteMed'],
    description: 'Glute-led lower work at a load you can repeat on Friday.',
    estMinutes: { full: 60, short: 32 },
    blocks: {
      full: [
        item('machine-hip-thrust', 4, [8, 12], 2, 1, { note: 'Shins vertical at the top. One-count squeeze, then lower under control.' }),
        item('dumbbell-romanian-deadlift', 3, [8, 12], 2, 2),
        item('box-step-up', 3, [8, 12], 2, 2, { note: 'Reps per leg. No push off the back foot.' }),
        item('cable-hip-abduction', 3, [12, 20], 3, 2),
        item('seated-leg-curl', 3, [10, 15], 3, 3),
        item('pallof-press', 3, [10, 12], 3, 3),
      ],
      short: [
        item('machine-hip-thrust', 3, [8, 12], 2, 1),
        item('dumbbell-romanian-deadlift', 3, [8, 12], 2, 2),
        item('box-step-up', 2, [8, 12], 2, 2),
        item('cable-hip-abduction', 2, [12, 20], 3, 2),
      ],
    },
  },

  /* ---- lower-heavy ------------------------------------------------------- */
  // LIFTMOR territory: heavy 5×5 plus impact. Never inside 24 h of a high-leg-fatigue class (§5.4 R3).
  'lower-heavy': {
    key: 'lower-heavy',
    name: 'Heavy Legs & Bone',
    type: 'lower-heavy',
    focus: ['quads', 'gluteMax', 'core'],
    description: 'Heavy fives and impact. The session bone density actually responds to.',
    estMinutes: { full: 62, short: 34 },
    blocks: {
      full: [
        item('trap-bar-deadlift', 5, [5, 5], 2, 1, { note: 'More upright than a straight bar, which is why it leads a 5:30 session. Exhale through the lockout.' }),
        item('bulgarian-split-squat', 3, [8, 10], 2, 2),
        item('seated-leg-curl', 3, [10, 15], 3, 2),
        item('box-jump', 3, [4, 6], null, 2, { note: 'Land soft, step down every rep. Quality over count — this is a bone signal, not conditioning.', restSec: 90 }),
        item('farmer-carry', 3, [2, 3], 3, 3, { note: 'One rep is one length. Log the weight per hand.' }),
        item('standing-calf-raise', 3, [12, 15], 3, 3),
      ],
      short: [
        item('trap-bar-deadlift', 5, [5, 5], 2, 1),
        item('bulgarian-split-squat', 2, [8, 10], 2, 2),
        item('seated-leg-curl', 2, [10, 15], 3, 2),
        item('box-jump', 3, [4, 6], null, 2, { restSec: 90 }),
      ],
    },
  },

  /* ---- glute ------------------------------------------------------------- */
  // Pure shape work. Pairs well after an upper-dominant class, or as a fourth day.
  glute: {
    key: 'glute',
    name: 'Glute Focus',
    type: 'glute',
    focus: ['gluteMax', 'gluteMed'],
    description: 'Glute max and the side shelf, with almost no spinal load.',
    estMinutes: { full: 55, short: 30 },
    blocks: {
      full: [
        item('barbell-hip-thrust', 4, [6, 10], 2, 1, { note: 'Chin tucked, ribs down. Exhale as you drive up.' }),
        item('back-extension', 3, [10, 12], 2, 2, { note: 'Round the upper back slightly and tuck the pelvis. Treat it as a glute exercise.' }),
        item('bulgarian-split-squat', 3, [8, 12], 2, 2),
        item('cable-hip-abduction', 3, [12, 20], 3, 2),
        item('banded-lateral-walk', 3, [15, 20], null, 3, { note: 'Steps per direction. Stay low the whole set.' }),
        item('frog-pump', 2, [18, 25], 3, 3),
      ],
      short: [
        item('barbell-hip-thrust', 4, [6, 10], 2, 1),
        item('back-extension', 3, [10, 12], 2, 2),
        item('bulgarian-split-squat', 2, [8, 12], 2, 2),
        item('cable-hip-abduction', 3, [12, 20], 3, 2),
      ],
    },
  },

  /* ---- conditioning ------------------------------------------------------ */
  // Sims' SIT prescription: 6–8 × 20 s all-out, 2 min easy between. Short bouts interfere with
  // lifting far less than a long class does, which is the whole reason this is the cardio day.
  conditioning: {
    key: 'conditioning',
    name: 'Sprint Intervals',
    type: 'conditioning',
    focus: ['core'],
    description: 'Six to eight 20-second efforts, two easy minutes between, then trunk work.',
    estMinutes: { full: 40, short: 24 },
    blocks: {
      full: [
        item('bike-sprint-intervals', 1, [16, 20], null, 1, {
          note: 'Six to eight efforts of 20 seconds all-out, two easy minutes between. Stop at six if an effort slows down — the last one should look like the first.',
          restSec: 0,
        }),
        item('pallof-press', 3, [10, 12], 3, 2),
        item('side-plank', 3, [25, 40], null, 2, { note: 'Seconds per side. Breathe out steadily rather than gripping and holding.' }),
        item('farmer-carry', 3, [2, 3], 3, 3),
        item('dead-bug', 2, [8, 10], null, 3),
      ],
      short: [
        item('bike-sprint-intervals', 1, [12, 16], null, 1, {
          note: 'Six efforts of 20 seconds, two easy minutes between.',
          restSec: 0,
        }),
        item('pallof-press', 2, [10, 12], 3, 2),
        item('side-plank', 2, [25, 40], null, 2),
      ],
    },
  },

  /* ---- recovery ---------------------------------------------------------- */
  // Sunday, and the buffer day between heavy sessions. Recovery is training, so it logs like training.
  recovery: {
    key: 'recovery',
    name: 'Walk & Mobility',
    type: 'recovery',
    focus: ['gluteMed', 'core'],
    description: 'An easy walk and ten minutes on the floor. This counts.',
    estMinutes: { full: 60, short: 32 },
    blocks: {
      full: [
        item('outdoor-walk', 1, [45, 60], null, 1, { note: 'Minutes. Easy and unhurried — conversation pace the whole way.', restSec: 0 }),
        item('glute-bridge', 2, [12, 15], null, 2),
        item('bird-dog', 2, [8, 10], null, 2, { note: 'Reps per side. Reach long rather than lifting high.' }),
        item('clamshell', 2, [15, 20], null, 3),
        item('side-lying-hip-abduction', 2, [12, 15], null, 3),
      ],
      short: [
        item('outdoor-walk', 1, [25, 35], null, 1, { restSec: 0 }),
        item('glute-bridge', 2, [12, 15], null, 2),
        item('bird-dog', 2, [8, 10], null, 2),
      ],
    },
  },
};

/* ========================================================================== */
/* PROGRAM 1 — ON-RAMP                                                        */
/* ========================================================================== */

/*
 * Four weeks. Every exercise below is beginner:true. Nothing below is axialLoad:true — not in
 * weeks 1–2, and not in weeks 3–4 either. The one axial movement she is cleared to try in week 3
 * is named in `weekPlan` as an optional upgrade, so the choice stays hers and the default stays safe.
 *
 * RIR 4 across the board, reps 8–12. Week 1 runs a notch lighter still (see weekPlan). She currently
 * walks and jogs, so her legs are conditioned and her connective tissue is not. The load stays where
 * she can hold position for every rep of every set.
 */

const ON_RAMP = {
  id: 'on-ramp',
  name: 'On-Ramp',
  weeks: 4,
  forExperience: ['new'],
  description: 'Four weeks learning the movements at light load. Machines, dumbbells and cables — no barbell on your back, nothing that compresses the spine first thing in the morning.',
  graduatesTo: 'transition-3day',

  days: [
    /* ---- Lower A — glute-dominant --------------------------------------- */
    {
      key: 'lower-a',
      name: 'Glutes & Hamstrings',
      type: 'lower',
      focus: ['gluteMax', 'hamstrings', 'gluteMed'],
      description: 'The glute day. Hip thrust first, because the pattern is worth more than the weight.',
      estMinutes: { full: 56, short: 30 },
      blocks: {
        full: [
          item('machine-hip-thrust', 3, [8, 12], 4, 1, { note: 'Start on the machine — the pad tells you where the top of the rep is. Exhale as you press it away.' }),
          item('dumbbell-romanian-deadlift', 3, [8, 12], 4, 2, { note: 'Hips travel back, not down. Stop where the hamstrings run out of stretch.' }),
          item('dumbbell-split-squat', 3, [8, 10], 4, 2, { note: 'Reps per leg. The easiest single-leg move to learn balance on.' }),
          item('machine-hip-abduction', 3, [12, 20], 4, 2, { note: 'Lean forward about 15 degrees. Three seconds on the way back in.' }),
          item('seated-leg-curl', 3, [10, 15], 4, 3),
          item('dead-bug', 2, [8, 10], null, 3, { note: 'Reps per side. Stop the rep where the low back lifts off the mat.' }),
        ],
        short: [
          item('machine-hip-thrust', 3, [8, 12], 4, 1),
          item('dumbbell-romanian-deadlift', 3, [8, 12], 4, 2),
          item('dumbbell-split-squat', 2, [8, 10], 4, 2),
          item('machine-hip-abduction', 2, [12, 20], 4, 2),
        ],
      },
    },

    /* ---- Upper ----------------------------------------------------------- */
    {
      key: 'upper',
      name: 'Shoulders & Back',
      type: 'upper',
      focus: ['back', 'delts', 'triceps'],
      description: 'Back and shoulders. Everything supported, nothing overhead you cannot control.',
      estMinutes: { full: 55, short: 29 },
      blocks: {
        full: [
          item('lat-pulldown', 3, [8, 12], 4, 1, { note: 'Pull the elbows down to the ribs, not the bar to the chin. Exhale on the pull.' }),
          item('chest-supported-row', 3, [8, 12], 4, 2, { note: 'Chest stays on the pad. Your low back gets the morning off.' }),
          item('machine-shoulder-press', 3, [10, 12], 4, 2, { note: 'Seat set so the handles start at shoulder level. Exhale as you press.' }),
          item('dumbbell-lateral-raise', 3, [12, 15], 4, 2, { note: 'Lead with the elbow, stop at shoulder height. Lighter than you think.' }),
          item('face-pull', 3, [15, 20], 4, 3),
          item('rope-pushdown', 3, [10, 15], 4, 3),
        ],
        short: [
          item('lat-pulldown', 3, [8, 12], 4, 1),
          item('chest-supported-row', 3, [8, 12], 4, 2),
          item('machine-shoulder-press', 2, [10, 12], 4, 2),
          item('dumbbell-lateral-raise', 3, [12, 15], 4, 2),
        ],
      },
    },

    /* ---- Lower B — quad + light impact ----------------------------------- */
    {
      key: 'lower-b',
      name: 'Legs & Bone',
      type: 'lower',
      focus: ['quads', 'gluteMax', 'calves'],
      description: 'The squat pattern, plus the gentlest entry to impact work there is.',
      estMinutes: { full: 57, short: 31 },
      blocks: {
        full: [
          item('goblet-squat', 3, [8, 12], 4, 1, { note: 'The bell at your chest is a counterweight — it keeps you upright and teaches the squat in about four sets.' }),
          item('box-step-up', 3, [8, 12], 4, 2, { note: 'Reps per leg. Box at knee height. No push off the back foot.' }),
          item('lying-leg-curl', 3, [10, 15], 4, 2),
          item('heel-drop', 3, [12, 15], null, 2, { note: 'Rise onto the toes, drop the heels sharply. Bone loading with almost no skill required — this is where jumping starts.', restSec: 60 }),
          item('farmer-carry', 3, [2, 3], 4, 3, { note: 'One rep is one length. Tall through the ribs, short quiet steps.' }),
          item('banded-lateral-walk', 3, [15, 20], null, 3, { note: 'Steps per direction.' }),
        ],
        short: [
          item('goblet-squat', 3, [8, 12], 4, 1),
          item('box-step-up', 2, [8, 12], 4, 2),
          item('lying-leg-curl', 2, [10, 15], 4, 2),
          item('heel-drop', 3, [12, 15], null, 2, { restSec: 60 }),
        ],
      },
    },
  ],

  /*
   * Week-by-week intent. `days` above are the same four weeks running; this is what changes around
   * them. `optionalUpgrade` is the single axially-loaded movement she may try in weeks 3–4 — it is
   * opt-in, and the program is complete and correct without it.
   */
  weekPlan: [
    {
      week: 1,
      rir: 5,
      note: 'Learn the shapes. Every set stops five reps short — you should finish each one thinking you could have done a lot more.',
      optionalUpgrade: null,
    },
    {
      week: 2,
      rir: 4,
      note: 'Same movements, same order. Add a little load only where last week felt easy and looked clean.',
      optionalUpgrade: null,
    },
    {
      week: 3,
      rir: 4,
      note: 'Add one set to the lead lift on each day. Nothing else changes.',
      optionalUpgrade: {
        dayKey: 'lower-b',
        replaces: 'goblet-squat',
        exerciseId: 'smith-machine-squat',
        note: 'Optional. The first movement that puts a bar across your back, on a fixed path. Keep the goblet squat if you would rather — you lose nothing by waiting.',
      },
    },
    {
      week: 4,
      rir: 4,
      note: 'Last week of the On-Ramp. Take the top of every rep range, then you graduate to the three-day program.',
      optionalUpgrade: {
        dayKey: 'lower-b',
        replaces: 'goblet-squat',
        exerciseId: 'smith-machine-squat',
        note: 'Same option as week 3. If you took it and it felt good, this is the movement that carries into Lower B next block.',
      },
    },
  ],

  sessionTemplates: SESSION_TEMPLATES,
};

/* ========================================================================== */
/* PROGRAM 2 — TRANSITION 3-DAY                                               */
/* ========================================================================== */

/*
 * The ongoing program (PROJECT_PLAN §5.1). Three lift days, RIR 2–3, top sets 5–8, one heavy day
 * carrying impact work for bone. Lower A leads with the barbell hip thrust; Lower B leads with the
 * trap-bar deadlift, which is more upright than a straight bar and therefore the AM-legal way to
 * pull heavy at 5:30.
 */

const TRANSITION_3DAY = {
  id: 'transition-3day',
  name: 'Transition — 3 Day',
  weeks: 6,
  forExperience: ['returning', 'experienced'],
  description: 'Three lift days a week: glutes, shoulder cap and back, then heavy quads with impact for bone. Built to run indefinitely with a deload every fifth or sixth week.',

  days: [
    /* ---- Lower A — glute-dominant --------------------------------------- */
    {
      key: 'lower-a',
      name: 'Glutes & Hamstrings',
      type: 'lower',
      focus: ['gluteMax', 'hamstrings', 'gluteMed'],
      description: 'Hip thrust leads. Glute max, hamstrings, and the side shelf that kills the hip-dip look.',
      estMinutes: { full: 63, short: 33 },
      blocks: {
        full: [
          item('barbell-hip-thrust', 4, [6, 8], 2, 1, { note: 'Chin tucked, ribs down. Exhale as you drive up, one-count squeeze at the top.' }),
          item('romanian-deadlift', 3, [6, 10], 2, 2, { note: 'Push the hips back. Stop where the hamstrings run out of stretch — the back stays flat.' }),
          item('bulgarian-split-squat', 3, [8, 10], 2, 2, { note: 'Reps per leg. Long stance and a slight forward lean loads the glute, not the knee.' }),
          item('cable-hip-abduction', 3, [12, 20], 3, 2, { note: 'Lead with the heel, toe slightly down. That is the side glute.' }),
          item('pallof-press', 3, [10, 12], 3, 3),
          item('back-extension', 3, [10, 12], 3, 3),
        ],
        short: [
          item('barbell-hip-thrust', 4, [6, 8], 2, 1),
          item('romanian-deadlift', 3, [6, 10], 2, 2),
          item('bulgarian-split-squat', 2, [8, 10], 2, 2),
          item('cable-hip-abduction', 2, [12, 20], 3, 2),
        ],
      },
    },

    /* ---- Upper — shoulder cap + back ------------------------------------ */
    // No shrugs. No heavy upright row. Trap bulk shortens the neckline; delts and lats do the
    // opposite, and that contrast is the entire point of this day.
    {
      key: 'upper',
      name: 'Shoulders & Back',
      type: 'upper',
      focus: ['back', 'delts', 'triceps'],
      description: 'Delts and lats build the V that makes the waist read smaller. No shrugs, no heavy upright rows — those work against the shape you are after.',
      estMinutes: { full: 61, short: 32 },
      blocks: {
        full: [
          item('lat-pulldown', 4, [8, 12], 2, 1, { note: 'Pull the elbows down to the ribs. Small lean back, then hold it — do not row it.' }),
          item('chest-supported-row', 3, [8, 12], 2, 2, { note: 'Row the elbows past the ribs. Chest stays on the pad.' }),
          item('incline-dumbbell-press', 3, [8, 12], 2, 3, { note: 'Bench at 30 degrees. Higher and it turns into a shoulder press.' }),
          item('dumbbell-lateral-raise', 4, [12, 15], 2, 2, { note: 'The single best move for the shoulder cap. Light weight, clean reps, four sets.' }),
          item('face-pull', 3, [15, 20], 3, 2, { note: 'Rope at eye height, elbows high and wide. Best posture insurance in the building.' }),
          item('rope-pushdown', 3, [10, 15], 3, 3),
        ],
        short: [
          item('lat-pulldown', 4, [8, 12], 2, 1),
          item('chest-supported-row', 3, [8, 12], 2, 2),
          item('dumbbell-lateral-raise', 4, [12, 15], 2, 2),
          item('face-pull', 2, [15, 20], 3, 2),
        ],
      },
    },

    /* ---- Lower B — quad + bone ------------------------------------------ */
    {
      key: 'lower-b',
      name: 'Legs & Bone',
      type: 'lower-heavy',
      focus: ['quads', 'gluteMax', 'core'],
      description: 'Heavy fives and impact loading. Trap-bar over back squat: more upright, kinder to a morning spine, and it moves the same weight.',
      estMinutes: { full: 64, short: 34 },
      blocks: {
        full: [
          item('trap-bar-deadlift', 5, [5, 5], 2, 1, { note: 'Five sets of five. Shoulders set down and back before the first pull, exhale through the lockout. Goblet squat 5×5 is the swap when the trap bar is taken.' }),
          item('box-step-up', 3, [8, 12], 2, 2, { note: 'Reps per leg. Box at knee height or a touch above.' }),
          item('seated-leg-curl', 3, [10, 15], 3, 2),
          item('box-jump', 3, [4, 6], null, 2, { note: 'Land soft and quiet, step down every time. This is the bone signal — quality, not count.', restSec: 90 }),
          item('farmer-carry', 3, [2, 3], 3, 3, { note: 'One rep is one 40-yard length. Log the weight per hand.' }),
          item('cable-hip-abduction', 3, [12, 20], 3, 3),
        ],
        short: [
          item('trap-bar-deadlift', 5, [5, 5], 2, 1),
          item('box-step-up', 2, [8, 12], 2, 2),
          item('seated-leg-curl', 2, [10, 15], 3, 2),
          item('box-jump', 3, [4, 6], null, 2, { restSec: 90 }),
        ],
      },
    },
  ],

  sessionTemplates: SESSION_TEMPLATES,
};

/* ========================================================================== */
/* PROGRAMS                                                                    */
/* ========================================================================== */

/**
 * Every value in here is program-shaped: { id, name, weeks, forExperience, description, days,
 * sessionTemplates }. Insertion order matters — `programFor` walks it and returns the first
 * program whose `forExperience` contains the profile's experience, so On-Ramp is checked first.
 */
export const PROGRAMS = {
  'on-ramp': ON_RAMP,
  'transition-3day': TRANSITION_3DAY,
};

/* -------------------------------------------------------------------------- */
/* Selection                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_PROGRAM_ID = 'on-ramp';

/**
 * Pick the program for a profile.
 *
 * Experience decides it: 'new' (or missing, or anything unrecognised) → the On-Ramp;
 * 'returning' / 'experienced' → the three-day Transition program. An explicit, valid
 * `profile.programId` is honoured only when the experience value matches no program at all,
 * so graduating out of the On-Ramp is a matter of updating `experience` and nothing else.
 *
 * @param {object} [profile]  a profile per BUILD_CONTRACT §4.5. Anything at all is safe to pass.
 * @returns {object} a program from PROGRAMS. Never null, never throws.
 */
export function programFor(profile) {
  const p = (profile && typeof profile === 'object') ? profile : {};

  const experience = typeof p.experience === 'string'
    ? p.experience.trim().toLowerCase()
    : '';

  if (experience) {
    for (const program of Object.values(PROGRAMS)) {
      if (program.forExperience.includes(experience)) return program;
    }
  }

  if (typeof p.programId === 'string') {
    const byProgramId = PROGRAMS[p.programId.trim().toLowerCase()];
    if (byProgramId) return byProgramId;
  }

  return PROGRAMS[DEFAULT_PROGRAM_ID];
}

/* -------------------------------------------------------------------------- */
/* Integrity check                                                             */
/* -------------------------------------------------------------------------- */

/*
 * Every exerciseId above was checked against exercises.js by hand. This re-checks it at load so a
 * later edit to either file cannot quietly ship a dead reference — the failure mode would be a
 * blank exercise card mid-session, which is the worst possible place to find out. It is silent
 * when everything resolves, which is the shipping state.
 */
(function verifyExerciseIds() {
  const problems = [];

  const checkBlock = (where, list) => {
    if (!Array.isArray(list)) {
      problems.push(`${where}: block is not an array`);
      return;
    }
    list.forEach((entry, i) => {
      const exercise = byId(entry.exerciseId);
      if (!exercise) {
        problems.push(`${where}[${i}]: unknown exerciseId "${entry.exerciseId}"`);
      }
    });
  };

  const checkDay = (where, day) => {
    checkBlock(`${where}.full`, day.blocks.full);
    checkBlock(`${where}.short`, day.blocks.short);
  };

  for (const [programId, program] of Object.entries(PROGRAMS)) {
    program.days.forEach((day) => checkDay(`${programId}/${day.key}`, day));
  }
  for (const [type, template] of Object.entries(SESSION_TEMPLATES)) {
    checkDay(`template/${type}`, template);
  }

  // On-Ramp guarantees: beginner-only, and no axially-loaded movement in any week.
  ON_RAMP.days.forEach((day) => {
    [...day.blocks.full, ...day.blocks.short].forEach((entry) => {
      const exercise = byId(entry.exerciseId);
      if (!exercise) return;
      if (!exercise.beginner) {
        problems.push(`on-ramp/${day.key}: "${entry.exerciseId}" is not flagged beginner`);
      }
      if (exercise.axialLoad) {
        problems.push(`on-ramp/${day.key}: "${entry.exerciseId}" is axially loaded`);
      }
    });
  });

  if (problems.length) {
    console.warn('[Daybreak] programs.js integrity check:\n  ' + problems.join('\n  '));
  }
}());
