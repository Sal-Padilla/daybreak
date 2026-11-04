// Lady_GYM — js/core/nav.js — iPhone navigation: tab bar, push/pop stacks, large titles, full-screen modals.
//
// Daybreak had five tabs and everything else in pop-up sheets layered on sheets, so there
// was no sense of "where am I" and no way back except closing things. This is the model every
// iPhone app uses and every iPhone owner already knows:
//   - four tabs at the bottom, each with its own history;
//   - tapping something pushes a page in from the right, with a "‹ Back" that says where back is;
//   - swipe from the left edge to go back;
//   - tap the current tab again to jump to its top;
//   - the workout itself opens full screen, like a workout in progress should.
//
// A page is a plain object: { id, title, large, render(params, ctx) -> html, actions, mount?, unmount? }.

const pages = new Map();
const stacks = new Map();        // tabId -> [entry]
let tabs = [];
let activeTab = null;
let modalStack = [];             // entries presented full screen
let globalActions = {};
let hostEl = null;
let tabbarEl = null;
let modalHost = null;
let renderSeq = 0;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const titleOf = (entry) => {
  const t = entry.page.title;
  return typeof t === 'function' ? t(entry.params || {}) : (t || '');
};

const backIcon = '<svg width="13" height="21" viewBox="0 0 13 21" aria-hidden="true"><path d="M11 2L3 10.5 11 19" ' +
  'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ------------------------------------------------------------------ building a page element */

function buildEntry(page, params, depth, prevTitle, inModal) {
  const el = document.createElement('div');
  el.className = 'page' + (page.large ? ' is-large' : '') + (page.cls ? ' ' + page.cls : '') + (inModal ? ' in-modal' : '');
  el.dataset.page = page.id;
  const entry = { page, params: params || {}, el, dirty: false, seq: 0 };
  const back = depth > 0
    ? '<button type="button" class="nav-back" data-action="nav-back" aria-label="Back to ' + esc(prevTitle || 'previous') + '">' +
      backIcon + '<span>' + esc(shorten(prevTitle || 'Back')) + '</span></button>'
    : (inModal && page.closeLabel !== false
      ? '<button type="button" class="nav-text" data-action="nav-dismiss">' + esc(page.closeLabel || 'Close') + '</button>' : '');
  el.innerHTML =
    '<header class="navbar">' +
      '<div class="navbar-left">' + back + '</div>' +
      '<div class="navbar-title" aria-hidden="' + (page.large ? 'true' : 'false') + '"></div>' +
      '<div class="navbar-right"></div>' +
    '</header>' +
    '<div class="page-scroll">' +
      (page.large ? '<div class="large-head"><div class="large-head-text"><p class="large-pre"></p>' +
        '<h1 class="large-title"></h1></div><div class="large-acc"></div></div>' : '') +
      '<div class="page-body"></div>' +
    '</div>';
  const scroll = el.querySelector('.page-scroll');
  entry.scrollEl = scroll;
  scroll.addEventListener('scroll', () => onScroll(entry), { passive: true });
  return entry;
}

// iOS shows the previous screen's title as the back label, and plain "Back" when it will not
// fit beside the current title. Long labels collided with the centred title on a 390px phone.
function shorten(s) {
  return s.length > 11 ? 'Back' : s;
}

function onScroll(entry) {
  const top = entry.scrollEl.scrollTop;
  const lt = entry.el.querySelector('.large-head');
  const threshold = lt ? lt.offsetHeight - 6 : 2;
  entry.el.classList.toggle('is-scrolled', top > threshold);
  entry.el.classList.toggle('is-moved', top > 2);
}

function ctxFor(entry) {
  return {
    params: entry.params,
    el: entry.el,
    body: entry.el.querySelector('.page-body'),
    refresh: () => renderEntry(entry, true),
    push: Nav.push,
    pop: Nav.pop,
  };
}

