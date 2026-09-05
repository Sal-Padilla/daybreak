// Daybreak — js/core/router.js — five-tab router: hash routing, async render, global data-action delegation.

/**
 * Tab order is fixed by BUILD_CONTRACT §6.5: Today · Train · Week · Shape · Me.
 * Any feature passed in that is not in this list is appended in the order given.
 */
const TAB_ORDER = ['today', 'train', 'week', 'shape', 'me'];

/** Bottom-nav icons — inline SVG, stroke-based, currentColor. No emoji in chrome. */
const ICONS = {
  today: '<path d="M12 3v3M4.9 6.5l2.1 2.1M19.1 6.5l-2.1 2.1M2.5 15.5h19M6.5 15.5a5.5 5.5 0 0 1 11 0"/><path d="M4 19.5h16"/>',
  train: '<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',
  week:  '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3.5v3M16 3.5v3M3.5 10h17"/>',
  shape: '<path d="M12 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"/><path d="M8.5 9h7l1 5h-2l-.5 6h-3l-.5-6h-2Z"/>',
  me:    '<path d="M12 4a3.6 3.6 0 1 1 0 7.2A3.6 3.6 0 0 1 12 4Z"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/>'
};

const FALLBACK_NAV_CSS = `
.db-nav{position:fixed;left:0;right:0;bottom:0;z-index:20;display:flex;
 background:var(--surface,#fff);border-top:1px solid var(--border,#E7DBD1);
 padding-bottom:env(safe-area-inset-bottom,0px)}
.db-nav .nav-btn{flex:1 1 0;min-height:var(--tap,56px);display:flex;flex-direction:column;
 align-items:center;justify-content:center;gap:var(--sp-1,4px);padding:var(--sp-2,8px) 0;
 background:none;border:0;font:inherit;font-size:var(--fs-xs,0.8125rem);
 color:var(--text-dim,#6B5F6E);cursor:pointer;-webkit-tap-highlight-color:transparent}
.db-nav .nav-btn[aria-current="page"]{color:var(--accent,#C4674F)}
.db-nav .nav-icon{width:24px;height:24px;display:block}
`;

/* ------------------------------------------------------------------ *
 * Internals
 * ------------------------------------------------------------------ */

let contentEl = null;
let navEl = null;
const features = new Map();   // id -> feature module
let order = [];               // tab ids in nav order
let activeId = null;
let wired = false;
let renderSeq = 0;
let navigating = false;

/** Router-owned actions, checked before the active feature's map. */
const routerActions = {
  'router-retry': () => Router.refresh(),
  'router-go': (node, data) => { if (data && data.tab) Router.go(data.tab); }
};

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveEl(target, what) {
  if (!target) return null;
  if (typeof target === 'string') return document.querySelector(target);
  if (target.nodeType === 1) return target;
  console.error(`Daybreak Router: could not resolve the ${what} element.`, target);
  return null;
}

