// Lady_GYM — js/art/figure.js — every movement drawn as a colourful illustrated woman, not a stick figure.
//
// Daybreak's 67 movement diagrams were accurate but read as engineering drawings: grey stick
// figures on beige. The feedback was "make it more picture friendly". The poses themselves
// were right, so this module keeps them and redraws them:
//
//   1. parse each diagram (they are machine-made, so a small tag parser is enough),
//   2. work out which line is the torso, which chains are legs and which are arms,
//   3. draw a woman over that skeleton: hair, skin, a coloured top, leggings and trainers,
//      on two soft pastel panels, with the equipment and the motion arrow recoloured.
//
// The cast is deliberately varied — skin tones, hair colours and outfits rotate by movement —
// so the library looks like the women using it, not one model repeated 67 times.
//
// Pure string in, string out. No DOM needed, so it also runs under Node for the contact sheet.

import { DIAGRAMS } from '../data/diagrams.js';

/* ------------------------------------------------------------------ cast */

export const SKIN = ['#F7D7C2', '#EBB894', '#D39A6E', '#B07650', '#8A5638', '#6B3F2A'];
export const HAIR = ['#2A1A14', '#5B3622', '#8C4A22', '#C98A3E', '#1C1C24', '#7A2F3B'];

// [top, leggings, trainers]. Bright, but each pair is distinct enough to read at thumbnail size.
export const OUTFITS = [
  ['#FF3D7F', '#3A2E6B', '#FFFFFF'],
  ['#8E5CF7', '#22314F', '#FFE16B'],
  ['#14B8A6', '#4A2A5E', '#FFFFFF'],
  ['#FF8A3D', '#2D3A66', '#FFFFFF'],
  ['#2E9BFF', '#5B2148', '#FFD1E3'],
  ['#FF5C8A', '#1F4E5A', '#FFFFFF'],
  ['#B05CF7', '#3B2F2F', '#B8F3E8'],
  ['#FFB020', '#43306E', '#FFFFFF'],
];

// Panel tints behind the two frames — soft, so the figure stays the subject.
const PANELS = [
  ['#FFE4EE', '#FFF2E6'],
  ['#EEE6FF', '#E3F1FF'],
  ['#DDF6F1', '#EAF7FF'],
  ['#FFF1D6', '#FFE4EE'],
  ['#E3F1FF', '#F1E8FF'],
  ['#FFE9E0', '#FFF6D9'],
];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A deterministic look for a given key, so the same movement always shows the same woman. */
export function castFor(key, offset = 0) {
  const h = hash(String(key)) + offset * 7919;
  return {
    skin: SKIN[h % SKIN.length],
    hair: HAIR[(h >>> 3) % HAIR.length],
    top: OUTFITS[(h >>> 6) % OUTFITS.length][0],
    legs: OUTFITS[(h >>> 6) % OUTFITS.length][1],
    shoe: OUTFITS[(h >>> 6) % OUTFITS.length][2],
    panel: PANELS[(h >>> 9) % PANELS.length],
    style: (h >>> 12) % 3,            // 0 ponytail · 1 bun · 2 long tied back
  };
}

/* ------------------------------------------------------------------ tiny SVG parser */

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][\w:.-]*)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

