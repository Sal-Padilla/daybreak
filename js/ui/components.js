// Daybreak — js/ui/components.js — the shared UI kit: element builder, HTML-string builders, bottom sheet, toast, confirm, formatters.

/*
 * BUILD_CONTRACT §6.2. Exports, exactly:
 *   h, el, card, btn, stat, sheet, closeSheet, toast, confirmDialog, fmt
 *
 * Two families live here on purpose:
 *
 *   1. DOM builders — h() and el() — for code that holds a node and mutates it
 *      (train.js's set rows, timer.js's readout).
 *   2. STRING builders — card(), btn(), stat() — because feature modules render
 *      with `el.innerHTML = \`…\`` (§6.1) and need pieces that drop straight into
 *      a template literal.
 *
 * Everything a caller hands to a string builder as TEXT is escaped. The two
 * fields documented as HTML (card's `body`/`footer`, sheet's `bodyHTML`) are not
 * escaped — they exist so callers can nest btn()/stat()/charts output. Never put
 * raw user input in those; wrap it in a text field or escape it yourself.
 *
 * No inline handlers anywhere. Clicks travel by data-action (§6.1): the Router
 * owns delegation for the content root, and sheet() owns delegation for whatever
 * is inside a sheet (see the note above sheet()).
 */

/* ==================================================================== *
 * Escaping
 * ==================================================================== */

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * Escape a value for interpolation into HTML text OR a double/single-quoted
 * attribute. Non-strings are stringified first; null/undefined become ''.
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