async function renderEntry(entry, keepScroll) {
  const seq = ++renderSeq;
  entry.seq = seq;
  entry.dirty = false;
  const body = entry.el.querySelector('.page-body');
  const scrollTop = entry.scrollEl.scrollTop;
  let html = '';
  try {
    html = await entry.page.render(entry.params, ctxFor(entry));
  } catch (err) {
    console.error('Lady_GYM: page "' + entry.page.id + '" failed to render.', err);
    html = '<div class="empty"><p class="empty-title">Something went wrong here</p>' +
      '<p class="empty-sub">Your data is safe. Try going back and opening it again.</p></div>';
  }
  if (entry.seq !== seq) return;              // a newer render started meanwhile
  if (entry.page.unmount) { try { entry.page.unmount(entry); } catch (_) { /* ignore */ } }
  body.innerHTML = html;
  const title = titleOf(entry);
  const nt = entry.el.querySelector('.navbar-title');
  if (nt) nt.textContent = title;
  const lt = entry.el.querySelector('.large-title');
  if (lt) lt.textContent = entry.page.largeTitle ? entry.page.largeTitle(entry.params) : title;
  const pre = entry.el.querySelector('.large-pre');
  if (pre) pre.textContent = entry.page.pre ? entry.page.pre(entry.params) : '';
  const acc = entry.el.querySelector('.large-acc');
  if (acc) acc.innerHTML = entry.page.accessory ? await entry.page.accessory(entry.params) : '';
  const right = entry.el.querySelector('.navbar-right');
  if (right) right.innerHTML = entry.page.right ? await entry.page.right(entry.params) : '';
  if (keepScroll) entry.scrollEl.scrollTop = scrollTop;
  if (entry.page.mount) { try { entry.page.mount(entry, ctxFor(entry)); } catch (err) { console.error(err); } }
  onScroll(entry);
}

/* ------------------------------------------------------------------ stacks */

function stackEl(tabId) {
  return hostEl.querySelector('.stack[data-tab="' + tabId + '"]');
}

function currentEntries() {
  return modalStack.length ? modalStack : (stacks.get(activeTab) || []);
}

function topEntry() {
  const list = currentEntries();
  return list[list.length - 1] || null;
}

function entryForNode(node) {
  const pageEl = node.closest('.page');
  if (!pageEl) return topEntry();
  for (const list of [modalStack, ...stacks.values()]) {
    const found = list.find((e) => e.el === pageEl);
    if (found) return found;
  }
  return topEntry();
}

function animate(el, cls, ms = 380) {
  return new Promise((resolve) => {
    el.classList.add(cls);
    setTimeout(() => { el.classList.remove(cls); resolve(); }, ms);
  });
}

/* ------------------------------------------------------------------ events */

async function runAction(node, e) {
  const name = node.dataset.action;
  const entry = entryForNode(node);
  if (name === 'nav-back') return Nav.pop();
  if (name === 'nav-dismiss') return Nav.dismiss();
  if (name === 'nav-push' && node.dataset.page) {
    return Nav.push(node.dataset.page, { ...node.dataset });
  }
  if (name === 'nav-tab' && node.dataset.tab) return Nav.tab(node.dataset.tab);
  const fn = (entry && entry.page.actions && entry.page.actions[name]) || globalActions[name];
  if (!fn) { console.warn('Lady_GYM: no action "' + name + '".'); return; }
  try {
    await fn(node, node.dataset, entry ? ctxFor(entry) : null, e);
  } catch (err) {
    console.error('Lady_GYM: action "' + name + '" failed.', err);
  }
}

function onClick(e) {
  if (e.target.closest('.sheet-layer, .alert-layer, .asheet-layer')) return;
  const node = e.target.closest('[data-action]');
  if (!node || node.disabled) return;
  if (node.tagName === 'INPUT' || node.tagName === 'SELECT' || node.tagName === 'TEXTAREA') return;
  if (node.tagName === 'A' && node.getAttribute('href') && node.getAttribute('href') !== '#') return;
  e.preventDefault();
  runAction(node, e);
}

function onField(e) {
  if (e.target.closest('.sheet-layer')) return;
  const node = e.target.closest('[data-action]');
  if (!node) return;
  if (!(node.tagName === 'INPUT' || node.tagName === 'SELECT' || node.tagName === 'TEXTAREA')) return;
  const wantsInput = node.dataset.on === 'input';
  if ((e.type === 'input') !== wantsInput) return;
  runAction(node, e);
}

