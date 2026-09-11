// Daybreak — js/data/classes.js — the real Bay Club Redondo Beach morning schedule, with the
// training-load metadata the scheduler needs and the plain-English info the "i" button shows.

/*
 * Each format carries the load metadata that lets scheduler.js build the lifting week
 * AROUND her classes instead of on top of them (BUILD_CONTRACT §4.3, PROJECT_PLAN §6.1/§2.7).
 *
 * Field meanings, so the numbers are readable six months from now:
 *   intensity          low | moderate | high        — perceived systemic effort
 *   legFatigue         low | moderate | high | very-high  — drives HEAVY_LOWER_TOO_SOON
 *   cnsCost            low | moderate | high        — drives spacing of maximal days
 *   counts.conditioning 0–1  — how much of a conditioning session this replaces
 *   counts.resistance   0–1  — how much resistance credit it earns; the Shape Map multiplies
 *                              shapeContribution by this number, so 0 means it credits nothing
 *   pairWith           session types the Stack block should be that morning, best first
 *   blocks             session types forbidden that same morning
 *   recoveryHours      required gap before a heavy LOWER session that follows it
 *   shapeContribution  raw sets credited per SHAPE_TARGETS key, before the resistance multiplier
 *   pillars            0–1 per training pillar: resistive, control, cardio, shape
 *   what / why         the "i" panel: what happens in the room, and what it does for her
 */

