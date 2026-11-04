// Lady_GYM — js/features/onboarding.js — a warm welcome, four picture questions, and you're in.
//
// What changed from Daybreak, and why:
//   - It opens on a picture, not a question. People decide in seconds whether an app is "for
//     me"; Daybreak opened on a beige form asking for a name.
//   - Choices are big picture tiles, one tap each, no "Continue" button to hunt for.
//   - Daybreak's second question was about periods and its sixth about bladder leaks. Both
//     matter to the program, but asked of a stranger in the first minute they read as
//     invasive. Life stage is now asked softly, with "prefer not to say", and the leak
//     question has moved to Profile → Comfort & privacy, where she can answer it if and when
//     she wants. Unanswered, the program uses its safe default.
//   - Height and weight are optional and say so.

import { DB } from '../core/db.js';
import { Store } from '../core/store.js';
import { dialsFor } from '../engine/lifestage.js';
import { programFor } from '../data/programs.js';
import { buildWeek } from '../engine/scheduler.js';
import { welcomeArt } from '../art/scenes.js';
import { figureSvg } from '../art/figure.js';
import { icon, tile } from '../ui/icons.js';
import { esc, button, haptic, confetti, toast, pickPhoto, shrinkImage } from '../ui/kit.js';
import { GOALS, EXPERIENCE, STAGES } from './profile.js';
import { mondayOf } from './shared.js';

const GOAL_ART = {
  shape: { fig: 'glute-bridge', bg: ['#D6185E', '#B8145E'] },
  'fat-loss': { fig: 'jump-land', bg: ['#C2410C', '#B23A0A'] },
  strong: { fig: 'deadlift-from-floor', bg: ['#6A3BD8', '#7E3FCF'] },
  recomp: { fig: 'kettlebell-swing', bg: ['#00796B', '#00695F'] },
};
const EXP_ART = { new: ['leaf', 'var(--mint-fill)'], returning: ['refresh', 'var(--blue-fill)'], experienced: ['trophy', 'var(--violet-fill)'] };
const STAGE_ART = { cycling: ['heart', 'var(--pink-fill)'], transition: ['sparkle', 'var(--orange-fill)'], post: ['star', 'var(--violet-fill)'] };

let root = null;
let step = 0;
let draft = null;
let photo = null;
let onDone = null;
let finishing = false;      // a double tap on the last button must not start the app twice

export async function needsOnboarding() {
  try {
    const p = await DB.getProfile();
    return !p || !p.name || !String(p.name).trim();
  } catch (_) { return true; }
}

function dots(n) {
  return '<div class="ob-dots" aria-label="Step ' + step + ' of ' + n + '">' +
    Array.from({ length: n }, (_, i) => '<span class="' + (i + 1 === step ? 'is-on' : i + 1 < step ? 'is-done' : '') + '"></span>').join('') + '</div>';
}

function frame(inner, { back = true, skip = '' } = {}) {
  return '<div class="ob">' +
    '<header class="ob-top">' +
      (back ? '<button type="button" class="nav-back" data-ob="back">' + icon('chevronLeft', 20) + '<span>Back</span></button>' : '<span></span>') +
      dots(5) +
      (skip ? '<button type="button" class="nav-text" data-ob="skip">' + esc(skip) + '</button>' : '<span></span>') +
    '</header>' +
    '<div class="ob-body">' + inner + '</div></div>';
}

