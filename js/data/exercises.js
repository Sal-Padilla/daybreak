// Daybreak — js/data/exercises.js — The exercise library: every movement, tagged for the Shape Map, the AM Ordering Rule and the On-Ramp.

/*
 * This is the keystone data file. programs.js, shapemap.js, train.js and the exercise picker all
 * read from it, so the tags below are load-bearing behaviour, not documentation.
 *
 * FIELDS (BUILD_CONTRACT §4.2)
 *   pattern          squat|hinge|lunge|push-h|push-v|pull-h|pull-v|carry|core|iso|plyo|cardio
 *   primary[]        SHAPE_TARGETS keys — a logged working set credits 1.0 to each
 *   secondary[]      SHAPE_TARGETS keys — credits 0.5 to each
 *   track            weight_reps | bodyweight_reps | time_hold | reps_only | time_distance
 *   tier             1 lead lift · 2 secondary · 3 accessory
 *   axialLoad        heavy spinal compression → the 5:30 AM ordering rule soft-warns (§5.4)
 *   impact           counts toward the bone-loading target (LIFTMOR, PROJECT_PLAN §2.2)
 *   pelvicFloorRisk  low|moderate|high — drives substitution when she flags symptoms (§5.6)
 *   defaultReps      [lo,hi]. Units follow `track`:
 *                      weight_reps / bodyweight_reps / reps_only → repetitions
 *                      time_hold                                 → seconds
 *                      time_distance                             → minutes
 *                      carries (weight_reps)                     → lengths, see the cue on each
 *   swaps            same-pattern alternatives, all of which exist in this file. Isolation
 *                    machines with no same-pattern sibling swap to the nearest compound instead.
 *   beginner         included in the 4-week On-Ramp. Every movement pattern has at least one
 *                    machine / cable / dumbbell / bodyweight option marked true, so the On-Ramp
 *                    can be built entirely from beginner-true exercises.
 *
 * CUES: every tier-1 and tier-2 lift carries an exhale-on-effort breath cue. Nothing in this file
 * coaches breath-holding or a Valsalva brace — that is the exact mechanism behind the pelvic floor
 * symptoms this population reports (PROJECT_PLAN §2.8).
 *
 * DELIBERATE OMISSIONS: no heavy shrugs, no loaded side-bends, no weighted twists. Exactly one
 * lightly-loaded rotational movement ships (standing-cable-woodchop, tier 3) and its cue says why.
 * Upright row ships tier 3 with a cue explaining it is de-emphasised in favour of lateral raises.
 */

/* -------------------------------------------------------------------------- */
/* Shape targets — the canonical keys (BUILD_CONTRACT §4.1)                    */
/* -------------------------------------------------------------------------- */

export const SHAPE_TARGETS = {
  gluteMax:   { label: 'Glutes',           tier: 'primary' },
  gluteMed:   { label: 'Side glute/hips',  tier: 'primary' },
  hamstrings: { label: 'Hamstrings',       tier: 'primary' },
  delts:      { label: 'Shoulders',        tier: 'primary' },
  back:       { label: 'Back',             tier: 'primary' },
  triceps:    { label: 'Triceps',          tier: 'primary' },
  core:       { label: 'Core',             tier: 'primary' },
  quads:      { label: 'Quads',            tier: 'secondary' },
  chest:      { label: 'Chest',            tier: 'secondary' },
  calves:     { label: 'Calves',           tier: 'secondary' },
  biceps:     { label: 'Biceps',           tier: 'secondary' },
};

/* -------------------------------------------------------------------------- */
/* Library                                                                     */
/* -------------------------------------------------------------------------- */

// Defaults keep every object complete at runtime even where an entry only states what differs.
const DEFAULTS = {
  pattern: 'iso',
  primary: [],
  secondary: [],
  equipment: [],
  track: 'weight_reps',
  tier: 3,
  axialLoad: false,
  impact: false,
  unilateral: false,
  pelvicFloorRisk: 'low',
  defaultReps: [10, 12],
  cues: [],
  swaps: [],
  beginner: false,
};

const ex = (o) => ({ ...DEFAULTS, ...o });

