// Lady_GYM — js/ui/kit.js — the iPhone-style building blocks: sheets, alerts, toasts, keypad, haptics.
//
// Everything renders to strings or to nodes appended to <body>. No framework.
// Sheets and alerts look and move like iOS ones on purpose: women who rejected Daybreak said
// it did not feel like an Apple app, and the first thing that gives a web app away is a
// dialog that slides in the wrong way.

import { icon } from './icons.js';

/* ------------------------------------------------------------------ strings */

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export const fmt = {
  num(n, dp = 1) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const v = Math.round(Number(n) * 10 ** dp) / 10 ** dp;
    return Number.isInteger(v) ? String(v) : v.toFixed(dp).replace(/0+$/, '').replace(/\.$/, '');
  },
  lb(n) { return n == null ? '—' : fmt.num(n) + ' lb'; },
  pct(f) { return Math.round((f || 0) * 100) + '%'; },
  mmss(sec) {
    const s = Math.max(0, Math.round(sec || 0));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  },
  clock(hhmm) {
    if (!hhmm) return '';
    const [h, m] = String(hhmm).split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + String(m || 0).padStart(2, '0') + ' ' + ampm;
  },
  longDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  },
  shortDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  },
  plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); },
};

/* ------------------------------------------------------------------ device */

export const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A light tap of feedback. Android has navigator.vibrate. iPhone Safari has no vibration API,
 * but since iOS 17.4 toggling a native switch control gives a system haptic — so we toggle an
 * invisible one. Must be called from inside a tap handler, which is the only time we want it.
 */
export function haptic() {
  try {
    if (navigator.vibrate) { navigator.vibrate(12); return; }
  } catch (_) { /* unsupported */ }
  if (!isIOS) return;
  try {
    const id = 'lg-haptic-' + Date.now();
    const label = document.createElement('label');
    label.htmlFor = id;
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    label.click();
    setTimeout(() => label.remove(), 50);
  } catch (_) { /* never let feedback break a tap */ }
}

/* ------------------------------------------------------------------ small pieces */

export function button({ label, action, kind = 'primary', size = 'lg', icon: ic, data = {}, full = true,
  disabled = false, cls = '' }) {
  const attrs = Object.entries(data).map(([k, v]) => ' data-' + k + '="' + esc(v) + '"').join('');
  return '<button type="button" class="btn btn-' + kind + ' btn-' + size + (full ? ' btn-full' : '') +
    (cls ? ' ' + cls : '') + '"' + (action ? ' data-action="' + esc(action) + '"' : '') + attrs +
    (disabled ? ' disabled aria-disabled="true"' : '') + '>' +
    (ic ? icon(ic, size === 'sm' ? 16 : 20) : '') + '<span>' + esc(label) + '</span></button>';
}

/** A grouped, inset list — iOS Settings. rows: [{icon html, title, sub, value, action, data, chevron}] */
export function group(rows, { header = '', footer = '', cls = '' } = {}) {
  const body = rows.filter(Boolean).map((r) => {
    const tag = r.action ? 'button' : 'div';
    const attrs = r.action ? ' type="button" data-action="' + esc(r.action) + '"' +
      Object.entries(r.data || {}).map(([k, v]) => ' data-' + k + '="' + esc(v) + '"').join('') : '';
    return '<' + tag + ' class="row' + (r.action ? ' is-tappable' : '') + (r.danger ? ' is-danger' : '') +
      (r.cls ? ' ' + r.cls : '') + '"' + attrs + '>' +
      (r.lead ? '<span class="row-lead">' + r.lead + '</span>' : '') +
      '<span class="row-main"><span class="row-title">' + (r.titleHtml || esc(r.title)) + '</span>' +
        (r.sub ? '<span class="row-sub">' + (r.subHtml ? r.sub : esc(r.sub)) + '</span>' : '') + '</span>' +
      (r.value != null && r.value !== '' ? '<span class="row-value">' + (r.valueHtml ? r.value : esc(r.value)) + '</span>' : '') +
      (r.trail || '') +
      (r.action && r.chevron !== false ? '<span class="row-chev">' + icon('chevronRight', 16) + '</span>' : '') +
      '</' + tag + '>';
  }).join('');
  return '<section class="group ' + cls + '">' +
    (header ? '<h2 class="group-header">' + esc(header) + '</h2>' : '') +
    '<div class="group-body">' + body + '</div>' +
    (footer ? '<p class="group-footer">' + footer + '</p>' : '') +
    '</section>';
}

