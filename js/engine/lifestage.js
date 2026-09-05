// Daybreak — js/engine/lifestage.js — the Life Stage dials: volume, load, impact and recovery per stage.

/**
 * The core insight of this product lives in this file.
 *
 * The same program does not produce the same result across ages 30–55. As
 * estrogen falls, muscle stem-cell regenerative capacity drops and the same
 * moderate program stops working — a 20-week controlled trial raised fat-free
 * mass in pre-menopausal women and produced no such gain in post-menopausal
 * women at the same intensities. For postmenopausal women, roughly 15 hard sets
 * per muscle per week beat 9, and the LIFTMOR trial ran 5x5 above 85% 1RM plus
 * impact loading for eight months, safely, with >90% adherence.
 *
 * So the dials go UP with stage, not down. Post-menopause gets MORE volume,
 * HEAVIER load, MORE impact work and MORE deloads — not a lighter version of
 * the 35-year-old's program. Every other app has this backwards.
 *
 * Stage is chosen by symptoms in onboarding, never by birthday. A 44-year-old
 * may sit in any of the three, and she can change it any time.
 */

/** The three stages, in order. Stored on profile.lifeStage. */
export const LIFE_STAGES = ['cycling', 'transition', 'post'];

/**
 * One or two plain sentences per stage, coach voice, for the UI to show next
 * to the dials. Keyed by stage.
 */
export const STAGE_RATIONALE = Object.freeze({
  cycling:
    'Recovery is still on your side, so three focused lift days and steady volume are enough to change your shape. ' +
    'Build the movement quality now — it makes everything that comes after far easier.',
  transition:
    'Recovery slows down well before anything else looks different, so we lift a little heavier, add impact work for your bones, ' +
    'and keep heavy leg days away from hard classes. This is the stage where training too light quietly costs you muscle.',
  post:
    'After menopause your muscle needs a bigger signal to grow, not a smaller one — more sets and heavier weight. ' +
    'Light weights for high reps is the advice that has cost women the most, and we are not following it.'
});

/**
 * The dial table, straight from PROJECT_PLAN §5.2.
 *
 * The plan states several dials as ranges; the app needs one number to
 * prescribe against, so a range collapses to its midpoint, rounded to nearest
 * with .5 rounding up. Weekly sets per primary target: 10–14 -> 12,
 * 12–16 -> 14, 14–20 -> 17. Deload: 6–8 -> 7, 5–6 -> 6, 4–6 -> 5.
 * Protein: 2.0–2.2 -> 2.1. Secondary shape targets (quads, chest, calves,
 * biceps) are trained for balance, so they run at about half the primary
 * volume. rirTarget and topSetReps stay ranges because the UI shows them
 * as ranges.
 */
const BASE = Object.freeze({
  cycling: Object.freeze({
    heavyDaysPerWeek: 3,
    rirTarget: Object.freeze([2, 3]),
    topSetReps: Object.freeze([6, 10]),
    weeklySetsPerPrimary: 12,
    weeklySetsPerSecondary: 6,
    impactSessionsPerWeek: 1,
    sprintSessionsPerWeek: 2,
    easySessionsPerWeek: 3,
    deloadEveryWeeks: 7,
    proteinGPerKg: 1.6,
    warmupMinutes: 10,
    cycleModule: 'date'
  }),
  transition: Object.freeze({
    heavyDaysPerWeek: 3,
    rirTarget: Object.freeze([2, 3]),
    topSetReps: Object.freeze([5, 8]),
    weeklySetsPerPrimary: 14,
    weeklySetsPerSecondary: 7,
    impactSessionsPerWeek: 2,
    sprintSessionsPerWeek: 2,
    easySessionsPerWeek: 3,
    deloadEveryWeeks: 6,
    proteinGPerKg: 1.8,
    warmupMinutes: 12,
    cycleModule: 'symptom'
  }),
  post: Object.freeze({
    heavyDaysPerWeek: 3,
    rirTarget: Object.freeze([1, 2]),
    topSetReps: Object.freeze([3, 6]),
    weeklySetsPerPrimary: 17,
    weeklySetsPerSecondary: 9,
    impactSessionsPerWeek: 3,
    sprintSessionsPerWeek: 2,
    easySessionsPerWeek: 3,
    deloadEveryWeeks: 5,
    proteinGPerKg: 2.1,
    warmupMinutes: 15,
    cycleModule: 'off'
  })
});

/** profile.experience values we understand. */
const EXPERIENCES = ['new', 'returning', 'experienced'];

/**
 * Unknown or missing stage falls back to 'transition' — the stored profile
 * default, and the middle of the three, so a broken profile never prescribes
 * the heaviest program by accident.
 */
function normalizeStage(value) {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return LIFE_STAGES.indexOf(v) === -1 ? 'transition' : v;
}

/**
 * Unknown or missing experience falls back to 'new'. That is the conservative
 * direction: lighter load, longer warm-up. The app always errs toward less
 * load and more warm-up, never the reverse.
 */
function normalizeExperience(value) {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return EXPERIENCES.indexOf(v) === -1 ? 'new' : v;
}

/**
 * The life-stage prescription for one profile.
 *
 * @param {object} profile  a stored profile — only lifeStage and experience are read.
 * @returns {{
 *   stage: string, experience: string, heavyDaysPerWeek: number,
 *   rirTarget: number[], topSetReps: number[],
 *   weeklySetsPerPrimary: number, weeklySetsPerSecondary: number,
 *   impactSessionsPerWeek: number, sprintSessionsPerWeek: number,
 *   easySessionsPerWeek: number, deloadEveryWeeks: number,
 *   proteinGPerKg: number, warmupMinutes: number,
 *   cycleModule: string, rationale: string
 * }}
 *
 * The returned object is a fresh, mutable copy every call — features may
 * override a dial locally without editing the table.
 */
export function dialsFor(profile) {
  const p = profile && typeof profile === 'object' ? profile : {};
  const stage = normalizeStage(p.lifeStage);
  const experience = normalizeExperience(p.experience);
  const base = BASE[stage];

  const dials = {
    stage,
    experience,
    heavyDaysPerWeek: base.heavyDaysPerWeek,
    rirTarget: [base.rirTarget[0], base.rirTarget[1]],
    topSetReps: [base.topSetReps[0], base.topSetReps[1]],
    weeklySetsPerPrimary: base.weeklySetsPerPrimary,
    weeklySetsPerSecondary: base.weeklySetsPerSecondary,
    impactSessionsPerWeek: base.impactSessionsPerWeek,
    sprintSessionsPerWeek: base.sprintSessionsPerWeek,
    easySessionsPerWeek: base.easySessionsPerWeek,
    deloadEveryWeeks: base.deloadEveryWeeks,
    proteinGPerKg: base.proteinGPerKg,
    warmupMinutes: base.warmupMinutes,
    cycleModule: base.cycleModule,
    rationale: STAGE_RATIONALE[stage]
  };

  // Experience override — a first-time lifter learns the pattern before she
  // loads it. Note what does NOT change: heavy days, protein, sprint and easy
  // work, deload cadence, and the stage's cycle module. Being new is a reason
  // to start lighter, not a reason to train less often.
  if (experience === 'new') {
    dials.rirTarget = [4, 5];
    dials.topSetReps = [8, 12];
    dials.weeklySetsPerPrimary = Math.round(base.weeklySetsPerPrimary * 0.7);
    dials.impactSessionsPerWeek = Math.min(base.impactSessionsPerWeek, 1);
    dials.warmupMinutes = base.warmupMinutes + 2;
  }

  return dials;
}