const screens = [
  // 0 — welcome
  () => '<div class="ob-welcome">' +
    '<div class="ob-welcome-art">' + welcomeArt() + '</div>' +
    '<div class="ob-welcome-text">' +
      '<p class="wordmark">Lady<span>_</span>GYM</p>' +
      '<h1>Strong, toned and confident — at your own pace.</h1>' +
      '<p class="ob-sub">Workouts made for women, planned around your classes, with a picture for every move.</p>' +
      button({ label: 'Get Started', action: '', kind: 'primary', cls: 'ob-go', data: { ob: 'next' } }) +
      '<button type="button" class="link ob-restore" data-ob="restore">I have a backup to restore</button>' +
    '</div></div>',

  // 1 — name + photo
  () => frame(
    '<h1 class="ob-title">Hi there! What’s your name?</h1>' +
    '<p class="ob-sub">Just your first name. It stays on this phone.</p>' +
    '<button type="button" class="ob-photo" data-ob="photo" aria-label="Add a photo of you (optional)">' +
      (photo ? '<img src="' + photo + '" alt="">' : icon('camera', 30) + '<span>Add photo</span>') + '</button>' +
    '<input class="input input-big" id="ob-name" value="' + esc(draft.name) + '" placeholder="Your name" maxlength="40" ' +
      'autocapitalize="words" autocomplete="given-name" enterkeyhint="next" aria-label="Your name">' +
    '<div class="ob-foot">' + button({ label: 'Continue', kind: 'primary', data: { ob: 'next' }, disabled: !draft.name.trim(), cls: 'ob-next' }) + '</div>',
    { back: true }),

  // 2 — goal
  () => frame(
    '<h1 class="ob-title">What’s your main goal, ' + esc(draft.name) + '?</h1>' +
    '<p class="ob-sub">Pick one. You can change it any time.</p>' +
    '<div class="ob-tiles">' + GOALS.map((g) => {
      const a = GOAL_ART[g.id];
      return '<button type="button" class="ob-tile' + (draft.goal === g.id ? ' is-on' : '') + '" data-ob="goal" data-v="' + g.id + '" ' +
        'style="background:linear-gradient(140deg,' + a.bg[0] + ',' + a.bg[1] + ')">' +
        '<span class="ob-tile-fig">' + figureSvg(a.fig, { frame: 'finish', labels: false, panel: false }) + '</span>' +
        '<span class="ob-tile-label">' + esc(g.label) + '</span><span class="ob-tile-sub">' + esc(g.sub) + '</span>' +
        '<span class="ob-tile-check">' + icon('check', 16) + '</span></button>';
    }).join('') + '</div>'),

  // 3 — experience
  () => frame(
    '<h1 class="ob-title">Have you lifted weights before?</h1>' +
    '<p class="ob-sub">Walking and running are great — but this is about weights.</p>' +
    '<div class="ob-cards">' + EXPERIENCE.map((x) => {
      const [ic, c] = EXP_ART[x.id];
      return '<button type="button" class="ob-card' + (draft.experience === x.id ? ' is-on' : '') + '" data-ob="exp" data-v="' + x.id + '">' +
        tile(ic, c, 48) + '<span><b>' + esc(x.label) + '</b><span>' + esc(x.sub) + '</span></span>' +
        '<span class="ob-radio"></span></button>';
    }).join('') + '</div>'),

  // 4 — life stage
  () => frame(
    '<h1 class="ob-title">Which sounds most like you?</h1>' +
    '<p class="ob-sub">Hormones change how your muscles respond, so this sets the right weights and rest for you. Private, on your phone only.</p>' +
    '<div class="ob-cards">' + STAGES.map((x) => {
      const [ic, c] = STAGE_ART[x.id];
      return '<button type="button" class="ob-card' + (draft.lifeStage === x.id ? ' is-on' : '') + '" data-ob="stage" data-v="' + x.id + '">' +
        tile(ic, c, 48) + '<span><b>' + esc(x.label) + '</b><span>' + esc(x.sub) + '</span></span>' +
        '<span class="ob-radio"></span></button>';
    }).join('') +
    '<button type="button" class="ob-card is-quiet" data-ob="stage" data-v="">' + tile('lock', 'var(--label-3)', 48) +
      '<span><b>I’d rather not say</b><span>No problem — I’ll use a safe middle setting</span></span><span class="ob-radio"></span></button>' +
    '</div>'),

  // 5 — body (optional)
  () => frame(
    '<h1 class="ob-title">Height and weight?</h1>' +
    '<p class="ob-sub">Optional. Only used to set your protein goal and starting weights.</p>' +
    '<div class="group-body ob-body-form">' +
      '<div class="row"><span class="row-main"><span class="row-title">Height</span></span>' +
        '<input class="input-inline num" id="ob-ft" type="number" inputmode="numeric" placeholder="5" value="' + esc(draft.ft || '') + '" aria-label="Feet"><span class="row-unit">ft</span>' +
        '<input class="input-inline num" id="ob-in" type="number" inputmode="numeric" placeholder="5" value="' + esc(draft.inch || '') + '" aria-label="Inches"><span class="row-unit">in</span></div>' +
      '<div class="row"><span class="row-main"><span class="row-title">Weight</span></span>' +
        '<input class="input-inline num" id="ob-wt" type="number" inputmode="decimal" placeholder="150" value="' + esc(draft.weightLb || '') + '" aria-label="Weight in pounds"><span class="row-unit">lb</span></div>' +
    '</div>' +
    '<div class="ob-foot">' + button({ label: 'Continue', kind: 'primary', data: { ob: 'body' } }) + '</div>',
    { skip: 'Skip' }),

  // 6 — ready
  () => {
    const profile = buildProfile();
    const dials = dialsFor(profile);
    profile.programId = (programFor(profile) || {}).id || 'on-ramp';
    const week = buildWeek(profile, [], dials, mondayOf(DB.todayISO()));
    const colors = { lower: 'pink', 'lower-heavy': 'pink', upper: 'violet', conditioning: 'orange', recovery: 'mint' };
    const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const lifts = week.filter((d) => d.session && d.session.type !== 'recovery' && d.session.type !== 'conditioning').length;
    return '<div class="ob ob-ready">' +
      '<div class="ob-ready-badge">' + icon('check', 52) + '</div>' +
      '<h1 class="ob-title center">You’re all set, ' + esc(draft.name) + '!</h1>' +
      '<p class="ob-sub center">Your plan: ' + lifts + ' strength workouts a week, about an hour each, plus cardio and an easy day.</p>' +
      '<div class="ob-week">' + week.map((d, i) => {
        const c = d.session ? colors[d.session.type] || 'pink' : null;
        return '<div class="ob-wday"><span class="ob-wdot' + (c ? '' : ' is-rest') + '"' + (c ? ' style="background:var(--' + c + '-fill)"' : '') + '>' +
          (c ? icon(d.session.type === 'recovery' ? 'leaf' : d.session.type === 'conditioning' ? 'bolt' : 'workouts', 18) : '') + '</span>' +
          '<span>' + letters[i] + '</span></div>';
      }).join('') + '</div>' +
      '<div class="ob-legend"><span><i style="background:var(--pink-fill)"></i>Lower body</span><span><i style="background:var(--violet-fill)"></i>Upper body</span>' +
        '<span><i style="background:var(--orange-fill)"></i>Cardio</span><span><i style="background:var(--mint-fill)"></i>Easy</span></div>' +
      '<p class="ob-sub center small">Add your favourite club classes later and I’ll plan around them.</p>' +
      '<div class="ob-foot">' + button({ label: 'Let’s Go!', kind: 'primary', data: { ob: 'finish' }, icon: 'play' }) + '</div>' +
      '</div>';
  },
];