const num = (v, d = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

/**
 * Flatten a diagram into a list of shapes, each carrying its inherited stroke/fill.
 * Shapes: {tag, a (attributes), stroke, fill, width, text?}
 */
function parse(svg) {
  const shapes = [];
  const stack = [{}];
  const re = /<(\/?)(g|line|polyline|polygon|circle|ellipse|rect|path|text)\b([^>]*?)(\/?)>(?:([^<]*)<\/text>)?/g;
  let m;
  while ((m = re.exec(svg))) {
    const [, close, tag, body, selfClose, text] = m;
    if (tag === 'g') {
      if (close) { if (stack.length > 1) stack.pop(); continue; }
      const a = attrs(body);
      const top = stack[stack.length - 1];
      stack.push({
        stroke: a.stroke || top.stroke,
        fill: a.fill || top.fill,
        width: a['stroke-width'] || top.width,
      });
      if (selfClose) stack.pop();
      continue;
    }
    if (close) continue;
    const a = attrs(body);
    const ctx = stack[stack.length - 1];
    shapes.push({
      tag,
      a,
      stroke: a.stroke || ctx.stroke || null,
      fill: a.fill || ctx.fill || null,
      width: num(a['stroke-width'] || ctx.width, 1),
      text: tag === 'text' ? (text || '') : null,
    });
  }
  return shapes;
}

const isInk = (c) => c === 'var(--ink-700)';
const isEquip = (c) => c === 'var(--clay-500)';

/* ------------------------------------------------------------------ geometry */

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const near = (p, q, tol = 2.6) => dist(p, q) <= tol;

function distToSeg(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy || 1;
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { d: dist(p, [a[0] + t * dx, a[1] + t * dy]), t };
}

/**
 * Flatten a path's d attribute to points. Handles M/L/H/V/Q/C/Z, absolute and relative —
 * everything the diagram generator wrote. Curves are sampled, which is plenty at this size.
 * Returns an array of subpaths (each an array of points).
 */
export function pathPoints(d) {
  const toks = String(d || '').match(/[MLHVQCZmlhvqcz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const subs = [];
  let cur = null;
  let x = 0; let y = 0; let sx = 0; let sy = 0;
  let cmd = null;
  let i = 0;
  const n = () => parseFloat(toks[i++]);
  const push = (px, py) => { if (!cur) { cur = []; subs.push(cur); } cur.push([px, py]); };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    if (!cmd) break;
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'Z') { if (cur && cur.length) push(sx, sy); cur = null; cmd = null; continue; }
    if (C === 'M') {
      const nx = n(); const ny = n();
      x = rel ? x + nx : nx; y = rel ? y + ny : ny; sx = x; sy = y;
      cur = null; push(x, y); cmd = rel ? 'l' : 'L'; continue;
    }
    if (C === 'L') { const nx = n(); const ny = n(); x = rel ? x + nx : nx; y = rel ? y + ny : ny; push(x, y); continue; }
    if (C === 'H') { const nx = n(); x = rel ? x + nx : nx; push(x, y); continue; }
    if (C === 'V') { const ny = n(); y = rel ? y + ny : ny; push(x, y); continue; }
    if (C === 'Q' || C === 'C') {
      const pts = [];
      const k = C === 'Q' ? 2 : 3;
      for (let j = 0; j < k; j++) { const px = n(); const py = n(); pts.push(rel ? [x + px, y + py] : [px, py]); }
      const p0 = [x, y];
      for (let t = 1; t <= 6; t++) {
        const u = t / 6;
        let q;
        if (k === 2) {
          q = [(1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * pts[0][0] + u * u * pts[1][0],
               (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * pts[0][1] + u * u * pts[1][1]];
        } else {
          const a = (1 - u) ** 3; const b = 3 * (1 - u) ** 2 * u; const c = 3 * (1 - u) * u * u; const e = u ** 3;
          q = [a * p0[0] + b * pts[0][0] + c * pts[1][0] + e * pts[2][0],
               a * p0[1] + b * pts[0][1] + c * pts[1][1] + e * pts[2][1]];
        }
        push(q[0], q[1]);
      }
      x = pts[k - 1][0]; y = pts[k - 1][1];
      continue;
    }
    break;  // an arc or anything unexpected: stop rather than guess
  }
  return subs.filter((sp) => sp.length >= 2 && sp.every((p) => p.every(Number.isFinite)));
}

function pointsOf(s) {
  if (s.tag === 'path') return (pathPoints(s.a.d)[0]) || [];
  if (s.tag === 'line') return [[num(s.a.x1), num(s.a.y1)], [num(s.a.x2), num(s.a.y2)]];
  if (s.tag === 'polyline' || s.tag === 'polygon') {
    return (s.a.points || '').trim().split(/\s+/).map((pair) => pair.split(',').map(Number))
      .filter((p) => p.length === 2 && p.every(Number.isFinite));
  }
  return [];
}

/* ------------------------------------------------------------------ skeleton */

/**
 * Turn one frame's ink shapes into a skeleton:
 *   {head:{x,y,r}, torso:[neck,hip], arms:[[p0,p1,...]], legs:[[...]], extra:[segments], paths:[d]}
 */
function skeleton(frameShapes, head) {
  // Break every ink line/polyline into two-point segments.
  const segs = [];
  const paths = [];
  for (const s of frameShapes) {
    const subs = s.tag === 'path' ? pathPoints(s.a.d) : [pointsOf(s)];
    if (s.tag === 'path' && !subs.length) { paths.push(s.a.d); continue; }
    for (const pts of subs) {
      for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
    }
  }
  if (!segs.length) return { head, torso: null, chains: [], extra: [], paths };

  const hc = [head.x, head.y];

  // Torso: among segments with an end close to the head, the longest one.
  let torso = null;
  let best = -1;
  for (const sg of segs) {
    const dA = dist(sg[0], hc);
    const dB = dist(sg[1], hc);
    const dn = Math.min(dA, dB);
    if (dn > head.r + 9) continue;
    const len = dist(sg[0], sg[1]);
    if (len > best) {
      best = len;
      torso = dA <= dB ? [sg[0], sg[1]] : [sg[1], sg[0]];
    }
  }
  if (!torso) return { head, torso: null, chains: [], extra: segs, paths };

  const [neck, hip] = torso;
  const tlen = dist(neck, hip) || 1;
  const used = new Set([segs.findIndex((sg) =>
    (sg[0] === torso[0] && sg[1] === torso[1]) || (sg[0] === torso[1] && sg[1] === torso[0]))]);

  // Grow chains outward from a start point, depth-first, following shared endpoints.
  function grow(start, kind) {
    const out = [];
    let frontier = [{ p: start, depth: 0 }];
    while (frontier.length) {
      const next = [];
      for (const { p, depth } of frontier) {
        segs.forEach((sg, i) => {
          if (used.has(i)) return;
          let a = null; let b = null;
          if (near(sg[0], p)) { a = sg[0]; b = sg[1]; } else if (near(sg[1], p)) { a = sg[1]; b = sg[0]; }
          if (!a) return;
          used.add(i);
          out.push({ a, b, depth: depth + 1, kind });
          next.push({ p: b, depth: depth + 1 });
        });
      }
      frontier = next;
    }
    return out;
  }

  const limbs = [];
  limbs.push(...grow(hip, 'leg'));

  // Arms attach anywhere along the upper part of the torso, not necessarily at its tip.
  segs.forEach((sg, i) => {
    if (used.has(i)) return;
    for (const [end, other] of [[sg[0], sg[1]], [sg[1], sg[0]]]) {
      const { d, t } = distToSeg(end, neck, hip);
      if (d <= 2.6 && t < 0.55) {
        used.add(i);
        limbs.push({ a: end, b: other, depth: 1, kind: 'arm' });
        limbs.push(...grow(other, 'arm').map((l) => ({ ...l, depth: l.depth + 1 })));
        return;
      }
    }
  });

  // A leg can also hang off the low end of the torso without sharing the exact point.
  segs.forEach((sg, i) => {
    if (used.has(i)) return;
    for (const [end, other] of [[sg[0], sg[1]], [sg[1], sg[0]]]) {
      const { d, t } = distToSeg(end, neck, hip);
      if (d <= 3 && t >= 0.55) {
        used.add(i);
        limbs.push({ a: end, b: other, depth: 1, kind: 'leg' });
        limbs.push(...grow(other, 'leg').map((l) => ({ ...l, depth: l.depth + 1 })));
        return;
      }
    }
  });

  const extra = segs.filter((_, i) => !used.has(i));
  return { head, torso, tlen, limbs, extra, paths };
}

/* ------------------------------------------------------------------ drawing a woman */

const r1 = (n) => Math.round(n * 10) / 10;
const P = (p) => r1(p[0]) + ',' + r1(p[1]);

function seg(a, b, color, w, cap = 'round') {
  return '<line x1="' + r1(a[0]) + '" y1="' + r1(a[1]) + '" x2="' + r1(b[0]) + '" y2="' + r1(b[1]) +
    '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="' + cap + '"/>';
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Facing direction: a unit vector pointing to the front of her body, perpendicular to the
 * neck→head line. Toes point forward in every pose, standing or lying, so the feet decide;
 * hands are the fallback; facing right is the last resort.
 */
function facingOf(sk) {
  const [neck] = sk.torso;
  const up = [sk.head.x - neck[0], sk.head.y - neck[1]];
  const ul = Math.hypot(up[0], up[1]) || 1;
  const u = [up[0] / ul, up[1] / ul];
  const perp = [-u[1], u[0]];
  let score = 0;
  const feet = sk.limbs.filter((l) => l.kind === 'leg' && l.depth >= 3);
  for (const f of feet) score += (f.b[0] - f.a[0]) * perp[0] + (f.b[1] - f.a[1]) * perp[1];
  if (Math.abs(score) < 0.5) {
    const hands = sk.limbs.filter((l) => l.kind === 'arm');
    for (const h of hands) score += ((h.b[0] - neck[0]) * perp[0] + (h.b[1] - neck[1]) * perp[1]) * 0.25;
  }
  if (Math.abs(score) < 0.5) score = perp[0] >= 0 ? 1 : -1;
  const s = score >= 0 ? 1 : -1;
  return { u, f: [perp[0] * s, perp[1] * s] };
}

function headArt(sk, cast) {
  const { x, y } = sk.head;
  const r = 6.8;
  const { u, f } = sk.torso ? facingOf(sk) : { u: [0, -1], f: [1, 0] };
  const at = (bx, by, du, df) => [bx + u[0] * du + f[0] * df, by + u[1] * du + f[1] * df];

  const hairBack = at(x, y, 0.9, -1.4);
  const face = at(x, y, -0.4, 0.9);
  let hair = '<circle cx="' + r1(hairBack[0]) + '" cy="' + r1(hairBack[1]) + '" r="' + r1(r + 0.6) +
    '" fill="' + cast.hair + '"/>';

  if (cast.style === 1) {
    // bun on the crown
    const bun = at(x, y, r + 2.2, -2.2);
    hair += '<circle cx="' + r1(bun[0]) + '" cy="' + r1(bun[1]) + '" r="3.6" fill="' + cast.hair + '"/>';
  } else {
    // ponytail swinging behind
    const root = at(x, y, 3.2, -r + 0.6);
    const tip = at(x, y, cast.style === 2 ? -8 : -3.5, -r - (cast.style === 2 ? 4.5 : 7.5));
    const ctrl = at(x, y, 5.5, -r - 6);
    hair += '<path d="M' + P(root) + ' Q' + P(ctrl) + ' ' + P(tip) + '" stroke="' + cast.hair +
      '" stroke-width="' + (cast.style === 2 ? 4.2 : 3.6) + '" stroke-linecap="round" fill="none"/>';
  }
  const faceArt = '<circle cx="' + r1(face[0]) + '" cy="' + r1(face[1]) + '" r="' + r1(r - 0.9) +
    '" fill="' + cast.skin + '"/>';
  // fringe across the top of the face, so it reads as hair and not a helmet
  const fr1 = at(x, y, r - 1.2, -2.4);
  const fr2 = at(x, y, r - 3.4, r - 1.6);
  const fringe = '<path d="M' + P(fr1) + ' Q' + P(at(x, y, r + 0.6, 2.2)) + ' ' + P(fr2) +
    '" stroke="' + cast.hair + '" stroke-width="2.6" stroke-linecap="round" fill="none"/>';
  // a hint of a cheek, in the direction she faces
  const cheek = at(x, y, -1.8, 3.4);
  const blush = '<circle cx="' + r1(cheek[0]) + '" cy="' + r1(cheek[1]) + '" r="1.3" fill="#FF7A9A" opacity=".55"/>';
  return hair + faceArt + fringe + blush;
}

function bodyArt(sk, cast) {
  if (!sk.torso) {
    // Could not find a torso: still draw the segments, in outfit colours, so it is never blank.
    return sk.extra.map((s) => seg(s[0], s[1], cast.legs, 6)).join('') + headArt(sk, cast);
  }
  const [neck, hip] = sk.torso;
  const legs = sk.limbs.filter((l) => l.kind === 'leg');
  const arms = sk.limbs.filter((l) => l.kind === 'arm');
  const far = shade(cast.legs, 26);
  const skinFar = shade(cast.skin, -18);

  let out = '';
  // far-side limbs first, slightly lighter, for depth: the second leg/arm chain found
  const legChains = chainIds(legs);
  const armChains = chainIds(arms);

  const drawLeg = (l, isFar) => {
    const col = isFar ? far : cast.legs;
    if (l.depth === 1) return seg(l.a, l.b, col, 9.4);
    if (l.depth === 2) return seg(l.a, l.b, col, 7.4);
    // feet: a trainer
    return seg(l.a, l.b, isFar ? shade(cast.shoe, -30) : cast.shoe, 5.2) +
      seg(l.a, l.b, isFar ? shade(cast.shoe, -60) : shade(cast.shoe, -70), 1.2, 'butt');
  };
  const drawArm = (l, isFar) => {
    const col = isFar ? skinFar : cast.skin;
    if (l.depth === 1) {
      // short sleeve over the top of the upper arm
      const mid = [l.a[0] + (l.b[0] - l.a[0]) * 0.38, l.a[1] + (l.b[1] - l.a[1]) * 0.38];
      return seg(l.a, l.b, col, 5.6) + seg(l.a, mid, isFar ? shade(cast.top, -24) : cast.top, 6.4);
    }
    return seg(l.a, l.b, col, l.depth === 2 ? 4.8 : 4);
  };

  legs.forEach((l, i) => { if (legChains[i] > 0) out += drawLeg(l, true); });
  arms.forEach((l, i) => { if (armChains[i] > 0) out += drawArm(l, true); });

  // torso: a top over the upper 62%, waistband + leggings over the hips
  const waist = [neck[0] + (hip[0] - neck[0]) * 0.64, neck[1] + (hip[1] - neck[1]) * 0.64];
  const band = [neck[0] + (hip[0] - neck[0]) * 0.72, neck[1] + (hip[1] - neck[1]) * 0.72];
  out += seg(waist, hip, cast.legs, 10.4);
  out += seg(neck, waist, cast.top, 11.6);
  out += seg(waist, band, shade(cast.legs, 40), 10.6, 'butt');
  // neck
  const nk = [neck[0] + (sk.head.x - neck[0]) * 0.45, neck[1] + (sk.head.y - neck[1]) * 0.45];
  out += seg(neck, nk, cast.skin, 4.4);

  legs.forEach((l, i) => { if (!legChains[i]) out += drawLeg(l, false); });
  for (const p of sk.paths) {
    out += '<path d="' + p + '" stroke="' + cast.top + '" stroke-width="10" stroke-linecap="round" ' +
      'stroke-linejoin="round" fill="none"/>';
  }
  for (const s of sk.extra) out += seg(s[0], s[1], cast.legs, 7);
  out += headArt(sk, cast);
  arms.forEach((l, i) => { if (!armChains[i]) out += drawArm(l, false); });
  // hands
  for (const l of arms) {
    if (!arms.some((o) => o !== l && near(o.a, l.b))) {
      out += '<circle cx="' + r1(l.b[0]) + '" cy="' + r1(l.b[1]) + '" r="2.5" fill="' + cast.skin + '"/>';
    }
  }
  return out;
}

/** Which chain (0 = first found, near side; 1+ = far side) each limb belongs to. */
function chainIds(limbs) {
  const ids = [];
  let chain = -1;
  limbs.forEach((l) => {
    if (l.depth === 1) chain += 1;
    ids.push(Math.max(0, chain));
  });
  return ids;
}

/* ------------------------------------------------------------------ the whole diagram */

function recolor(s, eq) {
  // equipment, arrows, floor, labels — everything that is not her
  const a = { ...s.a };
  const map = (c) => {
    if (!c) return c;
    if (isEquip(c)) return eq;
    if (c === 'var(--accent)') return '#FF2D78';
    if (c === 'var(--ink-300)') return 'rgba(60,50,90,.22)';
    if (c === 'var(--ink-500)') return '#5E5A73';
    if (c === 'var(--surface-2)') return 'rgba(255,255,255,.7)';
    if (c === 'var(--calm)') return '#1FA463';
    if (c === 'var(--signal)') return '#E5484D';
    return c;
  };
  const stroke = map(s.stroke);
  const fill = map(s.fill);
  delete a.stroke; delete a.fill; delete a.class;
  let w = s.width;
  if (isEquip(s.stroke)) w = Math.max(w, 3.2);
  const keep = Object.entries(a)
    .filter(([k]) => k !== 'stroke-width' && k !== 'stroke-linecap' && k !== 'stroke-linejoin')
    .map(([k, v]) => k + '="' + v + '"').join(' ');
  const paint = (stroke ? ' stroke="' + stroke + '" stroke-width="' + w + '"' : '') +
    (fill ? ' fill="' + fill + '"' : (s.tag === 'text' ? '' : ' fill="none"')) +
    (s.tag !== 'text' ? ' stroke-linecap="round" stroke-linejoin="round"' : '');
  if (s.tag === 'text') {
    return '<text ' + keep.replace(/font-family="[^"]*"/, '').replace(/font-size="[^"]*"/, '') +
      ' font-size="' + Math.min(8.6, Math.round((150 / Math.max(1, s.text.length)) * 10) / 10) + '"' +
      ' font-weight="650" font-family="ui-rounded,-apple-system,system-ui,sans-serif"' +
      (fill ? ' fill="' + fill + '"' : '') + '>' + s.text + '</text>';
  }
  return '<' + s.tag + ' ' + keep + paint + '/>';
}

const cache = new Map();
let copies = 0;

/**
 * Every copy put on the page gets its own gradient id. The cached markup repeated one id, and
 * WebKit does not paint url(#id) when the first element with that id sits in a hidden tab.
 */
function ownIds(svg, ck) {
  const gid = 'fg' + (hash(ck) % 1e7);
  return svg.indexOf(gid) < 0 ? svg : svg.split('#' + gid + ')').join('#' + gid + '-' + (++copies) + ')')
    .split('id="' + gid + '"').join('id="' + gid + '-' + copies + '"');
}

/**
 * The illustrated version of a stored diagram.
 *   key     a DIAGRAMS key
 *   opts.frame   'both' (default) | 'start' | 'finish' — crop to one pose
 *   opts.labels  false to drop the Start/Finish captions (thumbnails)
 *   opts.cast    override the look
 * Returns an SVG string, or '' when the key has no diagram.
 */
export function figureSvg(key, opts = {}) {
  const d = DIAGRAMS[key];
  if (!d || !d.svg) return '';
  const frame = opts.frame || 'both';
  const labels = opts.labels !== false;
  const bare = opts.panel === false;
  const ck = key + '|' + frame + '|' + labels + '|' + (opts.castKey || '') + '|' + bare;
  if (cache.has(ck)) return ownIds(cache.get(ck), ck);

  const cast = opts.cast || castFor(opts.castKey || key);
  const shapes = parse(d.svg);
  const eq = '#3D3566';

  const heads = shapes.filter((s) => s.tag === 'circle' && isInk(s.fill) && num(s.a.r) >= 5);
  const inkSegs = shapes.filter((s) => isInk(s.stroke) && s.tag !== 'circle');
  const others = shapes.filter((s) => !(isInk(s.fill) && s.tag === 'circle') && !isInk(s.stroke) &&
    s.stroke !== 'var(--border)');
  const smallInk = shapes.filter((s) => s.tag === 'circle' && isInk(s.fill) && num(s.a.r) < 5);

  const sideOf = (x) => (x < 105 ? 0 : 1);
  const xOf = (s) => {
    if (s.tag === 'line') return (num(s.a.x1) + num(s.a.x2)) / 2;
    if (s.tag === 'circle' || s.tag === 'ellipse') return num(s.a.cx);
    if (s.tag === 'rect') return num(s.a.x) + num(s.a.width) / 2;
    if (s.tag === 'text') return num(s.a.x);
    if (s.tag === 'polyline' || s.tag === 'polygon') {
      const p = pointsOf(s); return p.reduce((m, q) => m + q[0], 0) / (p.length || 1);
    }
    if (s.tag === 'path') { const m = /M\s*([\d.]+)/.exec(s.a.d || ''); return m ? +m[1] : 0; }
    return 0;
  };

  let figures = '';
  for (const side of [0, 1]) {
    const hs = heads.filter((h) => sideOf(num(h.a.cx)) === side);
    const ink = inkSegs.filter((s) => sideOf(xOf(s)) === side);
    if (!hs.length) {
      figures += ink.map((s) => pointsOf(s)).flatMap((pts) =>
        pts.slice(0, -1).map((p, i) => seg(p, pts[i + 1], cast.legs, 7))).join('');
      continue;
    }
    // Usually one head per frame; when there are two (rare), split ink by nearest head.
    hs.forEach((h, hi) => {
      const hc = [num(h.a.cx), num(h.a.cy)];
      const mine = hs.length === 1 ? ink : ink.filter((s) => {
        const p = pointsOf(s)[0] || hc;
        return hs.every((o, oi) => oi === hi || dist(p, hc) <= dist(p, [num(o.a.cx), num(o.a.cy)]));
      });
      const sk = skeleton(mine, { x: hc[0], y: hc[1], r: num(h.a.r, 7) });
      figures += '<g class="fig-woman">' + bodyArt(sk, cast) + '</g>';
    });
  }

  const back = others.filter((s) => s.tag !== 'text' && s.stroke !== 'var(--accent)');
  const front = others.filter((s) => s.stroke === 'var(--accent)');
  const texts = labels ? others.filter((s) => s.tag === 'text') : [];

  const [pA, pB] = cast.panel;
  const gid = 'fg' + (hash(ck) % 1e7);
  const panels = bare ? '' :
    '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + pA + '"/><stop offset="1" stop-color="' + pB + '"/>' +
    '</linearGradient></defs>' +
    '<rect x="2" y="4" width="100" height="110" rx="14" fill="url(#' + gid + ')"/>' +
    '<rect x="108" y="4" width="100" height="110" rx="14" fill="url(#' + gid + ')"/>' +
    '<ellipse cx="52" cy="101" rx="36" ry="3.2" fill="rgba(60,40,100,.10)"/>' +
    '<ellipse cx="158" cy="101" rx="36" ry="3.2" fill="rgba(60,40,100,.10)"/>';

  const vb = frame === 'start' ? '0 0 105 116' : frame === 'finish' ? '105 0 105 116' : '0 0 210 116';
  const label = (d.name || key) + (frame === 'both' ? ': start and finish' : '');
  const svg = '<svg class="fig" viewBox="' + vb + '" role="img" aria-label="' + escAttr(label) +
    '" xmlns="http://www.w3.org/2000/svg">' + panels +
    back.map((s) => recolor(s, eq)).join('') +
    figures +
    smallInk.map((s) => '<circle cx="' + s.a.cx + '" cy="' + s.a.cy + '" r="' + s.a.r + '" fill="' + cast.skin + '"/>').join('') +
    front.map((s) => recolor(s, eq)).join('') +
    texts.map((s) => recolor(s, eq)).join('') +
    '</svg>';
  cache.set(ck, svg);
  return ownIds(svg, ck);
}

function escAttr(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/**
 * The movement as a little animation: start and finish poses stacked, cross-fading.
 * Pure CSS (see .fig-anim in app.css), so it costs nothing and respects reduced motion.
 */
export function figureAnim(key, opts = {}) {
  const a = figureSvg(key, { ...opts, frame: 'start', labels: false });
  const b = figureSvg(key, { ...opts, frame: 'finish', labels: false });
  if (!a) return '';
  return '<div class="fig-anim" role="img" aria-label="' + escAttr((DIAGRAMS[key] && DIAGRAMS[key].name) || key) +
    ' — moving between start and finish">' +
    '<div class="fig-anim-a" aria-hidden="true">' + a + '</div>' +
    '<div class="fig-anim-b" aria-hidden="true">' + b + '</div></div>';
}

export function hasFigure(key) {
  return !!(key && DIAGRAMS[key] && DIAGRAMS[key].svg);
}

export function diagramSetup(key) {
  const d = DIAGRAMS[key];
  return d && Array.isArray(d.setup) ? d.setup : [];
}

/* ------------------------------------------------------------------ authored poses */

/**
 * Draw a hand-authored pose with the same renderer the diagrams use.
 *   pose = { head:[x,y], neck:[x,y], hip:[x,y],
 *            arms: [[shoulder, elbow, hand], ...],   near side first
 *            legs: [[hip, knee, ankle, toe], ...] }  near side first
 * Returns the SVG markup of the figure only (no <svg> wrapper), so scenes can place it.
 */
export function poseMarkup(pose, cast) {
  const limbs = [];
  for (const [kind, chains] of [['leg', pose.legs || []], ['arm', pose.arms || []]]) {
    for (const chain of chains) {
      for (let i = 0; i < chain.length - 1; i++) {
        limbs.push({ a: chain[i], b: chain[i + 1], depth: i + 1, kind });
      }
    }
  }
  const sk = {
    head: { x: pose.head[0], y: pose.head[1], r: 7 },
    torso: [pose.neck, pose.hip],
    limbs,
    extra: [],
    paths: [],
  };
  return bodyArt(sk, cast);
}