export function sectionTitle(text, { action = '', actionLabel = '', data = {} } = {}) {
  const attrs = Object.entries(data).map(([k, v]) => ' data-' + k + '="' + esc(v) + '"').join('');
  return '<div class="section-title"><h2>' + esc(text) + '</h2>' +
    (action ? '<button type="button" class="link" data-action="' + esc(action) + '"' + attrs + '>' +
      esc(actionLabel || 'See All') + '</button>' : '') + '</div>';
}

export function segmented(name, options, value) {
  return '<div class="segmented" role="tablist">' + options.map((o) =>
    '<button type="button" role="tab" class="seg' + (o.id === value ? ' is-on' : '') + '" aria-selected="' +
    (o.id === value) + '" data-action="' + esc(name) + '" data-value="' + esc(o.id) + '">' + esc(o.label) +
    '</button>').join('') + '</div>';
}

export function chip(text, color = 'pink', ic = '') {
  return '<span class="chip chip-' + color + '">' + (ic ? icon(ic, 14) : '') + esc(text) + '</span>';
}

export function bar(pct, color = 'pink') {
  const p = Math.max(0, Math.min(1, pct || 0));
  return '<span class="pbar"><span class="pbar-fill" style="width:' + (p * 100).toFixed(1) +
    '%;background:var(--' + color + '-fill)"></span></span>';
}

/* ------------------------------------------------------------------ toast (top banner) */

let toastTimer = null;

export function toast(message, { tone = 'brand', ic = 'check', ms = 2600 } = {}) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.innerHTML = '<span class="toast-ic tone-' + tone + '">' + icon(ic, 18) + '</span><span>' + esc(message) + '</span>';
  el.classList.remove('is-on');
  void el.offsetWidth;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), ms);
}

/* ------------------------------------------------------------------ sheets */

let openSheet = null;

/**
 * A bottom sheet with a grabber, like iOS.
 *   title     header text
 *   body      HTML
 *   actions   { name: fn(node, data, sheetHandle) } for data-action clicks inside it
 *   large     true for a near full-height sheet
 *   left/right  { label, action } header buttons (default right = Done → close)
 * Returns a handle { el, close(), setBody(html) }.
 */
export function sheet({ title = '', body = '', actions = {}, large = false, right, left, onClose, cls = '' } = {}) {
  closeSheet(true);
  const layer = document.createElement('div');
  layer.className = 'sheet-layer';
  const rightBtn = right === null ? '' : '<button type="button" class="sheet-btn is-bold" data-sheet="' +
    esc((right && right.action) || 'close') + '">' + esc((right && right.label) || 'Done') + '</button>';
  const leftBtn = left ? '<button type="button" class="sheet-btn" data-sheet="' + esc(left.action || 'close') + '">' +
    esc(left.label || 'Cancel') + '</button>' : '<span class="sheet-btn-spacer"></span>';
  layer.innerHTML =
    '<div class="sheet-dim" data-sheet="close"></div>' +
    '<div class="sheet' + (large ? ' is-large' : '') + (cls ? ' ' + cls : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="sheet-grab" aria-hidden="true"></div>' +
      '<header class="sheet-head">' + leftBtn + '<h2 class="sheet-title">' + esc(title) + '</h2>' + rightBtn + '</header>' +
      '<div class="sheet-body">' + body + '</div>' +
    '</div>';
  document.body.appendChild(layer);
  const panel = layer.querySelector('.sheet');

  const handle = {
    el: panel,
    close: (immediate) => closeSheet(immediate),
    setBody(html) { panel.querySelector('.sheet-body').innerHTML = html; },
    onClose,
  };
  openSheet = { layer, handle };

  layer.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-sheet]');
    if (s) {
      const name = s.dataset.sheet;
      if (name === 'close') { closeSheet(); return; }
      if (actions[name]) { await actions[name](s, s.dataset, handle); return; }
    }
    const a = e.target.closest('[data-action]');
    if (a && panel.contains(a) && actions[a.dataset.action]) {
      if (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA') return;
      e.stopPropagation();
      await actions[a.dataset.action](a, a.dataset, handle);
    }
  });
  layer.addEventListener('input', (e) => {
    const a = e.target.closest('[data-action]');
    if (a && actions[a.dataset.action]) actions[a.dataset.action](a, a.dataset, handle);
  });

  // Drag the grabber/header down to dismiss.
  let startY = null;
  let dy = 0;
  const head = panel.querySelector('.sheet-grab');
  const header = panel.querySelector('.sheet-head');
  const onStart = (e) => { startY = e.touches[0].clientY; dy = 0; panel.style.transition = 'none'; };
  const onMove = (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    panel.style.transform = 'translateY(' + dy + 'px)';
  };
  const onEnd = () => {
    if (startY == null) return;
    panel.style.transition = '';
    panel.style.transform = '';
    if (dy > 90) closeSheet();
    startY = null;
  };
  for (const n of [head, header]) {
    n.addEventListener('touchstart', onStart, { passive: true });
    n.addEventListener('touchmove', onMove, { passive: true });
    n.addEventListener('touchend', onEnd);
  }

  requestAnimationFrame(() => layer.classList.add('is-open'));
  setTimeout(() => {
    const f = panel.querySelector('[autofocus]');
    if (f) { try { f.focus({ preventScroll: true }); } catch (_) { /* old Safari */ } }
  }, 320);
  return handle;
}

