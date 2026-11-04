// Lady_GYM — js/ui/rings.js — rings, sparklines and the coloured body map.
//
// Progress is shown as colour and shape first, numbers second. Daybreak's Shape screen was
// nine screens of bars and paragraphs; here the week is four rings you can read in a glance.

import { esc } from './kit.js';

const TAU = Math.PI * 2;

/**
 * Concentric rings.
 *   rings: [{ pct (0..1, may exceed 1), color (fill), track (soft) }], outermost first
 *   size: px
 */
export function rings(list, { size = 140, stroke = 14, gap = 3, label = '' } = {}) {
  const c = size / 2;
  let out = '';
  list.forEach((r, i) => {
    const radius = c - stroke / 2 - i * (stroke + gap);
    if (radius <= stroke / 2) return;
    const circ = TAU * radius;
    const p = Math.max(0, r.pct || 0);
    const shown = Math.min(p, 1);
    out += '<circle cx="' + c + '" cy="' + c + '" r="' + radius.toFixed(2) + '" fill="none" stroke="' +
      (r.track || 'var(--fill)') + '" stroke-width="' + stroke + '"/>';
    if (shown > 0) {
      out += '<circle class="ring-arc" cx="' + c + '" cy="' + c + '" r="' + radius.toFixed(2) + '" fill="none" stroke="' +
        r.color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' +
        (circ * shown).toFixed(1) + ' ' + circ.toFixed(1) + '" transform="rotate(-90 ' + c + ' ' + c + ')"' +
        ' style="--len:' + circ.toFixed(1) + '"/>';
    }
    if (p >= 1) {
      // a small glint at the start of a closed ring, like the end cap passing over
      out += '<circle cx="' + c + '" cy="' + (c - radius).toFixed(2) + '" r="' + (stroke / 2 - 1.5) +
        '" fill="#fff" opacity=".35"/>';
    }
  });
  return '<svg class="rings" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size +
    '" role="img" aria-label="' + esc(label) + '">' + out + '</svg>';
}

/** One ring with a number in the middle. */
export function ringStat(pct, color, { size = 64, stroke = 8, text = '', label = '' } = {}) {
  return '<span class="ring-stat" style="width:' + size + 'px;height:' + size + 'px">' +
    rings([{ pct, color, track: 'var(--fill)' }], { size, stroke, label }) +
    '<span class="ring-stat-text">' + esc(text) + '</span></span>';
}

