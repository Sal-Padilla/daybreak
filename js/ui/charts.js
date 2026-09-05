// Daybreak — js/ui/charts.js — dependency-free inline-SVG charts: sparkline, bar chart, ring gauge, and the Shape Map body diagram.

/* ---------------------------------------------------------------------------
   All functions return an SVG **string**. No DOM, no libraries, no assets.
   Colour comes from CSS custom properties (var(--accent), var(--surface-2), …)
   written into inline `style` attributes, so every chart follows the theme —
   including a live light/dark switch — with no re-render.

   Inline `style` is used rather than presentation attributes because
   `fill="var(--accent)"` is unreliable on older WebKit, while
   `style="fill:var(--accent)"` is not.
--------------------------------------------------------------------------- */

const NS = 'http://www.w3.org/2000/svg';

/** Canonical Shape Map labels — mirrors SHAPE_TARGETS in js/data/exercises.js (contract §4.1). */
const SHAPE_LABELS = Object.freeze({
  gluteMax: 'Glutes',
  gluteMed: 'Side glute/hips',
  hamstrings: 'Hamstrings',
  delts: 'Shoulders',
  back: 'Back',
  triceps: 'Triceps',
  core: 'Core',
  quads: 'Quads',
  chest: 'Chest',
  calves: 'Calves',
  biceps: 'Biceps',
});

const SHAPE_KEYS = Object.freeze(Object.keys(SHAPE_LABELS));

/* --------------------------------- utils --------------------------------- */

let _seq = 0;
function uid(prefix) {
  _seq += 1;
  return `dbk-${prefix}-${_seq.toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function fin(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n;
}

/** One decimal, trailing ".0" dropped (contract §5.3). */
function n1(value) {
  const n = fin(value, 0);
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Two-decimal coordinate, safe for path/point strings. */
function c(n) {
  return String(Math.round(fin(n, 0) * 100) / 100);
}

/** Accepts 0–1 ratios and 0–100 percentages; anything above 1.5 is read as a percentage. */
function asRatio(value) {
  const n = fin(value, 0);
  return n > 1.5 ? n / 100 : n;
}

function pctText(ratio) {
  return `${Math.round(fin(ratio, 0) * 100)}%`;
}

function svgOpen(w, h, ariaLabel, extraStyle) {
  return `<svg xmlns="${NS}" viewBox="0 0 ${c(w)} ${c(h)}" width="${c(w)}" height="${c(h)}" role="img" aria-label="${esc(ariaLabel)}" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto;max-width:${c(w)}px;${extraStyle || ''}">`;
}

/** Small, calm empty state — never throw, never emit NaN. */
function emptyState(w, h, message) {
  const text = message || 'Nothing logged yet';
  const width = Math.max(60, fin(w, 160));
  const height = Math.max(32, fin(h, 44));
  return (
    svgOpen(width, height, text) +
    `<rect x="0.5" y="0.5" width="${c(width - 1)}" height="${c(height - 1)}" rx="10" style="fill:var(--surface-2);stroke:var(--border);stroke-width:1"/>` +
    `<text x="${c(width / 2)}" y="${c(height / 2 + 4.5)}" text-anchor="middle" style="font-family:var(--font-ui);font-size:12.5px;fill:var(--text-dim)">${esc(text)}</text>` +
    `</svg>`
  );
}

/* -------------------------------- sparkline ------------------------------- */

/**
 * Simple trend polyline with the last point marked.
 *
 * @param {number[]} values
 * @param {object} [opts]
 * @param {number} [opts.w=160] viewBox width
 * @param {number} [opts.h=44] viewBox height
 * @param {string} [opts.color='var(--accent)'] line colour (any CSS colour or var())
 * @param {boolean} [opts.fill=false] shade the area under the line
 * @param {string} [opts.label] prefix for the aria-label, e.g. 'Hip thrust'
 * @param {string} [opts.unit] appended to values in the aria-label, e.g. 'lb'
 * @param {string} [opts.emptyLabel]
 * @returns {string} svg
 */