export const EXERCISES = [

  /* ====================================================================== */
  /* GLUTE MAX — hip thrust and bridge family                               */
  /* The lead pattern of the whole app, and the AM-safe first movement.      */
  /* ====================================================================== */

  ex({
    id: 'barbell-hip-thrust',
    name: 'Barbell Hip Thrust',
    pattern: 'hinge',
    primary: ['gluteMax'],
    secondary: ['hamstrings'],
    equipment: ['barbell', 'bench'],
    track: 'weight_reps',
    tier: 1,
    pelvicFloorRisk: 'low',
    defaultReps: [6, 8],
    cues: [
      'Chin tucked, ribs down',
      'Exhale as you drive up',
      'One-count squeeze at the top',
    ],
    swaps: ['dumbbell-hip-thrust', 'machine-hip-thrust', 'glute-bridge'],
    beginner: true,
  }),

  ex({
    id: 'dumbbell-hip-thrust',
    name: 'Dumbbell Hip Thrust',
    pattern: 'hinge',
    primary: ['gluteMax'],
    secondary: ['hamstrings'],
    equipment: ['dumbbell', 'bench'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [8, 12],
    cues: [
      'Bench across the shoulder blades, not the neck',
      'Exhale as the hips rise',
      'Stop when the hips are level — no arching past it',
    ],
    swaps: ['barbell-hip-thrust', 'machine-hip-thrust', 'glute-bridge'],
    beginner: true,
  }),

  ex({
    id: 'machine-hip-thrust',
    name: 'Hip Thrust Machine',
    pattern: 'hinge',
    primary: ['gluteMax'],
    secondary: ['hamstrings'],
    equipment: ['machine'],
    track: 'weight_reps',
    tier: 1,
    defaultReps: [8, 12],
    cues: [
      'Feet flat, shins vertical at the top',
      'Exhale as you press the pad away',
      'Lower under control — do not let the stack drop',
    ],
    swaps: ['barbell-hip-thrust', 'dumbbell-hip-thrust', 'smith-hip-thrust'],
    beginner: true,
  }),

  ex({
    id: 'smith-hip-thrust',
    name: 'Smith Machine Hip Thrust',
    pattern: 'hinge',
    primary: ['gluteMax'],
    secondary: ['hamstrings'],
    equipment: ['smith', 'bench'],
    track: 'weight_reps',
    tier: 1,
    defaultReps: [8, 10],
    cues: [
      'Set the bar over the hip crease before you load it',
      'Exhale on the drive up',
      'Ribs stay down — the movement is hips, not lower back',
    ],
    swaps: ['barbell-hip-thrust', 'machine-hip-thrust', 'dumbbell-hip-thrust'],
    beginner: true,
  }),

  ex({
    id: 'glute-bridge',
    name: 'Glute Bridge',
    pattern: 'hinge',
    primary: ['gluteMax'],
    secondary: ['hamstrings'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    defaultReps: [12, 20],
    cues: [
      'Heels close to the hips, toes light',
      'Exhale as you press the hips up',
      'Squeeze for one count, then lower slowly',
    ],
    swaps: ['barbell-glute-bridge', 'frog-pump', 'dumbbell-hip-thrust'],
    beginner: true,
  }),

  ex({
    id: 'barbell-glute-bridge',
    name: 'Barbell Glute Bridge',
    pattern: 'hinge',
    primary: ['gluteMax'],
    secondary: ['hamstrings'],
    equipment: ['barbell', 'mat'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [8, 12],
    cues: [
      'Pad the bar and set it on the hip crease',
      'Exhale through the top half of the drive',
      'Shorter range than a thrust — expect to load it heavier',
    ],
    swaps: ['glute-bridge', 'barbell-hip-thrust', 'dumbbell-hip-thrust'],
  }),

  ex({
    id: 'single-leg-hip-thrust',
    name: 'Single-Leg Hip Thrust',
    pattern: 'hinge',
    primary: ['gluteMax'],
    secondary: ['gluteMed', 'hamstrings'],
    equipment: ['bodyweight', 'bench'],
    track: 'bodyweight_reps',
    unilateral: true,
    defaultReps: [8, 12],
    cues: [
      'Hips stay square — do not let the free side drop',
      'Exhale as you drive through the working heel',
      'Free knee pulled toward the chest to keep it honest',
    ],
    swaps: ['b-stance-hip-thrust', 'glute-bridge', 'dumbbell-hip-thrust'],
    beginner: true,
  }),

  ex({
    id: 'b-stance-hip-thrust',
    name: 'B-Stance Hip Thrust',
    pattern: 'hinge',
    primary: ['gluteMax'],
    secondary: ['gluteMed', 'hamstrings'],
    equipment: ['dumbbell', 'bench'],
    track: 'weight_reps',
    tier: 2,
    unilateral: true,
    defaultReps: [8, 12],
    cues: [
      'Front heel does the work, back foot is a kickstand only',
      'Exhale as the hips rise',
      'Same load both sides — start with the weaker side',
    ],
    swaps: ['single-leg-hip-thrust', 'dumbbell-hip-thrust', 'barbell-hip-thrust'],
  }),

  ex({
    id: 'frog-pump',
    name: 'Frog Pump',
    pattern: 'hinge',
    primary: ['gluteMax'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    defaultReps: [15, 25],
    cues: [
      'Soles of the feet together, knees wide',
      'Exhale on every rep — short range, quick tempo',
      'A finisher, not a strength move. Chase the burn, not the load',
    ],
    swaps: ['glute-bridge', 'single-leg-hip-thrust', 'machine-hip-thrust'],
    beginner: true,
  }),

  /* ====================================================================== */
  /* HINGE — deadlifts, RDLs, extensions                                    */
  /* ====================================================================== */

  ex({
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    pattern: 'hinge',
    primary: ['hamstrings', 'gluteMax'],
    secondary: ['back'],
    equipment: ['barbell'],
    track: 'weight_reps',
    tier: 1,
    pelvicFloorRisk: 'moderate',
    defaultReps: [6, 10],
    cues: [
      'Push the hips back, do not bend the knees to get down',
      'Exhale as you stand the bar up',
      'Stop where the hamstrings run out of stretch — the back stays flat',
    ],
    swaps: ['dumbbell-romanian-deadlift', 'cable-romanian-deadlift', 'good-morning'],
  }),

  ex({
    id: 'dumbbell-romanian-deadlift',
    name: 'Dumbbell Romanian Deadlift',
    pattern: 'hinge',
    primary: ['hamstrings', 'gluteMax'],
    secondary: ['back'],
    equipment: ['dumbbell'],
    track: 'weight_reps',
    tier: 2,
    pelvicFloorRisk: 'moderate',
    defaultReps: [8, 12],
    cues: [
      'Dumbbells brush the thighs the whole way down',
      'Exhale as you drive the hips forward to stand',
      'Soft knees, not bent knees',
    ],
    swaps: ['romanian-deadlift', 'cable-romanian-deadlift', 'single-leg-romanian-deadlift'],
    beginner: true,
  }),

  ex({
    id: 'cable-romanian-deadlift',
    name: 'Cable Romanian Deadlift',
    pattern: 'hinge',
    primary: ['hamstrings', 'gluteMax'],
    equipment: ['cable'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [10, 15],
    cues: [
      'The cable pulls you back — lean into it and hinge',
      'Exhale as you finish the hips',
      'Tension never drops, which is the point of doing it here',
    ],
    swaps: ['dumbbell-romanian-deadlift', 'romanian-deadlift', 'cable-pull-through'],
    beginner: true,
  }),

  ex({
    id: 'single-leg-romanian-deadlift',
    name: 'Single-Leg Romanian Deadlift',
    pattern: 'hinge',
    primary: ['hamstrings', 'gluteMed'],
    secondary: ['gluteMax', 'core'],
    equipment: ['dumbbell'],
    track: 'weight_reps',
    tier: 2,
    unilateral: true,
    defaultReps: [8, 10],
    cues: [
      'Hip of the free leg stays down — no opening to the ceiling',
      'Exhale as you come back to standing',
      'Touch the free toe down between reps if balance goes',
    ],
    swaps: ['dumbbell-romanian-deadlift', 'cable-romanian-deadlift', 'b-stance-hip-thrust'],
    beginner: true,
  }),

  ex({
    id: 'conventional-deadlift',
    name: 'Conventional Deadlift',
    pattern: 'hinge',
    primary: ['gluteMax', 'hamstrings'],
    secondary: ['back', 'quads'],
    equipment: ['barbell'],
    track: 'weight_reps',
    tier: 1,
    axialLoad: true,
    pelvicFloorRisk: 'high',
    defaultReps: [3, 6],
    cues: [
      'Bar over mid-foot, lats set before you pull',
      'Exhale steadily through the lockout — no breath-holding under the bar',
      'Push the floor away rather than yanking the bar up',
    ],
    swaps: ['trap-bar-deadlift', 'sumo-deadlift', 'romanian-deadlift'],
  }),

  ex({
    id: 'sumo-deadlift',
    name: 'Sumo Deadlift',
    pattern: 'hinge',
    primary: ['gluteMax', 'quads'],
    secondary: ['hamstrings', 'back'],
    equipment: ['barbell'],
    track: 'weight_reps',
    tier: 1,
    axialLoad: true,
    pelvicFloorRisk: 'high',
    defaultReps: [3, 6],
    cues: [
      'Wide stance, toes out, knees tracking over the toes',
      'Exhale through the lockout — never hold your breath',
      'Chest up first, then push the knees out and stand',
    ],
    swaps: ['conventional-deadlift', 'trap-bar-deadlift', 'romanian-deadlift'],
  }),

  ex({
    id: 'trap-bar-deadlift',
    name: 'Trap-Bar Deadlift',
    pattern: 'hinge',
    primary: ['gluteMax', 'quads'],
    secondary: ['hamstrings', 'back'],
    equipment: ['trapbar'],
    track: 'weight_reps',
    tier: 1,
    pelvicFloorRisk: 'high',
    defaultReps: [5, 8],
    cues: [
      'More upright than a straight bar — that is why it leads the morning',
      'Exhale as you stand it up',
      'Set the shoulders down and back before the first pull',
    ],
    swaps: ['conventional-deadlift', 'sumo-deadlift', 'dumbbell-romanian-deadlift'],
    beginner: true,
  }),

  ex({
    id: 'good-morning',
    name: 'Good Morning',
    pattern: 'hinge',
    primary: ['hamstrings', 'gluteMax'],
    secondary: ['back'],
    equipment: ['barbell', 'rack'],
    track: 'weight_reps',
    tier: 2,
    axialLoad: true,
    pelvicFloorRisk: 'high',
    defaultReps: [8, 10],
    cues: [
      'Light bar. This one is never a strength test',
      'Exhale as you stand back up',
      'Hips travel back, spine holds one line the whole rep',
    ],
    swaps: ['romanian-deadlift', 'back-extension', 'cable-pull-through'],
  }),

  ex({
    id: 'back-extension',
    name: 'Back Extension',
    pattern: 'hinge',
    primary: ['gluteMax', 'hamstrings'],
    secondary: ['back'],
    equipment: ['machine'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [10, 15],
    cues: [
      'Round the upper back slightly and tuck the pelvis — this is a glute exercise',
      'Exhale as you come up',
      'Stop level with the pad. Nothing is gained by going past it',
    ],
    swaps: ['cable-pull-through', 'good-morning', 'glute-ham-raise'],
    beginner: true,
  }),

  ex({
    id: 'cable-pull-through',
    name: 'Cable Pull-Through',
    pattern: 'hinge',
    primary: ['gluteMax'],
    secondary: ['hamstrings'],
    equipment: ['cable'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [12, 15],
    cues: [
      'Walk out until the cable is tight, then hinge back to it',
      'Exhale as the hips snap through',
      'Finish standing tall — do not lean back at the top',
    ],
    swaps: ['cable-romanian-deadlift', 'back-extension', 'dumbbell-romanian-deadlift'],
    beginner: true,
  }),

  ex({
    id: 'kettlebell-swing',
    name: 'Kettlebell Swing',
    pattern: 'hinge',
    primary: ['gluteMax', 'hamstrings'],
    secondary: ['core'],
    equipment: ['kettlebell'],
    track: 'weight_reps',
    tier: 2,
    pelvicFloorRisk: 'high',
    defaultReps: [10, 15],
    cues: [
      'Hinge, do not squat. The bell floats, you do not lift it',
      'Sharp exhale at the top of every swing',
      'Chest height is plenty — overhead adds risk and nothing else',
    ],
    swaps: ['cable-pull-through', 'dumbbell-romanian-deadlift', 'romanian-deadlift'],
  }),

  ex({
    id: 'glute-ham-raise',
    name: 'Glute-Ham Raise',
    pattern: 'hinge',
    primary: ['hamstrings'],
    secondary: ['gluteMax'],
    equipment: ['machine'],
    track: 'bodyweight_reps',
    tier: 2,
    defaultReps: [5, 8],
    cues: [
      'Hips stay extended — this is not a back extension',
      'Exhale as you pull yourself back up',
      'Push the toes into the plate to hold the shin down',
    ],
    swaps: ['nordic-curl', 'back-extension', 'good-morning'],
  }),

  ex({
    id: 'nordic-curl',
    name: 'Nordic Hamstring Curl',
    pattern: 'hinge',
    primary: ['hamstrings'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    tier: 2,
    defaultReps: [4, 8],
    cues: [
      'Lower as slowly as you can, then push off the floor to return',
      'Exhale on the way down — the eccentric is the whole exercise',
      'Hips locked out the entire rep',
    ],
    swaps: ['glute-ham-raise', 'back-extension', 'good-morning'],
  }),

  /* ====================================================================== */
  /* LUNGE — single leg, glute-dominant                                     */
  /* ====================================================================== */

  ex({
    id: 'bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    pattern: 'lunge',
    primary: ['gluteMax', 'quads'],
    secondary: ['gluteMed'],
    equipment: ['dumbbell', 'bench'],
    track: 'weight_reps',
    tier: 1,
    unilateral: true,
    pelvicFloorRisk: 'moderate',
    defaultReps: [8, 10],
    cues: [
      'Long stance and a slight forward lean loads the glute, not the knee',
      'Exhale as you drive up out of the bottom',
      'Front heel stays glued down',
    ],
    swaps: ['reverse-lunge', 'dumbbell-split-squat', 'box-step-up'],
    beginner: true,
  }),

  ex({
    id: 'reverse-lunge',
    name: 'Reverse Lunge',
    pattern: 'lunge',
    primary: ['gluteMax', 'quads'],
    secondary: ['gluteMed'],
    equipment: ['dumbbell'],
    track: 'weight_reps',
    tier: 2,
    unilateral: true,
    defaultReps: [8, 12],
    cues: [
      'Step back, not down — the front leg never moves',
      'Exhale as you stand out of the lunge',
      'Kinder to the knees than a forward lunge, same glute payoff',
    ],
    swaps: ['walking-lunge', 'box-step-up', 'bulgarian-split-squat'],
    beginner: true,
  }),

  ex({
    id: 'deficit-reverse-lunge',
    name: 'Deficit Reverse Lunge',
    pattern: 'lunge',
    primary: ['gluteMax', 'quads'],
    secondary: ['gluteMed'],
    equipment: ['dumbbell', 'box'],
    track: 'weight_reps',
    tier: 2,
    unilateral: true,
    defaultReps: [8, 10],
    cues: [
      'Stand on a low step so the back knee travels further down',
      'Exhale as you push back up to the platform',
      'Deeper stretch on the glute — drop the load to earn the range',
    ],
    swaps: ['reverse-lunge', 'bulgarian-split-squat', 'walking-lunge'],
  }),

  ex({
    id: 'walking-lunge',
    name: 'Walking Lunge',
    pattern: 'lunge',
    primary: ['quads', 'gluteMax'],
    secondary: ['gluteMed'],
    equipment: ['dumbbell'],
    track: 'weight_reps',
    tier: 2,
    unilateral: true,
    defaultReps: [10, 14],
    cues: [
      'Count reps per leg, not total steps',
      'Exhale each time you come up to standing',
      'Torso upright, ribs stacked over the hips',
    ],
    swaps: ['reverse-lunge', 'dumbbell-split-squat', 'box-step-up'],
    beginner: true,
  }),

  ex({
    id: 'dumbbell-split-squat',
    name: 'Dumbbell Split Squat',
    pattern: 'lunge',
    primary: ['quads', 'gluteMax'],
    equipment: ['dumbbell'],
    track: 'weight_reps',
    tier: 2,
    unilateral: true,
    defaultReps: [8, 12],
    cues: [
      'Feet stay planted — you only move up and down',
      'Exhale on the drive up',
      'The easiest single-leg move to learn balance on. Start here',
    ],
    swaps: ['bulgarian-split-squat', 'reverse-lunge', 'walking-lunge'],
    beginner: true,
  }),

  ex({
    id: 'box-step-up',
    name: 'Box Step-Up',
    pattern: 'lunge',
    primary: ['gluteMax', 'quads'],
    secondary: ['gluteMed'],
    equipment: ['dumbbell', 'box'],
    track: 'weight_reps',
    tier: 2,
    unilateral: true,
    defaultReps: [8, 12],
    cues: [
      'Box at knee height or a touch above for the glute',
      'Exhale as you press through the top foot',
      'No push off the back foot — it is a passenger',
    ],
    swaps: ['lateral-step-up', 'reverse-lunge', 'bulgarian-split-squat'],
    beginner: true,
  }),

  ex({
    id: 'lateral-step-up',
    name: 'Lateral Step-Up',
    pattern: 'lunge',
    primary: ['gluteMed', 'quads'],
    secondary: ['gluteMax'],
    equipment: ['dumbbell', 'box'],
    track: 'weight_reps',
    unilateral: true,
    defaultReps: [10, 12],
    cues: [
      'Stand side-on to the box and step up sideways',
      'Exhale as you rise',
      'Knee tracks over the middle toes — do not let it fall inward',
    ],
    swaps: ['box-step-up', 'curtsy-lunge', 'lateral-lunge'],
    beginner: true,
  }),

  ex({
    id: 'curtsy-lunge',
    name: 'Curtsy Lunge',
    pattern: 'lunge',
    primary: ['gluteMed', 'gluteMax'],
    secondary: ['quads'],
    equipment: ['dumbbell'],
    track: 'weight_reps',
    unilateral: true,
    defaultReps: [10, 12],
    cues: [
      'Back leg crosses behind and out to the side',
      'Exhale as you come back to standing',
      'Front knee stays over the foot — moderate load only',
    ],
    swaps: ['lateral-lunge', 'lateral-step-up', 'reverse-lunge'],
    beginner: true,
  }),

  ex({
    id: 'lateral-lunge',
    name: 'Lateral Lunge',
    pattern: 'lunge',
    primary: ['gluteMed', 'quads'],
    secondary: ['hamstrings'],
    equipment: ['dumbbell'],
    track: 'weight_reps',
    unilateral: true,
    defaultReps: [10, 12],
    cues: [
      'Step wide, sit back into that hip, keep the other leg straight',
      'Exhale as you push back to the middle',
      'Chest stays up — hinge at the hip, not the spine',
    ],
    swaps: ['curtsy-lunge', 'lateral-step-up', 'box-step-up'],
    beginner: true,
  }),

  /* ====================================================================== */
  /* GLUTE MED / ABDUCTION — the side shelf                                 */
  /* ====================================================================== */

  ex({
    id: 'cable-hip-abduction',
    name: 'Cable Hip Abduction',
    pattern: 'iso',
    primary: ['gluteMed'],
    equipment: ['cable'],
    track: 'weight_reps',
    tier: 2,
    unilateral: true,
    defaultReps: [12, 20],
    cues: [
      'Cuff low on the ankle, stand tall and hold the upright',
      'Exhale as the leg travels out',
      'Lead with the heel, toe slightly down — that is the side glute',
    ],
    swaps: ['machine-hip-abduction', 'side-lying-hip-abduction', 'seated-band-abduction'],
    beginner: true,
  }),

  ex({
    id: 'machine-hip-abduction',
    name: 'Hip Abduction Machine',
    pattern: 'iso',
    primary: ['gluteMed'],
    equipment: ['machine'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [12, 20],
    cues: [
      'Lean the torso forward about 15 degrees to bias the upper glute',
      'Exhale as you press the pads apart',
      'Three seconds back in — the return is half the work',
    ],
    swaps: ['cable-hip-abduction', 'seated-band-abduction', 'side-lying-hip-abduction'],
    beginner: true,
  }),

  ex({
    id: 'seated-band-abduction',
    name: 'Seated Band Abduction',
    pattern: 'iso',
    primary: ['gluteMed'],
    equipment: ['band'],
    track: 'reps_only',
    defaultReps: [15, 25],
    cues: [
      'Band above the knees, feet flat, lean forward onto the elbows',
      'Exhale as you push the knees apart',
      'A finisher when the abduction machine is taken',
    ],
    swaps: ['machine-hip-abduction', 'cable-hip-abduction', 'clamshell'],
    beginner: true,
  }),

  ex({
    id: 'banded-lateral-walk',
    name: 'Banded Lateral Walk',
    pattern: 'iso',
    primary: ['gluteMed'],
    equipment: ['band'],
    track: 'reps_only',
    defaultReps: [12, 20],
    cues: [
      'Half squat, band above the knees, toes forward',
      'Breathe out through each step — never hold your breath here',
      'Count steps per direction',
    ],
    swaps: ['monster-walk', 'seated-band-abduction', 'clamshell'],
    beginner: true,
  }),

  ex({
    id: 'monster-walk',
    name: 'Monster Walk',
    pattern: 'iso',
    primary: ['gluteMed'],
    secondary: ['gluteMax'],
    equipment: ['band'],
    track: 'reps_only',
    defaultReps: [12, 20],
    cues: [
      'Wide stance, walk diagonally forward against the band',
      'Steady breathing, out on each step',
      'Stay low the whole set',
    ],
    swaps: ['banded-lateral-walk', 'clamshell', 'fire-hydrant'],
    beginner: true,
  }),

  ex({
    id: 'side-lying-hip-abduction',
    name: 'Side-Lying Hip Abduction',
    pattern: 'iso',
    primary: ['gluteMed'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    unilateral: true,
    defaultReps: [12, 20],
    cues: [
      'Stack the hips, roll the top hip slightly forward',
      'Exhale as the leg lifts',
      'Small range, done right, beats a big sloppy one',
    ],
    swaps: ['clamshell', 'fire-hydrant', 'cable-hip-abduction'],
    beginner: true,
  }),

  ex({
    id: 'clamshell',
    name: 'Clamshell',
    pattern: 'iso',
    primary: ['gluteMed'],
    equipment: ['band', 'mat'],
    track: 'reps_only',
    unilateral: true,
    defaultReps: [15, 20],
    cues: [
      'Heels together, knees open against the band',
      'Exhale on the open',
      'The pelvis must not roll back — that is where the range comes from',
    ],
    swaps: ['side-lying-hip-abduction', 'fire-hydrant', 'banded-lateral-walk'],
    beginner: true,
  }),

  ex({
    id: 'fire-hydrant',
    name: 'Fire Hydrant',
    pattern: 'iso',
    primary: ['gluteMed'],
    secondary: ['gluteMax'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    unilateral: true,
    defaultReps: [12, 20],
    cues: [
      'On all fours, knee bent, lift out to the side',
      'Exhale as the knee opens',
      'Ribs down, no rotating through the low back',
    ],
    swaps: ['clamshell', 'side-lying-hip-abduction', 'monster-walk'],
    beginner: true,
  }),

  /* ====================================================================== */
  /* HAMSTRING ISOLATION                                                    */
  /* ====================================================================== */

  ex({
    id: 'seated-leg-curl',
    name: 'Seated Leg Curl',
    pattern: 'iso',
    primary: ['hamstrings'],
    secondary: ['calves'],
    equipment: ['machine'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [10, 15],
    cues: [
      'Knee joint lined up with the machine pivot',
      'Exhale as you curl the pad under',
      'Three seconds on the return',
    ],
    swaps: ['lying-leg-curl', 'standing-leg-curl', 'stability-ball-leg-curl'],
    beginner: true,
  }),

  ex({
    id: 'lying-leg-curl',
    name: 'Lying Leg Curl',
    pattern: 'iso',
    primary: ['hamstrings'],
    secondary: ['calves'],
    equipment: ['machine'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [10, 15],
    cues: [
      'Hips stay pressed into the pad — no lifting to help the weight',
      'Exhale as you curl',
      'Point the toes away to bias the hamstring over the calf',
    ],
    swaps: ['seated-leg-curl', 'standing-leg-curl', 'stability-ball-leg-curl'],
    beginner: true,
  }),

  ex({
    id: 'standing-leg-curl',
    name: 'Standing Leg Curl',
    pattern: 'iso',
    primary: ['hamstrings'],
    equipment: ['machine'],
    track: 'weight_reps',
    unilateral: true,
    defaultReps: [10, 15],
    cues: [
      'Hips square to the machine, no swinging',
      'Exhale as you curl the heel to the glute',
      'Good for finding a side-to-side difference',
    ],
    swaps: ['seated-leg-curl', 'lying-leg-curl', 'stability-ball-leg-curl'],
    beginner: true,
  }),

  ex({
    id: 'stability-ball-leg-curl',
    name: 'Stability Ball Leg Curl',
    pattern: 'iso',
    primary: ['hamstrings'],
    secondary: ['gluteMax', 'core'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    defaultReps: [10, 15],
    cues: [
      'Hips stay high the whole set',
      'Exhale as you pull the ball in',
      'Slow the return down until you can control it',
    ],
    swaps: ['lying-leg-curl', 'seated-leg-curl', 'standing-leg-curl'],
    beginner: true,
  }),

  /* ====================================================================== */
  /* SQUAT PATTERN / QUADS                                                  */
  /* ====================================================================== */

  ex({
    id: 'back-squat',
    name: 'Back Squat',
    pattern: 'squat',
    primary: ['quads', 'gluteMax'],
    secondary: ['hamstrings', 'core'],
    equipment: ['barbell', 'rack'],
    track: 'weight_reps',
    tier: 1,
    axialLoad: true,
    pelvicFloorRisk: 'high',
    defaultReps: [5, 8],
    cues: [
      'Not the first movement of a 5:30 session — put it after 20 minutes upright',
      'Exhale on the way up. No breath-holding under load',
      'Knees track over the toes, chest stays proud out of the hole',
    ],
    swaps: ['front-squat', 'smith-machine-squat', 'goblet-squat'],
  }),

  ex({
    id: 'front-squat',
    name: 'Front Squat',
    pattern: 'squat',
    primary: ['quads'],
    secondary: ['gluteMax', 'core'],
    equipment: ['barbell', 'rack'],
    track: 'weight_reps',
    tier: 1,
    axialLoad: true,
    pelvicFloorRisk: 'high',
    defaultReps: [5, 8],
    cues: [
      'Elbows high — if they drop, the bar goes with them',
      'Exhale through the drive up',
      'More upright than a back squat, so the low back gets an easier ride',
    ],
    swaps: ['back-squat', 'hack-squat', 'goblet-squat'],
  }),

  ex({
    id: 'goblet-squat',
    name: 'Goblet Squat',
    pattern: 'squat',
    primary: ['quads', 'gluteMax'],
    secondary: ['core'],
    equipment: ['dumbbell', 'kettlebell'],
    track: 'weight_reps',
    tier: 2,
    pelvicFloorRisk: 'moderate',
    defaultReps: [8, 12],
    cues: [
      'Hold the bell at the chest — the counterweight keeps you upright',
      'Exhale as you stand up',
      'Elbows brush the inside of the knees at the bottom',
    ],
    swaps: ['leg-press', 'back-squat', 'smith-machine-squat'],
    beginner: true,
  }),

  ex({
    id: 'leg-press',
    name: 'Leg Press',
    pattern: 'squat',
    primary: ['quads', 'gluteMax'],
    secondary: ['hamstrings'],
    equipment: ['machine'],
    track: 'weight_reps',
    tier: 1,
    pelvicFloorRisk: 'moderate',
    defaultReps: [10, 15],
    cues: [
      'Feet higher on the platform shifts work to the glutes and hamstrings',
      'Exhale as you press away',
      'Low back stays on the pad — stop before the hips curl under',
    ],
    swaps: ['hack-squat', 'goblet-squat', 'back-squat'],
    beginner: true,
  }),

  ex({
    id: 'hack-squat',
    name: 'Hack Squat',
    pattern: 'squat',
    primary: ['quads'],
    secondary: ['gluteMax'],
    equipment: ['machine'],
    track: 'weight_reps',
    tier: 2,
    pelvicFloorRisk: 'moderate',
    defaultReps: [8, 12],
    cues: [
      'Back flat on the pad the entire rep',
      'Exhale as you press up',
      'Feet a little forward takes strain off the knees',
    ],
    swaps: ['leg-press', 'smith-machine-squat', 'front-squat'],
    beginner: true,
  }),

  ex({
    id: 'smith-machine-squat',
    name: 'Smith Machine Squat',
    pattern: 'squat',
    primary: ['quads', 'gluteMax'],
    secondary: ['core'],
    equipment: ['smith'],
    track: 'weight_reps',
    tier: 2,
    axialLoad: true,
    pelvicFloorRisk: 'high',
    defaultReps: [6, 10],
    cues: [
      'Feet slightly forward of the bar so the hips can sit back',
      'Exhale on the way up',
      'Fixed bar path — useful when you are training alone and pushing load',
    ],
    swaps: ['back-squat', 'hack-squat', 'goblet-squat'],
    beginner: true,
  }),

  ex({
    id: 'wall-sit',
    name: 'Wall Sit',
    pattern: 'squat',
    primary: ['quads'],
    equipment: ['bodyweight'],
    track: 'time_hold',
    defaultReps: [30, 60],
    cues: [
      'Thighs parallel, back flat to the wall',
      'Keep breathing out steadily — this is where people hold their breath',
      'Hands off the legs',
    ],
    swaps: ['goblet-squat', 'leg-press', 'hack-squat'],
    beginner: true,
  }),

  ex({
    id: 'leg-extension',
    name: 'Leg Extension',
    pattern: 'iso',
    primary: ['quads'],
    equipment: ['machine'],
    track: 'weight_reps',
    defaultReps: [12, 15],
    cues: [
      'Pause one count at the top with the knees straight',
      'Exhale as you extend',
      'Light load, full range — this is not a knee-testing lift',
    ],
    swaps: ['leg-press', 'hack-squat', 'wall-sit'],
    beginner: true,
  }),

  /* ====================================================================== */
  /* CORE — anti-extension, anti-rotation, carries                          */
  /* ====================================================================== */

  ex({
    id: 'dead-bug',
    name: 'Dead Bug',
    pattern: 'core',
    primary: ['core'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    tier: 2,
    defaultReps: [8, 12],
    cues: [
      'Low back stays flat on the mat the whole time',
      'Exhale as the arm and leg reach away',
      'Go slower, not further. Stop the rep where the back lifts',
    ],
    swaps: ['bird-dog', 'plank', 'stir-the-pot'],
    beginner: true,
  }),

  ex({
    id: 'bird-dog',
    name: 'Bird Dog',
    pattern: 'core',
    primary: ['core'],
    secondary: ['gluteMax', 'back'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    unilateral: true,
    defaultReps: [8, 12],
    cues: [
      'Reach long rather than lifting high',
      'Exhale as you extend',
      'Hips stay level — imagine a glass of water on your low back',
    ],
    swaps: ['dead-bug', 'plank', 'glute-bridge-march'],
    beginner: true,
  }),

  ex({
    id: 'plank',
    name: 'Plank',
    pattern: 'core',
    primary: ['core'],
    equipment: ['bodyweight', 'mat'],
    track: 'time_hold',
    tier: 2,
    defaultReps: [30, 60],
    cues: [
      'Elbows under shoulders, ribs down, glutes on',
      'Breathe normally through it — a plank you cannot breathe in is too hard',
      'Stop the set when the hips start to sag, not when the clock says so',
    ],
    swaps: ['side-plank', 'hollow-hold', 'weighted-plank'],
    beginner: true,
  }),

  ex({
    id: 'weighted-plank',
    name: 'Weighted Plank',
    pattern: 'core',
    primary: ['core'],
    equipment: ['bodyweight', 'mat'],
    track: 'time_hold',
    defaultReps: [30, 45],
    cues: [
      'Plate across the upper back, placed by a partner or set carefully',
      'Keep breathing out steadily — no bracing and holding',
      'Progress the load only once a clean 60-second plank is easy',
    ],
    swaps: ['plank', 'ab-wheel-rollout', 'hollow-hold'],
  }),

  ex({
    id: 'side-plank',
    name: 'Side Plank',
    pattern: 'core',
    primary: ['core'],
    secondary: ['gluteMed'],
    equipment: ['bodyweight', 'mat'],
    track: 'time_hold',
    unilateral: true,
    defaultReps: [20, 45],
    cues: [
      'Body in one line from ear to ankle',
      'Breathe out steadily rather than gripping and holding',
      'Drop the bottom knee if the hips sink',
    ],
    swaps: ['plank', 'pallof-press', 'hollow-hold'],
    beginner: true,
  }),

  ex({
    id: 'hollow-hold',
    name: 'Hollow Hold',
    pattern: 'core',
    primary: ['core'],
    equipment: ['bodyweight', 'mat'],
    track: 'time_hold',
    defaultReps: [20, 40],
    cues: [
      'Low back pressed down first, then lift the shoulders and legs',
      'Keep breathing out — bend the knees if the back lifts',
      'Lower legs, harder hold. Raise them to make it easier',
    ],
    swaps: ['plank', 'dead-bug', 'lying-leg-raise'],
    beginner: true,
  }),

  ex({
    id: 'pallof-press',
    name: 'Pallof Press',
    pattern: 'core',
    primary: ['core'],
    equipment: ['cable'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [10, 12],
    cues: [
      'Stand side-on. The cable wants to twist you; your job is to refuse',
      'Exhale as you press the handle out',
      'Hips and shoulders stay square the whole rep',
    ],
    swaps: ['half-kneeling-pallof-press', 'dead-bug', 'side-plank'],
    beginner: true,
  }),

  ex({
    id: 'half-kneeling-pallof-press',
    name: 'Half-Kneeling Pallof Press',
    pattern: 'core',
    primary: ['core'],
    secondary: ['gluteMax'],
    equipment: ['cable', 'mat'],
    track: 'weight_reps',
    defaultReps: [10, 12],
    cues: [
      'Down knee under the hip, tall through the ribs',
      'Exhale on the press-out',
      'Takes the legs out of it, so the trunk has nowhere to hide',
    ],
    swaps: ['pallof-press', 'dead-bug', 'side-plank'],
    beginner: true,
  }),

  ex({
    id: 'ab-wheel-rollout',
    name: 'Ab Wheel Rollout',
    pattern: 'core',
    primary: ['core'],
    secondary: ['back'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    tier: 2,
    pelvicFloorRisk: 'moderate',
    defaultReps: [6, 10],
    cues: [
      'From the knees. Tuck the pelvis before the wheel moves',
      'Exhale as you pull back in',
      'Only roll as far as the low back stays flat',
    ],
    swaps: ['stir-the-pot', 'plank', 'hollow-hold'],
  }),

  ex({
    id: 'stir-the-pot',
    name: 'Stir the Pot',
    pattern: 'core',
    primary: ['core'],
    equipment: ['bodyweight', 'mat'],
    track: 'time_hold',
    defaultReps: [20, 40],
    cues: [
      'Forearms on a stability ball, plank position, draw small circles',
      'Keep breathing out through the circles',
      'The gentlest way into rollout-style loading',
    ],
    swaps: ['plank', 'ab-wheel-rollout', 'dead-bug'],
    beginner: true,
  }),

  ex({
    id: 'cable-crunch',
    name: 'Cable Crunch',
    pattern: 'core',
    primary: ['core'],
    equipment: ['cable', 'mat'],
    track: 'weight_reps',
    pelvicFloorRisk: 'moderate',
    defaultReps: [10, 15],
    cues: [
      'Hips stay still — curl the ribs toward the pelvis',
      'Exhale all the way down through the crunch',
      'Moderate load. This is a shaping move, not a strength move',
    ],
    swaps: ['reverse-crunch', 'hanging-knee-raise', 'hollow-hold'],
    beginner: true,
  }),

  ex({
    id: 'hanging-knee-raise',
    name: 'Hanging Knee Raise',
    pattern: 'core',
    primary: ['core'],
    secondary: ['back'],
    equipment: ['bodyweight', 'rack'],
    track: 'bodyweight_reps',
    pelvicFloorRisk: 'moderate',
    defaultReps: [8, 12],
    cues: [
      'Curl the pelvis up at the top — do not just swing the legs',
      'Exhale as the knees come up',
      'Skip this one on a day the pelvic floor feels heavy; use dead bug instead',
    ],
    swaps: ['lying-leg-raise', 'reverse-crunch', 'hollow-hold'],
  }),

  ex({
    id: 'lying-leg-raise',
    name: 'Lying Leg Raise',
    pattern: 'core',
    primary: ['core'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    defaultReps: [10, 15],
    cues: [
      'Hands under the hips, low back flat',
      'Exhale as the legs lower',
      'Bend the knees the moment the back peels off the mat',
    ],
    swaps: ['reverse-crunch', 'hanging-knee-raise', 'dead-bug'],
    beginner: true,
  }),

  ex({
    id: 'reverse-crunch',
    name: 'Reverse Crunch',
    pattern: 'core',
    primary: ['core'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    defaultReps: [10, 15],
    cues: [
      'Lift the hips off the mat, not just the knees',
      'Exhale on the lift',
      'Slow down the lowering phase — that is where the work is',
    ],
    swaps: ['lying-leg-raise', 'cable-crunch', 'hollow-hold'],
    beginner: true,
  }),

  ex({
    id: 'plank-shoulder-tap',
    name: 'Plank Shoulder Tap',
    pattern: 'core',
    primary: ['core'],
    secondary: ['delts'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    defaultReps: [10, 16],
    cues: [
      'Feet wide for stability, hips locked',
      'Exhale on each tap',
      'If the hips rock, the set is over',
    ],
    swaps: ['plank', 'dead-bug', 'stir-the-pot'],
    beginner: true,
  }),

  ex({
    id: 'glute-bridge-march',
    name: 'Glute Bridge March',
    pattern: 'core',
    primary: ['core', 'gluteMax'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    defaultReps: [10, 16],
    cues: [
      'Bridge up first, then lift one foot without dropping the hips',
      'Exhale on each lift',
      'Count reps per side',
    ],
    swaps: ['dead-bug', 'bird-dog', 'plank'],
    beginner: true,
  }),

  ex({
    id: 'standing-cable-woodchop',
    name: 'Standing Cable Woodchop',
    pattern: 'core',
    primary: ['core'],
    equipment: ['cable'],
    track: 'weight_reps',
    defaultReps: [10, 12],
    cues: [
      'Light load only — heavy loaded rotation thickens the waist, which is not the goal',
      'Exhale through the chop',
      'Turn from the hips and let the feet pivot; do not grind the low back',
    ],
    swaps: ['pallof-press', 'half-kneeling-pallof-press', 'side-plank'],
  }),

  /* ====================================================================== */
  /* CARRIES — a rep is one length. Set the load, count the lengths.         */
  /* ====================================================================== */

  ex({
    id: 'farmer-carry',
    name: 'Farmer Carry',
    pattern: 'carry',
    primary: ['core'],
    secondary: ['back', 'gluteMed'],
    equipment: ['dumbbell', 'kettlebell'],
    track: 'weight_reps',
    tier: 2,
    pelvicFloorRisk: 'moderate',
    defaultReps: [2, 4],
    cues: [
      'One rep is one 40-yard length. Log the weight per hand',
      'Breathe out steadily as you walk — no holding the breath',
      'Tall through the ribs, short quiet steps',
    ],
    swaps: ['suitcase-carry', 'front-rack-carry', 'overhead-carry'],
    beginner: true,
  }),

  ex({
    id: 'suitcase-carry',
    name: 'Suitcase Carry',
    pattern: 'carry',
    primary: ['core'],
    secondary: ['gluteMed', 'back'],
    equipment: ['dumbbell', 'kettlebell'],
    track: 'weight_reps',
    tier: 2,
    unilateral: true,
    pelvicFloorRisk: 'moderate',
    defaultReps: [2, 4],
    cues: [
      'One rep is one length per side. Load one hand only',
      'Exhale steadily as you walk',
      'Do not lean away from the weight — stay stacked and let the side of the trunk work',
    ],
    swaps: ['farmer-carry', 'front-rack-carry', 'overhead-carry'],
    beginner: true,
  }),

  ex({
    id: 'front-rack-carry',
    name: 'Front Rack Carry',
    pattern: 'carry',
    primary: ['core'],
    secondary: ['back', 'delts'],
    equipment: ['kettlebell'],
    track: 'weight_reps',
    pelvicFloorRisk: 'moderate',
    defaultReps: [2, 3],
    cues: [
      'Bells on the chest, elbows tucked in',
      'Exhale steadily the whole walk',
      'Ribs down. The load wants to pull you into an arch',
    ],
    swaps: ['farmer-carry', 'suitcase-carry', 'overhead-carry'],
    beginner: true,
  }),

  ex({
    id: 'overhead-carry',
    name: 'Overhead Carry',
    pattern: 'carry',
    primary: ['core', 'delts'],
    equipment: ['dumbbell', 'kettlebell'],
    track: 'weight_reps',
    pelvicFloorRisk: 'moderate',
    defaultReps: [2, 3],
    cues: [
      'Arm locked out, biceps by the ear',
      'Breathe out steadily as you walk',
      'Light. If the ribs flare, the weight is too heavy',
    ],
    swaps: ['farmer-carry', 'suitcase-carry', 'front-rack-carry'],
  }),

  /* ====================================================================== */
  /* DELTS — heavily lateral and rear. The shoulder cap.                     */
  /* ====================================================================== */

  ex({
    id: 'dumbbell-lateral-raise',
    name: 'Dumbbell Lateral Raise',
    pattern: 'iso',
    primary: ['delts'],
    equipment: ['dumbbell'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [12, 15],
    cues: [
      'Lead with the elbow, stop at shoulder height',
      'Exhale as the arms rise',
      'Light weight, clean reps. This is the single best move for the shoulder cap',
    ],
    swaps: ['cable-lateral-raise', 'machine-lateral-raise'],
    beginner: true,
  }),

  ex({
    id: 'cable-lateral-raise',
    name: 'Cable Lateral Raise',
    pattern: 'iso',
    primary: ['delts'],
    equipment: ['cable'],
    track: 'weight_reps',
    tier: 2,
    unilateral: true,
    defaultReps: [12, 15],
    cues: [
      'Cable behind the body, handle in the far hand',
      'Exhale as you raise',
      'Tension at the bottom is the reason to pick this over dumbbells',
    ],
    swaps: ['dumbbell-lateral-raise', 'machine-lateral-raise'],
    beginner: true,
  }),

  ex({
    id: 'machine-lateral-raise',
    name: 'Lateral Raise Machine',
    pattern: 'iso',
    primary: ['delts'],
    equipment: ['machine'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [12, 15],
    cues: [
      'Pads on the outside of the upper arm, not the forearm',
      'Exhale as you push out',
      'Easiest version to take close to failure safely',
    ],
    swaps: ['dumbbell-lateral-raise', 'cable-lateral-raise'],
    beginner: true,
  }),

  ex({
    id: 'rear-delt-fly',
    name: 'Rear Delt Fly',
    pattern: 'iso',
    primary: ['delts'],
    secondary: ['back'],
    equipment: ['dumbbell', 'bench'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [12, 15],
    cues: [
      'Chest on an incline bench so you cannot swing',
      'Exhale as the arms open',
      'Thumbs down, pull wide — think elbows out, not up',
    ],
    swaps: ['reverse-pec-deck', 'cable-rear-delt-fly', 'face-pull'],
    beginner: true,
  }),

  ex({
    id: 'reverse-pec-deck',
    name: 'Reverse Pec Deck',
    pattern: 'iso',
    primary: ['delts'],
    secondary: ['back'],
    equipment: ['machine'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [12, 15],
    cues: [
      'Chest against the pad, slight bend in the elbows',
      'Exhale as you open',
      'Pause one count at the back of every rep',
    ],
    swaps: ['rear-delt-fly', 'cable-rear-delt-fly', 'face-pull'],
    beginner: true,
  }),

  ex({
    id: 'cable-rear-delt-fly',
    name: 'Cable Rear Delt Fly',
    pattern: 'iso',
    primary: ['delts'],
    secondary: ['back'],
    equipment: ['cable'],
    track: 'weight_reps',
    defaultReps: [12, 15],
    cues: [
      'Cables crossed at chest height, pull them apart and back',
      'Exhale as you open the arms',
      'Let the shoulder blades move — this is not a hold-and-squeeze',
    ],
    swaps: ['rear-delt-fly', 'reverse-pec-deck', 'face-pull'],
    beginner: true,
  }),

  ex({
    id: 'face-pull',
    name: 'Face Pull',
    pattern: 'iso',
    primary: ['delts'],
    secondary: ['back'],
    equipment: ['cable'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [12, 20],
    cues: [
      'Rope at eye height, pull toward the forehead',
      'Exhale as you pull',
      'Elbows high and wide. Best posture insurance in the building',
    ],
    swaps: ['rear-delt-fly', 'reverse-pec-deck', 'cable-rear-delt-fly'],
    beginner: true,
  }),

  ex({
    id: 'upright-row',
    name: 'Upright Row',
    pattern: 'iso',
    primary: ['delts'],
    secondary: ['biceps'],
    equipment: ['cable'],
    track: 'weight_reps',
    defaultReps: [12, 15],
    cues: [
      'De-emphasised here on purpose — it loads the traps, and trap bulk shortens the neckline',
      'Exhale as you pull, and stop the elbows at shoulder height',
      'Wide grip only. If the shoulders pinch, swap to a lateral raise',
    ],
    swaps: ['dumbbell-lateral-raise', 'cable-lateral-raise', 'face-pull'],
  }),

  ex({
    id: 'overhead-press',
    name: 'Overhead Press',
    pattern: 'push-v',
    primary: ['delts'],
    secondary: ['triceps', 'core'],
    equipment: ['barbell', 'rack'],
    track: 'weight_reps',
    tier: 1,
    axialLoad: true,
    pelvicFloorRisk: 'moderate',
    defaultReps: [5, 8],
    cues: [
      'Standing and loaded overhead — later in a 5:30 session, not first',
      'Exhale as you press up. Never hold your breath overhead',
      'Ribs stay down, glutes on. Move the head back, not the bar forward',
    ],
    swaps: ['seated-dumbbell-shoulder-press', 'machine-shoulder-press', 'landmine-press'],
  }),

  ex({
    id: 'seated-dumbbell-shoulder-press',
    name: 'Seated Dumbbell Shoulder Press',
    pattern: 'push-v',
    primary: ['delts'],
    secondary: ['triceps'],
    equipment: ['dumbbell', 'bench'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [8, 12],
    cues: [
      'Back supported, slight incline is fine',
      'Exhale as you press',
      'Bring the dumbbells to ear height at the bottom, not lower',
    ],
    swaps: ['machine-shoulder-press', 'overhead-press', 'landmine-press'],
    beginner: true,
  }),

  ex({
    id: 'machine-shoulder-press',
    name: 'Machine Shoulder Press',
    pattern: 'push-v',
    primary: ['delts'],
    secondary: ['triceps'],
    equipment: ['machine'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [10, 12],
    cues: [
      'Seat height so the handles start at shoulder level',
      'Exhale as you press up',
      'Supported spine — the AM-friendly way to press overhead',
    ],
    swaps: ['seated-dumbbell-shoulder-press', 'overhead-press', 'landmine-press'],
    beginner: true,
  }),

  ex({
    id: 'landmine-press',
    name: 'Half-Kneeling Landmine Press',
    pattern: 'push-v',
    primary: ['delts'],
    secondary: ['core', 'triceps'],
    equipment: ['barbell'],
    track: 'weight_reps',
    unilateral: true,
    pelvicFloorRisk: 'moderate',
    defaultReps: [8, 12],
    cues: [
      'Angled press — the friendliest overhead option for cranky shoulders',
      'Exhale as you press away',
      'Down knee under the hip, ribs stacked over the pelvis',
    ],
    swaps: ['seated-dumbbell-shoulder-press', 'machine-shoulder-press', 'overhead-press'],
    beginner: true,
  }),

  /* ====================================================================== */
  /* BACK — vertical and horizontal pull                                    */
  /* ====================================================================== */

  ex({
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    pattern: 'pull-v',
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['machine', 'cable'],
    track: 'weight_reps',
    tier: 1,
    defaultReps: [8, 12],
    cues: [
      'Pull the elbows down to the ribs, not the bar to the chin',
      'Exhale as you pull down',
      'Small lean back, then hold it — do not row it',
    ],
    swaps: ['neutral-grip-lat-pulldown', 'assisted-pull-up', 'straight-arm-pulldown'],
    beginner: true,
  }),

  ex({
    id: 'neutral-grip-lat-pulldown',
    name: 'Neutral-Grip Lat Pulldown',
    pattern: 'pull-v',
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['machine', 'cable'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [8, 12],
    cues: [
      'Palms facing each other — usually the strongest and kindest grip',
      'Exhale on the pull',
      'Chest to the bar, shoulders away from the ears',
    ],
    swaps: ['lat-pulldown', 'assisted-pull-up', 'pull-up'],
    beginner: true,
  }),

  ex({
    id: 'pull-up',
    name: 'Pull-Up',
    pattern: 'pull-v',
    primary: ['back'],
    secondary: ['biceps', 'core'],
    equipment: ['bodyweight', 'rack'],
    track: 'bodyweight_reps',
    tier: 1,
    defaultReps: [4, 8],
    cues: [
      'Set the shoulders down before the first inch of the pull',
      'Exhale as you pull up',
      'Full hang at the bottom, chin clearly over at the top',
    ],
    swaps: ['assisted-pull-up', 'lat-pulldown', 'neutral-grip-lat-pulldown'],
  }),

  ex({
    id: 'assisted-pull-up',
    name: 'Assisted Pull-Up',
    pattern: 'pull-v',
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['machine'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [6, 10],
    cues: [
      'Log the assistance weight — less assistance is progress',
      'Exhale as you pull up',
      'Same shape as a pull-up. Do not let the knees push you off the pad',
    ],
    swaps: ['pull-up', 'lat-pulldown', 'neutral-grip-lat-pulldown'],
    beginner: true,
  }),

  ex({
    id: 'straight-arm-pulldown',
    name: 'Straight-Arm Pulldown',
    pattern: 'pull-v',
    primary: ['back'],
    equipment: ['cable'],
    track: 'weight_reps',
    defaultReps: [12, 15],
    cues: [
      'Arms nearly straight, hinge forward slightly',
      'Exhale as the bar comes to the thighs',
      'All lat, no biceps. Great before a heavy pulling day',
    ],
    swaps: ['dumbbell-pullover', 'lat-pulldown', 'neutral-grip-lat-pulldown'],
    beginner: true,
  }),

  ex({
    id: 'dumbbell-pullover',
    name: 'Dumbbell Pullover',
    pattern: 'pull-v',
    primary: ['back'],
    secondary: ['chest', 'triceps'],
    equipment: ['dumbbell', 'bench'],
    track: 'weight_reps',
    defaultReps: [10, 12],
    cues: [
      'Ribs down — the stretch comes from the lats, not the low back',
      'Exhale as you pull the dumbbell back over the chest',
      'Stop where the shoulders feel supported',
    ],
    swaps: ['straight-arm-pulldown', 'lat-pulldown', 'assisted-pull-up'],
    beginner: true,
  }),

  ex({
    id: 'seated-cable-row',
    name: 'Seated Cable Row',
    pattern: 'pull-h',
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['cable'],
    track: 'weight_reps',
    tier: 1,
    defaultReps: [8, 12],
    cues: [
      'Tall spine, pull to the bottom of the ribs',
      'Exhale as you row',
      'Let the shoulder blades travel forward on the return, then pull again',
    ],
    swaps: ['chest-supported-row', 'machine-row', 'single-arm-dumbbell-row'],
    beginner: true,
  }),

  ex({
    id: 'chest-supported-row',
    name: 'Chest-Supported Row',
    pattern: 'pull-h',
    primary: ['back'],
    secondary: ['biceps', 'delts'],
    equipment: ['dumbbell', 'bench'],
    track: 'weight_reps',
    tier: 1,
    defaultReps: [8, 12],
    cues: [
      'Chest stays on the pad — the low back gets the morning off',
      'Exhale as you row the elbows past the ribs',
      'One of the safest first movements for a 5:30 session',
    ],
    swaps: ['seated-cable-row', 'machine-row', 'single-arm-dumbbell-row'],
    beginner: true,
  }),

  ex({
    id: 'machine-row',
    name: 'Machine Row',
    pattern: 'pull-h',
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['machine'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [10, 12],
    cues: [
      'Chest pad set so the arms are level with the shoulders',
      'Exhale as you pull',
      'Pause one count with the elbows behind you',
    ],
    swaps: ['seated-cable-row', 'chest-supported-row', 't-bar-row'],
    beginner: true,
  }),

  ex({
    id: 'single-arm-dumbbell-row',
    name: 'Single-Arm Dumbbell Row',
    pattern: 'pull-h',
    primary: ['back'],
    secondary: ['biceps', 'core'],
    equipment: ['dumbbell', 'bench'],
    track: 'weight_reps',
    tier: 2,
    unilateral: true,
    defaultReps: [8, 12],
    cues: [
      'Hand and knee on the bench, back flat like a table',
      'Exhale as you row to the hip',
      'No twisting to finish the rep',
    ],
    swaps: ['chest-supported-row', 'seated-cable-row', 'machine-row'],
    beginner: true,
  }),

  ex({
    id: 'barbell-row',
    name: 'Barbell Row',
    pattern: 'pull-h',
    primary: ['back'],
    secondary: ['biceps', 'hamstrings'],
    equipment: ['barbell'],
    track: 'weight_reps',
    tier: 2,
    pelvicFloorRisk: 'moderate',
    defaultReps: [6, 10],
    cues: [
      'Hinge to about 45 degrees and hold that angle every rep',
      'Exhale as you row to the belly button',
      'An unsupported spine under load — better later in the session than first',
    ],
    swaps: ['t-bar-row', 'chest-supported-row', 'single-arm-dumbbell-row'],
  }),

  ex({
    id: 't-bar-row',
    name: 'T-Bar Row',
    pattern: 'pull-h',
    primary: ['back'],
    secondary: ['biceps'],
    equipment: ['barbell', 'machine'],
    track: 'weight_reps',
    tier: 2,
    pelvicFloorRisk: 'moderate',
    defaultReps: [8, 12],
    cues: [
      'Chest up, knees soft, hips back',
      'Exhale as you pull the handles to the ribs',
      'Use the chest-supported version if the low back is the limiter',
    ],
    swaps: ['barbell-row', 'chest-supported-row', 'machine-row'],
  }),

  ex({
    id: 'inverted-row',
    name: 'Inverted Row',
    pattern: 'pull-h',
    primary: ['back'],
    secondary: ['biceps', 'core'],
    equipment: ['bodyweight', 'rack'],
    track: 'bodyweight_reps',
    tier: 2,
    defaultReps: [8, 12],
    cues: [
      'Body in one line, heels down, bar at chest height to start',
      'Exhale as you pull the chest to the bar',
      'Walk the feet in to make it easier, out to make it harder',
    ],
    swaps: ['seated-cable-row', 'chest-supported-row', 'machine-row'],
    beginner: true,
  }),

  /* ====================================================================== */
  /* CHEST                                                                   */
  /* ====================================================================== */

  ex({
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    pattern: 'push-h',
    primary: ['chest'],
    secondary: ['delts', 'triceps'],
    equipment: ['dumbbell', 'bench'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [8, 12],
    cues: [
      'Bench at 30 degrees — higher turns it into a shoulder press',
      'Exhale as you press up',
      'Shoulder blades pinned back and down on the bench',
    ],
    swaps: ['dumbbell-bench-press', 'machine-chest-press', 'bench-press'],
    beginner: true,
  }),

  ex({
    id: 'dumbbell-bench-press',
    name: 'Dumbbell Bench Press',
    pattern: 'push-h',
    primary: ['chest'],
    secondary: ['triceps', 'delts'],
    equipment: ['dumbbell', 'bench'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [8, 12],
    cues: [
      'Elbows at about 45 degrees from the body, not flared wide',
      'Exhale as you press',
      'Bench-supported, so it is a safe first movement in the morning',
    ],
    swaps: ['incline-dumbbell-press', 'machine-chest-press', 'bench-press'],
    beginner: true,
  }),

  ex({
    id: 'bench-press',
    name: 'Barbell Bench Press',
    pattern: 'push-h',
    primary: ['chest'],
    secondary: ['triceps', 'delts'],
    equipment: ['barbell', 'bench', 'rack'],
    track: 'weight_reps',
    tier: 1,
    defaultReps: [5, 8],
    cues: [
      'Feet flat, upper back tight, wrists stacked over the elbows',
      'Exhale as you press the bar up',
      'Bar touches the lower chest, not the throat',
    ],
    swaps: ['dumbbell-bench-press', 'machine-chest-press', 'incline-dumbbell-press'],
  }),

  ex({
    id: 'machine-chest-press',
    name: 'Machine Chest Press',
    pattern: 'push-h',
    primary: ['chest'],
    secondary: ['triceps', 'delts'],
    equipment: ['machine'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [10, 12],
    cues: [
      'Handles level with the mid-chest',
      'Exhale as you press away',
      'Do not lock the elbows hard at the end',
    ],
    swaps: ['dumbbell-bench-press', 'incline-dumbbell-press', 'bench-press'],
    beginner: true,
  }),

  ex({
    id: 'push-up',
    name: 'Push-Up',
    pattern: 'push-h',
    primary: ['chest'],
    secondary: ['triceps', 'core'],
    equipment: ['bodyweight', 'mat'],
    track: 'bodyweight_reps',
    tier: 2,
    defaultReps: [8, 15],
    cues: [
      'Hands under the shoulders, body in one line',
      'Exhale as you press up',
      'Ribs down and glutes on — it is a moving plank',
    ],
    swaps: ['incline-push-up', 'dumbbell-bench-press', 'machine-chest-press'],
    beginner: true,
  }),

  ex({
    id: 'incline-push-up',
    name: 'Incline Push-Up',
    pattern: 'push-h',
    primary: ['chest'],
    secondary: ['triceps', 'core'],
    equipment: ['bodyweight', 'bench'],
    track: 'bodyweight_reps',
    defaultReps: [10, 15],
    cues: [
      'Hands on a bench or barbell in the rack',
      'Exhale as you press',
      'Lower the surface as you get stronger — that is the progression',
    ],
    swaps: ['push-up', 'machine-chest-press', 'dumbbell-bench-press'],
    beginner: true,
  }),

  ex({
    id: 'cable-chest-fly',
    name: 'Cable Chest Fly',
    pattern: 'push-h',
    primary: ['chest'],
    secondary: ['delts'],
    equipment: ['cable'],
    track: 'weight_reps',
    defaultReps: [12, 15],
    cues: [
      'Soft elbows held at a fixed angle the whole rep',
      'Exhale as the hands come together',
      'Cross the hands slightly at the finish',
    ],
    swaps: ['pec-deck', 'dumbbell-chest-fly', 'machine-chest-press'],
    beginner: true,
  }),

  ex({
    id: 'pec-deck',
    name: 'Pec Deck',
    pattern: 'push-h',
    primary: ['chest'],
    equipment: ['machine'],
    track: 'weight_reps',
    defaultReps: [12, 15],
    cues: [
      'Back flat on the pad, seat set so the handles are at chest height',
      'Exhale as you bring the pads together',
      'Slow on the way back out',
    ],
    swaps: ['cable-chest-fly', 'dumbbell-chest-fly', 'machine-chest-press'],
    beginner: true,
  }),

  ex({
    id: 'dumbbell-chest-fly',
    name: 'Dumbbell Chest Fly',
    pattern: 'push-h',
    primary: ['chest'],
    secondary: ['delts'],
    equipment: ['dumbbell', 'bench'],
    track: 'weight_reps',
    defaultReps: [10, 15],
    cues: [
      'Wide arc with a fixed soft elbow',
      'Exhale as you bring the dumbbells together',
      'Stop the stretch level with the chest',
    ],
    swaps: ['pec-deck', 'cable-chest-fly', 'incline-dumbbell-press'],
    beginner: true,
  }),

  /* ====================================================================== */
  /* TRICEPS                                                                 */
  /* ====================================================================== */

  ex({
    id: 'rope-pushdown',
    name: 'Rope Pushdown',
    pattern: 'iso',
    primary: ['triceps'],
    equipment: ['cable'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [10, 15],
    cues: [
      'Elbows pinned to the ribs',
      'Exhale as you push down and spread the rope',
      'Full lockout, one count, then back up slowly',
    ],
    swaps: ['straight-bar-pushdown', 'machine-tricep-extension', 'overhead-tricep-extension'],
    beginner: true,
  }),

  ex({
    id: 'straight-bar-pushdown',
    name: 'Straight-Bar Pushdown',
    pattern: 'iso',
    primary: ['triceps'],
    equipment: ['cable'],
    track: 'weight_reps',
    defaultReps: [10, 15],
    cues: [
      'Wrists straight, elbows still',
      'Exhale as you push down',
      'Lets you load a little heavier than the rope',
    ],
    swaps: ['rope-pushdown', 'machine-tricep-extension', 'overhead-tricep-extension'],
    beginner: true,
  }),

  ex({
    id: 'overhead-tricep-extension',
    name: 'Overhead Tricep Extension',
    pattern: 'iso',
    primary: ['triceps'],
    equipment: ['cable'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [10, 15],
    cues: [
      'Facing away from the stack, elbows beside the ears',
      'Exhale as you extend',
      'Ribs down — the long head gets stretched, the back does not',
    ],
    swaps: ['dumbbell-overhead-tricep-extension', 'rope-pushdown', 'skull-crusher'],
    beginner: true,
  }),

  ex({
    id: 'dumbbell-overhead-tricep-extension',
    name: 'Dumbbell Overhead Tricep Extension',
    pattern: 'iso',
    primary: ['triceps'],
    equipment: ['dumbbell'],
    track: 'weight_reps',
    defaultReps: [10, 12],
    cues: [
      'One dumbbell in both hands, seated with back support',
      'Exhale as you press overhead',
      'Elbows point forward and stay there',
    ],
    swaps: ['overhead-tricep-extension', 'rope-pushdown', 'skull-crusher'],
    beginner: true,
  }),

  ex({
    id: 'skull-crusher',
    name: 'Skull Crusher',
    pattern: 'iso',
    primary: ['triceps'],
    equipment: ['barbell', 'bench'],
    track: 'weight_reps',
    defaultReps: [8, 12],
    cues: [
      'Lower behind the head rather than to the forehead — easier on the elbows',
      'Exhale as you extend',
      'Upper arms angled slightly back and held there',
    ],
    swaps: ['overhead-tricep-extension', 'dumbbell-overhead-tricep-extension', 'rope-pushdown'],
  }),

  ex({
    id: 'machine-tricep-extension',
    name: 'Machine Tricep Extension',
    pattern: 'iso',
    primary: ['triceps'],
    equipment: ['machine'],
    track: 'weight_reps',
    defaultReps: [10, 15],
    cues: [
      'Elbows on the pad, seat set so they sit level with the shoulders',
      'Exhale as you extend',
      'The easiest tricep move to push close to failure on',
    ],
    swaps: ['rope-pushdown', 'straight-bar-pushdown', 'overhead-tricep-extension'],
    beginner: true,
  }),

  ex({
    id: 'tricep-kickback',
    name: 'Tricep Kickback',
    pattern: 'iso',
    primary: ['triceps'],
    equipment: ['dumbbell'],
    track: 'weight_reps',
    unilateral: true,
    defaultReps: [12, 15],
    cues: [
      'Upper arm parallel to the floor and locked there',
      'Exhale as you straighten the arm',
      'Light. The lockout is the whole rep',
    ],
    swaps: ['rope-pushdown', 'straight-bar-pushdown', 'machine-tricep-extension'],
    beginner: true,
  }),

  ex({
    id: 'close-grip-bench-press',
    name: 'Close-Grip Bench Press',
    pattern: 'push-h',
    primary: ['triceps'],
    secondary: ['chest', 'delts'],
    equipment: ['barbell', 'bench', 'rack'],
    track: 'weight_reps',
    tier: 2,
    defaultReps: [6, 10],
    cues: [
      'Hands about shoulder width — narrower hurts the wrists and adds nothing',
      'Exhale as you press',
      'Elbows tucked close to the ribs',
    ],
    swaps: ['bench-press', 'dumbbell-bench-press', 'machine-chest-press'],
  }),

  ex({
    id: 'bench-dip',
    name: 'Bench Dip',
    pattern: 'push-h',
    primary: ['triceps'],
    secondary: ['chest'],
    equipment: ['bodyweight', 'bench'],
    track: 'bodyweight_reps',
    defaultReps: [8, 12],
    cues: [
      'Hands on the bench behind you, shoulders down away from the ears',
      'Exhale as you press up',
      'Only go as deep as the shoulders stay comfortable',
    ],
    swaps: ['push-up', 'incline-push-up', 'machine-chest-press'],
    beginner: true,
  }),

  /* ====================================================================== */
  /* BICEPS — deliberately low volume, trained for balance                   */
  /* ====================================================================== */

  ex({
    id: 'dumbbell-curl',
    name: 'Dumbbell Curl',
    pattern: 'iso',
    primary: ['biceps'],
    equipment: ['dumbbell'],
    track: 'weight_reps',
    defaultReps: [10, 12],
    cues: [
      'Elbows by the ribs, no swinging',
      'Exhale as you curl',
      'Slow on the way down',
    ],
    swaps: ['cable-curl', 'hammer-curl', 'ez-bar-curl'],
    beginner: true,
  }),

  ex({
    id: 'cable-curl',
    name: 'Cable Curl',
    pattern: 'iso',
    primary: ['biceps'],
    equipment: ['cable'],
    track: 'weight_reps',
    defaultReps: [10, 15],
    cues: [
      'Constant tension the whole range',
      'Exhale as you curl',
      'Stand a step back from the stack',
    ],
    swaps: ['dumbbell-curl', 'ez-bar-curl', 'machine-preacher-curl'],
    beginner: true,
  }),

  ex({
    id: 'hammer-curl',
    name: 'Hammer Curl',
    pattern: 'iso',
    primary: ['biceps'],
    secondary: ['back'],
    equipment: ['dumbbell'],
    track: 'weight_reps',
    defaultReps: [10, 12],
    cues: [
      'Neutral grip the whole way',
      'Exhale as you curl',
      'Kinder to the elbows than a supinated curl',
    ],
    swaps: ['dumbbell-curl', 'cable-curl', 'incline-dumbbell-curl'],
    beginner: true,
  }),

  ex({
    id: 'incline-dumbbell-curl',
    name: 'Incline Dumbbell Curl',
    pattern: 'iso',
    primary: ['biceps'],
    equipment: ['dumbbell', 'bench'],
    track: 'weight_reps',
    defaultReps: [10, 12],
    cues: [
      'Bench at 45 degrees, arms hanging behind the body',
      'Exhale as you curl',
      'Light — the stretch position is demanding',
    ],
    swaps: ['dumbbell-curl', 'hammer-curl', 'machine-preacher-curl'],
    beginner: true,
  }),

  ex({
    id: 'machine-preacher-curl',
    name: 'Machine Preacher Curl',
    pattern: 'iso',
    primary: ['biceps'],
    equipment: ['machine'],
    track: 'weight_reps',
    defaultReps: [10, 12],
    cues: [
      'Armpits on the top of the pad',
      'Exhale as you curl',
      'Do not slam the arms straight at the bottom',
    ],
    swaps: ['cable-curl', 'dumbbell-curl', 'ez-bar-curl'],
    beginner: true,
  }),

  ex({
    id: 'ez-bar-curl',
    name: 'EZ-Bar Curl',
    pattern: 'iso',
    primary: ['biceps'],
    equipment: ['barbell'],
    track: 'weight_reps',
    defaultReps: [8, 12],
    cues: [
      'Angled grip takes the strain off the wrists',
      'Exhale as you curl',
      'Body still — if the hips move, the weight is too heavy',
    ],
    swaps: ['dumbbell-curl', 'cable-curl', 'machine-preacher-curl'],
  }),

  /* ====================================================================== */
  /* CALVES                                                                  */
  /* ====================================================================== */

  ex({
    id: 'standing-calf-raise',
    name: 'Standing Calf Raise',
    pattern: 'iso',
    primary: ['calves'],
    equipment: ['machine'],
    track: 'weight_reps',
    defaultReps: [12, 15],
    cues: [
      'Full stretch at the bottom, full rise at the top',
      'Exhale as you press up',
      'Pause one count at each end',
    ],
    swaps: ['seated-calf-raise', 'leg-press-calf-raise', 'single-leg-calf-raise'],
    beginner: true,
  }),

  ex({
    id: 'seated-calf-raise',
    name: 'Seated Calf Raise',
    pattern: 'iso',
    primary: ['calves'],
    equipment: ['machine'],
    track: 'weight_reps',
    defaultReps: [12, 20],
    cues: [
      'Bent knee biases the soleus, the endurance half of the calf',
      'Exhale as you press up',
      'Slow, controlled, no bouncing',
    ],
    swaps: ['standing-calf-raise', 'leg-press-calf-raise', 'single-leg-calf-raise'],
    beginner: true,
  }),

  ex({
    id: 'leg-press-calf-raise',
    name: 'Leg Press Calf Raise',
    pattern: 'iso',
    primary: ['calves'],
    equipment: ['machine'],
    track: 'weight_reps',
    defaultReps: [12, 20],
    cues: [
      'Toes on the bottom edge of the platform, knees soft not locked',
      'Exhale as you push',
      'Safety catches engaged before you start',
    ],
    swaps: ['standing-calf-raise', 'seated-calf-raise', 'single-leg-calf-raise'],
    beginner: true,
  }),

  ex({
    id: 'single-leg-calf-raise',
    name: 'Single-Leg Calf Raise',
    pattern: 'iso',
    primary: ['calves'],
    equipment: ['bodyweight', 'box'],
    track: 'bodyweight_reps',
    unilateral: true,
    defaultReps: [12, 20],
    cues: [
      'Off a step so the heel can drop below the toes',
      'Exhale as you rise',
      'Fingertips on a wall for balance only',
    ],
    swaps: ['standing-calf-raise', 'seated-calf-raise', 'leg-press-calf-raise'],
    beginner: true,
  }),

  /* ====================================================================== */
  /* IMPACT / PLYO — bone loading (LIFTMOR). All flagged high pelvic-floor   */
  /* risk, because jumping is the most common trigger there is.             */
  /* ====================================================================== */

  ex({
    id: 'box-jump',
    name: 'Box Jump',
    pattern: 'plyo',
    primary: ['quads', 'gluteMax'],
    secondary: ['calves'],
    equipment: ['box'],
    track: 'reps_only',
    tier: 2,
    impact: true,
    pelvicFloorRisk: 'high',
    defaultReps: [3, 6],
    cues: [
      'Land soft and quiet, knees over the toes',
      'Exhale on the jump — never hold your breath through impact',
      'Step down every time. Jumping down adds risk and no bone benefit',
    ],
    swaps: ['broad-jump', 'split-jump', 'step-down'],
  }),

  ex({
    id: 'pogo-hop',
    name: 'Pogo Hop',
    pattern: 'plyo',
    primary: ['calves'],
    secondary: ['quads'],
    equipment: ['bodyweight'],
    track: 'reps_only',
    impact: true,
    pelvicFloorRisk: 'high',
    defaultReps: [15, 25],
    cues: [
      'Stiff ankles, small fast hops, knees barely bend',
      'Breathe out steadily through the set',
      'The lowest-skill way to load bone. Start here',
    ],
    swaps: ['jump-rope', 'heel-drop', 'skater-jump'],
    beginner: true,
  }),

  ex({
    id: 'broad-jump',
    name: 'Broad Jump',
    pattern: 'plyo',
    primary: ['gluteMax', 'quads'],
    secondary: ['hamstrings'],
    equipment: ['bodyweight'],
    track: 'reps_only',
    tier: 2,
    impact: true,
    pelvicFloorRisk: 'high',
    defaultReps: [3, 5],
    cues: [
      'Swing the arms, jump forward, land in a quiet half squat',
      'Exhale on the jump',
      'Full reset between reps. Quality over count',
    ],
    swaps: ['box-jump', 'split-jump', 'skater-jump'],
  }),

  ex({
    id: 'skater-jump',
    name: 'Skater Jump',
    pattern: 'plyo',
    primary: ['gluteMed'],
    secondary: ['quads'],
    equipment: ['bodyweight'],
    track: 'reps_only',
    impact: true,
    unilateral: true,
    pelvicFloorRisk: 'high',
    defaultReps: [8, 12],
    cues: [
      'Bound side to side and stick each landing for a count',
      'Exhale on each bound',
      'Loads bone sideways, which walking and running never do',
    ],
    swaps: ['split-jump', 'pogo-hop', 'broad-jump'],
  }),

  ex({
    id: 'split-jump',
    name: 'Split Jump',
    pattern: 'plyo',
    primary: ['quads', 'gluteMax'],
    equipment: ['bodyweight'],
    track: 'reps_only',
    impact: true,
    pelvicFloorRisk: 'high',
    defaultReps: [6, 10],
    cues: [
      'Lunge position, switch legs in the air, land soft',
      'Exhale on each switch',
      'Count reps per leg',
    ],
    swaps: ['box-jump', 'skater-jump', 'broad-jump'],
  }),

  ex({
    id: 'drop-squat',
    name: 'Drop Squat',
    pattern: 'plyo',
    primary: ['quads'],
    secondary: ['gluteMax'],
    equipment: ['bodyweight'],
    track: 'reps_only',
    impact: true,
    pelvicFloorRisk: 'high',
    defaultReps: [6, 10],
    cues: [
      'From standing, drop fast into a quarter squat and stop dead',
      'Exhale as you drop',
      'No jump at all — this is the gentlest entry to impact work',
    ],
    swaps: ['step-down', 'box-jump', 'pogo-hop'],
    beginner: true,
  }),

  ex({
    id: 'step-down',
    name: 'Step-Down',
    pattern: 'plyo',
    primary: ['quads', 'gluteMax'],
    secondary: ['gluteMed'],
    equipment: ['box'],
    track: 'reps_only',
    impact: true,
    unilateral: true,
    pelvicFloorRisk: 'high',
    defaultReps: [6, 10],
    cues: [
      'Stand on a low box and step down to a controlled landing',
      'Exhale as you step down',
      'The substitute for box jumps when jumping is off the table',
    ],
    swaps: ['drop-squat', 'box-jump', 'heel-drop'],
    beginner: true,
  }),

  ex({
    id: 'jump-rope',
    name: 'Jump Rope',
    pattern: 'plyo',
    primary: ['calves'],
    secondary: ['quads'],
    equipment: ['bodyweight'],
    track: 'time_hold',
    impact: true,
    pelvicFloorRisk: 'high',
    defaultReps: [30, 60],
    cues: [
      'Small hops, wrists doing the turning',
      'Breathe out steadily — no holding the breath',
      'Stop the set the moment the landings get loud',
    ],
    swaps: ['pogo-hop', 'heel-drop', 'drop-squat'],
    beginner: true,
  }),

  ex({
    id: 'heel-drop',
    name: 'Heel Drop',
    pattern: 'plyo',
    primary: ['calves'],
    equipment: ['bodyweight'],
    track: 'reps_only',
    impact: true,
    pelvicFloorRisk: 'high',
    defaultReps: [10, 20],
    cues: [
      'Rise onto the toes, then drop the heels sharply to the floor',
      'Exhale as the heels land',
      'Sends a bone-loading signal up through the hip with almost no skill required',
    ],
    swaps: ['pogo-hop', 'jump-rope', 'drop-squat'],
    beginner: true,
  }),

  /* ====================================================================== */
  /* CARDIO — tracked as time and distance. Credits no Shape Map sets;      */
  /* it is conditioning, and pretending otherwise would inflate the map.    */
  /* ====================================================================== */

  ex({
    id: 'treadmill-walk',
    name: 'Treadmill Walk',
    pattern: 'cardio',
    equipment: ['cardio'],
    track: 'time_distance',
    defaultReps: [20, 40],
    cues: [
      'Easy pace — you should be able to hold a conversation',
      'No hanging on the handrails',
    ],
    swaps: ['treadmill-incline-walk', 'outdoor-walk', 'elliptical'],
    beginner: true,
  }),

  ex({
    id: 'treadmill-incline-walk',
    name: 'Treadmill Incline Walk',
    pattern: 'cardio',
    equipment: ['cardio'],
    track: 'time_distance',
    defaultReps: [20, 40],
    cues: [
      'Incline 8 to 12 percent, pace slow enough to breathe through the nose',
      'Hands off the rails so the hips do the work',
    ],
    swaps: ['treadmill-walk', 'stair-climber', 'outdoor-walk'],
    beginner: true,
  }),

  ex({
    id: 'treadmill-run',
    name: 'Treadmill Run',
    pattern: 'cardio',
    equipment: ['cardio'],
    track: 'time_distance',
    defaultReps: [15, 30],
    cues: [
      'Conversational pace unless the session says otherwise',
      'Impact through the run is a bonus for bone, not a reason to overdo it',
    ],
    swaps: ['treadmill-incline-walk', 'outdoor-walk', 'elliptical'],
  }),

  ex({
    id: 'outdoor-walk',
    name: 'Outdoor Walk',
    pattern: 'cardio',
    equipment: ['bodyweight'],
    track: 'time_distance',
    defaultReps: [30, 60],
    cues: [
      'The Sunday session. Easy, unhurried, outdoors',
      'Counts as training — recovery is not nothing',
    ],
    swaps: ['treadmill-walk', 'treadmill-incline-walk', 'elliptical'],
    beginner: true,
  }),

  ex({
    id: 'stationary-bike',
    name: 'Stationary Bike',
    pattern: 'cardio',
    equipment: ['cardio'],
    track: 'time_distance',
    defaultReps: [15, 30],
    cues: [
      'Saddle height so the knee is just short of straight at the bottom',
      'Three easy minutes here is the non-negotiable start to every warm-up',
    ],
    swaps: ['rower', 'elliptical', 'stair-climber'],
    beginner: true,
  }),

  ex({
    id: 'bike-sprint-intervals',
    name: 'Bike Sprint Intervals',
    pattern: 'cardio',
    equipment: ['cardio'],
    track: 'time_distance',
    tier: 2,
    defaultReps: [10, 20],
    cues: [
      'Six to eight efforts of 20 seconds all-out, two easy minutes between',
      'Breathe out hard through the effort — never hold your breath',
      'Short bouts like this interfere with lifting far less than a long class does',
    ],
    swaps: ['rower-sprint-intervals', 'stationary-bike', 'rower'],
  }),

  ex({
    id: 'rower',
    name: 'Rower',
    pattern: 'cardio',
    equipment: ['cardio'],
    track: 'time_distance',
    defaultReps: [10, 20],
    cues: [
      'Legs, then back, then arms — and the reverse coming forward',
      'Exhale on the drive',
    ],
    swaps: ['stationary-bike', 'elliptical', 'stair-climber'],
    beginner: true,
  }),

  ex({
    id: 'rower-sprint-intervals',
    name: 'Rower Sprint Intervals',
    pattern: 'cardio',
    equipment: ['cardio'],
    track: 'time_distance',
    tier: 2,
    defaultReps: [10, 20],
    cues: [
      'Six to eight efforts of 20 seconds hard, two easy minutes between',
      'Exhale hard on every drive. No breath-holding',
      'Stop the session if the stroke falls apart',
    ],
    swaps: ['bike-sprint-intervals', 'rower', 'stationary-bike'],
  }),

  ex({
    id: 'stair-climber',
    name: 'Stair Climber',
    pattern: 'cardio',
    equipment: ['cardio'],
    track: 'time_distance',
    defaultReps: [10, 20],
    cues: [
      'Stand tall, hands light on the rails',
      'Full steps rather than fast half steps',
    ],
    swaps: ['treadmill-incline-walk', 'elliptical', 'stationary-bike'],
    beginner: true,
  }),

  ex({
    id: 'elliptical',
    name: 'Elliptical',
    pattern: 'cardio',
    equipment: ['cardio'],
    track: 'time_distance',
    defaultReps: [15, 30],
    cues: [
      'Zero impact, which makes it the fallback on a sore day',
      'Push and pull the handles so the upper body joins in',
    ],
    swaps: ['stationary-bike', 'rower', 'treadmill-walk'],
    beginner: true,
  }),

];

/* -------------------------------------------------------------------------- */
/* Lookup                                                                      */
/* -------------------------------------------------------------------------- */

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/**
 * Look one exercise up by id.
 * @param {string} id
 * @returns {object|undefined} the exercise, or undefined for anything unknown. Never throws.
 */
export function byId(id) {
  if (typeof id !== 'string') return undefined;
  return BY_ID.get(id.trim().toLowerCase());
}

/* -------------------------------------------------------------------------- */
/* Search                                                                      */
/* -------------------------------------------------------------------------- */

// Normalises a filter value into a lowercase string Set, or null when the filter is unset.
function filterSet(value) {
  if (value === undefined || value === null || value === '') return null;
  const list = Array.isArray(value) ? value : [value];
  const out = new Set();
  for (const v of list) {
    if (v === undefined || v === null || v === '') continue;
    out.add(String(v).trim().toLowerCase());
  }
  return out.size ? out : null;
}

function hitsAny(values, set) {
  for (const v of values) {
    if (set.has(String(v).toLowerCase())) return true;
  }
  return false;
}

/**
 * Search the library.
 *
 * @param {string} [q]  case-insensitive substring, matched against name and id
 * @param {object} [filters]
 *   @param {string|string[]} [filters.target]     SHAPE_TARGETS key; matches primary OR secondary
 *   @param {string|string[]} [filters.equipment]  matches an exercise using ANY of the given items
 *   @param {string|string[]} [filters.pattern]
 *   @param {number|number[]} [filters.tier]
 *   @param {boolean} [filters.beginner]           true = On-Ramp only, false = everything else
 * @returns {object[]} matches, name-prefix hits first, then by tier, then alphabetically.
 */
export function search(q, filters) {
  const term = (q === undefined || q === null ? '' : String(q)).trim().toLowerCase();
  const f = (filters && typeof filters === 'object') ? filters : {};

  const targets = filterSet(f.target);
  const equipment = filterSet(f.equipment);
  const patterns = filterSet(f.pattern);
  const tiers = filterSet(f.tier);

  let beginner = null;
  if (f.beginner === true || f.beginner === 'true') beginner = true;
  else if (f.beginner === false || f.beginner === 'false') beginner = false;

  const matches = EXERCISES.filter((e) => {
    if (term) {
      const inName = e.name.toLowerCase().includes(term);
      const inId = e.id.includes(term.replace(/\s+/g, '-'));
      if (!inName && !inId) return false;
    }
    if (targets && !hitsAny([...e.primary, ...e.secondary], targets)) return false;
    if (equipment && !hitsAny(e.equipment, equipment)) return false;
    if (patterns && !patterns.has(e.pattern)) return false;
    if (tiers && !tiers.has(String(e.tier))) return false;
    if (beginner !== null && e.beginner !== beginner) return false;
    return true;
  });

  return matches.sort((a, b) => {
    if (term) {
      const aStarts = a.name.toLowerCase().startsWith(term) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(term) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
    }
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.name.localeCompare(b.name);
  });
}
