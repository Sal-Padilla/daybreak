// Lady_GYM — js/art/scenes.js — the big pictures: classes, workouts, welcome, empty states.
//
// Every class at the club gets its own colour and its own illustration, so the Classes tab
// reads like a timetable of pictures rather than a list of names. Poses are authored by joint
// position and drawn with the same renderer as the exercise library, so the whole app shares
// one illustrated cast.

import { poseMarkup, castFor, figureSvg } from './figure.js';

// Labels can be a stored session's name (a restored backup), so they are escaped like figure.js's.
function escAttr(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ------------------------------------------------------------------ poses (100 × 116 frame) */

const POSES = {
  tree: {
    head: [50, 18], neck: [50, 27], hip: [50, 57],
    arms: [[[50, 31], [43, 16], [50, 5]], [[50, 31], [57, 16], [50, 5]]],
    legs: [[[50, 57], [50, 78], [50, 98], [57, 98]], [[50, 57], [64, 69], [52, 75], [53, 77]]],
  },
  warrior: {
    head: [52, 23], neck: [52, 32], hip: [52, 61],
    arms: [[[52, 35], [71, 35], [90, 34]], [[52, 35], [33, 35], [14, 34]]],
    legs: [[[52, 61], [72, 72], [74, 98], [82, 98]], [[52, 61], [38, 80], [24, 98], [18, 96]]],
  },
  star: {
    head: [50, 15], neck: [50, 24], hip: [50, 53],
    arms: [[[50, 28], [62, 16], [72, 5]], [[50, 28], [38, 16], [28, 5]]],
    legs: [[[50, 53], [60, 72], [68, 90], [75, 91]], [[50, 53], [40, 72], [32, 90], [25, 91]]],
  },
  cycle: {
    head: [66, 30], neck: [59, 38], hip: [40, 53],
    arms: [[[58, 40], [67, 48], [76, 50]], [[58, 40], [65, 47], [73, 49]]],
    legs: [[[40, 53], [57, 61], [53, 80], [60, 82]], [[40, 53], [52, 68], [44, 85], [51, 87]]],
  },
  hundred: {
    head: [20, 72], neck: [28, 77], hip: [52, 88],
    arms: [[[30, 78], [42, 84], [55, 83]], [[30, 79], [42, 86], [55, 86]]],
    legs: [[[52, 88], [66, 76], [80, 63], [84, 58]], [[52, 88], [67, 78], [81, 66], [85, 61]]],
  },
  swim: {
    head: [72, 58], neck: [64, 61], hip: [38, 64],
    arms: [[[63, 61], [75, 52], [88, 51]], [[61, 61], [51, 52], [45, 45]]],
    legs: [[[38, 64], [26, 63], [14, 61], [9, 58]], [[38, 64], [26, 67], [15, 69], [10, 72]]],
  },
  punch: {
    head: [46, 24], neck: [47, 33], hip: [44, 62],
    arms: [[[47, 36], [64, 36], [80, 34]], [[47, 36], [53, 46], [58, 33]]],
    legs: [[[44, 62], [55, 80], [57, 98], [65, 98]], [[44, 62], [35, 80], [28, 98], [35, 98]]],
  },
  kick: {
    head: [36, 24], neck: [39, 33], hip: [44, 61],
    arms: [[[40, 36], [47, 45], [52, 33]], [[40, 36], [35, 46], [41, 31]]],
    legs: [[[44, 61], [62, 53], [81, 45], [88, 42]], [[44, 61], [44, 80], [44, 98], [51, 98]]],
  },
  fold: {
    head: [66, 69], neck: [58, 72], hip: [33, 91],
    arms: [[[56, 73], [66, 82], [77, 88]], [[56, 74], [65, 84], [75, 90]]],
    legs: [[[33, 91], [53, 93], [74, 93], [77, 86]], [[33, 91], [53, 95], [73, 95], [76, 89]]],
  },
  dance: {
    head: [50, 17], neck: [51, 26], hip: [47, 55],
    arms: [[[51, 30], [62, 19], [67, 5]], [[51, 30], [38, 36], [27, 29]]],
    legs: [[[47, 55], [60, 70], [61, 90], [68, 93]], [[47, 55], [44, 77], [44, 98], [51, 98]]],
  },
  barre: {
    head: [50, 24], neck: [50, 33], hip: [50, 62],
    arms: [[[50, 37], [64, 44], [79, 46]], [[50, 37], [40, 26], [45, 13]]],
    legs: [[[50, 62], [62, 76], [58, 95], [63, 91]], [[50, 62], [39, 76], [43, 95], [38, 91]]],
  },
  squatBar: {
    head: [50, 33], neck: [50, 42], hip: [43, 69],
    arms: [[[50, 45], [41, 46], [42, 39]], [[50, 45], [59, 47], [58, 39]]],
    legs: [[[43, 69], [61, 75], [57, 98], [65, 98]], [[43, 69], [59, 78], [54, 98], [61, 98]]],
  },
  ropes: {
    head: [36, 35], neck: [39, 44], hip: [32, 69],
    arms: [[[39, 47], [49, 57], [61, 59]], [[39, 47], [48, 59], [60, 62]]],
    legs: [[[32, 69], [47, 78], [43, 98], [51, 98]], [[32, 69], [24, 83], [22, 98], [29, 98]]],
  },
  run: {
    head: [57, 18], neck: [55, 27], hip: [48, 56],
    arms: [[[55, 31], [65, 40], [73, 32]], [[55, 31], [45, 41], [37, 47]]],
    legs: [[[48, 56], [64, 63], [59, 82], [67, 84]], [[48, 56], [40, 76], [28, 90], [33, 95]]],
  },
  curl: {
    head: [50, 20], neck: [50, 29], hip: [50, 58],
    arms: [[[50, 33], [53, 47], [62, 38]], [[50, 33], [47, 47], [40, 38]]],
    legs: [[[50, 58], [53, 78], [53, 98], [60, 98]], [[50, 58], [47, 78], [47, 98], [54, 98]]],
  },
  press: {
    head: [50, 22], neck: [50, 31], hip: [50, 60],
    arms: [[[50, 34], [60, 24], [62, 8]], [[50, 34], [40, 24], [38, 8]]],
    legs: [[[50, 60], [55, 80], [56, 98], [63, 98]], [[50, 60], [45, 80], [44, 98], [51, 98]]],
  },
  kb: {
    head: [58, 30], neck: [54, 38], hip: [40, 60],
    arms: [[[54, 41], [56, 56], [52, 70]], [[54, 41], [54, 57], [50, 71]]],
    legs: [[[40, 60], [55, 74], [52, 98], [60, 98]], [[40, 60], [47, 79], [42, 98], [50, 98]]],
  },
  wave: {
    head: [50, 20], neck: [50, 29], hip: [50, 58],
    arms: [[[50, 33], [60, 22], [70, 12]], [[50, 33], [44, 47], [46, 58]]],
    legs: [[[50, 58], [53, 78], [53, 98], [60, 98]], [[50, 58], [47, 78], [46, 98], [53, 98]]],
  },
};

/* ------------------------------------------------------------------ props */

const INK = '#3D3566';

const PROPS = {
  bike: () =>
    '<g stroke="' + INK + '" stroke-width="3.4" stroke-linecap="round" fill="none">' +
      '<line x1="40" y1="56" x2="47" y2="99"/><line x1="76" y1="51" x2="80" y2="88"/>' +
      '<line x1="47" y1="80" x2="78" y2="80"/><line x1="28" y1="100" x2="90" y2="100"/>' +
      '<line x1="33" y1="55" x2="46" y2="55" stroke-width="4.4"/>' +
      '<line x1="71" y1="49" x2="80" y2="49" stroke-width="4"/>' +
    '</g>' +
    '<circle cx="80" cy="88" r="11" fill="none" stroke="' + INK + '" stroke-width="3.4"/>' +
    '<circle cx="80" cy="88" r="3" fill="' + INK + '"/>',
  mat: (c) => '<rect x="6" y="94" width="88" height="6" rx="3" fill="' + c + '"/>',
  water: () => '',
  gloves: () =>
    '<circle cx="81" cy="34" r="5.2" fill="#E5484D"/><circle cx="58" cy="33" r="5" fill="#E5484D"/>',
  gloves2: () =>
    '<circle cx="52" cy="33" r="4.8" fill="#E5484D"/><circle cx="41" cy="31" r="4.8" fill="#E5484D"/>',
  barre: () =>
    '<g stroke="#B9905A" stroke-linecap="round"><line x1="74" y1="46" x2="100" y2="46" stroke-width="3.6"/>' +
    '<line x1="94" y1="46" x2="94" y2="100" stroke-width="3"/></g>',
  barbell: () =>
    '<line x1="18" y1="39" x2="82" y2="39" stroke="' + INK + '" stroke-width="3.2" stroke-linecap="round"/>' +
    '<rect x="16" y="29" width="7" height="20" rx="2.5" fill="#FF3D7F"/><rect x="77" y="29" width="7" height="20" rx="2.5" fill="#FF3D7F"/>',
  ropes: () =>
    '<path d="M61 59 q6 -8 12 0 t12 0 t12 2" stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<path d="M60 62 q6 8 12 0 t12 0 t12 4" stroke="' + INK + '" stroke-width="3" fill="none" stroke-linecap="round"/>',
  dumbbells: () =>
    '<g fill="' + INK + '"><rect x="58" y="34" width="9" height="5" rx="2"/><rect x="35" y="34" width="9" height="5" rx="2"/></g>',
  dumbbellsUp: () =>
    '<g fill="' + INK + '"><rect x="56" y="4" width="12" height="5" rx="2"/><rect x="32" y="4" width="12" height="5" rx="2"/></g>',
  kettlebell: () =>
    '<path d="M47 70 a4 4 0 0 1 8 0" stroke="' + INK + '" stroke-width="2.4" fill="none"/>' +
    '<circle cx="51" cy="77" r="6.5" fill="' + INK + '"/>',
  notes: () =>
    '<g fill="#FF3D7F"><circle cx="82" cy="24" r="3"/><rect x="84" y="10" width="1.8" height="14"/>' +
    '<circle cx="18" cy="52" r="2.6" fill="#8E5CF7"/><rect x="20" y="40" width="1.6" height="12" fill="#8E5CF7"/></g>',
  sweat: () =>
    '<g fill="#2E9BFF" opacity=".7"><path d="M78 20 q3 5 0 7 q-3 -2 0 -7Z"/><path d="M22 26 q3 5 0 7 q-3 -2 0 -7Z"/></g>',
  none: () => '',
};

/* ------------------------------------------------------------------ themes */

// Each theme: two gradient stops, an accent for the sun/blob, and a prop colour.
// Each theme: two bright gradient stops (a, b) for pictures, a blob tint, a mat colour, and two
// DEEP stops (da, db) for any surface that carries white text — bright yellow or mint under
// white type fails WCAG, so text surfaces use the deep pair. tools/check.mjs verifies them.
export const THEMES = {
  pink:   { a: '#FF5C93', b: '#FF9A7A', da: '#D6185E', db: '#B8145E', blob: '#FFD1E0', mat: '#FFE1EB', label: 'Pink' },
  violet: { a: '#8E5CF7', b: '#C07CFF', da: '#6A3BD8', db: '#7E3FCF', blob: '#E4D6FF', mat: '#EBDDFF', label: 'Violet' },
  teal:   { a: '#11B5A4', b: '#55D6C2', da: '#00796B', db: '#00695F', blob: '#C7F3EA', mat: '#D5F7F0', label: 'Teal' },
  orange: { a: '#FF7A3D', b: '#FFB347', da: '#C2410C', db: '#B23A0A', blob: '#FFE2C4', mat: '#FFE9D2', label: 'Orange' },
  blue:   { a: '#2E8BFF', b: '#5CC8FF', da: '#1A5FC9', db: '#1556B5', blob: '#D3EAFF', mat: '#DDF0FF', label: 'Blue' },
  berry:  { a: '#D6246E', b: '#FF6F91', da: '#B0144F', db: '#C21A5B', blob: '#FFD0DF', mat: '#FFE0EA', label: 'Berry' },
  sun:    { a: '#FFAA00', b: '#FFD54A', da: '#A85A00', db: '#9A5200', blob: '#FFF0BF', mat: '#FFF4CF', label: 'Sun' },
  mint:   { a: '#22C17A', b: '#7BE3A8', da: '#137A45', db: '#0F6E3E', blob: '#D3F7E2', mat: '#DDF8E8', label: 'Mint' },
  lilac:  { a: '#B05CF7', b: '#FF8AD8', da: '#8A2BB8', db: '#A3228F', blob: '#F2D9FF', mat: '#F6E3FF', label: 'Lilac' },
};

/* ------------------------------------------------------------------ class formats */

// formatId -> { pose, prop, theme }. Anything unknown falls back to the HIIT star.
const CLASS_ART = {
  'hiit':                            { pose: 'star',     prop: 'sweat',     theme: 'orange' },
  'hiit-express':                    { pose: 'run',      prop: 'sweat',     theme: 'sun' },
  'cycle':                           { pose: 'cycle',    prop: 'bike',      theme: 'blue' },
  'the-battle':                      { pose: 'ropes',    prop: 'ropes',     theme: 'berry' },
  'battle-on-the-turf':              { pose: 'ropes',    prop: 'ropes',     theme: 'mint' },
  'body-pump':                       { pose: 'squatBar', prop: 'barbell',   theme: 'pink' },
  'les-mills-strength-development':  { pose: 'press',    prop: 'dumbbellsUp', theme: 'violet' },
  'mat-pilates':                     { pose: 'hundred',  prop: 'mat',       theme: 'teal' },
  'core-and-more':                   { pose: 'hundred',  prop: 'mat',       theme: 'lilac' },
  'masters-swim':                    { pose: 'swim',     prop: 'water',     theme: 'blue' },
  'box-n-burn':                      { pose: 'punch',    prop: 'gloves',    theme: 'berry' },
  'kickboxing':                      { pose: 'kick',     prop: 'gloves2',   theme: 'orange' },
  'stretch-mobility':                { pose: 'fold',     prop: 'mat',       theme: 'mint' },
  'vinyasa-flow':                    { pose: 'warrior',  prop: 'mat',       theme: 'violet' },
  'hatha-yoga':                      { pose: 'tree',     prop: 'mat',       theme: 'teal' },
  'gentle-yoga':                     { pose: 'fold',     prop: 'mat',       theme: 'lilac' },
  'zumba':                           { pose: 'dance',    prop: 'notes',     theme: 'pink' },
  'barre-strong':                    { pose: 'barre',    prop: 'barre',     theme: 'lilac' },
};

export function classTheme(formatId) {
  const a = CLASS_ART[formatId] || CLASS_ART.hiit;
  return THEMES[a.theme] || THEMES.pink;
}

/* ------------------------------------------------------------------ composition */

let uid = 0;

function sparkle(x, y, s, color, op = 1) {
  const p = (dx, dy) => (x + dx * s).toFixed(1) + ',' + (y + dy * s).toFixed(1);
  return '<path d="M' + p(0, -1) + ' Q' + p(0.18, -0.18) + ' ' + p(1, 0) + ' Q' + p(0.18, 0.18) + ' ' +
    p(0, 1) + ' Q' + p(-0.18, 0.18) + ' ' + p(-1, 0) + ' Q' + p(-0.18, -0.18) + ' ' + p(0, -1) +
    'Z" fill="' + color + '" opacity="' + op + '"/>';
}

/**
 * A full scene: gradient background, sun/blob, sparkles, prop and one woman.
 * Aspect is 200 × 130 by default (fits a card); `square` gives 130 × 130 for thumbnails.
 */
export function sceneSvg({ pose = 'star', prop = 'none', theme = 'pink', castKey = pose, square = false,
  label = '', bare = false } = {}) {
  const t = THEMES[theme] || THEMES.pink;
  const cast = castFor(castKey);
  const id = 'sc' + (++uid);
  const W = square ? 130 : 200;
  const H = 130;
  const fx = square ? 15 : 70;            // where the 100-wide pose frame sits
  const fy = 8;
  const P = POSES[pose] || POSES.star;
  const blobX = square ? 92 : 150;

  const bg =
    '<defs>' +
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="' + t.a + '"/><stop offset="1" stop-color="' + t.b + '"/>' +
      '</linearGradient>' +
    '</defs>' +
    (bare ? '' : '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'g)"/>') +
    '<circle cx="' + blobX + '" cy="40" r="44" fill="' + t.blob + '" opacity=".38"/>' +
    '<circle cx="' + (square ? 18 : 30) + '" cy="118" r="38" fill="#fff" opacity=".14"/>' +
    sparkle(square ? 20 : 34, 26, 6, '#fff', 0.9) +
    sparkle(square ? 112 : 182, 92, 4.5, '#fff', 0.75) +
    sparkle(square ? 104 : 120, 16, 3.2, '#fff', 0.6) +
    '<ellipse cx="' + (fx + 50) + '" cy="' + (fy + 101) + '" rx="40" ry="4" fill="rgba(40,20,70,.16)"/>';

  const propFn = PROPS[prop] || PROPS.none;
  const backProp = prop === 'water' ? '' : propFn(t.mat);
  const frontProp = prop === 'water' ? propFn(t.mat) : '';
  let fig = '<g transform="translate(' + fx + ' ' + fy + ')">' + backProp + poseMarkup(P, cast) + frontProp + '</g>';
  if (prop === 'water') {
    // Full-width waves over her lower half, drawn at scene scale rather than in her frame.
    const wave = (y, op) => {
      let d = 'M0 ' + y;
      for (let x = 0; x < W; x += 20) d += ' q5 -4 10 0 t10 0';
      return '<path d="' + d + ' V' + H + ' H0Z" fill="#fff" opacity="' + op + '"/>';
    };
    fig += wave(fy + 68, 0.30) + wave(fy + 75, 0.30);
  }

  return '<svg class="scene" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" ' +
    'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + escAttr(label || 'Illustration') + '">' +
    bg + fig + '</svg>';
}

export function classArt(formatId, opts = {}) {
  const a = CLASS_ART[formatId] || CLASS_ART.hiit;
  return sceneSvg({ ...a, castKey: formatId, square: !!opts.square, label: opts.label || '', bare: !!opts.bare });
}

/* ------------------------------------------------------------------ workouts */

// Session type -> theme and pose for the hero, when there is no exercise picture to use.
const WORKOUT_ART = {
  lower:          { theme: 'pink',   pose: 'squatBar', prop: 'barbell' },
  'lower-heavy':  { theme: 'berry',  pose: 'kb',       prop: 'kettlebell' },
  upper:          { theme: 'violet', pose: 'press',    prop: 'dumbbellsUp' },
  full:           { theme: 'orange', pose: 'curl',     prop: 'none' },
  conditioning:   { theme: 'sun',    pose: 'run',      prop: 'sweat' },
  recovery:       { theme: 'mint',   pose: 'wave',     prop: 'none' },
  class:          { theme: 'blue',   pose: 'dance',    prop: 'notes' },
  rest:           { theme: 'lilac',  pose: 'fold',     prop: 'mat' },
};

export function workoutTheme(type) {
  const a = WORKOUT_ART[type] || WORKOUT_ART.full;
  return { ...(THEMES[a.theme] || THEMES.pink), key: a.theme };
}

/**
 * The hero picture for a workout. If the first exercise has an illustration, she is the
 * woman in the picture (finish pose) — so the card shows what the session actually starts
 * with. Otherwise a pose for the session type.
 */
export function workoutArt(type, firstDiagramKey, opts = {}) {
  const a = WORKOUT_ART[type] || WORKOUT_ART.full;
  const t = THEMES[a.theme] || THEMES.pink;
  if (firstDiagramKey) {
    const fig = figureSvg(firstDiagramKey, { frame: 'finish', labels: false, panel: false });
    if (fig) {
      const id = 'wa' + (++uid);
      const inner = fig.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
      return '<svg class="scene" viewBox="0 0 200 130" preserveAspectRatio="xMidYMid slice" ' +
        'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + escAttr(opts.label || 'Workout') + '">' +
        '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="' + t.a + '"/><stop offset="1" stop-color="' + t.b + '"/></linearGradient></defs>' +
        (opts.bare ? '' : '<rect width="200" height="130" fill="url(#' + id + ')"/>') +
        '<circle cx="150" cy="44" r="46" fill="' + t.blob + '" opacity=".4"/>' +
        '<circle cx="28" cy="120" r="40" fill="#fff" opacity=".13"/>' +
        sparkle(30, 26, 6, '#fff', 0.9) + sparkle(184, 96, 4.5, '#fff', 0.7) +
        '<g transform="translate(80 10) scale(1.04)"><svg x="-105" y="0" width="210" height="116" viewBox="105 0 105 116" overflow="visible">' +
        inner + '</svg></g></svg>';
    }
  }
  return sceneSvg({ ...a, castKey: type, label: opts.label || '', bare: !!opts.bare });
}

/** CSS background for a card that sits behind a bare scene, so picture and card are one surface. */
export function themeBg(theme) {
  const t = typeof theme === 'string' ? (THEMES[theme] || THEMES.pink) : theme;
  return 'linear-gradient(160deg,' + t.da + ' 0%,' + t.db + ' 100%)';
}

/* ------------------------------------------------------------------ welcome & empty states */

/** Three women on one sunrise: lifting, flowing, cycling. The first thing anyone sees. */
export function welcomeArt() {
  const id = 'wl' + (++uid);
  const fig = (pose, key, x, y, s, prop) =>
    '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' + (prop ? PROPS[prop]('#FFE1EB') : '') +
    poseMarkup(POSES[pose], castFor(key)) + '</g>';
  return '<svg class="scene" viewBox="0 0 360 300" xmlns="http://www.w3.org/2000/svg" role="img" ' +
    'aria-label="Three women training: one pressing dumbbells, one in a yoga pose, one dancing">' +
    '<defs>' +
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#FF5C93"/><stop offset=".55" stop-color="#FF8A6B"/><stop offset="1" stop-color="#FFC36B"/>' +
      '</linearGradient>' +
      '<radialGradient id="' + id + 's" cx=".5" cy=".5" r=".5">' +
        '<stop offset="0" stop-color="#FFF6C9"/><stop offset="1" stop-color="#FFE07A"/>' +
      '</radialGradient>' +
    '</defs>' +
    '<rect width="360" height="300" fill="url(#' + id + 'g)"/>' +
    '<circle cx="180" cy="150" r="88" fill="url(#' + id + 's)" opacity=".92"/>' +
    '<circle cx="300" cy="40" r="60" fill="#fff" opacity=".10"/>' +
    '<circle cx="40" cy="260" r="80" fill="#fff" opacity=".10"/>' +
    sparkle(52, 52, 9, '#fff', 0.95) + sparkle(312, 120, 7, '#fff', 0.85) + sparkle(250, 34, 5, '#fff', 0.7) +
    sparkle(90, 150, 4, '#fff', 0.6) +
    '<path d="M0 252 Q90 228 180 246 T360 240 V300 H0Z" fill="#fff" opacity=".22"/>' +
    '<ellipse cx="180" cy="262" rx="150" ry="8" fill="rgba(80,20,60,.16)"/>' +
    fig('press', 'welcome-a', 30, 118, 1.3, 'dumbbellsUp') +
    fig('tree', 'welcome-b', 118, 96, 1.5, null) +
    fig('dance', 'welcome-c', 228, 118, 1.3, null) +
    '</svg>';
}

/** A gentle rest-day picture. */
export function restArt(opts = {}) {
  return sceneSvg({ pose: 'fold', prop: 'mat', theme: 'lilac', castKey: 'rest-day', label: 'Stretching on a mat', bare: !!opts.bare });
}

/** Little round avatar illustration for when she has not added a photo. */
export function avatarArt(name) {
  const cast = castFor('avatar-' + (name || ''));
  const id = 'av' + (++uid);    // one per copy: every tab shows an avatar, and the hidden tabs' come first
  return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5C93"/>' +
    '<stop offset="1" stop-color="#FFB37A"/></linearGradient></defs>' +
    '<circle cx="32" cy="32" r="32" fill="url(#' + id + ')"/>' +
    '<circle cx="32" cy="27" r="13" fill="' + cast.hair + '"/>' +
    '<path d="M44 22 q10 8 4 22" stroke="' + cast.hair + '" stroke-width="6" fill="none" stroke-linecap="round"/>' +
    '<circle cx="31" cy="29" r="10.5" fill="' + cast.skin + '"/>' +
    '<path d="M21 25 q8 -9 21 -3" stroke="' + cast.hair + '" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<path d="M12 64 q2 -18 20 -18 q18 0 20 18Z" fill="' + cast.top + '"/>' +
    '</svg>';
}

export { POSES, CLASS_ART };