export function sparkline(values, opts = {}) {
  const o = opts || {};
  const w = Math.max(40, fin(o.w, 160));
  const h = Math.max(24, fin(o.h, 44));
  const color = typeof o.color === 'string' && o.color ? o.color : 'var(--accent)';
  const unit = o.unit ? ` ${o.unit}` : '';

  const nums = (Array.isArray(values) ? values : [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));

  if (!nums.length) return emptyState(w, h, o.emptyLabel || 'No trend yet');

  const padX = 5;
  const padY = 6;
  const innerW = Math.max(1, w - padX * 2);
  const innerH = Math.max(1, h - padY * 2);

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min;

  const xAt = (i) => (nums.length === 1 ? w / 2 : padX + (i * innerW) / (nums.length - 1));
  const yAt = (v) => (span === 0 ? padY + innerH / 2 : padY + (1 - (v - min) / span) * innerH);

  const pts = nums.map((v, i) => [xAt(i), yAt(v)]);
  if (pts.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
    return emptyState(w, h, o.emptyLabel || 'No trend yet');
  }

  const first = nums[0];
  const last = nums[nums.length - 1];
  const direction = last > first ? 'up' : last < first ? 'down' : 'flat';
  const aria =
    (o.label ? `${o.label}: ` : '') +
    (nums.length === 1
      ? `single reading, ${n1(last)}${unit}.`
      : `trend over ${nums.length} points, ${direction} from ${n1(first)}${unit} to ${n1(last)}${unit}.`);

  let body = '';

  if (o.fill === true && pts.length > 1) {
    const area =
      `M${c(pts[0][0])},${c(h - padY / 2)} ` +
      pts.map(([x, y]) => `L${c(x)},${c(y)}`).join(' ') +
      ` L${c(pts[pts.length - 1][0])},${c(h - padY / 2)} Z`;
    body += `<path d="${area}" style="fill:${color};fill-opacity:.12;stroke:none"/>`;
  }

  if (pts.length > 1) {
    const line = pts.map(([x, y]) => `${c(x)},${c(y)}`).join(' ');
    body += `<polyline points="${line}" style="fill:none;stroke:${color};stroke-width:2;stroke-linecap:round;stroke-linejoin:round"/>`;
  }

  const [lx, ly] = pts[pts.length - 1];
  body += `<circle cx="${c(lx)}" cy="${c(ly)}" r="3.25" style="fill:${color};stroke:var(--surface);stroke-width:1.5"/>`;

  return svgOpen(w, h, aria) + body + `</svg>`;
}

/* -------------------------------- barChart -------------------------------- */

/**
 * Horizontal bars with a target tick. Bars at or over target use full --accent;
 * bars under target use --accent at reduced opacity. Value labels always shown.
 *
 * @param {{label:string, value:number, target?:number}[]} data
 * @param {object} [opts]
 * @param {number} [opts.w=320]
 * @param {number} [opts.h] only used when horizontal === false
 * @param {boolean} [opts.horizontal=true] false draws vertical columns
 * @param {number} [opts.max] force the scale maximum
 * @param {string} [opts.unit] appended to value labels, e.g. 'sets'
 * @param {string} [opts.label] chart name, used in the aria-label
 * @param {string} [opts.emptyLabel]
 * @returns {string} svg
 */