/** camelCase / snake_case / spaced -> kebab-case, for data-* attribute names. */
function kebab(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/** kebab-case -> camelCase, for dataset property names. */
function camel(key) {
  return String(key).replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

/**
 * A data-* attribute name we are willing to emit. Anything with characters that
 * could break out of the attribute list is dropped rather than escaped, because
 * an attribute name cannot be escaped — only rejected.
 */
function safeDataName(key) {
  const name = kebab(key).replace(/[^a-z0-9-]/g, '');
  return /^[a-z][a-z0-9-]*$/.test(name) ? name : '';
}

/** A token safe to append to a class name (tones, variants, sizes). */
function safeToken(value, fallback) {
  const token = String(value === null || value === undefined ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  return token || fallback;
}

/** Build `data-a="1" data-b="2"` from a plain object. Values are escaped. */
function dataAttrs(data) {
  if (!data || typeof data !== 'object') return '';
  const out = [];
  for (const key of Object.keys(data)) {
    const name = safeDataName(key);
    const value = data[key];
    if (!name || value === null || value === undefined || value === false) continue;
    out.push(`data-${name}="${escapeHtml(value === true ? '' : value)}"`);
  }
  return out.length ? ' ' + out.join(' ') : '';
}

/** Normalise class input: string, array, or {name:truthy} object. */
function classString(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.filter(Boolean).map(classString).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    return Object.keys(value).filter((k) => value[k]).join(' ');
  }
  return String(value);
}

/** Flatten HTML-string-ish input: string, number, or (nested) array of them. */
function htmlChunk(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (Array.isArray(value)) return value.map(htmlChunk).join('');
  if (typeof value === 'number') return String(value);
  return String(value);
}

/* ==================================================================== *
 * h() — build a real element
 * ==================================================================== */

const PROPERTY_KEYS = new Set(['value', 'checked', 'indeterminate', 'selected', 'textContent', 'innerText']);

function isChildLike(value) {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    Array.isArray(value) ||
    (typeof Node !== 'undefined' && value instanceof Node)
  );
}

function appendChild(parent, child) {
  if (child === null || child === undefined || child === false || child === true) return;
  if (Array.isArray(child)) {
    for (const c of child) appendChild(parent, c);
    return;
  }
  if (typeof Node !== 'undefined' && child instanceof Node) {
    parent.appendChild(child);
    return;
  }
  parent.appendChild(document.createTextNode(String(child)));
}

/**
 * h('div', {class:'row', dataset:{action:'log-set'}, on:{click:fn}}, 'text', node, [more])
 *
 * attrs (all optional, all skippable):
 *   class / className : string | array | {name:bool}
 *   dataset           : {exerciseId:'x'} -> data-exercise-id="x"
 *   on                : {click:fn} or {click:[fn, fn]}
 *   style             : 'color:red' or {color:'red', '--x':'1'}
 *   anything else     : attribute. `true` -> bare attribute, `false`/null -> omitted.
 *
 * Children: strings, numbers, Nodes, nested arrays. null/undefined/false skipped.
 * The second argument may itself be a child (h('p', 'hello')).
 */
export function h(tag, attrs, ...children) {
  const node = document.createElement(tag);
  let props = attrs;

  if (props !== null && props !== undefined && (isChildLike(props) || typeof props !== 'object')) {
    children.unshift(props);
    props = null;
  }

  if (props) {
    for (const key of Object.keys(props)) {
      const value = props[key];
      if (value === null || value === undefined || value === false) continue;

      if (key === 'class' || key === 'className') {
        const cls = classString(value);
        if (cls) node.setAttribute('class', cls);
      } else if (key === 'dataset') {
        if (value && typeof value === 'object') {
          for (const dk of Object.keys(value)) {
            const dv = value[dk];
            if (dv === null || dv === undefined || dv === false) continue;
            node.dataset[camel(dk)] = dv === true ? '' : String(dv);
          }
        }
      } else if (key === 'on') {
        if (value && typeof value === 'object') {
          for (const evt of Object.keys(value)) {
            const handler = value[evt];
            if (Array.isArray(handler)) handler.filter(Boolean).forEach((fn) => node.addEventListener(evt, fn));
            else if (handler) node.addEventListener(evt, handler);
          }
        }
      } else if (key === 'style') {
        if (typeof value === 'string') {
          node.setAttribute('style', value);
        } else if (value && typeof value === 'object') {
          for (const prop of Object.keys(value)) {
            const v = value[prop];
            if (v === null || v === undefined || v === false) continue;
            if (prop.startsWith('--')) node.style.setProperty(prop, String(v));
            else node.style[prop] = typeof v === 'number' ? `${v}px` : String(v);
          }
        }
      } else if (PROPERTY_KEYS.has(key)) {
        node[key] = value;
      } else if (value === true) {
        node.setAttribute(key, '');
      } else {
        node.setAttribute(key, String(value));
      }
    }
  }

  appendChild(node, children);
  return node;
}

/* ==================================================================== *
 * el() — parse one element out of an HTML string
 * ==================================================================== */

/**
 * el('<li class="row">Hi</li>') -> HTMLLIElement
 *
 * Uses a <template>, so table rows, list items and SVG parse correctly.
 * If the string has several roots, the FIRST element is returned. If it has no
 * element at all, the text is wrapped in a <span> rather than returning null,
 * so callers never have to null-check.
 */
export function el(htmlString) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(htmlString === null || htmlString === undefined ? '' : htmlString).trim();
  const first = tpl.content.firstElementChild;
  if (first) return first;
  const span = document.createElement('span');
  span.textContent = tpl.content.textContent || '';
  return span;
}

/* ==================================================================== *
 * card / btn / stat — HTML strings for template literals
 * ==================================================================== */

/**
 * card({title, subtitle, body, footer, tone}) -> HTML string
 *
 *   title, subtitle : TEXT — escaped.
 *   body, footer    : HTML — not escaped (that is the point; nest btn()/stat()/
 *                     chart strings here). Arrays are joined.
 *   tone            : 'accent' | 'brand' | 'win' | 'calm' | 'signal' | 'quiet'
 *   class           : extra class names (optional)
 *   id              : element id (optional)
 *   action / data   : make the whole card a tappable button (optional)
 */
