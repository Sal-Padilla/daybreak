// Daybreak — tools/check-contrast.mjs — does every colour pairing still clear WCAG AA?
//
// Run: node tools/check-contrast.mjs
// Exits non-zero if anything fails, so it can gate a commit.
//
// This exists because the palette failed AA in a way nobody spotted by looking: the
// terracotta links were 3.65:1 and simply read as disabled. Rocio reported them as
// "greyed out and i cant pick anything". Eyeballing a colour does not catch that.

import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');

/** Pull the `--name:#hex` declarations out of one block of the token file. */
function varsIn(block) {
  const out = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})/g)) out[m[1]] = m[2];
  return out;
}

function blockAfter(marker) {
  const i = css.indexOf(marker);
  if (i < 0) throw new Error('block not found: ' + marker);
  // take everything to the end of that rule
  let depth = 0, started = false, end = i;
  for (let j = i; j < css.length; j++) {
    if (css[j] === '{') { depth++; started = true; }
    else if (css[j] === '}') { depth--; if (started && depth === 0) { end = j; break; } }
  }
  return css.slice(i, end);
}

const light = varsIn(blockAfter(':root{'));
const dark = varsIn(blockAfter(':root[data-theme="dark"]{'));

const rgb = (h) => {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lum = (hex) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const [r, g, b] = rgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const L1 = lum(a), L2 = lum(b);
  return +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05))).toFixed(2);
};

const AA = 4.5;                 // normal text
const AA_UI = 3.0;              // a control's own boundary against what is behind it

let failures = 0;

function check(label, fg, bg, floor = AA) {
  if (!fg || !bg) { console.log('  SKIP ' + label + ' (missing token)'); return; }
  const r = ratio(fg, bg);
  const ok = r >= floor;
  if (!ok) failures++;
  console.log('  ' + (ok ? 'pass' : 'FAIL') + '  ' + String(r).padStart(5) +
    '  (needs ' + floor + ')  ' + label + '  ' + fg + ' on ' + bg);
}

function suite(name, v, grounds, onFill) {
  console.log('\n' + name);
  const fgs = ['--clay-500', '--clay-600', '--plum-700', '--plum-500', '--gold-500',
    '--sage-500', '--rose-500', '--teal-500', '--ink-900', '--ink-500'];
  for (const [gname, g] of Object.entries(grounds)) {
    for (const f of fgs) check(f + ' on ' + gname, v[f], g);
  }
  console.log('  -- labels on filled controls --');
  for (const f of ['--clay-500', '--gold-500', '--sage-500', '--rose-500', '--teal-500']) {
    check('--on-accent on ' + f, onFill, v[f]);
  }
}

suite('LIGHT', light, {
  bg: light['--sand-50'], surface: '#FFFFFF', 'surface-2': light['--sand-100'],
}, light['--on-accent']);

suite('DARK', dark, {
  bg: dark['--sand-50'], surface: dark['--sand-100'], 'surface-2': dark['--sand-200'],
}, dark['--on-accent']);

// Are two pillars actually distinguishable? Luminance contrast is the WRONG tool for
// this — terracotta and teal can share a luminance and still be obviously different
// colours. Perceptual distance is the right question, so: CIE76 deltaE in Lab.
function toLab(hex) {
  let [r, g, b] = rgb(hex).map((v) => v / 255);
  const inv = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  r = inv(r); g = inv(g); b = inv(b);
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722);
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function deltaE(a, b) {
  const A = toLab(a), B = toLab(b);
  return +Math.sqrt((A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2).toFixed(1);
}

// ~2.3 is just-noticeable; 20 is comfortably "these are different colours" for two
// swatches sitting side by side in a legend.
const DE_FLOOR = 20;

console.log('');
console.log('--- the four pillars must read as four colours (CIE76 deltaE) ---');
for (const [name, v] of [['light', light], ['dark', dark]]) {
  const keys = ['--clay-500', '--plum-500', '--teal-500', '--gold-500'];
  const names = ['resistive', 'control', 'cardio', 'shape'];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const d = deltaE(v[keys[i]], v[keys[j]]);
      const ok = d >= DE_FLOOR;
      if (!ok) failures++;
      console.log('  ' + (ok ? 'pass' : 'FAIL') + '  dE ' + String(d).padStart(5) +
        '  (needs ' + DE_FLOOR + ')  ' + name + ' ' + names[i] + ' vs ' + names[j]);
    }
  }
}

console.log('\n' + (failures ? failures + ' FAILURES' : 'all pairings pass'));
process.exit(failures ? 1 : 0);