export function barChart(data, opts = {}) {
  const o = opts || {};
  const w = Math.max(160, fin(o.w, 320));

  const rows = (Array.isArray(data) ? data : [])
    .filter((d) => d && typeof d === 'object')
    .map((d) => ({
      label: String(d.label == null ? '' : d.label),
      value: Math.max(0, fin(d.value, 0)),
      target: Number.isFinite(Number(d.target)) && Number(d.target) > 0 ? Number(d.target) : null,
    }));

  if (!rows.length) return emptyState(w, fin(o.h, 88), o.emptyLabel || 'Nothing logged yet');

  const unit = o.unit ? ` ${o.unit}` : '';
  const scale = (() => {
    const forced = fin(o.max, 0);
    if (forced > 0) return forced;
    const peak = rows.reduce((m, r) => Math.max(m, r.value, r.target || 0), 0);
    return peak > 0 ? peak * 1.08 : 1;
  })();

  const aria =
    (o.label ? `${o.label}. ` : '') +
    rows
      .map((r) => `${r.label} ${n1(r.value)}${r.target != null ? ` of ${n1(r.target)}` : ''}${unit}`)
      .join(', ') +
    '.';

  if (o.horizontal === false) return verticalBars(rows, scale, w, o, aria, unit);

  const rowH = 46;
  const h = rows.length * rowH + 4;
  let body = '';

  rows.forEach((r, i) => {
    const top = i * rowH + 2;
    const onTarget = r.target != null && r.value >= r.target;
    const barW = scale > 0 ? clamp((r.value / scale) * w, 0, w) : 0;
    const drawnW = r.value > 0 ? Math.max(barW, 4) : 0;
    const valueText = `${n1(r.value)}${r.target != null ? ` / ${n1(r.target)}` : ''}${unit}`;
    const rowTitle = `${r.label} ${n1(r.value)}${r.target != null ? ` of ${n1(r.target)}` : ''}${unit}`;

    body += `<g><title>${esc(rowTitle)}</title>`;
    body += `<text x="0" y="${c(top + 12)}" style="font-family:var(--font-ui);font-size:13px;fill:var(--text)">${esc(r.label)}</text>`;
    body += `<text x="${c(w)}" y="${c(top + 12)}" text-anchor="end" style="font-family:var(--font-ui);font-size:13px;font-variant-numeric:tabular-nums;fill:${onTarget ? 'var(--accent)' : 'var(--text-dim)'}">${esc(valueText)}</text>`;
    body += `<rect x="0" y="${c(top + 20)}" width="${c(w)}" height="11" rx="5.5" style="fill:var(--surface-2)"/>`;
    if (drawnW > 0) {
      body += `<rect x="0" y="${c(top + 20)}" width="${c(drawnW)}" height="11" rx="5.5" style="fill:var(--accent);fill-opacity:${onTarget ? '1' : '.45'}"/>`;
    }
    if (r.target != null) {
      const tx = clamp((r.target / scale) * w, 1, w - 1);
      body += `<line x1="${c(tx)}" y1="${c(top + 16)}" x2="${c(tx)}" y2="${c(top + 35)}" style="stroke:var(--text-dim);stroke-width:2;stroke-linecap:round;stroke-opacity:.7"/>`;
    }
    body += `</g>`;
  });

  return svgOpen(w, h, aria) + body + `</svg>`;
}

function verticalBars(rows, scale, w, o, aria, unit) {
  const h = Math.max(140, fin(o.h, 180));
  const labelBand = 34;
  const topBand = 18;
  const plotH = Math.max(20, h - labelBand - topBand);
  const slot = w / rows.length;
  const barW = Math.min(46, Math.max(12, slot * 0.52));
  let body = `<line x1="0" y1="${c(topBand + plotH)}" x2="${c(w)}" y2="${c(topBand + plotH)}" style="stroke:var(--border);stroke-width:1"/>`;

  rows.forEach((r, i) => {
    const cx = slot * i + slot / 2;
    const onTarget = r.target != null && r.value >= r.target;
    const barH = scale > 0 ? clamp((r.value / scale) * plotH, 0, plotH) : 0;
    const drawnH = r.value > 0 ? Math.max(barH, 3) : 0;
    const y = topBand + plotH - drawnH;
    const rowTitle = `${r.label} ${n1(r.value)}${r.target != null ? ` of ${n1(r.target)}` : ''}${unit}`;

    body += `<g><title>${esc(rowTitle)}</title>`;
    body += `<rect x="${c(cx - barW / 2)}" y="${c(topBand)}" width="${c(barW)}" height="${c(plotH)}" rx="6" style="fill:var(--surface-2)"/>`;
    if (drawnH > 0) {
      body += `<rect x="${c(cx - barW / 2)}" y="${c(y)}" width="${c(barW)}" height="${c(drawnH)}" rx="6" style="fill:var(--accent);fill-opacity:${onTarget ? '1' : '.45'}"/>`;
    }
    if (r.target != null) {
      const ty = topBand + plotH - clamp((r.target / scale) * plotH, 0, plotH);
      body += `<line x1="${c(cx - barW / 2 - 3)}" y1="${c(ty)}" x2="${c(cx + barW / 2 + 3)}" y2="${c(ty)}" style="stroke:var(--text-dim);stroke-width:2;stroke-linecap:round;stroke-opacity:.7"/>`;
    }
    body += `<text x="${c(cx)}" y="${c(topBand - 6)}" text-anchor="middle" style="font-family:var(--font-ui);font-size:12.5px;font-variant-numeric:tabular-nums;fill:${onTarget ? 'var(--accent)' : 'var(--text-dim)'}">${esc(n1(r.value))}</text>`;
    body += `<text x="${c(cx)}" y="${c(topBand + plotH + 17)}" text-anchor="middle" style="font-family:var(--font-ui);font-size:12px;fill:var(--text-dim)">${esc(r.label)}</text>`;
    body += `</g>`;
  });

  return svgOpen(w, h, aria) + body + `</svg>`;
}