export function card(opts = {}) {
  const { title, subtitle, body, footer, tone, action } = opts;
  const classes = ['card'];
  if (tone) classes.push(`card-${safeToken(tone, 'default')}`);
  if (action) classes.push('card-tap');
  const extra = classString(opts.class);
  if (extra) classes.push(extra);

  const idAttr = opts.id ? ` id="${escapeHtml(opts.id)}"` : '';

  let head = '';
  if (title || subtitle) {
    head =
      '<header class="card-head">' +
      (title ? `<h3 class="card-title">${escapeHtml(title)}</h3>` : '') +
      (subtitle ? `<p class="card-sub">${escapeHtml(subtitle)}</p>` : '') +
      '</header>';
  }

  const bodyHtml = body === null || body === undefined || body === '' ? '' : `<div class="card-body">${htmlChunk(body)}</div>`;
  const footHtml = footer === null || footer === undefined || footer === '' ? '' : `<footer class="card-foot">${htmlChunk(footer)}</footer>`;
  const inner = head + bodyHtml + footHtml;

  if (action) {
    return (
      `<button type="button" class="${escapeHtml(classes.join(' '))}"${idAttr}` +
      ` data-action="${escapeHtml(action)}"${dataAttrs(opts.data)}>${inner}</button>`
    );
  }
  return `<section class="${escapeHtml(classes.join(' '))}"${idAttr}>${inner}</section>`;
}

/**
 * btn({label, action, data, variant, size}) -> HTML string
 *
 *   label   : TEXT — escaped.
 *   action  : the data-action name the Router (or a sheet) will look up.
 *   data    : {exerciseId:'x'} -> data-exercise-id="x" -> node.dataset.exerciseId
 *   variant : 'primary' (default) | 'ghost' | 'danger'
 *   size    : 'lg' (default) | 'md'
 *   disabled, full, ariaLabel, icon (inline SVG string), type — optional extras.
 */
export function btn(opts = {}) {
  const { label, action, data, disabled } = opts;
  const variant = safeToken(opts.variant, 'primary');
  const size = safeToken(opts.size, 'lg');

  const classes = ['btn', `btn-${variant}`, `btn-${size}`];
  if (opts.full) classes.push('btn-full');
  const extra = classString(opts.class);
  if (extra) classes.push(extra);

  const type = safeToken(opts.type, 'button') === 'submit' ? 'submit' : 'button';
  const actionAttr = action ? ` data-action="${escapeHtml(action)}"` : '';
  const ariaAttr = opts.ariaLabel ? ` aria-label="${escapeHtml(opts.ariaLabel)}"` : '';
  const idAttr = opts.id ? ` id="${escapeHtml(opts.id)}"` : '';
  const disabledAttr = disabled ? ' disabled aria-disabled="true"' : '';
  const icon = opts.icon ? `<span class="btn-icon" aria-hidden="true">${htmlChunk(opts.icon)}</span>` : '';
  const text = label === null || label === undefined || label === '' ? '' : `<span class="btn-label">${escapeHtml(label)}</span>`;

  return (
    `<button type="${type}" class="${escapeHtml(classes.join(' '))}"${idAttr}${actionAttr}` +
    `${dataAttrs(data)}${ariaAttr}${disabledAttr}>${icon}${text}</button>`
  );
}

/**
 * stat({label, value, unit, delta, tone}) -> HTML string
 *
 *   label : TEXT (escaped) — what the number is.
 *   value : TEXT or number (escaped) — pre-format with fmt.* if you want units
 *           inside the number itself; otherwise pass `unit` separately.
 *   unit  : TEXT (escaped) — 'lb', '%', 'sets'.
 *   delta : number -> rendered as +15 / −5 with an up/down class;
 *           string -> shown verbatim (escaped), tone from `deltaTone`.
 *   tone  : 'accent' | 'brand' | 'win' | 'calm' | 'signal' | 'quiet'
 */