export function closeSheet(immediate) {
  if (!openSheet) return;
  const { layer, handle } = openSheet;
  openSheet = null;
  if (handle.onClose) { try { handle.onClose(); } catch (_) { /* ignore */ } }
  if (immediate) { layer.remove(); return; }
  layer.classList.remove('is-open');
  setTimeout(() => layer.remove(), 360);
}

export function sheetIsOpen() { return !!openSheet; }

/* ------------------------------------------------------------------ alert & action sheet */

/** iOS centred alert. Resolves true for the confirm button, false otherwise. */
export function confirmAlert(title, message = '', { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const layer = document.createElement('div');
    layer.className = 'alert-layer';
    layer.innerHTML =
      '<div class="alert" role="alertdialog" aria-modal="true" aria-label="' + esc(title) + '">' +
        '<div class="alert-text"><h2>' + esc(title) + '</h2>' + (message ? '<p>' + esc(message) + '</p>' : '') + '</div>' +
        '<div class="alert-btns">' +
          (cancel ? '<button type="button" data-v="0">' + esc(cancel) + '</button>' : '') +
          '<button type="button" data-v="1" class="' + (danger ? 'is-danger' : 'is-bold') + '">' + esc(ok) + '</button>' +
        '</div></div>';
    document.body.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('is-open'));
    layer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      layer.classList.remove('is-open');
      setTimeout(() => layer.remove(), 220);
      resolve(b.dataset.v === '1');
    });
  });
}

/** iOS action sheet. options: [{id, label, danger}]. Resolves the chosen id or null. */
export function actionSheet(title, options) {
  return new Promise((resolve) => {
    const layer = document.createElement('div');
    layer.className = 'asheet-layer';
    layer.innerHTML =
      '<div class="sheet-dim" data-v=""></div>' +
      '<div class="asheet" role="dialog" aria-modal="true" aria-label="' + esc(title || 'Options') + '">' +
        '<div class="asheet-group">' +
          (title ? '<p class="asheet-title">' + esc(title) + '</p>' : '') +
          options.map((o) => '<button type="button" data-v="' + esc(o.id) + '"' +
            (o.danger ? ' class="is-danger"' : '') + '>' + esc(o.label) + '</button>').join('') +
        '</div>' +
        '<div class="asheet-group"><button type="button" data-v="" class="is-bold">Cancel</button></div>' +
      '</div>';
    document.body.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('is-open'));
    layer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      layer.classList.remove('is-open');
      setTimeout(() => layer.remove(), 300);
      resolve(b.dataset.v || null);
    });
  });
}

/* ------------------------------------------------------------------ number pad */

/**
 * Big-key number entry for weights and reps. A native number keyboard covers half the screen
 * and its keys are small; mid-set, with chalky hands, she needs targets the size of a thumb.
 * Resolves the number, or null if cancelled.
 */