/* -------------------------------- ringGauge ------------------------------- */

/**
 * Circular progress ring with the percentage in the middle (tabular numerals).
 *
 * @param {number} pct 0–1 ratio (values above 1.5 are read as 0–100 percentages)
 * @param {object} [opts]
 * @param {number} [opts.size=120] square viewBox edge
 * @param {number} [opts.stroke] ring thickness, defaults to size / 10
 * @param {string} [opts.label] caption under the number
 * @param {string} [opts.color='var(--accent)']
 * @param {string} [opts.centerText] overrides the percentage, e.g. '12/14'
 * @param {string} [opts.emptyLabel]
 * @returns {string} svg
 */
export function ringGauge(pct, opts = {}) {
  const o = opts || {};
  const size = Math.max(48, fin(o.size, 120));

  if (!Number.isFinite(Number(pct))) return emptyState(size, size, o.emptyLabel || 'No data yet');

  const ratio = asRatio(pct);
  const shown = clamp(ratio, 0, 1);
  const sw = clamp(fin(o.stroke, size / 10), 3, size / 3);
  const color = typeof o.color === 'string' && o.color ? o.color : 'var(--accent)';
  const cxy = size / 2;
  const r = Math.max(4, cxy - sw / 2 - 1);
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - shown);
  const hasLabel = typeof o.label === 'string' && o.label.length > 0;

  const centerText = typeof o.centerText === 'string' && o.centerText ? o.centerText : pctText(ratio);
  const aria = `${hasLabel ? `${o.label}: ` : ''}${pctText(ratio)} of target.`;

  let body = `<circle cx="${c(cxy)}" cy="${c(cxy)}" r="${c(r)}" style="fill:none;stroke:var(--surface-2);stroke-width:${c(sw)}"/>`;

  if (shown > 0) {
    body +=
      `<circle cx="${c(cxy)}" cy="${c(cxy)}" r="${c(r)}" transform="rotate(-90 ${c(cxy)} ${c(cxy)})" ` +
      `style="fill:none;stroke:${color};stroke-width:${c(sw)};stroke-linecap:round;` +
      `stroke-dasharray:${c(circumference)};stroke-dashoffset:${c(dashOffset)}"/>`;
  }

  const numY = hasLabel ? cxy + size * 0.04 : cxy + size * 0.1;
  body +=
    `<text x="${c(cxy)}" y="${c(numY)}" text-anchor="middle" ` +
    `style="font-family:var(--font-ui);font-size:${c(size * 0.27)}px;font-weight:600;font-variant-numeric:tabular-nums;fill:var(--text)">${esc(centerText)}</text>`;

  if (hasLabel) {
    body +=
      `<text x="${c(cxy)}" y="${c(cxy + size * 0.24)}" text-anchor="middle" ` +
      `style="font-family:var(--font-ui);font-size:${c(Math.max(11, size * 0.11))}px;fill:var(--text-dim)">${esc(o.label)}</text>`;
  }

  return svgOpen(size, size, aria) + body + `</svg>`;
}

/* --------------------------------- bodyMap -------------------------------- */

/* Figure geometry lives in a 120 × 236 local box, drawn once for the left half
   and mirrored for the right. Front and back views share the silhouette; only
   the tinted regions differ. No faces, no detail — a training diagram. */

const FIG_W = 120;
const MIRROR = 'matrix(-1,0,0,1,120,0)';