export function stat(opts = {}) {
  const { label, value, unit, delta, tone } = opts;
  const classes = ['stat'];
  if (tone) classes.push(`stat-${safeToken(tone, 'default')}`);
  const extra = classString(opts.class);
  if (extra) classes.push(extra);

  let deltaHtml = '';
  if (delta !== null && delta !== undefined && delta !== '') {
    let deltaClass = 'stat-delta';
    let deltaText;
    if (typeof delta === 'number' && Number.isFinite(delta)) {
      if (delta > 0) { deltaClass += ' stat-delta-up'; deltaText = `+${fmt.num(delta)}`; }
      else if (delta < 0) { deltaClass += ' stat-delta-down'; deltaText = `−${fmt.num(Math.abs(delta))}`; }
      else { deltaClass += ' stat-delta-flat'; deltaText = '0'; }
    } else {
      deltaText = String(delta);
      if (opts.deltaTone) deltaClass += ` stat-delta-${safeToken(opts.deltaTone, 'flat')}`;
    }
    deltaHtml = `<span class="${escapeHtml(deltaClass)}">${escapeHtml(deltaText)}</span>`;
  }

  const unitHtml = unit ? `<span class="stat-unit">${escapeHtml(unit)}</span>` : '';
  const labelHtml = label === null || label === undefined || label === '' ? '' : `<span class="stat-label">${escapeHtml(label)}</span>`;

  return (
    `<div class="${escapeHtml(classes.join(' '))}">` +
    labelHtml +
    `<span class="stat-value"><span class="stat-num">${escapeHtml(value === null || value === undefined ? '—' : value)}</span>${unitHtml}</span>` +
    deltaHtml +
    '</div>'
  );
}

/* ==================================================================== *
 * Bottom sheet
 * ==================================================================== */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),' +
  'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

