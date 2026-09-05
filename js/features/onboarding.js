// Daybreak — js/features/onboarding.js — six questions, ninety seconds, then out of the way.
//
// The research behind the hard six-question limit: a long or confusing onboarding is a
// top cause of women abandoning a fitness app before they ever use it once. Every question
// here earns its place by changing the program. Nothing is asked for a database's benefit.

import { DB } from '../core/db.js';
import { Store } from '../core/store.js';
import { dialsFor } from '../engine/lifestage.js';
import { programFor } from '../data/programs.js';
import { btn, toast } from '../ui/components.js';

const GOALS = [
  { id: 'fat-loss', label: 'Lose fat',      note: 'Lean out, keep the muscle you build' },
  { id: 'shape',    label: 'Build shape',   note: 'Glutes, hips, shoulders — the Shape Map' },
  { id: 'strong',   label: 'Get strong',    note: 'Load on the bar, and bone density with it' },
  { id: 'recomp',   label: 'All three',     note: 'The usual answer, and a good one' },
];

const STAGES = [
  { id: 'cycling',    label: 'My periods are regular',
    note: 'Standard programming, with cycle tracking if you want it' },
  { id: 'transition', label: 'My periods have changed, or I’m having hot flashes or sleep changes',
    note: 'Perimenopause — this changes your training in ways that matter' },
  { id: 'post',       label: 'It’s been a year or more since my last period',
    note: 'Post-menopause — you need heavier and more volume, not less' },
];

const EXPERIENCE = [
  { id: 'new',         label: 'New to lifting',        note: 'We’ll start with four weeks learning the movements' },
  { id: 'returning',   label: 'Coming back after a break', note: 'You know the lifts — we’ll rebuild the load' },
  { id: 'experienced', label: 'Already lifting',       note: 'Straight into the full program' },
];

const LEAK = [
  { id: 'never',       label: 'Never' },
  { id: 'sometimes',   label: 'Sometimes' },
  { id: 'often',       label: 'Often' },
  { id: 'prefer-not',  label: 'I’d rather not say' },
];

const TOTAL = 6;

// Working answers. Reset each time onboarding is entered.
let draft = null;
let step = 0;
let rootEl = null;

function freshDraft() {
  return {
    name: '',
    lifeStage: 'transition',
    experience: 'new',
    heightIn: null,
    weightLb: null,
    goal: 'recomp',
    pelvicFloor: 'unknown',
  };
}