const P_HEAD =
  'M60,2 C65.5,2 70,7.4 70,14 C70,20.6 65.5,26 60,26 C54.5,26 50,20.6 50,14 C50,7.4 54.5,2 60,2 Z';

const P_TORSO =
  'M54,21.5 L54,31.2 C46.5,33 40.5,38.6 36,47 C31.5,55.5 31,63.5 33.5,72.5 ' +
  'C36.5,84 43,95 45.5,105.5 C47.5,114 40,119 38.5,127 C37,136 42,144 47,149 ' +
  'C51,147.5 56,144.6 60,144.6 C64,144.6 69,147.5 73,149 ' +
  'C78,144 83,136 81.5,127 C80,119 72.5,114 74.5,105.5 C77,95 83.5,84 86.5,72.5 ' +
  'C89,63.5 88.5,55.5 84,47 C79.5,38.6 73.5,33 66,31.2 L66,21.5 Z';

const P_ARM =
  'M38.2,62.5 C33.6,68 30.4,76 29.2,86 C28.2,94 27.8,99 27.6,104 ' +
  'C27.2,116 26.6,132 27.2,145 C27.4,151 28,155.6 29.2,158.4 ' +
  'C30,160.4 33.2,160.6 34.2,158.6 C35.4,156 35.8,151 35.6,145 ' +
  'C35.2,133 36.4,117 37,105 C37.3,100 38.6,95 39.8,87 ' +
  'C40.8,79.6 41,70 40,64 C39.6,62.4 39,62 38.2,62.5 Z';

const P_LEG =
  'M38.6,136 C36.8,148 38.4,166 41,180 C42.6,190 41.2,198 41.4,208 ' +
  'C41.6,216 43.4,224 44,229 C44.3,231.2 45.2,231.8 47.2,231.8 L51,231.8 ' +
  'C52.8,231.8 53.4,230.6 53.2,228.2 C52.6,220 50.8,212 50.6,204 ' +
  'C50.4,194 52.6,186 53.8,176 C55.2,164 57.5,150 57.6,136 Z';

/* Region patches — all authored on the left, mirrored where marked. */
const R_DELT =
  'M36,46.5 C31.5,55.5 31,63.5 33.5,72.5 C36.6,71.4 40,67.6 42,61.6 ' +
  'C43.8,56 45,50.6 44.6,45.6 C41.4,44.2 38.2,44.8 36,46.5 Z';

const R_UPPER_ARM =
  'M37.6,69 C34.4,74 32,80.6 31,89.6 C30.6,94.4 30.4,98 30.2,101.4 ' +
  'C32.4,103.4 35.2,103 36.4,100.6 C36.8,96 37.4,90 38,84 ' +
  'C38.6,78 39,73 38.8,69.6 C38.4,68.2 38,68.2 37.6,69 Z';

const R_CHEST =
  'M46.4,62.6 C43,68 42.2,77 44,85.4 C49,89.6 71,89.6 76,85.4 ' +
  'C77.8,77 77,68 73.6,62.6 C66,59.8 54,59.8 46.4,62.6 Z';

const R_CORE =
  'M47.4,94.4 C44.6,104 44.4,116 46,126 C47.6,136 52.4,143.6 60,146 ' +
  'C67.6,143.6 72.4,136 74,126 C75.6,116 75.4,104 72.6,94.4 ' +
  'C64,91.6 56,91.6 47.4,94.4 Z';

const R_UPPER_BACK =
  'M43,63.6 C39.8,73.6 40.6,86 43.6,96 C47.6,102.4 52.4,104.6 60,104.6 ' +
  'C67.6,104.6 72.4,102.4 76.4,96 C79.4,86 80.2,73.6 77,63.6 ' +
  'C66,60.4 54,60.4 43,63.6 Z';

const R_HIP =
  'M39.5,121 C36.6,129 36.6,139.5 39.2,147.5 C41.8,151 45,150.4 46.2,147 ' +
  'C45.8,138.5 45.2,129.5 45,121 C43,119.4 41,119.6 39.5,121 Z';

const R_GLUTE =
  'M48.5,126 C45.6,134 45.4,144 48,151 C51.6,155 57,155 59.2,150.8 ' +
  'C59.7,142 59.3,133.5 58.4,125.5 C54.6,123.6 51,124 48.5,126 Z';

