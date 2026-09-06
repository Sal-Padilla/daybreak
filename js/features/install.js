// Daybreak — js/features/install.js — help people actually get it onto their home screen.
//
// The two platforms behave completely differently:
//
//   Android/Chrome  fires `beforeinstallprompt`, which we can capture and turn into a real
//                   one-tap Install button.
//   iOS/Safari      fires nothing and offers nothing. The only route is Share → Add to Home
//                   Screen, and there is no way to trigger it from script. If we do not tell
//                   people, they will simply use it as a web page and never install it.
//
// So: a real button where one is possible, an honest instruction where it is not, and silence
// once she has installed it or said no.

import { DB } from '../core/db.js';

const DISMISSED = 'install:dismissed';

let deferredPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Safari is the only iOS browser that can add to the home screen. */
function isIOSSafari() {
  const ua = navigator.userAgent || '';
  return isIOS() && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function shareGlyph() {
  // The iOS share icon, so the instruction points at something recognisable.
  return '<svg class="install-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v12M12 3l-3.5 3.5M12 3l3.5 3.5"/>' +
    '<path d="M6 12H4.5v8h15v-8H18"/></svg>';
}

function banner(inner, opts = {}) {
  const el = document.createElement('div');
  el.className = 'install-bar' + (opts.class ? ' ' + opts.class : '');
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Install Daybreak');
  el.innerHTML = inner +
    '<button type="button" class="install-close" aria-label="Not now">&times;</button>';

  el.querySelector('.install-close').addEventListener('click', async () => {
    el.remove();
    try { await DB.setPref(DISMISSED, true); } catch (_) { /* nothing to do */ }
  });

  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-open'));
  return el;
}

function showAndroid() {
  const el = banner(
    '<div class="install-text">' +
      '<strong>Add Daybreak to your phone</strong>' +
      '<span>Opens like an app, works without signal.</span>' +
    '</div>' +
    '<button type="button" class="btn btn-primary btn-md install-go">Install</button>'
  );

  el.querySelector('.install-go').addEventListener('click', async () => {
    if (!deferredPrompt) { el.remove(); return; }
    const prompt = deferredPrompt;
    deferredPrompt = null;
    el.remove();
    try {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'dismissed') await DB.setPref(DISMISSED, true);
    } catch (err) {
      console.warn('Daybreak: install prompt failed.', err);
    }
  });
}

function showIOS() {
  banner(
    '<div class="install-text">' +
      '<strong>Add Daybreak to your Home Screen</strong>' +
      '<span><span class="install-step">Tap ' + shareGlyph() + ' below</span>, then ' +
      '<b>Add to Home Screen</b>. ' +
      'It then opens like an app and works without signal.</span>' +
    '</div>',
    { class: 'is-ios' }
  );
}

/**
 * Decide whether to offer anything, and what. Safe to call on every boot — it is silent
 * once the app is installed, once she has dismissed it, or on a browser that cannot install.
 */
export async function offerInstall() {
  if (isStandalone()) return;                       // already installed

  let dismissed = false;
  try { dismissed = await DB.getPref(DISMISSED, false); } catch (_) { /* treat as not dismissed */ }
  if (dismissed) return;

  // Android and desktop Chrome: wait for the browser to tell us it is installable.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();                             // suppress Chrome's own mini-infobar
    deferredPrompt = e;
    showAndroid();
  }, { once: true });

  // iOS never fires that event, so ask on a short delay — after the first screen has drawn,
  // and only in Safari, which is the only iOS browser that can do it.
  if (isIOSSafari()) {
    setTimeout(showIOS, 2500);
  }

  window.addEventListener('appinstalled', () => {
    document.querySelectorAll('.install-bar').forEach((n) => n.remove());
    DB.setPref(DISMISSED, true).catch(() => { /* best effort */ });
  }, { once: true });
}