let sheetSeq = 0;
let activeSheet = null;        // { layer, panel, actions, onClose, restoreFocus, closing }
let scrollLock = null;         // { y, bodyStyle:{...} }
let hiddenSiblings = [];       // background nodes we set aria-hidden on

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Freeze the page behind the sheet. iOS needs position:fixed, not just overflow. */
function lockScroll() {
  if (scrollLock) return;
  const body = document.body;
  const y = window.scrollY || window.pageYOffset || 0;
  scrollLock = {
    y,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow
  };
  body.style.position = 'fixed';
  body.style.top = `-${y}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
}

function unlockScroll() {
  if (!scrollLock) return;
  const body = document.body;
  body.style.position = scrollLock.position;
  body.style.top = scrollLock.top;
  body.style.left = scrollLock.left;
  body.style.right = scrollLock.right;
  body.style.width = scrollLock.width;
  body.style.overflow = scrollLock.overflow;
  const y = scrollLock.y;
  scrollLock = null;
  window.scrollTo(0, y);
}

/** Hide everything behind the sheet from assistive tech, then put it back. */
function hideBackground(layer) {
  hiddenSiblings = [];
  for (const node of Array.from(document.body.children)) {
    if (node === layer || node.id === 'daybreak-toasts' || node.tagName === 'SCRIPT') continue;
    if (node.getAttribute('aria-hidden') === 'true') continue;
    node.setAttribute('aria-hidden', 'true');
    hiddenSiblings.push(node);
  }
}

function restoreBackground() {
  for (const node of hiddenSiblings) node.removeAttribute('aria-hidden');
  hiddenSiblings = [];
}

function focusablesIn(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(
    (node) => node.offsetParent !== null || node === document.activeElement
  );
}

function trapTab(event, panel) {
  const items = focusablesIn(panel);
  if (!items.length) {
    event.preventDefault();
    panel.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const current = document.activeElement;
  if (event.shiftKey) {
    if (current === first || current === panel || !panel.contains(current)) {
      event.preventDefault();
      last.focus();
    }
  } else if (current === last) {
    event.preventDefault();
    first.focus();
  }
}

function onSheetKeydown(event) {
  if (!activeSheet) return;
  if (event.key === 'Escape' || event.key === 'Esc') {
    event.preventDefault();
    closeSheet();
    return;
  }
  if (event.key === 'Tab') trapTab(event, activeSheet.panel);
}

/**
 * Sheet-local click delegation.
 *
 * DELEGATION MODEL — read this before wiring a sheet up:
 *   The `actions` map passed to sheet() is the path that is guaranteed to work
 *   end to end, and it is the one this module uses itself (confirmDialog). A
 *   click inside the sheet walks up to the nearest [data-action]; if that name
 *   is in the map, handler(node, node.dataset) runs — same signature as a
 *   feature's `actions` (§6.1).
 *   In addition, EVERY action click also dispatches a bubbling CustomEvent
 *   "daybreak:action" on document with
 *       detail = { action, node, dataset, source:'sheet', handled }
 *   `handled` is true when a sheet-local handler already ran, so a Router
 *   listening for the event can ignore those and pick up only the ones the
 *   sheet did not claim. Sheets are outside the content root, so this event is
 *   how a feature handles a sheet action without passing a map.
 */
function onSheetClick(event) {
  if (!activeSheet) return;
  const node = event.target.closest('[data-action],[data-sheet-close]');
  if (!node || !activeSheet.panel.contains(node)) return;

  if (node.hasAttribute('data-sheet-close') || node.dataset.action === 'close-sheet') {
    event.preventDefault();
    closeSheet();
    return;
  }

  const action = node.dataset.action;
  if (!action) return;

  const handler = activeSheet.actions ? activeSheet.actions[action] : null;
  let handled = false;
  if (typeof handler === 'function') {
    handled = true;
    try {
      const result = handler(node, node.dataset);
      if (result && typeof result.catch === 'function') {
        result.catch((err) => console.error(`Daybreak: sheet action "${action}" failed`, err));
      }
    } catch (err) {
      console.error(`Daybreak: sheet action "${action}" failed`, err);
    }
  }

  document.dispatchEvent(
    new CustomEvent('daybreak:action', {
      bubbles: true,
      detail: { action, node, dataset: { ...node.dataset }, source: 'sheet', handled }
    })
  );
}

function onBackdropClick() {
  if (activeSheet && activeSheet.dismissible !== false) closeSheet();
}

/**
 * sheet(titleText, bodyHTML, {actions, dismissible, onClose, tone, class}) -> void
 *
 *   titleText   : TEXT — escaped.
 *   bodyHTML    : HTML — not escaped. Build it with card()/btn()/stat().
 *   actions     : {'do-thing': (node, data) => {}} — sheet-local delegation.
 *   dismissible : false to require an explicit button (default true).
 *   onClose     : called once, after the sheet is gone.
 *
 * Only one sheet exists at a time; opening a second closes the first.
 */
export function sheet(titleText, bodyHTML, opts = {}) {
  if (activeSheet) closeSheet(true);

  const titleId = `daybreak-sheet-title-${++sheetSeq}`;
  const layer = document.createElement('div');
  layer.className = 'sheet-layer';
  const extra = classString(opts.class);

  layer.innerHTML =
    '<div class="sheet-backdrop" data-sheet-backdrop></div>' +
    `<div class="sheet${opts.tone ? ` sheet-${safeToken(opts.tone, 'default')}` : ''}${extra ? ` ${escapeHtml(extra)}` : ''}" ` +
    `role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">` +
    '<div class="sheet-grip" aria-hidden="true"></div>' +
    '<header class="sheet-head">' +
    `<h2 class="sheet-title" id="${titleId}">${escapeHtml(titleText)}</h2>` +
    (opts.dismissible === false
      ? ''
      : `<button type="button" class="sheet-close" data-sheet-close aria-label="Close">${CLOSE_ICON}</button>`) +
    '</header>' +
    `<div class="sheet-body">${htmlChunk(bodyHTML)}</div>` +
    '</div>';

  const panel = layer.querySelector('.sheet');
  const backdrop = layer.querySelector('.sheet-backdrop');

  document.body.appendChild(layer);
  lockScroll();
  hideBackground(layer);

  activeSheet = {
    layer,
    panel,
    actions: opts.actions && typeof opts.actions === 'object' ? opts.actions : null,
    onClose: typeof opts.onClose === 'function' ? opts.onClose : null,
    dismissible: opts.dismissible,
    restoreFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    closing: false
  };

  layer.addEventListener('click', onSheetClick);
  backdrop.addEventListener('click', onBackdropClick);
  document.addEventListener('keydown', onSheetKeydown, true);

  // Animate in on the next frame so the closed transform is committed first.
  requestAnimationFrame(() => {
    if (activeSheet && activeSheet.layer === layer) layer.classList.add('is-open');
  });

  const firstFocus = focusablesIn(panel)[0];
  (firstFocus || panel).focus({ preventScroll: true });
}