function buildProfile() {
  const ft = parseInt(draft.ft, 10);
  const inch = parseInt(draft.inch, 10) || 0;
  const wt = parseFloat(draft.weightLb);
  return {
    id: 'me',
    name: draft.name.trim() || 'Friend',
    lifeStage: draft.lifeStage || 'transition',
    experience: draft.experience || 'new',
    heightIn: Number.isFinite(ft) && ft > 0 ? ft * 12 + inch : null,
    weightLb: Number.isFinite(wt) && wt > 0 ? wt : null,
    goal: draft.goal || 'recomp',
    pelvicFloor: 'unknown',
    startedOn: DB.todayISO(),
    programWeek: 1,
  };
}

function paint() {
  root.innerHTML = screens[step]();
  root.scrollTop = 0;
  if (step === 1) {
    const n = root.querySelector('#ob-name');
    if (n && !draft.name) setTimeout(() => { try { n.focus({ preventScroll: true }); } catch (_) { /* old Safari */ } }, 350);
  }
}

function go(n) {
  step = Math.max(0, Math.min(screens.length - 1, n));
  paint();
}

function readBody() {
  const v = (id) => (root.querySelector('#' + id) || {}).value || '';
  draft.ft = v('ob-ft'); draft.inch = v('ob-in'); draft.weightLb = v('ob-wt');
}