/** True when nobody has completed onboarding on this device. */
export async function needsOnboarding() {
  try {
    const has = await DB.hasProfile();
    if (!has) return true;
    const p = await DB.getProfile();
    return !p || !p.name || !String(p.name).trim();
  } catch (err) {
    console.error('Daybreak: could not read the profile, showing onboarding.', err);
    return true;
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function dots() {
  let out = '<div class="ob-dots" role="progressbar" aria-valuemin="1" aria-valuemax="' + TOTAL +
            '" aria-valuenow="' + (step + 1) + '" aria-label="Question ' + (step + 1) + ' of ' + TOTAL + '">';
  for (let i = 0; i < TOTAL; i++) {
    out += '<span class="ob-dot' + (i === step ? ' is-active' : (i < step ? ' is-done' : '')) + '"></span>';
  }
  return out + '</div>';
}

function optionRows(items, selectedId, action) {
  return items.map((it) => (
    '<button type="button" class="option-row' + (it.id === selectedId ? ' is-selected' : '') + '"' +
    ' data-action="' + action + '" data-value="' + esc(it.id) + '">' +
      '<span class="option-row-main">' +
        '<span class="option-row-label">' + esc(it.label) + '</span>' +
        (it.note ? '<span class="option-row-note">' + esc(it.note) + '</span>' : '') +
      '</span>' +
      '<span class="option-row-check" aria-hidden="true"></span>' +
    '</button>'
  )).join('');
}

function shell(inner, opts = {}) {
  const backBtn = step > 0
    ? '<button type="button" class="ob-back" data-action="back" aria-label="Back">← Back</button>'
    : '<span class="ob-back-spacer"></span>';
  const skip = opts.skip
    ? '<button type="button" class="ob-skip" data-action="skip">' + esc(opts.skip) + '</button>'
    : '';
  return (
    '<div class="onboarding">' +
      '<header class="ob-head">' + backBtn + dots() + '</header>' +
      '<div class="ob-body">' + inner + '</div>' +
      '<footer class="ob-foot">' +
        (opts.next === false ? '' : btn({
          label: opts.nextLabel || 'Continue',
          action: 'next',
          variant: 'primary',
          size: 'lg',
          full: true,
          disabled: !!opts.nextDisabled,
        })) +
        skip +
      '</footer>' +
    '</div>'
  );
}

function q1() {
  return shell(
    '<h1 class="ob-title display">First — what should I call you?</h1>' +
    '<p class="ob-sub">Just a first name. It stays on this phone.</p>' +
    '<div class="field">' +
      '<input class="input ob-input" type="text" id="ob-name" data-action="name" ' +
      'value="' + esc(draft.name) + '" placeholder="Your name" autocomplete="given-name" ' +
      'autocapitalize="words" enterkeyhint="next" maxlength="40">' +
    '</div>',
    { nextDisabled: !draft.name.trim() }
  );
}

function q2() {
  return shell(
    '<h1 class="ob-title display">Where are you right now?</h1>' +
    '<p class="ob-sub">Not your age — what your body is actually doing. This changes your ' +
    'training more than anything else you’ll tell me.</p>' +
    '<div class="option-list">' + optionRows(STAGES, draft.lifeStage, 'stage') + '</div>',
    { skip: 'Not sure — skip' }
  );
}

function q3() {
  return shell(
    '<h1 class="ob-title display">Have you lifted before?</h1>' +
    '<p class="ob-sub">Walking and running count for fitness, but not for this question.</p>' +
    '<div class="option-list">' + optionRows(EXPERIENCE, draft.experience, 'experience') + '</div>'
  );
}

function q4() {
  const ft = draft.heightIn ? Math.floor(draft.heightIn / 12) : '';
  const inch = draft.heightIn ? Math.round(draft.heightIn % 12) : '';
  return shell(
    '<h1 class="ob-title display">Height and weight?</h1>' +
    '<p class="ob-sub">Only used to set your protein target and your strength numbers. ' +
    'Skip it and everything still works.</p>' +
    '<div class="ob-grid">' +
      '<div class="field"><label class="field-label" for="ob-ft">Height</label>' +
        '<div class="row gap-2">' +
          '<input class="input" type="number" id="ob-ft" data-action="ft" inputmode="numeric" ' +
          'min="4" max="7" placeholder="5" value="' + esc(ft) + '" aria-label="Feet">' +
          '<span class="ob-unit">ft</span>' +
          '<input class="input" type="number" id="ob-in" data-action="in" inputmode="numeric" ' +
          'min="0" max="11" placeholder="6" value="' + esc(inch) + '" aria-label="Inches">' +
          '<span class="ob-unit">in</span>' +
        '</div>' +
      '</div>' +
      '<div class="field"><label class="field-label" for="ob-wt">Weight</label>' +
        '<div class="row gap-2">' +
          '<input class="input" type="number" id="ob-wt" data-action="weight" inputmode="decimal" ' +
          'min="60" max="500" step="0.5" placeholder="150" value="' + esc(draft.weightLb ?? '') + '">' +
          '<span class="ob-unit">lb</span>' +
        '</div>' +
      '</div>' +
    '</div>',
    { skip: 'Skip this' }
  );
}

function q5() {
  return shell(
    '<h1 class="ob-title display">What are you after?</h1>' +
    '<p class="ob-sub">You can change this whenever you like.</p>' +
    '<div class="option-list">' + optionRows(GOALS, draft.goal, 'goal') + '</div>'
  );
}

function q6() {
  return shell(
    '<h1 class="ob-title display">One private question.</h1>' +
    '<p class="ob-sub">Any leaking when you jump, cough, sneeze or lift heavy?</p>' +
    '<div class="option-list">' + optionRows(LEAK, draft.pelvicFloor === 'unknown' ? null : draft.pelvicFloor, 'leak') + '</div>' +
    '<p class="ob-note">I ask because it’s common — roughly four in ten women who lift ' +
    'report it — and because it changes which exercises I put in front of you. It stays on ' +
    'this phone, and it’s usually very treatable.</p>',
    { nextLabel: 'Finish', skip: 'Skip this' }
  );
}

const STEPS = [q1, q2, q3, q4, q5, q6];

function paint() {
  if (!rootEl) return;
  rootEl.innerHTML = STEPS[step]();
  const focusable = rootEl.querySelector('.ob-input, .option-row, .input');
  if (focusable && step === 0) {
    // Only autofocus the name field; grabbing focus on option screens fights the scroll.
    try { focusable.focus({ preventScroll: true }); } catch (_) { /* older Safari */ }
  }
  rootEl.scrollTop = 0;
}

function advance() {
  if (step < TOTAL - 1) {
    step += 1;
    paint();
  } else {
    finish();
  }
}

async function finish() {
  const profile = {
    id: 'me',
    name: draft.name.trim() || 'Friend',
    lifeStage: draft.lifeStage,
    experience: draft.experience,
    heightIn: draft.heightIn,
    weightLb: draft.weightLb,
    goal: draft.goal,
    pelvicFloor: draft.pelvicFloor,
    startedOn: DB.todayISO(),
    programWeek: 1,
  };

  const dials = dialsFor(profile);
  const program = programFor(profile);
  profile.programId = program && program.id ? program.id : 'on-ramp';

  // Protein target: bodyweight in kg × the life-stage multiplier. No weight, no target —
  // we do not invent a number and then coach off it.
  if (Number.isFinite(profile.weightLb) && profile.weightLb > 0) {
    profile.proteinTargetG = Math.round((profile.weightLb / 2.2046) * dials.proteinGPerKg);
  } else {
    profile.proteinTargetG = null;
  }

  try {
    await DB.saveProfile(profile);
    await Store.init();
    if (typeof onComplete === 'function') onComplete();
  } catch (err) {
    console.error('Daybreak: could not save the profile.', err);
    toast('Could not save that. Try again?', 'signal');
  }
}

let onComplete = null;

const handlers = {
  next: advance,
  back() { if (step > 0) { step -= 1; paint(); } },
  skip() {
    // A skip is a real answer: it means "leave it at the safe default".
    if (step === 5) draft.pelvicFloor = 'prefer-not';
    advance();
  },
  name(node) {
    draft.name = node.value || '';
    const next = rootEl.querySelector('[data-action="next"]');
    if (next) {
      const empty = !draft.name.trim();
      next.disabled = empty;
      next.setAttribute('aria-disabled', empty ? 'true' : 'false');
    }
  },
  stage(node) { draft.lifeStage = node.dataset.value; paint(); setTimeout(advance, 180); },
  experience(node) { draft.experience = node.dataset.value; paint(); setTimeout(advance, 180); },
  goal(node) { draft.goal = node.dataset.value; paint(); setTimeout(advance, 180); },
  leak(node) { draft.pelvicFloor = node.dataset.value; paint(); setTimeout(advance, 180); },
  ft(node) { setHeight(node.value, null); },
  in(node) { setHeight(null, node.value); },
  weight(node) {
    const n = parseFloat(node.value);
    draft.weightLb = Number.isFinite(n) && n > 0 ? n : null;
  },
};

let heightFt = null;
let heightIn = null;
function setHeight(ft, inch) {
  if (ft !== null) heightFt = parseInt(ft, 10);
  if (inch !== null) heightIn = parseInt(inch, 10);
  const f = Number.isFinite(heightFt) ? heightFt : null;
  const i = Number.isFinite(heightIn) ? heightIn : 0;
  draft.heightIn = f ? f * 12 + i : null;
}

function onEvent(e) {
  const node = e.target.closest('[data-action]');
  if (!node || !rootEl.contains(node)) return;
  const fn = handlers[node.getAttribute('data-action')];
  if (!fn) return;
  const isControl = node.tagName === 'INPUT' || node.tagName === 'SELECT' || node.tagName === 'TEXTAREA';
  if (isControl && e.type === 'click') return;   // let input/change drive form controls
  if (!isControl && e.type !== 'click') return;
  if (node.disabled) return;
  fn(node, node.dataset);
}

/**
 * Render the whole onboarding flow into `el`. Calls `done()` once the profile is saved,
 * which is where app.js hands control over to the Router.
 */
export function renderOnboarding(el, done) {
  rootEl = el;
  onComplete = typeof done === 'function' ? done : null;
  draft = freshDraft();
  step = 0;
  heightFt = null;
  heightIn = null;

  if (!el.dataset.obWired) {
    el.addEventListener('click', onEvent);
    el.addEventListener('input', onEvent);
    el.addEventListener('change', onEvent);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        const next = rootEl.querySelector('[data-action="next"]');
        if (next && !next.disabled) advance();
      }
    });
    el.dataset.obWired = '1';
  }
  paint();
}