/** closeSheet() -> void. Closes whatever sheet is open; safe to call when none is. */
export function closeSheet(immediate) {
  const current = activeSheet;
  if (!current || current.closing) return;
  current.closing = true;
  activeSheet = null;

  const { layer, panel, onClose, restoreFocus } = current;
  layer.removeEventListener('click', onSheetClick);
  document.removeEventListener('keydown', onSheetKeydown, true);
  layer.classList.remove('is-open');

  const finish = () => {
    if (layer.parentNode) layer.parentNode.removeChild(layer);
    restoreBackground();
    unlockScroll();
    if (restoreFocus && document.contains(restoreFocus)) {
      restoreFocus.focus({ preventScroll: true });
    }
    if (onClose) {
      try { onClose(); } catch (err) { console.error('Daybreak: sheet onClose failed', err); }
    }
  };

  if (immediate === true || prefersReducedMotion()) {
    finish();
    return;
  }

  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    panel.removeEventListener('transitionend', once);
    finish();
  };
  panel.addEventListener('transitionend', once);
  setTimeout(once, 320);
}

/* ==================================================================== *
 * Toast
 * ==================================================================== */

const TOAST_MS = 2500;
const TOAST_MAX = 3;

function toastStack() {
  let stack = document.getElementById('daybreak-toasts');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'daybreak-toasts';
    stack.className = 'toast-stack';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  } else if (stack.parentNode !== document.body) {
    document.body.appendChild(stack);
  }
  return stack;
}

function dismissToast(node) {
  if (!node || node.dataset.leaving === '1') return;
  node.dataset.leaving = '1';
  if (node._daybreakTimer) clearTimeout(node._daybreakTimer);
  node.classList.remove('is-in');
  const remove = () => { if (node.parentNode) node.parentNode.removeChild(node); };
  if (prefersReducedMotion()) remove();
  else setTimeout(remove, 220);
}

/**
 * toast(message, tone) -> void
 * 2.5 s, above the bottom nav. Calling it again while one is up stacks the new
 * message under the old one; past three, the oldest is dropped immediately.
 * tone: 'win' | 'calm' | 'signal' | 'accent' (optional).
 */
export function toast(message, tone) {
  const stack = toastStack();

  while (stack.children.length >= TOAST_MAX) {
    const oldest = stack.firstElementChild;
    if (oldest && oldest._daybreakTimer) clearTimeout(oldest._daybreakTimer);
    if (oldest && oldest.parentNode) oldest.parentNode.removeChild(oldest);
    else break;
  }

  const node = document.createElement('div');
  node.className = tone ? `toast toast-${safeToken(tone, 'default')}` : 'toast';
  node.textContent = message === null || message === undefined ? '' : String(message);
  stack.appendChild(node);

  requestAnimationFrame(() => node.classList.add('is-in'));
  node._daybreakTimer = setTimeout(() => dismissToast(node), TOAST_MS);
}

/* ==================================================================== *
 * confirmDialog
 * ==================================================================== */

/**
 * confirmDialog(question, {confirmLabel, cancelLabel, danger, title, detail})
 *   -> Promise<boolean>
 *
 * Built on sheet(), using the sheet-local `actions` map. Backdrop, Escape and
 * the close button all resolve false — the safe answer.
 */
export function confirmDialog(question, opts = {}) {
  const confirmLabel = opts.confirmLabel || 'Confirm';
  const cancelLabel = opts.cancelLabel || 'Cancel';
  const danger = opts.danger === true;
  const title = opts.title || (danger ? 'Confirm' : 'Just checking');

  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const body =
      `<p class="sheet-question">${escapeHtml(question)}</p>` +
      (opts.detail ? `<p class="sheet-detail">${escapeHtml(opts.detail)}</p>` : '') +
      '<div class="sheet-actions">' +
      btn({ label: confirmLabel, action: 'confirm-yes', variant: danger ? 'danger' : 'primary', size: 'lg', full: true }) +
      btn({ label: cancelLabel, action: 'confirm-no', variant: 'ghost', size: 'lg', full: true }) +
      '</div>';

    sheet(title, body, {
      actions: {
        'confirm-yes': () => { settle(true); closeSheet(); },
        'confirm-no': () => { settle(false); closeSheet(); }
      },
      onClose: () => settle(false)
    });
  });
}