const R_THIGH =
  'M43,143 C40.6,154 41.6,168 43.8,180 C47,182 50.6,181.2 52.4,178.4 ' +
  'C53.8,166.4 55,152.6 55.6,141 C50.6,139.2 46.6,140 43,143 Z';

const R_CALF =
  'M43,190 C41.8,198 42.2,208 43.4,216.6 C45.4,218.6 48,218.2 49.2,215.8 ' +
  'C50,207 50.4,198 51.2,190 C48.4,188.2 45.4,188.2 43,190 Z';

const BASE_PARTS = [
  { d: P_HEAD, mirror: false },
  { d: P_TORSO, mirror: false },
  { d: P_ARM, mirror: true },
  { d: P_LEG, mirror: true },
];

const VIEWS = [
  {
    caption: 'Front',
    regions: [
      { key: 'delts', d: R_DELT, mirror: true },
      { key: 'chest', d: R_CHEST, mirror: false },
      { key: 'biceps', d: R_UPPER_ARM, mirror: true },
      { key: 'core', d: R_CORE, mirror: false },
      { key: 'gluteMed', d: R_HIP, mirror: true },
      { key: 'quads', d: R_THIGH, mirror: true },
    ],
  },
  {
    caption: 'Back',
    regions: [
      { key: 'delts', d: R_DELT, mirror: true },
      { key: 'back', d: R_UPPER_BACK, mirror: false },
      { key: 'triceps', d: R_UPPER_ARM, mirror: true },
      { key: 'gluteMed', d: R_HIP, mirror: true },
      { key: 'gluteMax', d: R_GLUTE, mirror: true },
      { key: 'hamstrings', d: R_THIGH, mirror: true },
      { key: 'calves', d: R_CALF, mirror: true },
    ],
  },
];

/**
 * Normalises anything the Shape Map engine might hand us into one entry per
 * canonical key. Accepts the full weeklyShapeMap() result, its `targets` map,
 * or a plain `{key: ratio}` object. Missing keys read as 0.
 */
function normalizeShape(shapeData) {
  const raw =
    shapeData && typeof shapeData === 'object'
      ? shapeData.targets && typeof shapeData.targets === 'object'
        ? shapeData.targets
        : shapeData
      : {};

  const out = {};
  for (const key of SHAPE_KEYS) {
    const entry = raw[key];
    let done = 0;
    let target = null;
    let ratio = 0;
    let label = SHAPE_LABELS[key];

    if (typeof entry === 'number' && Number.isFinite(entry)) {
      ratio = asRatio(entry);
    } else if (entry && typeof entry === 'object') {
      done = Math.max(0, fin(entry.done, 0));
      const t = fin(entry.target, 0);
      target = t > 0 ? t : null;
      if (Number.isFinite(Number(entry.pct))) ratio = asRatio(entry.pct);
      else if (target) ratio = done / target;
      if (typeof entry.label === 'string' && entry.label) label = entry.label;
    }

    out[key] = { key, label, done, target, ratio: clamp(ratio, 0, 1) };
  }
  return out;
}

function regionTitle(r) {
  return r.target != null
    ? `${r.label} — ${n1(r.done)} of ${n1(r.target)} sets (${pctText(r.ratio)})`
    : `${r.label} — ${n1(r.done)} sets`;
}

function regionMarkup(region, entry, action) {
  const onTarget = entry.ratio >= 0.999;
  const strokeColor = onTarget ? 'var(--accent)' : 'var(--border)';
  const baseStyle = `fill:var(--surface-2);stroke:${strokeColor};stroke-width:.8;stroke-opacity:${onTarget ? '1' : '.8'};stroke-linejoin:round`;
  const tintStyle = `fill:var(--accent);fill-opacity:${c(Math.round(entry.ratio * 1000) / 1000)};stroke:none`;

  const shapes = (style) =>
    `<path d="${region.d}" style="${style}"/>` +
    (region.mirror ? `<path d="${region.d}" transform="${MIRROR}" style="${style}"/>` : '');

  const actionAttr = action ? ` data-action="${esc(action)}"` : '';
  const cursor = action ? ' style="cursor:pointer"' : '';

  return (
    `<g data-target="${esc(region.key)}"${actionAttr}${cursor}>` +
    `<title>${esc(regionTitle(entry))}</title>` +
    shapes(baseStyle) +
    (entry.ratio > 0 ? shapes(tintStyle) : '') +
    `</g>`
  );
}

