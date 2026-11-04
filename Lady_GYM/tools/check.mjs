// Lady_GYM — tools/check.mjs — the pre-ship checks: contrast, offline cache, versions, pictures, engine.
//
//   node tools/check.mjs
//
// Exits non-zero on any failure. Daybreak shipped a palette that failed WCAG AA (its links
// looked "greyed out"); this is how Lady_GYM makes sure a bright palette is still readable.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
const fail = (msg) => { failures++; console.log('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);

/* ------------------------------------------------------------------ contrast */

function lum(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function tokens(block) {
  const out = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\b/g)) out[m[1]] = m[2];
  return out;
}

const css = readFileSync(join(ROOT, 'css/tokens.css'), 'utf8');
const lightBlock = css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)'));
const darkBlock = css.slice(css.indexOf(':root[data-theme="dark"]'));
const light = tokens(lightBlock);
const dark = { ...light, ...tokens(darkBlock) };

console.log('Contrast (WCAG AA: 4.5 body text, 3.0 large/bold)');
for (const [name, T] of [['light', light], ['dark', dark]]) {
  const grounds = { bg: T.bg, card: T.card, 'card-2': T['card-2'] };
  const texts = ['label', 'label-2', 'label-3', 'brand', 'pink-ink', 'violet-ink', 'teal-ink', 'orange-ink',
    'blue-ink', 'sun-ink', 'mint-ink', 'red-ink'];
  let worst = 99;
  for (const t of texts) {
    for (const [g, gv] of Object.entries(grounds)) {
      const r = ratio(T[t], gv);
      worst = Math.min(worst, r);
      if (r < 4.5) fail(name + ': --' + t + ' on --' + g + ' is ' + r.toFixed(2));
    }
  }
  // chips and tinted rows: ink on its own soft tint
  for (const c of ['pink', 'violet', 'teal', 'orange', 'blue', 'sun', 'mint', 'red']) {
    const r = ratio(T[c + '-ink'], T[c + '-soft']);
    worst = Math.min(worst, r);
    if (r < 4.5) fail(name + ': --' + c + '-ink on --' + c + '-soft is ' + r.toFixed(2));
  }
  const rb = ratio(T.brand, T['brand-soft']);
  if (rb < 4.5) fail(name + ': --brand on --brand-soft is ' + rb.toFixed(2));
  ok(name + ' theme: every text token clears AA (worst ' + worst.toFixed(2) + ')');
}

// White text on coloured surfaces: buttons, hero cards, tiles.
const { THEMES } = await import('../js/art/scenes.js');
const WHITE = '#FFFFFF';
const whiteOn = {
  'primary button (start)': '#E1126B', 'primary button (end)': '#C2117A',
  'mint "good" button': light['mint-ink'],
};
for (const [k, t] of Object.entries(THEMES)) { whiteOn['hero ' + k + ' (start)'] = t.da; whiteOn['hero ' + k + ' (end)'] = t.db; }
const deepSunrise = css.match(/--grad-sunrise-deep:\s*linear-gradient\([^#]*(#[0-9A-Fa-f]{6})[^#]*(#[0-9A-Fa-f]{6})/);
if (deepSunrise) { whiteOn['report hero (start)'] = deepSunrise[1]; whiteOn['report hero (end)'] = deepSunrise[2]; }
let worstWhite = 99;
for (const [k, v] of Object.entries(whiteOn)) {
  if (!v) { fail('no colour for ' + k); continue; }
  const r = ratio(WHITE, v);
  worstWhite = Math.min(worstWhite, r);
  if (r < 4.5) fail('white text on ' + k + ' ' + v + ' is ' + r.toFixed(2));
}
ok('white text on every hero, tile and button background clears AA (worst ' + worstWhite.toFixed(2) + ')');

/* ------------------------------------------------------------------ offline cache + versions */

console.log('Offline cache');
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const listed = new Set([...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]));
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [relative(ROOT, p).split('\\').join('/')];
  });
}
const shipped = [...walk(join(ROOT, 'js')), ...walk(join(ROOT, 'css')), 'index.html', 'get.html', 'manifest.json'];
const missing = shipped.filter((f) => !listed.has(f));
if (missing.length) fail('not precached: ' + missing.join(', '));
else ok('all ' + shipped.length + ' code files are precached for offline use');
for (const f of listed) {
  if (f === '') continue;
  try { statSync(join(ROOT, f)); } catch (_) { fail('sw.js lists a file that does not exist: ' + f); }
}
const { APP_VERSION } = await import('../js/version.js');
const swVersion = (sw.match(/const CACHE = 'lady-gym-([^']+)'/) || [])[1];
if (swVersion !== APP_VERSION) fail('sw.js cache is ' + swVersion + ' but js/version.js is ' + APP_VERSION);
else ok('service worker cache matches app version ' + APP_VERSION);

/* ------------------------------------------------------------------ pictures */

console.log('Pictures');
const { EXERCISES } = await import('../js/data/exercises.js');
const { diagramKeyFor } = await import('../js/data/info.js');
const { figureSvg } = await import('../js/art/figure.js');
const { CLASS_FORMATS } = await import('../js/data/classes.js');
const { classArt, CLASS_ART } = await import('../js/art/scenes.js');
const unpictured = EXERCISES.filter((e) => !diagramKeyFor(e) || !figureSvg(diagramKeyFor(e)).includes('fig-woman'));
if (unpictured.length) fail(unpictured.length + ' exercises without an illustrated woman: ' + unpictured.slice(0, 5).map((e) => e.id).join(', '));
else ok('all ' + EXERCISES.length + ' exercises have an illustrated woman');
const noArt = CLASS_FORMATS.filter((f) => !CLASS_ART[f.id] || !classArt(f.id).includes('<svg'));
if (noArt.length) fail('classes without art: ' + noArt.map((f) => f.id).join(', '));
else ok('all ' + CLASS_FORMATS.length + ' club class formats have their own illustration');

/* ------------------------------------------------------------------ engine */

console.log('Engine');
const { buildWeek } = await import('../js/engine/scheduler.js');
const { dialsFor } = await import('../js/engine/lifestage.js');
const { programFor } = await import('../js/data/programs.js');
const { planFor } = await import('../js/engine/sessionplan.js');
let combos = 0;
for (const lifeStage of ['cycling', 'transition', 'post']) {
  for (const experience of ['new', 'returning', 'experienced']) {
    const profile = { id: 'me', name: 'Test', lifeStage, experience, goal: 'recomp', pelvicFloor: 'unknown', startedOn: '2026-10-01' };
    profile.programId = programFor(profile).id;
    const week = buildWeek(profile, [], dialsFor(profile), '2026-11-02');
    if (week.length !== 7) fail(lifeStage + '/' + experience + ': week has ' + week.length + ' days');
    for (const d of week) {
      if (!d.session || d.session.type === 'recovery' || d.session.type === 'conditioning') continue;
      const p = planFor(profile, d.session);
      if (!p.items.length) fail(lifeStage + '/' + experience + ' ' + d.dayName + ': empty plan');
      if (!(Number(d.session.estMinutes) > 0)) fail(lifeStage + '/' + experience + ' ' + d.dayName + ': minutes not a number');
    }
    combos++;
  }
}
ok('every life stage × experience builds a full week (' + combos + ' combinations)');

console.log(failures ? '\n' + failures + ' problem(s).' : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