/* ==================================================================== *
 * fmt — display formatting
 * ==================================================================== */

const EM_DASH = '—';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Parse a stored date. 'YYYY-MM-DD' is built as a LOCAL date on purpose —
 * new Date('2026-09-08') is UTC midnight and reads as Sep 7 west of Greenwich.
 * Full ISO timestamps go through the native parser, which already localises.
 */
function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const fmt = {
  /**
   * num(1234.56) -> '1,234.6' · num(12) -> '12' · num(12.0) -> '12'
   * Locale-formatted, at most one decimal, trailing .0 dropped.
   */
  num(value) {
    const n = toNumber(value);
    if (n === null) return EM_DASH;
    try {
      return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
    } catch (_) {
      const rounded = Math.round(n * 10) / 10;
      return String(rounded);
    }
  },

  /** lb(165) -> '165 lb' · lb(52.5) -> '52.5 lb' · lb(null) -> '—'. Never 'lbs'. */
  lb(value) {
    const n = toNumber(value);
    if (n === null) return EM_DASH;
    return `${fmt.num(n)} lb`;
  },

  /** inches(32.5) -> '32.5″'. Double-prime, not a quote — it survives attributes. */
  inches(value) {
    const n = toNumber(value);
    if (n === null) return EM_DASH;
    return `${fmt.num(n)}″`;
  },

  /**
   * pct(0.86) -> '86%' · pct(86) -> '86%' · pct(1) -> '100%'
   * Fractions and percentages both arrive here (shapemap hands over 0–1,
   * readiness hands over 0–100), so anything in [-1, 1] is read as a fraction.
   * Pass `digits` for decimals: pct(0.865, 1) -> '86.5%'.
   */
  pct(value, digits) {
    const n = toNumber(value);
    if (n === null) return EM_DASH;
    const scaled = Math.abs(n) <= 1 ? n * 100 : n;
    const places = Number.isFinite(digits) ? Math.max(0, Math.min(2, digits)) : 0;
    const factor = Math.pow(10, places);
    const rounded = Math.round(scaled * factor) / factor;
    return `${fmt.num(rounded)}%`;
  },

  /** date('2026-09-08') -> 'Mon, Sep 8' */
  date(iso) {
    const d = parseDate(iso);
    if (!d) return EM_DASH;
    try {
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    } catch (_) {
      return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
    }
  },

  /** shortDate('2026-09-08') -> 'Sep 8' */
  shortDate(iso) {
    const d = parseDate(iso);
    if (!d) return EM_DASH;
    try {
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (_) {
      return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
    }
  },

  /** duration(45) -> '45s' · duration(92) -> '1:32' · duration(3903) -> '1:05:03' */
  duration(seconds) {
    const n = toNumber(seconds);
    if (n === null) return EM_DASH;
    const total = Math.max(0, Math.round(n));
    if (total < 60) return `${total}s`;
    const pad = (v) => String(v).padStart(2, '0');
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hrs > 0) return `${hrs}:${pad(mins)}:${pad(secs)}`;
    return `${mins}:${pad(secs)}`;
  }
};

/* ==================================================================== *
 * Structural fallback styles
 * ====================================================================
 * css/components.css owns the look. These rules only make the sheet and the
 * toast POSITION and ANIMATE correctly, so this module works on its own. They
 * are injected as the first stylesheet in <head> and use single-class
 * selectors, so anything components.css says wins.
 */