function tabFromHash() {
  const raw = (window.location.hash || '').replace(/^#\/?/, '').split(/[?/]/)[0];
  return features.has(raw) ? raw : null;
}

function isFormControl(node) {
  if (!node) return false;
  const tag = node.tagName;
  if (tag === 'SELECT' || tag === 'TEXTAREA') return true;
  if (tag !== 'INPUT') return false;
  const type = (node.getAttribute('type') || 'text').toLowerCase();
  // Buttons rendered as <input> still belong to click.
  return type !== 'button' && type !== 'submit' && type !== 'reset' && type !== 'image';
}

/**
 * Which event a form control listens on, so a control never fires twice.
 * Ranges (and anything marked data-on="input") update live; everything else
 * commits on change, which is what a weight or reps field wants.
 */
function controlEvent(node) {
  const explicit = (node.getAttribute('data-on') || '').toLowerCase();
  if (explicit === 'input' || explicit === 'change') return explicit;
  const type = node.tagName === 'INPUT' ? (node.getAttribute('type') || 'text').toLowerCase() : '';
  return type === 'range' ? 'input' : 'change';
}

function dispatch(name, node, event) {
  const handler = routerActions[name] || (features.get(activeId) || {}).actions?.[name];
  if (typeof handler !== 'function') {
    console.warn(`Daybreak Router: no handler for data-action="${name}" on tab "${activeId}".`);
    return;
  }
  if (event && event.type === 'click' && node.tagName === 'A') event.preventDefault();
  let result;
  try {
    result = handler(node, node.dataset, event);
  } catch (err) {
    console.error(`Daybreak Router: action "${name}" threw.`, err);
    return;
  }
  if (result && typeof result.then === 'function') {
    result.catch((err) => console.error(`Daybreak Router: action "${name}" rejected.`, err));
  }
}

function onClick(event) {
  const start = event.target && event.target.nodeType === 1 ? event.target : event.target?.parentElement;
  if (!start) return;
  const node = start.closest('[data-action]');
  if (!node || !contentEl.contains(node)) return;
  if (node.disabled || node.getAttribute('aria-disabled') === 'true') return;
  // Form controls are served by change/input so they cannot fire twice.
  if (isFormControl(node)) return;
  dispatch(node.getAttribute('data-action'), node, event);
}

function onFormEvent(event) {
  const node = event.target;
  if (!node || node.nodeType !== 1 || !node.hasAttribute('data-action')) return;
  if (!contentEl.contains(node)) return;
  if (isFormControl(node) && controlEvent(node) !== event.type) return;
  dispatch(node.getAttribute('data-action'), node, event);
}

function onSubmit(event) {
  const form = event.target;
  if (!form || form.nodeType !== 1 || !contentEl.contains(form)) return;
  event.preventDefault();   // never reload the shell
  if (form.hasAttribute('data-action')) {
    dispatch(form.getAttribute('data-action'), form, event);
  }
}

function onHashChange() {
  if (navigating) return;
  const tab = tabFromHash();
  if (tab && tab !== activeId) Router.go(tab);
}

/* ------------------------------------------------------------------ *
 * Navigation bar
 * ------------------------------------------------------------------ */

function buildNav() {
  if (!navEl) return;
  if (navEl.querySelector('[data-tab]')) return;   // the shell already ships a nav

  if (!document.getElementById('daybreak-nav-fallback')) {
    const style = document.createElement('style');
    style.id = 'daybreak-nav-fallback';
    style.textContent = FALLBACK_NAV_CSS;
    document.head.appendChild(style);
  }
  navEl.classList.add('db-nav');
  navEl.innerHTML = order.map((id) => {
    const feature = features.get(id);
    const label = escapeHtml(feature && feature.title ? feature.title : id);
    const path = ICONS[id] || ICONS.today;
    return `<button class="nav-btn" type="button" data-tab="${escapeHtml(id)}">` +
      `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
      `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>` +
      `<span class="nav-label">${label}</span></button>`;
  }).join('');
}

function onNavClick(event) {
  const start = event.target && event.target.nodeType === 1 ? event.target : event.target?.parentElement;
  if (!start) return;
  const node = start.closest('[data-tab]');
  if (!node || !navEl.contains(node)) return;
  event.preventDefault();
  Router.go(node.getAttribute('data-tab'));
}

function syncNav() {
  if (!navEl) return;
  const buttons = navEl.querySelectorAll('[data-tab]');
  for (const node of buttons) {
    const isActive = node.getAttribute('data-tab') === activeId;
    node.classList.toggle('is-active', isActive);
    if (isActive) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  }
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

function showRenderError(feature, err) {
  const name = escapeHtml(feature && feature.title ? feature.title : activeId);
  const detail = escapeHtml((err && err.message) || String(err));
  contentEl.innerHTML =
    `<section class="view-error" role="alert">` +
      `<h2>${name} didn't load.</h2>` +
      `<p>Your training data is safe — this screen hit an error while drawing itself.</p>` +
      `<p class="view-error-detail"><code>${detail}</code></p>` +
      `<button class="btn btn-primary" type="button" data-action="router-retry">Try again</button>` +
    `</section>`;
}

async function renderActive(preserveScroll) {
  const feature = features.get(activeId);
  if (!contentEl || !feature) return;

  const seq = ++renderSeq;
  const scrollY = preserveScroll ? window.scrollY : 0;

  contentEl.setAttribute('aria-busy', 'true');
  contentEl.dataset.tab = activeId;
  contentEl.innerHTML = '';

  try {
    await feature.render(contentEl);
    if (seq !== renderSeq) return;   // a newer render won
  } catch (err) {
    if (seq !== renderSeq) return;
    console.error(`Daybreak Router: "${activeId}" failed to render.`, err);
    showRenderError(feature, err);
  } finally {
    if (seq === renderSeq) contentEl.setAttribute('aria-busy', 'false');
  }

  if (preserveScroll) window.scrollTo(0, scrollY);
  else window.scrollTo(0, 0);

  if (feature.title) document.title = `Daybreak — ${feature.title}`;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export const Router = {
  /**
   * Wire the router up and render the starting tab.
   *
   * @param {object}  options
   * @param {Element|string} options.content  where features render
   * @param {Element|string} [options.nav]    bottom nav; built here if it has no [data-tab] children
   * @param {Array|Object}   options.features feature modules (array, or map keyed by id)
   * @returns {Promise<string>} the tab that ended up active
   */
  async init({ content, nav, features: featureList } = {}) {
    contentEl = resolveEl(content, 'content');
    navEl = resolveEl(nav, 'nav');
    if (!contentEl) throw new Error('Daybreak Router: init() needs a content element.');

    features.clear();
    const list = Array.isArray(featureList)
      ? featureList
      : (featureList && typeof featureList === 'object' ? Object.values(featureList) : []);
    for (const mod of list) {
      if (!mod || typeof mod.render !== 'function' || !mod.id) {
        console.error('Daybreak Router: skipping a feature without an id and a render().', mod);
        continue;
      }
      features.set(mod.id, mod);
    }
    if (features.size === 0) throw new Error('Daybreak Router: init() needs at least one feature.');

    const known = TAB_ORDER.filter((id) => features.has(id));
    const extra = Array.from(features.keys()).filter((id) => !TAB_ORDER.includes(id));
    order = known.concat(extra);

    if (!wired) {
      contentEl.addEventListener('click', onClick);
      contentEl.addEventListener('change', onFormEvent);
      contentEl.addEventListener('input', onFormEvent);
      contentEl.addEventListener('submit', onSubmit);
      window.addEventListener('hashchange', onHashChange);
      wired = true;
    }
    if (navEl && !navEl.dataset.dbWired) {
      buildNav();
      navEl.addEventListener('click', onNavClick);
      navEl.dataset.dbWired = '1';
    }

    await this.go(tabFromHash() || order[0]);
    return activeId;
  },

  /** Switch tabs: updates the hash, the nav, and renders. */
  async go(tabId) {
    if (!features.has(tabId)) {
      console.error(`Daybreak Router: no tab named "${tabId}".`);
      if (!activeId) tabId = order[0]; else return activeId;
    }
    activeId = tabId;
    syncNav();

    const wanted = `#${tabId}`;
    if (window.location.hash !== wanted) {
      navigating = true;
      try { window.location.hash = wanted; } finally { navigating = false; }
    }

    await renderActive(false);
    return activeId;
  },

  /** Re-render the current tab in place, keeping scroll position. */
  async refresh() {
    if (!activeId) return null;
    await renderActive(true);
    return activeId;
  },

  /** The active tab id, or null before init(). */
  current() {
    return activeId;
  },

  /** The active feature module, or null. Handy for tests and debugging. */
  currentFeature() {
    return features.get(activeId) || null;
  },

  /** Tab ids in nav order. */
  tabs() {
    return order.slice();
  }
};
