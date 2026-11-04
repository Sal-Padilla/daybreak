// Lady_GYM — js/data/warmup.js — the dawn warm-up: what to do, in what order, for how long.
//
// Taken unchanged from Daybreak's 5 AM Protocol (the science was never the problem): core
// temperature bottoms out around 4–5 AM, so morning sessions need a longer warm-up, and part
// one — raising core temperature — is the part with the evidence. Only the screen changed.

const RAISE = {
  name: 'Easy bike or row',
  cue: 'Conversational pace. You are raising your core temperature, not training.',
  part: 'raise',
  seconds: 180,
};

const MOBILITY = {
  lower: [
    { name: '90/90 hip switches', cue: 'Slow. Let the hips open — do not force the range.' },
    { name: 'Cat-cow',            cue: 'Move one vertebra at a time. Breathe with it.' },
    { name: 'Ankle rocks',        cue: 'Knee tracks over the toes. Heel stays down.' },
    { name: 'World’s greatest stretch', cue: 'Elbow to instep, then open the chest to the ceiling.' },
  ],
  upper: [
    { name: 'Thoracic opener',    cue: 'Side lying, top arm sweeps overhead. Follow it with your eyes.' },
    { name: 'Cat-cow',            cue: 'Move one vertebra at a time. Breathe with it.' },
    { name: 'Shoulder CARs',      cue: 'Biggest circle you can make. Slow enough to feel every inch.' },
    { name: 'Wall slides',        cue: 'Forearms on the wall, ribs down, slide up without shrugging.' },
  ],
  general: [
    { name: 'Cat-cow',            cue: 'Move one vertebra at a time. Breathe with it.' },
    { name: '90/90 hip switches', cue: 'Slow. Let the hips open — do not force the range.' },
    { name: 'Thoracic opener',    cue: 'Side lying, top arm sweeps overhead. Follow it with your eyes.' },
  ],
};

const ACTIVATION = {
  lower: [
    { name: 'Glute bridge',        cue: 'Ribs down, squeeze at the top. Exhale as you lift.' },
    { name: 'Banded lateral walk', cue: 'Band above the knees. Small steps, tension the whole way.' },
    { name: 'Dead bug',            cue: 'Low back stays flat on the floor. Exhale as you reach.' },
  ],
  upper: [
    { name: 'Scap pull-ups',       cue: 'Arms straight. Just pull the shoulder blades down.' },
    { name: 'Band pull-apart',     cue: 'Straight arms, squeeze the mid-back. Exhale as you open.' },
    { name: 'Dead bug',            cue: 'Low back stays flat on the floor. Exhale as you reach.' },
  ],
  general: [
    { name: 'Glute bridge',        cue: 'Ribs down, squeeze at the top. Exhale as you lift.' },
    { name: 'Band pull-apart',     cue: 'Straight arms, squeeze the mid-back. Exhale as you open.' },
    { name: 'Dead bug',            cue: 'Low back stays flat on the floor. Exhale as you reach.' },
  ],
};

const RAMP = {
  name: 'Ramp sets',
  cue: 'Two or three sets on your first lift, building to your working weight. These do not count.',
  part: 'ramp',
  seconds: 180,
};

/**
 * A warm-up movement is exactly the kind she has never done — nobody arrives knowing what a
 * 90/90 hip switch is — and the warm-up opens every single session. It used to picture two
 * of its fourteen movements, and one of those two was wrong: the glute bridge borrowed the
 * hip-thrust drawing, where the shoulders are up on a bench.
 *
 * Every movement now has its own shape, or shares one that is genuinely the same movement.
 * A key without artwork still renders nothing rather than a near-miss, and every movement
 * keeps its "Show me" link to a demonstration.
 */
export const WARMUP_SHAPE = {
  'Easy bike or row': 'bike',
  '90/90 hip switches': 'warmup-hip-switch',
  'Cat-cow': 'warmup-cat-cow',
  'Ankle rocks': 'warmup-ankle-rock',
  'World’s greatest stretch': 'warmup-greatest-stretch',
  'Thoracic opener': 'warmup-thoracic-opener',
  'Shoulder CARs': 'warmup-shoulder-car',
  'Wall slides': 'warmup-wall-slide',
  'Glute bridge': 'glute-bridge',
  'Banded lateral walk': 'banded-lateral-walk',
  'Dead bug': 'supine-core',
  'Scap pull-ups': 'warmup-scap-pullup',
  'Band pull-apart': 'warmup-band-pull-apart',
  'Ramp sets': 'warmup-ramp-sets',
};

function familyFor(sessionType) {
  const t = String(sessionType || '').toLowerCase();
  if (t.includes('lower') || t === 'glute' || t.includes('leg')) return 'lower';
  if (t.includes('upper') || t.includes('push') || t.includes('pull')) return 'upper';
  return 'general';
}

/**
 * warmupFor(dials, sessionType) -> { totalMinutes, items: [{name, seconds, cue, part}] }
 *
 * Budget comes from dials.warmupMinutes (10 / 12 / 15 by life stage, +2 for beginners).
 * Part one is fixed at 3 minutes and is never trimmed — it is the one with the evidence
 * behind it. Whatever remains is split between mobility and activation, with ramp sets last.
 */
export function warmupFor(dials, sessionType) {
  const budgetMin = Math.max(6, Math.round((dials && dials.warmupMinutes) || 12));
  const family = familyFor(sessionType);

  const items = [{ ...RAISE }];

  // Reserve part 1 (3 min) and ramp sets (3 min); split the rest between mobility and activation.
  const middleSeconds = Math.max(120, budgetMin * 60 - RAISE.seconds - RAMP.seconds);
  const mobilityPool = MOBILITY[family];
  const activationPool = ACTIVATION[family];
  const count = mobilityPool.length + activationPool.length;
  const per = Math.max(30, Math.round(middleSeconds / count / 5) * 5);

  for (const m of mobilityPool) items.push({ ...m, seconds: per, part: 'mobility' });
  for (const a of activationPool) items.push({ ...a, seconds: per, part: 'activation' });
  items.push({ ...RAMP });

  const totalSeconds = items.reduce((sum, it) => sum + it.seconds, 0);
  return { totalMinutes: Math.round(totalSeconds / 60), totalSeconds, items, sessionType, family };
}

/** A trimmed version for someone who is already up and moving, or simply short on time. */
export function shortWarmup(plan) {
  const keep = plan.items.filter((it) => it.part === 'raise' || it.part === 'ramp' ||
    it.name === 'Glute bridge' || it.name === 'Cat-cow' || it.name === 'Band pull-apart');
  const items = keep.map((it) => ({ ...it, seconds: it.part === 'raise' ? 180 : Math.min(it.seconds, 45) }));
  const totalSeconds = items.reduce((s, it) => s + it.seconds, 0);
  return { ...plan, items, totalSeconds, totalMinutes: Math.round(totalSeconds / 60), trimmed: true };
}


export const PART_LABEL = {
  raise: 'Get warm',
  mobility: 'Loosen up',
  activation: 'Wake it up',
  ramp: 'Build up',
};