const FALLBACK_CSS = `
.sheet-layer{position:fixed;inset:0;z-index:900;display:flex;align-items:flex-end;justify-content:center}
.sheet-backdrop{position:absolute;inset:0;background:rgba(36,28,38,.5);opacity:0;transition:opacity .22s var(--ease,cubic-bezier(.2,.8,.3,1))}
.sheet-layer.is-open .sheet-backdrop{opacity:1}
.sheet{position:relative;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;-webkit-overflow-scrolling:touch;
  background:var(--surface,#fff);color:var(--text,#241C26);font-family:var(--font-ui,system-ui,sans-serif);font-size:var(--fs-body,1.0625rem);
  border-radius:var(--r-lg,20px) var(--r-lg,20px) 0 0;box-shadow:var(--shadow-lg,0 8px 28px rgba(36,28,38,.12));
  padding:var(--sp-3,12px) var(--sp-4,16px) calc(var(--sp-6,32px) + env(safe-area-inset-bottom,0px));
  transform:translateY(100%);transition:transform .26s var(--ease,cubic-bezier(.2,.8,.3,1))}
.sheet-layer.is-open .sheet{transform:translateY(0)}
.sheet:focus{outline:none}
.sheet-grip{width:40px;height:4px;border-radius:999px;background:var(--border,#E7DBD1);margin:0 auto var(--sp-2,8px)}
.sheet-head{display:flex;align-items:center;gap:var(--sp-3,12px);min-height:var(--tap,56px)}
.sheet-title{flex:1;margin:0;font-family:var(--font-display,Georgia,serif);font-size:var(--fs-h2,1.3rem);font-weight:600;line-height:1.25}
.sheet-close{flex:none;width:var(--tap,56px);height:var(--tap,56px);display:flex;align-items:center;justify-content:center;
  background:none;border:0;border-radius:var(--r-full,999px);color:var(--text-dim,#6B5F6E);cursor:pointer}
.sheet-body{padding-top:var(--sp-2,8px)}
.sheet-question{margin:0 0 var(--sp-3,12px);font-size:var(--fs-body,1.0625rem);line-height:1.45}
.sheet-detail{margin:0 0 var(--sp-4,16px);color:var(--text-dim,#6B5F6E);font-size:var(--fs-sm,.9375rem);line-height:1.45}
.sheet-actions{display:flex;flex-direction:column;gap:var(--sp-2,8px);margin-top:var(--sp-4,16px)}
.toast-stack{position:fixed;left:0;right:0;bottom:calc(var(--nav-h,68px) + var(--sp-4,16px) + env(safe-area-inset-bottom,0px));
  z-index:950;display:flex;flex-direction:column;align-items:center;gap:var(--sp-2,8px);padding:0 var(--sp-4,16px);pointer-events:none}
.toast{max-width:100%;box-sizing:border-box;padding:var(--sp-3,12px) var(--sp-4,16px);border-radius:var(--r,14px);
  background:var(--surface,#fff);color:var(--text,#241C26);border:1px solid var(--border,#E7DBD1);
  box-shadow:var(--shadow-lg,0 8px 28px rgba(36,28,38,.12));font-family:var(--font-ui,system-ui,sans-serif);
  font-size:var(--fs-body,1.0625rem);line-height:1.35;opacity:0;transform:translateY(8px);
  transition:opacity .18s var(--ease,ease),transform .18s var(--ease,ease)}
.toast.is-in{opacity:1;transform:translateY(0)}
.toast-win{border-left:4px solid var(--win,#D99A32)}
.toast-calm{border-left:4px solid var(--calm,#6E8B72)}
.toast-signal{border-left:4px solid var(--signal,#B3556B)}
.toast-accent{border-left:4px solid var(--accent,#C4674F)}
@media (prefers-reduced-motion:reduce){
  .sheet,.sheet-backdrop,.toast{transition:none}
  .sheet{transform:none}
}
`;

function injectFallbackCSS() {
  if (typeof document === 'undefined') return;
  const head = document.head;
  if (!head || document.getElementById('daybreak-components-fallback')) return;
  const style = document.createElement('style');
  style.id = 'daybreak-components-fallback';
  style.textContent = FALLBACK_CSS;
  head.insertBefore(style, head.firstChild);
}

if (typeof document !== 'undefined') {
  if (document.head) injectFallbackCSS();
  else document.addEventListener('DOMContentLoaded', injectFallbackCSS, { once: true });
}