/* Swipe from the left edge to go back, following the finger. */
function wireEdgeSwipe() {
  let start = null;
  hostEl.addEventListener('touchstart', (e) => {
    const list = stacks.get(activeTab) || [];
    if (modalStack.length || list.length < 2) return;
    const t = e.touches[0];
    if (t.clientX > 24) return;
    start = { x: t.clientX, y: t.clientY, t: performance.now(), top: list[list.length - 1], under: list[list.length - 2], dx: 0 };
    start.top.el.style.transition = 'none';
    start.under.el.style.transition = 'none';
  }, { passive: true });
  hostEl.addEventListener('touchmove', (e) => {
    if (!start) return;
    const t = e.touches[0];
    const dx = Math.max(0, t.clientX - start.x);
    if (Math.abs(t.clientY - start.y) > 40 && dx < 20) { cancel(); return; }
    start.dx = dx;
    const w = hostEl.clientWidth;
    start.top.el.style.transform = 'translateX(' + dx + 'px)';
    start.under.el.style.transform = 'translateX(' + (-0.28 * w + dx * 0.28) + 'px)';
  }, { passive: true });
  const cancel = () => {
    if (!start) return;
    start.top.el.style.transition = '';
    start.under.el.style.transition = '';
    start.top.el.style.transform = '';
    start.under.el.style.transform = '';
    start = null;
  };
  hostEl.addEventListener('touchend', () => {
    if (!start) return;
    const w = hostEl.clientWidth;
    const v = start.dx / Math.max(1, performance.now() - start.t);
    const go = start.dx > w * 0.35 || v > 0.6;
    const s = start;
    start = null;
    s.top.el.style.transition = '';
    s.under.el.style.transition = '';
    if (go) {
      s.top.el.style.transform = 'translateX(100%)';
      s.under.el.style.transform = '';
      setTimeout(() => Nav.pop({ animated: false }), 300);
    } else {
      s.top.el.style.transform = '';
      s.under.el.style.transform = '';
    }
  });
  hostEl.addEventListener('touchcancel', cancel);
}

/* ------------------------------------------------------------------ tab bar */

function buildTabbar() {
  tabbarEl.innerHTML = tabs.map((t) =>
    '<button type="button" class="tab" data-tab="' + t.id + '" aria-label="' + esc(t.label) + '">' +
      t.icon + '<span class="tab-label">' + esc(t.label) + '</span>' +
    '</button>').join('');
  tabbarEl.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (!b) return;
    Nav.tab(b.dataset.tab);
  });
}