/**
 * The Shape Map hero: front and back silhouettes, one region per SHAPE_TARGETS
 * key, tinted from --surface-2 (nothing logged) to --accent (target hit).
 *
 * Each region carries a `data-target` attribute and a `<title>` naming the
 * target and its done/target numbers, so features can make regions tappable and
 * screen readers get real numbers.
 *
 * @param {object} shapeData weeklyShapeMap() result, its `targets` map, or {key: ratio}
 * @param {object} [opts]
 * @param {string} [opts.action] data-action written on every region, for Router delegation
 * @param {boolean} [opts.legend=true] show the tint scale
 * @param {boolean} [opts.captions=true] show 'Front' / 'Back'
 * @param {number} [opts.maxWidth=520] CSS max-width in px
 * @returns {string} svg
 */
export function bodyMap(shapeData, opts = {}) {
  const o = opts || {};
  const entries = normalizeShape(shapeData);
  const action = typeof o.action === 'string' && o.action ? o.action : null;
  const showLegend = o.legend !== false;
  const showCaptions = o.captions !== false;

  const clipId = uid('clip');
  const gradId = uid('grad');

  const W = 288;
  const H = showLegend ? 292 : showCaptions ? 266 : 246;
  const offsets = [12, 156];
  const figTop = 6;

  const baseShapes = BASE_PARTS.map(
    (p) =>
      `<path d="${p.d}"/>` + (p.mirror ? `<path d="${p.d}" transform="${MIRROR}"/>` : '')
  ).join('');

  let body =
    `<defs><clipPath id="${clipId}">${baseShapes}</clipPath>` +
    (showLegend
      ? `<linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" style="stop-color:var(--surface-2)"/>` +
        `<stop offset="1" style="stop-color:var(--accent)"/>` +
        `</linearGradient>`
      : '') +
    `</defs>`;

  VIEWS.forEach((view, i) => {
    const regions = view.regions.map((r) => regionMarkup(r, entries[r.key], action)).join('');
    body +=
      `<g transform="translate(${offsets[i]},${figTop})">` +
      `<g style="fill:var(--surface-2);stroke:none;pointer-events:none">${baseShapes}</g>` +
      `<g clip-path="url(#${clipId})">${regions}</g>` +
      `<g style="fill:none;stroke:var(--border);stroke-width:1;stroke-linejoin:round;pointer-events:none">${baseShapes}</g>` +
      `</g>`;
  });

  if (showCaptions) {
    VIEWS.forEach((view, i) => {
      body +=
        `<text x="${c(offsets[i] + FIG_W / 2)}" y="254" text-anchor="middle" ` +
        `style="font-family:var(--font-ui);font-size:12.5px;letter-spacing:.04em;fill:var(--text-dim)">${esc(view.caption)}</text>`;
    });
  }

  if (showLegend) {
    body +=
      `<text x="95" y="279" text-anchor="end" style="font-family:var(--font-ui);font-size:11.5px;fill:var(--text-dim)">Not yet</text>` +
      `<rect x="99" y="270" width="90" height="9" rx="4.5" style="fill:url(#${gradId});stroke:var(--border);stroke-width:.75"/>` +
      `<text x="193" y="279" style="font-family:var(--font-ui);font-size:11.5px;fill:var(--text-dim)">On target</text>`;
  }

  const aria =
    'Shape Map, front and back view. ' +
    SHAPE_KEYS.map((k) => {
      const e = entries[k];
      return e.target != null
        ? `${e.label} ${n1(e.done)} of ${n1(e.target)} sets`
        : `${e.label} ${n1(e.done)} sets`;
    }).join(', ') +
    '.';

  return (
    svgOpen(W, H, aria, `max-width:${c(fin(o.maxWidth, 520))}px;margin:0 auto`) + body + `</svg>`
  );
}

/** Canonical labels, exposed so callers can build legends without re-importing exercises.js. */
export const CHART_SHAPE_LABELS = SHAPE_LABELS;