/** A soft filled sparkline. values: numbers (nulls skipped). */
export function sparkline(values, { color = 'var(--pink-fill)', width = 120, height = 36, fill = true } = {}) {
  const v = values.map(Number).filter(Number.isFinite);
  if (v.length < 2) return '';
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const step = width / (v.length - 1);
  const pts = v.map((y, i) => [i * step, height - 4 - ((y - min) / span) * (height - 8)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ' L' + width + ' ' + height + ' L0 ' + height + ' Z';
  const last = pts[pts.length - 1];
  const id = 'sp' + Math.random().toString(36).slice(2, 8);
  return '<svg class="spark" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height +
    '" aria-hidden="true">' +
    (fill ? '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color +
      '" stop-opacity=".35"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + id + ')"/>' : '') +
    '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3.4" fill="' + color + '"/>' +
    '</svg>';
}

/** A simple line chart with dated points, for measurements. */
export function lineChart(points, { color = 'var(--teal-fill)', height = 140, unit = '' } = {}) {
  const v = points.filter((p) => Number.isFinite(p.y));
  if (v.length < 2) return '';
  const W = 320;
  const H = height;
  const pad = { l: 8, r: 8, t: 14, b: 20 };
  const min = Math.min(...v.map((p) => p.y));
  const max = Math.max(...v.map((p) => p.y));
  const span = max - min || 1;
  const x = (i) => pad.l + (i / (v.length - 1)) * (W - pad.l - pad.r);
  const y = (val) => pad.t + (1 - (val - min) / span) * (H - pad.t - pad.b);
  const d = v.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.y).toFixed(1)).join(' ');
  const id = 'lc' + Math.random().toString(36).slice(2, 8);
  return '<svg class="linechart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Trend">' +
    '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + color +
    '" stop-opacity=".28"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + d + ' L' + x(v.length - 1).toFixed(1) + ' ' + (H - pad.b) + ' L' + pad.l + ' ' + (H - pad.b) +
    ' Z" fill="url(#' + id + ')"/>' +
    '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
    v.map((p, i) => '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.y).toFixed(1) + '" r="3.2" fill="' + color + '"/>').join('') +
    '</svg>' +
    '<div class="linechart-axis"><span>' + esc(v[0].label || '') + '</span><span>' + esc(v[v.length - 1].label || '') + '</span></div>';
}

/* ------------------------------------------------------------------ body map */

// Front and back silhouettes with named regions. Each region fills with its colour at an
// opacity set by how close that area is to its weekly target.
const REGIONS = {
  front: {
    delts: 'M27 33c-4 1-7 4-7 9l1 5 6-2 3-9Zm26 0c4 1 7 4 7 9l-1 5-6-2-3-9Z',
    chest: 'M31 34h18c2 3 2 8 0 11H31c-2-3-2-8 0-11Z',
    biceps: 'M21 48l5-1 1 13-5 1Zm38 0l-5-1-1 13 5 1Z',
    core: 'M32 47h16l1 22H31Z',
    quads: 'M31 72h8l-1 30h-6Zm18 0h-8l1 30h6Z',
    gluteMed: 'M29 66l3 2-1 8-3-1Zm22 0l-3 2 1 8 3-1Z',
    calves: 'M32 108h5l-1 22h-3Zm16 0h-5l1 22h3Z',
  },
  back: {
    delts: 'M27 33c-4 1-7 4-7 9l1 5 6-2 3-9Zm26 0c4 1 7 4 7 9l-1 5-6-2-3-9Z',
    back: 'M31 33h18l2 22-11 6-11-6Z',
    triceps: 'M21 48l5-1 1 13-5 1Zm38 0l-5-1-1 13 5 1Z',
    gluteMax: 'M30 63h20l1 12c-4 3-7 3-10 1-3 2-6 2-10-1Z',
    gluteMed: 'M28 61l3 1-1 8-3-2Zm24 0l-3 1 1 8 3-2Z',
    hamstrings: 'M31 78h8l-1 25h-6Zm18 0h-8l1 25h6Z',
    calves: 'M32 108h5l-1 22h-3Zm16 0h-5l1 22h3Z',
  },
};

const SILHOUETTE =
  '<circle cx="40" cy="14" r="9"/>' +
  '<path d="M36 22h8v6h-8Z"/>' +
  '<path d="M27 30h26c5 0 9 4 9 9l2 24c0 2-3 3-4 1l-3-18-1 18c2 6 3 12 2 18l-2 28 1 22c0 3-6 3-6 0l-2-24-2-26h-2l-2 26-2 24c0 3-6 3-6 0l1-22-2-28c-1-6 0-12 2-18l-1-18-3 18c-1 2-4 1-4-1l2-24c0-5 4-9 9-9Z"/>';

/**
 * shape: weeklyShapeMap(...).targets — {key: {done, target, label}}
 * colorFor(key) -> css colour
 */
export function bodyMap(shape, colorFor) {
  const view = (side) => {
    const regions = REGIONS[side];
    let out = '';
    for (const [key, d] of Object.entries(regions)) {
      const t = shape && shape[key];
      const pct = t && t.target ? Math.min(1, t.done / t.target) : 0;
      const op = t ? (0.18 + pct * 0.82).toFixed(2) : 0.12;
      out += '<path d="' + d + '" fill="' + colorFor(key) + '" opacity="' + op + '"><title>' +
        esc(t ? t.label + ': ' + Math.round(pct * 100) + '%' : key) + '</title></path>';
    }
    return '<svg viewBox="0 0 80 140" class="bodymap-fig" role="img" aria-label="' + side + ' view">' +
      '<g fill="var(--fill-2)">' + SILHOUETTE + '</g>' + out + '</svg>';
  };
  return '<div class="bodymap"><figure>' + view('front') + '<figcaption>Front</figcaption></figure>' +
    '<figure>' + view('back') + '<figcaption>Back</figcaption></figure></div>';
}