export const CLASS_FORMATS = [
  {
    id: 'hiit',
    name: 'HIIT',
    intensity: 'high',
    legFatigue: 'high',
    cnsCost: 'high',
    counts: { conditioning: 1, resistance: 0.25 },
    pairWith: ['upper'],
    blocks: ['lower', 'lower-heavy', 'glute', 'full'],
    recoveryHours: 24,
    shapeContribution: { quads: 1, core: 1, delts: 0.5 },
    pillars: { resistive: 0.25, control: 0.2, cardio: 1, shape: 0.3 },
    typicalStart: '06:00',
    durationMin: 50,
    note: 'Fifty minutes of full-body intervals, and most of it lands on the legs. Lift upper body before it, and leave heavy lower work a day clear on either side.',
    what: 'Fifty minutes of hard intervals — bodyweight, dumbbells and machines, short bursts with short rests. You will be out of breath most of the way through.',
    why: 'This is your cardiovascular ceiling work. Short, hard intervals do more for the fat-burning side of your metabolism through perimenopause than long steady cardio does, and they take far less time. The catch is that it is expensive: it lands heavily on the legs, so it should not sit next to a heavy squat or hip thrust day.'
  },
  {
    id: 'hiit-express',
    name: 'HIIT Express',
    intensity: 'high',
    legFatigue: 'moderate',
    cnsCost: 'moderate',
    counts: { conditioning: 0.75, resistance: 0.25 },
    pairWith: ['upper', 'glute'],
    blocks: ['lower-heavy'],
    recoveryHours: 12,
    shapeContribution: { quads: 0.5, core: 1, delts: 0.5 },
    pillars: { resistive: 0.25, control: 0.2, cardio: 0.8, shape: 0.25 },
    typicalStart: '06:00',
    durationMin: 25,
    note: 'Half the length, so it costs your lifting far less — short interval work is the version that plays nicely with strength training. Anything but a heavy lower day pairs with it.',
    what: 'Twenty-five minutes. The same interval idea as HIIT, compressed — in and out before most people have finished warming up.',
    why: 'The best-value class on the schedule for someone who also lifts. Short interval work gives you most of the cardiovascular return of a full HIIT session while taking far less out of your strength training. If you only do one conditioning class a week, this is the one that costs you least.'
  },
  {
    id: 'cycle',
    name: 'Cycle',
    intensity: 'high',
    legFatigue: 'very-high',
    cnsCost: 'moderate',
    counts: { conditioning: 1, resistance: 0 },
    pairWith: ['upper'],
    blocks: ['lower', 'lower-heavy', 'glute'],
    recoveryHours: 24,
    shapeContribution: { quads: 1 },
    pillars: { resistive: 0.1, control: 0.1, cardio: 1, shape: 0.15 },
    typicalStart: '06:15',
    durationMin: 50,
    note: 'Legs take a beating. Lift upper before it, and give squats or hip thrusts a full day afterwards.',
    what: 'Indoor cycling to music, seated and standing, with the resistance dial doing the work. Entirely leg-driven.',
    why: 'Excellent for your heart and lungs and very easy on the joints — nothing pounds. But it is the most leg-expensive class here, and it builds almost no muscle, so treat it as cardio and never as a substitute for lower-body lifting. Lift upper body before it and keep squats and hip thrusts a clear day away.'
  },
  {
    id: 'the-battle',
    name: 'The Battle',
    intensity: 'high',
    legFatigue: 'high',
    cnsCost: 'high',
    counts: { conditioning: 1, resistance: 0.25 },
    pairWith: ['upper'],
    blocks: ['lower', 'lower-heavy', 'glute', 'full'],
    recoveryHours: 24,
    shapeContribution: { back: 1, core: 1, quads: 0.5, delts: 0.5 },
    pillars: { resistive: 0.3, control: 0.25, cardio: 1, shape: 0.35 },
    typicalStart: '07:00',
    durationMin: 50,
    note: 'Team conditioning on the rowers and bikes — big lungs, big legs, high nervous-system cost. Pair it with upper body and keep heavy lower a day away.',
    what: 'Team-format conditioning — rowers, bikes and floor work, usually scored or timed against the room.',
    why: 'The competitive format makes you work harder than you would alone, which is the point. It gives you real back and core credit alongside the cardio. It is also one of the most tiring things on the schedule for your nervous system, so it wants a genuinely easy day after it.'
  },
  {
    id: 'battle-on-the-turf',
    name: 'Battle on the Turf',
    intensity: 'high',
    legFatigue: 'very-high',
    cnsCost: 'high',
    counts: { conditioning: 1, resistance: 0.5 },
    pairWith: ['upper'],
    blocks: ['lower', 'lower-heavy', 'glute', 'full'],
    recoveryHours: 36,
    shapeContribution: { quads: 1, gluteMax: 1, core: 1, back: 0.5 },
    pillars: { resistive: 0.5, control: 0.35, cardio: 1, shape: 0.5 },
    typicalStart: '07:00',
    durationMin: 50,
    note: 'Sleds, carries and turf sprints — the most leg-expensive class on the schedule, and it earns real glute credit. Upper body before it, and give heavy lower a day and a half.',
    what: 'Sled pushes and drags, loaded carries and short sprints on the turf strip.',
    why: 'Sleds and carries are genuinely useful for you — pushing a heavy sled is a glute exercise that happens to be cardio, and loaded carries build the deep core and grip that carry over to everything else. It earns real Shape Map credit. It is also the single most leg-expensive session here, so give heavy lower work a day and a half afterwards.'
  },
  {
    id: 'body-pump',
    name: 'BODYPUMP',
    intensity: 'moderate',
    legFatigue: 'moderate',
    cnsCost: 'low',
    counts: { conditioning: 0, resistance: 0.5 },
    pairWith: ['lower-heavy'],
    blocks: [],
    recoveryHours: 12,
    shapeContribution: {
      quads: 2, gluteMax: 1, hamstrings: 0.5, back: 1,
      chest: 1, delts: 1, triceps: 1, biceps: 1, core: 1
    },
    pillars: { resistive: 0.5, control: 0.3, cardio: 0.4, shape: 0.5 },
    typicalStart: '06:30',
    durationMin: 50,
    note: 'High-rep barbell work across the whole body. It counts — half credit toward your weekly sets — but a light bar for sixty reps does not replace heavy lifting. Do your heavy lower work first, then use this as the finisher.',
    what: 'A barbell class set to music. Light plates, very high reps, every muscle group in turn.',
    why: 'This is real resistance training and it counts toward your weekly sets at half credit. But be clear about what it is not: a light bar for sixty reps does not load bone or muscle the way heavy sets do, and at your stage heavy loading is the part that protects bone density. Use it as a supplement to your three heavy days, never as a replacement for one.'
  },
  {
    id: 'mat-pilates',
    name: 'Mat Pilates',
    intensity: 'low',
    legFatigue: 'low',
    cnsCost: 'low',
    counts: { conditioning: 0, resistance: 0.25 },
    pairWith: ['lower-heavy', 'upper'],
    blocks: [],
    recoveryHours: 0,
    shapeContribution: { core: 2, gluteMed: 1 },
    pillars: { resistive: 0.25, control: 1, cardio: 0.1, shape: 0.4 },
    typicalStart: '06:30',
    durationMin: 50,
    note: 'Deep core and hip control with almost no load. This one recovers rather than costs, so it belongs between your two heaviest days — and it will happily follow any lift you like.',
    what: 'Mat-based work on the floor: small, controlled movements for the deep abdominals, hips and spine. No weights.',
    why: 'This is control training, and it is the quiet partner to your heavy lifting. It builds the deep core and pelvic floor coordination that make squats and hip thrusts safer, and it targets the side-glute that shapes the hip. It costs your legs nothing, so it is the ideal thing to put between your two hardest days.'
  },
  {
    id: 'core-and-more',
    name: 'Core & More',
    intensity: 'moderate',
    legFatigue: 'low',
    cnsCost: 'low',
    counts: { conditioning: 0.25, resistance: 0.5 },
    pairWith: ['lower-heavy', 'lower', 'upper'],
    blocks: [],
    recoveryHours: 0,
    shapeContribution: { core: 3, gluteMed: 0.5, back: 0.5 },
    pillars: { resistive: 0.4, control: 0.8, cardio: 0.25, shape: 0.5 },
    typicalStart: '06:30',
    durationMin: 50,
    note: 'Direct core work, and the cheapest way to close a core shortfall in the Shape Map. Stack it after any lift — it takes nothing out of your legs.',
    what: 'Focused abdominal, oblique and lower-back work, plus some glute and shoulder accessory work.',
    why: 'The most efficient way to close a core gap in your Shape Map. A strong deep core is what keeps your waist tight and your lower back healthy under load — and it costs your legs nothing, so it stacks after any lift without interfering.'
  },

  // ---- formats from the real schedule that were not in the original eight ----

  {
    id: 'masters-swim',
    name: 'Masters Swim',
    intensity: 'moderate',
    legFatigue: 'low',
    cnsCost: 'low',
    counts: { conditioning: 1, resistance: 0.25 },
    pairWith: ['lower-heavy', 'lower', 'glute'],
    blocks: [],
    recoveryHours: 0,
    shapeContribution: { back: 1.5, delts: 1, core: 1 },
    pillars: { resistive: 0.25, control: 0.5, cardio: 0.9, shape: 0.35 },
    typicalStart: '06:30',
    durationMin: 50,
    note: 'Coached lane swimming. Zero impact and almost no leg cost, so it is the one hard cardio session that will not touch your lifting.',
    what: 'Coached swim sets in the pool, organised by lane speed. Intervals with short rests on the wall.',
    why: 'The most lift-friendly cardio on the schedule. Swimming is genuinely hard work for your heart and lungs while costing your legs almost nothing, so it will not blunt a squat day the way cycling or HIIT would. It also builds the back and shoulders, which is exactly the upper-body shape you are after. The one thing it does not do is load bone — water takes the impact away — so it supplements your lifting rather than replacing any of it.'
  },
  {
    id: 'box-n-burn',
    name: 'Box n Burn',
    intensity: 'high',
    legFatigue: 'moderate',
    cnsCost: 'high',
    counts: { conditioning: 1, resistance: 0.25 },
    pairWith: ['lower-heavy', 'lower', 'glute'],
    blocks: ['upper'],
    recoveryHours: 12,
    shapeContribution: { delts: 1, core: 1.5, back: 0.5 },
    pillars: { resistive: 0.3, control: 0.6, cardio: 1, shape: 0.4 },
    typicalStart: '08:00',
    durationMin: 50,
    note: 'Boxing technique on the bags plus interval conditioning. Heavy on shoulders and core, light on legs — so it pairs with a lower day, not an upper one.',
    what: 'Boxing on the heavy bags — real technique work on stance, footwork and combinations, wrapped in interval conditioning.',
    why: 'Punching for fifty minutes is enormous work for the shoulders and rotational core, and the footwork is genuine coordination training. Because it barely touches the legs it pairs neatly with a lower-body lift the same morning — but it does hammer the shoulders, so do not stack it on an upper-body day.'
  },
  {
    id: 'kickboxing',
    name: 'Kickboxing',
    intensity: 'high',
    legFatigue: 'high',
    cnsCost: 'high',
    counts: { conditioning: 1, resistance: 0.25 },
    pairWith: ['upper'],
    blocks: ['lower-heavy', 'lower'],
    recoveryHours: 24,
    shapeContribution: { delts: 1, core: 1.5, quads: 0.5, gluteMed: 0.5 },
    pillars: { resistive: 0.25, control: 0.7, cardio: 1, shape: 0.4 },
    typicalStart: '08:00',
    durationMin: 50,
    note: 'Punches and kicks, so unlike boxing it does load the legs and hips. Treat it as a leg-cost class and keep heavy lower work a day clear.',
    what: 'Boxing plus kicks — combinations on the bag and in the air, with conditioning between rounds.',
    why: 'All the shoulder and core benefit of boxing, with a large helping of hip and balance work on top. Kicking on one leg is genuinely good for the side-glute and single-leg stability. The trade-off is that it now costs your legs real fatigue, so it wants a day between it and heavy lower-body work.'
  },
  {
    id: 'stretch-mobility',
    name: 'Stretch & Mobility',
    intensity: 'low',
    legFatigue: 'low',
    cnsCost: 'low',
    counts: { conditioning: 0, resistance: 0 },
    pairWith: ['lower-heavy', 'lower', 'upper', 'glute'],
    blocks: [],
    recoveryHours: 0,
    shapeContribution: {},
    pillars: { resistive: 0.05, control: 1, cardio: 0.05, shape: 0.1 },
    typicalStart: '07:00',
    durationMin: 50,
    note: 'Pure recovery. Costs nothing, helps everything — put it after your heaviest day of the week.',
    what: 'Guided stretching and joint mobility work. Slow, no load, plenty of breathing.',
    why: 'The one session here with no cost attached. Hips and thoracic spine are the two areas that limit squat depth and overhead reach in almost everyone, and this is direct work on both. Put it the day after your heaviest session — it will not interfere with anything and you will move better for the rest of the week.'
  },
  {
    id: 'vinyasa-flow',
    name: 'All Level Vinyasa Flow',
    intensity: 'moderate',
    legFatigue: 'moderate',
    cnsCost: 'low',
    counts: { conditioning: 0.25, resistance: 0.25 },
    pairWith: ['upper', 'lower', 'glute'],
    blocks: [],
    recoveryHours: 0,
    shapeContribution: { core: 1.5, delts: 0.5, gluteMed: 0.5 },
    pillars: { resistive: 0.3, control: 1, cardio: 0.3, shape: 0.35 },
    typicalStart: '08:00',
    durationMin: 75,
    note: 'Seventy-five minutes of flowing yoga. More demanding than it looks — real shoulder and core work — but it recovers more than it costs.',
    what: 'Continuous flowing yoga linked to the breath, seventy-five minutes, open to all levels.',
    why: 'More physically demanding than people expect — holding plank and downward dog repeatedly is meaningful shoulder and core work, and the balance postures train single-leg control. It is also the best stress and sleep intervention on this schedule, which matters more than it sounds through perimenopause, when sleep is often the thing that breaks first.'
  },
  {
    id: 'zumba',
    name: 'Zumba',
    intensity: 'moderate',
    legFatigue: 'moderate',
    cnsCost: 'low',
    counts: { conditioning: 0.75, resistance: 0 },
    pairWith: ['upper', 'lower', 'glute'],
    blocks: [],
    recoveryHours: 6,
    shapeContribution: { quads: 0.5, calves: 0.5, core: 0.5 },
    pillars: { resistive: 0.1, control: 0.6, cardio: 0.8, shape: 0.2 },
    typicalStart: '09:00',
    durationMin: 50,
    note: 'Dance cardio. Moderate cost, low stress, and the one on this list people actually look forward to — which is worth more than the numbers suggest.',
    what: 'Latin-inspired dance cardio. Follow the instructor, keep moving, no technique pressure.',
    why: 'Steady moderate cardio with a coordination and rhythm element, and low joint stress. It builds little muscle, so it does not replace anything — but enjoyment is the most underrated variable in whether a training week actually happens, and this is the class most people come back for.'
  },

  // ---- Sunday formats ----

  {
    id: 'les-mills-strength-development',
    name: 'LES MILLS Strength Development',
    intensity: 'high',
    legFatigue: 'high',
    cnsCost: 'moderate',
    counts: { conditioning: 0, resistance: 0.75 },
    pairWith: [],
    blocks: ['lower', 'lower-heavy', 'glute', 'upper', 'full'],
    recoveryHours: 24,
    shapeContribution: {
      quads: 2, gluteMax: 1.5, hamstrings: 1, back: 1.5,
      chest: 1, delts: 1, core: 1, triceps: 0.5, biceps: 0.5
    },
    pillars: { resistive: 0.9, control: 0.4, cardio: 0.3, shape: 0.75 },
    typicalStart: '08:00',
    durationMin: 50,
    note: 'Barbell strength work with real load — the only class here that is genuinely lifting. Nothing of yours belongs on the same morning: let this be the lift and put your own session on another day. Keep heavy squats and hip thrusts a clear day after it.',
    what: 'A barbell class built around progressive overload rather than burn — squat, hinge, press, row and lunge, in low rep ranges with heavy plates and real rest between sets. You pick the load, and you are expected to add to it week on week.',
    why: 'The closest thing on this timetable to your own training, and the only class here that loads you the way bone actually responds to. Heavy compound work is the signal that keeps muscle and slows the density loss that comes off your hip and spine fastest in the years around your last period. It earns three-quarter credit toward your weekly sets, more than any other class here. Where it stops short is the top end: the class rack runs out of plates well below what you can hip thrust, so treat it as a strong supplement to your three heavy days rather than a fourth one. It is still a hard lower-body morning, so give your own heavy leg work a clear day afterwards.'
  },
  {
    id: 'hatha-yoga',
    name: 'Hatha Yoga',
    intensity: 'low',
    legFatigue: 'low',
    cnsCost: 'low',
    counts: { conditioning: 0, resistance: 0 },
    pairWith: ['lower-heavy', 'lower', 'upper', 'glute'],
    blocks: [],
    recoveryHours: 0,
    shapeContribution: { core: 1, gluteMed: 0.5, delts: 0.5 },
    pillars: { resistive: 0.15, control: 1, cardio: 0.1, shape: 0.15 },
    typicalStart: '08:00',
    durationMin: 50,
    note: 'Held postures rather than a flow. It recovers more than it costs and takes nothing out of your legs, so it will follow any lift you like — and the doors open a full hour before it if you want to lift first.',
    what: 'Yoga taught posture by posture instead of as a continuous flow. You set a shape up, hold it for several breaths, come out, and set the next one up. Slow, deliberate, with a lot of attention on the breathing.',
    why: 'Holding a standing posture while nothing moves is still balance and single-leg control training, and control is the pillar that decides whether you are still lifting in ten years. Be clear that it builds no muscle — it earns no set credit and it is not trying to. What it gives you is hip and thoracic range, which is what lets you squat deeper and press overhead without your ribs flaring, plus a real return on stress and sleep. The breathing is not decoration: slow breathing early in the morning is one of the cheapest things you have against hot flashes and broken nights.'
  },
  {
    id: 'gentle-yoga',
    name: 'Gentle Yoga',
    intensity: 'low',
    legFatigue: 'low',
    cnsCost: 'low',
    counts: { conditioning: 0, resistance: 0 },
    pairWith: ['lower-heavy', 'lower', 'upper', 'glute'],
    blocks: [],
    recoveryHours: 0,
    shapeContribution: {},
    pillars: { resistive: 0.05, control: 0.85, cardio: 0.05, shape: 0.05 },
    typicalStart: '09:00',
    durationMin: 50,
    note: 'The same teacher an hour later, and considerably easier — supported postures, more floor, nothing held at the edge of your range. Pure recovery: it costs nothing, and it is the right call on a morning when the week has flattened you.',
    what: 'Slower and softer than Hatha. Much of it happens on the floor, blocks and bolsters hold you up in the shapes, and the standing holds are largely gone.',
    why: 'The honest difference from Hatha is effort, not content. Gentle takes the standing holds out, so you lose most of the balance work and keep all of the mobility and the calm. It builds nothing, and it is not pretending to. What it does is open hips and upper back after a week of loading, and drop your nervous system into a gear a busy week never lets it find — which matters more than it sounds when sleep is usually the first thing perimenopause breaks. If you only have room for one yoga class, take the earlier Hatha. If the week has beaten you up, take this one instead and count it as training, because that morning it is.'
  },
  {
    id: 'barre-strong',
    name: 'Barre Strong',
    intensity: 'moderate',
    legFatigue: 'high',
    cnsCost: 'low',
    counts: { conditioning: 0.25, resistance: 0.25 },
    pairWith: ['upper'],
    blocks: ['lower', 'lower-heavy', 'glute'],
    recoveryHours: 24,
    shapeContribution: { quads: 2, gluteMax: 1, gluteMed: 1, core: 1, calves: 0.5, delts: 0.5 },
    pillars: { resistive: 0.3, control: 0.8, cardio: 0.4, shape: 0.4 },
    typicalStart: '09:30',
    durationMin: 50,
    note: 'Hundreds of small reps, nearly all of them quads and glutes. Light load, but a lot of leg fatigue for what it builds — lift upper body before it if you lift at all, and keep squats and hip thrusts a clear day away.',
    what: 'Ballet-derived work at the barre and on the mat: small pulses, long holds in a half squat, light hand weights and a band, very high reps throughout. The burn is local rather than breathless.',
    why: 'Do not let anyone tell you this is nothing. Three hundred reps in a shortened range is real work, and the side-glute, deep core and single-leg control it trains are what hold your hips level and your pelvic floor coordinated under load. But be clear about the load itself: endurance-range work with no weight on your back does not load bone, and bone is the part of this you cannot get back later. It earns quarter credit toward your weekly sets and it does not stand in for a heavy day. The price is the awkward bit — your quads will be cooked afterwards for something that built very little, so if you love this class, and plenty of women do, put it on a morning you were never going to squat on anyway.'
  }
];