async function finish() {
  const profile = buildProfile();
  const dials = dialsFor(profile);
  profile.programId = (programFor(profile) || {}).id || 'on-ramp';
  profile.proteinTargetG = profile.weightLb ? Math.round((profile.weightLb / 2.2046) * dials.proteinGPerKg) : null;
  try {
    await DB.saveProfile(profile);
    if (photo) await DB.setPref('avatar', photo);
    await Store.init();
    if (onDone) onDone();
  } catch (err) {
    console.error(err);
    finishing = false;
    toast('Could not save that — try again?', { tone: 'bad', ic: 'info' });
  }
}

async function onClick(e) {
  const b = e.target.closest('[data-ob]');
  if (!b || b.disabled) return;
  const what = b.dataset.ob;
  const choose = (field) => {
    haptic();
    draft[field] = b.dataset.v || null;
    for (const x of root.querySelectorAll('[data-ob="' + what + '"]')) x.classList.toggle('is-on', x === b);
    // From the step this tap was on: a double tap used to advance twice and skip a question.
    const from = step;
    setTimeout(() => { if (step === from) go(from + 1); }, 260);
  };
  if (what === 'next') { haptic(); return go(step + 1); }
  if (what === 'back') return go(step - 1);
  if (what === 'skip') { if (step === 5) { draft.ft = draft.inch = draft.weightLb = ''; } return go(step + 1); }
  if (what === 'goal') return choose('goal');
  if (what === 'exp') return choose('experience');
  if (what === 'stage') return choose('lifeStage');
  if (what === 'body') { readBody(); return go(step + 1); }
  if (what === 'finish') {
    if (finishing) return;
    finishing = true;
    haptic(); confetti(); return setTimeout(finish, 450);
  }
  if (what === 'photo') {
    const f = await pickPhoto();
    if (!f) return;
    try { photo = await shrinkImage(f, 400, 0.85); paint(); } catch (_) { /* ignore */ }
    return;
  }
  if (what === 'restore') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        await DB.importAll(JSON.parse(await f.text()));
        toast('Restored — welcome back!', { tone: 'good' });
        setTimeout(() => location.reload(), 700);
      } catch (_) { toast('That file isn’t a backup I can read', { tone: 'bad', ic: 'info' }); }
    };
    input.click();
  }
}

function onInput(e) {
  if (e.target.id === 'ob-name') {
    draft.name = e.target.value;
    const next = root.querySelector('.ob-next');
    if (next) { next.disabled = !draft.name.trim(); next.setAttribute('aria-disabled', String(!draft.name.trim())); }
  }
}

function onKey(e) {
  if (e.key === 'Enter' && e.target.id === 'ob-name' && draft.name.trim()) { e.preventDefault(); go(step + 1); }
}

export function renderOnboarding(el, done) {
  root = el;
  onDone = done;
  step = 0;
  draft = { name: '', goal: null, experience: null, lifeStage: null, ft: '', inch: '', weightLb: '' };
  photo = null;
  finishing = false;
  if (!el.dataset.wired) {
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKey);
    el.dataset.wired = '1';
  }
  paint();
}