function syncTabbar() {
  for (const b of tabbarEl.querySelectorAll('.tab')) {
    const on = b.dataset.tab === activeTab;
    b.classList.toggle('is-on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
}

/* ------------------------------------------------------------------ public API */

export const Nav = {
  /** Register page modules so they can be pushed by id (data-action="nav-push" data-page="..."). */
  register(...list) {
    for (const p of list) if (p && p.id) pages.set(p.id, p);
  },

  page(id) { return pages.get(id); },

  init({ host, tabbar, tabs: tabList, actions = {} }) {
    hostEl = host;
    tabbarEl = tabbar;
    tabs = tabList;
    globalActions = actions;
    hostEl.innerHTML = tabs.map((t) => '<section class="stack" data-tab="' + t.id + '" hidden></section>').join('');
    modalHost = document.getElementById('modal-host');
    for (const t of tabs) {
      pages.set(t.page.id, t.page);
      stacks.set(t.id, []);
    }
    buildTabbar();
    document.addEventListener('click', onClick);
    document.addEventListener('input', onField);
    document.addEventListener('change', onField);
    wireEdgeSwipe();
  },

  /** Show a tab. Tapping the tab you are on pops it to its first page and scrolls to the top. */
  async tab(id) {
    const t = tabs.find((x) => x.id === id);
    if (!t) return;
    const list = stacks.get(id);
    if (activeTab === id && list.length) {
      if (list.length > 1) {
        while (list.length > 1) {
          const e = list.pop();
          if (e.page.unmount) { try { e.page.unmount(e); } catch (_) { /* ignore */ } }
          e.el.remove();
        }
        list[0].el.classList.remove('is-behind');
        if (list[0].dirty) await renderEntry(list[0], true);
      } else {
        list[0].scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    activeTab = id;
    for (const s of hostEl.querySelectorAll('.stack')) s.hidden = s.dataset.tab !== id;
    syncTabbar();
    if (!list.length) {
      const entry = buildEntry(t.page, {}, 0, '', false);
      list.push(entry);
      stackEl(id).appendChild(entry.el);
      await renderEntry(entry, false);
    } else {
      const top = list[list.length - 1];
      if (top.dirty) await renderEntry(top, true);
    }
  },

  /** Push a page (module or registered id) onto the current tab, or onto the open modal. */
  async push(pageOrId, params = {}) {
    const page = typeof pageOrId === 'string' ? pages.get(pageOrId) : pageOrId;
    if (!page) { console.error('Lady_GYM: unknown page', pageOrId); return; }
    const list = currentEntries();
    const prev = list[list.length - 1];
    const container = modalStack.length ? modalHost.lastElementChild : stackEl(activeTab);
    const entry = buildEntry(page, params, list.length, prev ? titleOf(prev) : '', !!modalStack.length);
    list.push(entry);
    entry.el.classList.add('is-entering');
    container.appendChild(entry.el);
    await renderEntry(entry, false);
    requestAnimationFrame(() => {
      entry.el.classList.remove('is-entering');
      if (prev) prev.el.classList.add('is-behind');
    });
    return entry;
  },

  async pop({ animated = true } = {}) {
    const list = currentEntries();
    if (list.length < 2) { if (modalStack.length) return Nav.dismiss(); return; }
    const top = list.pop();
    const under = list[list.length - 1];
    under.el.classList.remove('is-behind');
    under.el.style.transform = '';
    if (under.dirty) renderEntry(under, true);
    if (top.page.unmount) { try { top.page.unmount(top); } catch (_) { /* ignore */ } }
    if (animated) {
      top.el.classList.add('is-leaving');
      setTimeout(() => top.el.remove(), 360);
    } else {
      top.el.remove();
    }
  },

  /** Full-screen modal (the workout player). Slides up over the tab bar. */
  async present(pageOrId, params = {}) {
    const page = typeof pageOrId === 'string' ? pages.get(pageOrId) : pageOrId;
    const layer = document.createElement('div');
    layer.className = 'modal is-entering';
    modalHost.appendChild(layer);
    modalStack = [];
    const entry = buildEntry(page, params, 0, '', true);
    modalStack.push(entry);
    layer.appendChild(entry.el);
    document.body.classList.add('has-modal');
    await renderEntry(entry, false);
    requestAnimationFrame(() => layer.classList.remove('is-entering'));
    return entry;
  },

  async dismiss() {
    const layer = modalHost.lastElementChild;
    for (const e of modalStack) {
      if (e.page.unmount) { try { e.page.unmount(e); } catch (_) { /* ignore */ } }
    }
    modalStack = [];
    document.body.classList.remove('has-modal');
    if (layer) {
      layer.classList.add('is-leaving');
      setTimeout(() => layer.remove(), 380);
    }
    const top = topEntry();
    if (top && top.dirty) await renderEntry(top, true);
  },

  isPresenting() { return modalStack.length > 0; },

  /** Re-render the visible page, keeping its scroll position. */
  refresh() {
    const top = topEntry();
    return top ? renderEntry(top, true) : Promise.resolve();
  },

  /**
   * Data changed somewhere: everything not on screen re-renders the next time it is shown,
   * and the visible page re-renders now.
   */
  invalidate() {
    for (const list of stacks.values()) for (const e of list) e.dirty = true;
    for (const e of modalStack) e.dirty = true;
    const top = topEntry();
    if (top) return renderEntry(top, true);
    return Promise.resolve();
  },

  activeTab() { return activeTab; },
  top: topEntry,
};

export default Nav;