const BY_ID = new Map(CLASS_FORMATS.map((f) => [f.id, f]));

/**
 * Look up a class format by id.
 * Tolerant of casing and stray whitespace so stored ids from older records still resolve.
 * @param {string} id
 * @returns {object|null} the format, or null when nothing matches
 */
export function classById(id) {
  if (typeof id !== 'string') return null;
  const key = id.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return BY_ID.get(key) || null;
}

/* ------------------------------------------------------------------------- *
 * The actual Redondo Beach morning schedule.
 *
 * Transcribed from the Bay Club Connect app, week of 14 Sep 2026. These are the
 * EARLY sessions only — the club runs classes all day, but this app exists for the
 * 5:30–9:00 window. Anything not listed here can still be added by hand.
 *
 * Instructors and times drift. This is a starting menu, not a contract: the class
 * picker lets her edit the time on anything she taps.
 * ------------------------------------------------------------------------- */

export const CLASS_SCHEDULE = [
  // Monday
  { formatId: 'hiit',               dayOfWeek: 1, start: '06:00', end: '06:50', studio: 'Fitness Studio',        instructor: 'Murat Kabil' },
  { formatId: 'the-battle',         dayOfWeek: 1, start: '07:00', end: '07:50', studio: 'Fitness Studio',        instructor: 'Sam Joe' },
  { formatId: 'cycle',              dayOfWeek: 1, start: '07:30', end: '08:20', studio: 'Indoor Cycling Studio', instructor: 'Bobby Accardi' },
  // Tuesday
  { formatId: 'hiit-express',       dayOfWeek: 2, start: '06:00', end: '06:25', studio: 'Fitness Studio',        instructor: 'Tara Ho' },
  { formatId: 'mat-pilates',        dayOfWeek: 2, start: '06:30', end: '07:20', studio: 'Fitness Studio',        instructor: 'Tara Ho' },
  { formatId: 'masters-swim',       dayOfWeek: 2, start: '06:30', end: '07:20', studio: 'Pool',                  instructor: 'Romina Caristo' },
  // Wednesday
  { formatId: 'body-pump',          dayOfWeek: 3, start: '06:30', end: '07:20', studio: 'Fitness Studio',        instructor: 'Nancy Wisniewski' },
  { formatId: 'battle-on-the-turf', dayOfWeek: 3, start: '07:00', end: '07:50', studio: 'Turf Studio',           instructor: 'Robert Rose' },
  { formatId: 'box-n-burn',         dayOfWeek: 3, start: '08:00', end: '08:50', studio: 'Boxing Studio',         instructor: 'Conor Capps' },
  // Thursday
  { formatId: 'hiit-express',       dayOfWeek: 4, start: '06:00', end: '06:25', studio: 'Fitness Studio',        instructor: 'Pamela Light' },
  { formatId: 'masters-swim',       dayOfWeek: 4, start: '06:30', end: '07:20', studio: 'Pool',                  instructor: 'Romina Caristo' },
  { formatId: 'core-and-more',      dayOfWeek: 4, start: '06:30', end: '07:20', studio: 'Fitness Studio',        instructor: 'Pamela Light' },
  // Friday
  { formatId: 'hiit',               dayOfWeek: 5, start: '06:00', end: '06:50', studio: 'Fitness Studio',        instructor: 'Murat Kabil' },
  { formatId: 'cycle',              dayOfWeek: 5, start: '06:15', end: '07:05', studio: 'Indoor Cycling Studio', instructor: 'Attila Fruttus' },
  { formatId: 'stretch-mobility',   dayOfWeek: 5, start: '07:00', end: '07:50', studio: 'Fitness Studio',        instructor: 'Murat Kabil' },
  // Saturday
  { formatId: 'kickboxing',         dayOfWeek: 6, start: '08:00', end: '08:50', studio: 'Fitness Studio',        instructor: 'Ken Park' },
  { formatId: 'vinyasa-flow',       dayOfWeek: 6, start: '08:00', end: '09:15', studio: 'Turf Studio',           instructor: 'Summer Mecham' },
  { formatId: 'zumba',              dayOfWeek: 6, start: '09:00', end: '09:50', studio: 'Fitness Studio',        instructor: 'Angella Blackhall' },
  // Sunday
  { formatId: 'les-mills-strength-development', dayOfWeek: 0, start: '08:00', end: '08:50', studio: 'Fitness Studio',        instructor: 'Pamela Light' },
  { formatId: 'hatha-yoga',         dayOfWeek: 0, start: '08:00', end: '08:50', studio: 'Yoga Studio',           instructor: 'Lisa Schmahl' },
  { formatId: 'gentle-yoga',        dayOfWeek: 0, start: '09:00', end: '09:50', studio: 'Yoga Studio',           instructor: 'Lisa Schmahl' },
  { formatId: 'cycle',              dayOfWeek: 0, start: '09:15', end: '10:05', studio: 'Indoor Cycling Studio', instructor: 'Courtney Smith' },
  { formatId: 'barre-strong',       dayOfWeek: 0, start: '09:30', end: '10:20', studio: 'Fitness Studio',        instructor: 'TBA' }
];

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Every scheduled class on one weekday (0 = Sunday), earliest first, format joined on. */
export function scheduleForDay(dayOfWeek) {
  return CLASS_SCHEDULE
    .filter((s) => s.dayOfWeek === dayOfWeek)
    .map((s) => ({ ...s, format: classById(s.formatId) }))
    .filter((s) => s.format)
    .sort((a, b) => (a.start < b.start ? -1 : 1));
}

/** The whole week as [{dayOfWeek, dayName, classes:[…]}], Monday first. */
export function scheduleByDay() {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    dayOfWeek: d,
    dayName: DAY_NAMES[d],
    classes: scheduleForDay(d)
  }));
}

/** How much room a class leaves for a lift beforehand, given the club opens at `openTime`. */
export function liftWindowMinutes(startHHMM, openTime) {
  const toMin = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + m;
  };
  return Math.max(0, toMin(startHHMM) - toMin(openTime));
}