export function numberPad({ title = 'Weight', value = null, unit = '', step = 5, decimals = true, quick = [] } = {}) {
  return new Promise((resolve) => {
    let text = value == null ? '' : String(value);
    let done = false;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimals ? '.' : '', '0', 'del'];
    const display = () => '<span class="pad-num">' + esc(text || '0') + '</span>' +
      (unit ? '<span class="pad-unit">' + esc(unit) + '</span>' : '');
    const body =
      '<div class="pad">' +
        '<div class="pad-row">' +
          '<button type="button" class="pad-step" data-action="pad-down" aria-label="Less">−' + esc(fmt.num(step)) + '</button>' +
          '<div class="pad-display" id="pad-display" aria-live="polite">' + display() + '</div>' +
          '<button type="button" class="pad-step" data-action="pad-up" aria-label="More">+' + esc(fmt.num(step)) + '</button>' +
        '</div>' +
        (quick.length ? '<div class="pad-quick">' + quick.map((q) =>
          '<button type="button" class="pad-chip" data-action="pad-set" data-value="' + esc(q) + '">' + esc(fmt.num(q)) +
          (unit ? ' ' + esc(unit) : '') + '</button>').join('') + '</div>' : '') +
        '<div class="pad-keys">' + keys.map((k) => k === '' ? '<span></span>' :
          '<button type="button" class="pad-key" data-action="pad-key" data-k="' + k + '"' +
          (k === 'del' ? ' aria-label="Delete"' : '') + '>' + (k === 'del' ? '⌫' : k) + '</button>').join('') +
        '</div>' +
        button({ label: 'Done', action: 'pad-done', kind: 'primary' }) +
      '</div>';
    const repaint = (h) => { const d = h.el.querySelector('#pad-display'); if (d) d.innerHTML = display(); };
    const bump = (h, dir) => {
      const n = parseFloat(text) || 0;
      const next = Math.max(0, Math.round((n + dir * step) * 100) / 100);
      text = String(next);
      repaint(h);
      haptic();
    };
    sheet({
      title,
      body,
      right: null,
      left: { label: 'Cancel', action: 'close' },
      onClose: () => { if (!done) resolve(null); },
      actions: {
        'pad-key'(n, d, h) {
          const k = n.dataset.k;
          if (k === 'del') text = text.slice(0, -1);
          else if (k === '.' && text.includes('.')) return;
          else if (text.length < 6) text = (text === '0' && k !== '.') ? k : text + k;
          repaint(h);
        },
        'pad-up'(n, d, h) { bump(h, 1); },
        'pad-down'(n, d, h) { bump(h, -1); },
        'pad-set'(n, d, h) { text = String(n.dataset.value); repaint(h); },
        'pad-done'(n, d, h) {
          done = true;
          const v = parseFloat(text);
          h.close();
          resolve(Number.isFinite(v) ? v : null);
        },
      },
    });
  });
}

/* ------------------------------------------------------------------ confetti */

/** A short burst of colour. Skipped entirely when the phone asks for reduced motion. */
export function confetti({ count = 120, ms = 2400 } = {}) {
  if (reducedMotion()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#FF2D78', '#8E5CF7', '#11B5A4', '#FF8A3D', '#2E8BFF', '#FFC21A', '#22C17A'];
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: innerHeight * 0.32,
    vx: (Math.random() - 0.5) * 11,
    vy: -Math.random() * 12 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  const t0 = performance.now();
  const tick = (t) => {
    const k = (t - t0) / ms;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * 0.6);
      ctx.restore();
    }
    if (k < 1) requestAnimationFrame(tick); else c.remove();
  };
  requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------ images */

/**
 * Read a picked photo, shrink it, and return a JPEG data URL. A 12 MP iPhone photo is ~4 MB;
 * stored as-is, a few months of progress photos would fill the browser's storage allowance.
 */
export function shrinkImage(file, max = 1080, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/** Open the photo picker (camera or library). Resolves a File or null. */
export function pickPhoto({ camera = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      input.remove();
      resolve(f || null);
    });
    document.body.appendChild(input);
    input.click();
  });
}
