// Daybreak — js/features/warmup.js — the 5 AM Protocol: get warm before you get heavy.
//
// Why this exists as a first-class feature rather than a line of advice:
// core body temperature bottoms out around 4–5 AM and spinal discs are maximally hydrated
// after a night lying down, which is exactly when disc injury risk is highest and spinal
// stiffness peaks. Morning sessions need 10–15 minutes of warm-up where an afternoon
// session needs 5–8. Part one — raising core temperature — is the one that actually matters.

import { btn } from '../ui/components.js';

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

const PART_LABEL = {
  raise: 'Raise the temperature',
  mobility: 'Mobility',
  activation: 'Wake it up',
  ramp: 'Ramp up',
};

function mmss(sec) {
  const s = Math.max(0, Math.round(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/**
 * renderWarmup(el, plan, onDone) — one item at a time, big countdown, always skippable.
 * Returns a teardown function so the caller can cancel cleanly if she navigates away.
 */
export function renderWarmup(el, plan, onDone) {
  let index = 0;
  let remaining = plan.items[0].seconds;
  let deadline = Date.now() + remaining * 1000;
  let paused = false;
  let ticker = null;
  let current = plan;

  function elapsedBefore(i) {
    return current.items.slice(0, i).reduce((s, it) => s + it.seconds, 0);
  }

  function paint() {
    const it = current.items[index];
    const doneSec = elapsedBefore(index) + (it.seconds - remaining);
    const pct = Math.min(100, Math.round((doneSec / current.totalSeconds) * 100));
    const isRaise = it.part === 'raise';

    el.innerHTML =
      '<div class="warmup">' +
        '<header class="warmup-head">' +
          '<span class="warmup-part">' + (PART_LABEL[it.part] || 'Warm-up') + '</span>' +
          '<span class="warmup-progress">' + (index + 1) + ' of ' + current.items.length + '</span>' +
        '</header>' +
        '<div class="warmup-track"><span class="warmup-fill" style="width:' + pct + '%"></span></div>' +

        '<div class="warmup-stage">' +
          '<h1 class="warmup-name display">' + it.name + '</h1>' +
          '<div class="warmup-clock num' + (paused ? ' is-paused' : '') + '">' + mmss(remaining) + '</div>' +
          '<p class="warmup-cue">' + it.cue + '</p>' +
          (isRaise
            ? '<p class="warmup-flag">This is the one that matters. At 5:30 AM your core ' +
              'temperature is at its lowest point of the day — everything after this is safer once ' +
              'you are actually warm.</p>'
            : '') +
        '</div>' +

        '<footer class="warmup-foot">' +
          btn({ label: paused ? 'Resume' : 'Pause', action: 'wu-pause', variant: 'ghost', size: 'md' }) +
          btn({ label: index === current.items.length - 1 ? 'Start lifting' : 'Next',
                action: 'wu-next', variant: 'primary', size: 'lg', full: true }) +
          '<div class="warmup-links">' +
            (current.trimmed ? '' :
              '<button type="button" class="link-quiet" data-action="wu-short">Short version</button>') +
            '<button type="button" class="link-quiet" data-action="wu-skip">Skip the warm-up</button>' +
          '</div>' +
          '<p class="warmup-total">' + mmss(current.totalSeconds - doneSec) + ' left of ' +
            current.totalMinutes + ' min</p>' +
        '</footer>' +
      '</div>';
  }

  function tick() {
    if (paused) return;
    remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    if (remaining <= 0) {
      if (navigator.vibrate) { try { navigator.vibrate(120); } catch (_) { /* not supported */ } }
      next();
      return;
    }
    paint();
  }

  function goTo(i) {
    index = i;
    remaining = current.items[index].seconds;
    deadline = Date.now() + remaining * 1000;
    paint();
  }

  function next() {
    if (index < current.items.length - 1) goTo(index + 1);
    else finish();
  }

  function finish() {
    teardown();
    if (typeof onDone === 'function') onDone();
  }

  function teardown() {
    if (ticker) { clearInterval(ticker); ticker = null; }
    el.removeEventListener('click', onClick);
  }

  function onClick(e) {
    const node = e.target.closest('[data-action]');
    if (!node || !el.contains(node)) return;
    const action = node.getAttribute('data-action');
    if (action === 'wu-next') { next(); }
    else if (action === 'wu-skip') { finish(); }
    else if (action === 'wu-pause') {
      paused = !paused;
      if (!paused) deadline = Date.now() + remaining * 1000;
      paint();
    } else if (action === 'wu-short') {
      current = shortWarmup(plan);
      goTo(Math.min(index, current.items.length - 1));
    }
  }

  el.addEventListener('click', onClick);
  ticker = setInterval(tick, 1000);
  paint();

  return teardown;
}
