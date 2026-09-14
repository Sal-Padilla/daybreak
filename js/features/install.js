// Daybreak — js/features/install.js — getting it onto the Home Screen, as automatically as each phone allows.
//
// Rocio tried to put it on an iPhone Home Screen, it did not work, and she asked for it to be
// more automatic. The honest limit first: Apple gives a website NO way to add itself to the
// Home Screen. There is no API, no prompt, no permission to ask for — on an iPhone the only
// route is the Share menu, tapped by a person. Android is different: Chrome hands the page a
// real install prompt, and one tap installs it.
//
// So "more automatic" means everything short of that one tap:
//   - work out exactly which browser this is, because each hides the option somewhere else,
//     and one kind — the browser built into another app (Gmail, Messenger, Instagram, the
//     Google app) — cannot add to the Home Screen at all. That is the most common reason it
//     "does not work", and nothing on screen tells you;
//   - open a numbered guide by itself on the first visit, pointing at the real button;
//   - keep a small reminder on Today until it is installed, instead of vanishing for good the
//     first time she taps "not now";
//   - on Android, catch the install prompt the moment Chrome offers it, so the button is a
//     genuine one-tap install.

import { DB } from '../core/db.js';
import { Router } from '../core/router.js';
import { sheet, closeSheet, toast, btn, card } from '../ui/components.js';

const AUTO_SHOWN = 'install:autoShown';        // the guide has opened by itself once
const SNOOZED_UNTIL = 'install:snoozedUntil';  // YYYY-MM-DD; the Today card hides until then
const INSTALLED = 'install:installed';

let deferredPrompt = null;

// Chrome can fire this before the app has finished booting, so listen from the moment this
// module loads. The previous version only started listening after boot and could miss it,
// leaving Android with no one-tap button at all.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    closeSheet();
    DB.setPref(INSTALLED, true).catch(() => { /* best effort */ });
    toast('Daybreak is on your Home Screen.', 'calm');
  });
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isIPad() {
  const ua = navigator.userAgent || '';
  return /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Which kind of browser this is, as far as installing goes.
 *   'installed'     already running from the Home Screen
 *   'android'       Chrome has handed us a one-tap install prompt
 *   'android-menu'  Android with no prompt (yet): the browser menu has Install app
 *   'ios-safari'    iPhone or iPad Safari: Share, then Add to Home Screen
 *   'ios-other'     Chrome, Edge or Firefox on iOS: their own Share button
 *   'ios-inapp'     a browser built into another app — cannot install, open in Safari first
 *   'desktop'       a computer
 */
export function installEnv() {
  if (isStandalone()) return 'installed';
  const ua = navigator.userAgent || '';
  if (isIOS()) {
    const inApp = /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Snapchat|Twitter|MicroMessenger|Pinterest/.test(ua) ||
      ua.includes('Line/') || ua.includes('GSA/');
    if (inApp) return 'ios-inapp';
    if (/CriOS|EdgiOS|FxiOS|OPiOS/.test(ua)) return 'ios-other';
    // Real Safari always carries a "Safari/" token. A bare web view inside an app does not.
    if (!ua.includes('Safari/')) return 'ios-inapp';
    return 'ios-safari';
  }
  if (deferredPrompt) return 'android';
  if (/Android/.test(ua)) return 'android-menu';
  return 'desktop';
}

/* ------------------------------------------------------------------ the guide */

const ICON = {
  share: '<svg class="install-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3v12M12 3l-3.5 3.5M12 3l3.5 3.5"/><path d="M6.5 11H5v9h14v-9h-1.5"/></svg>',
  add: '<svg class="install-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
  more: '<svg class="install-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<circle cx="6" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18" cy="12" r="1.9"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v15M6 13l6 6 6-6"/></svg>',
};

function steps(list) {
  return '<ol class="install-guide-steps">' + list.map((html, i) =>
    '<li class="install-guide-step"><span class="install-guide-n">' + (i + 1) + '</span>' +
    '<span class="install-guide-text">' + html + '</span></li>').join('') + '</ol>';
}

const doneBtn = () => btn({ label: 'Done', action: 'install-done', variant: 'ghost', size: 'md', full: true });
const copyBtn = (primary) => btn({ label: 'Copy the link', action: 'install-copy',
  variant: primary ? 'primary' : 'ghost', size: primary ? 'lg' : 'md', full: true });
const actionRow = (...buttons) => '<div class="install-guide-actions">' + buttons.join('') + '</div>';

// On an iPhone the Home Screen app keeps its own storage, completely separate from Safari, so
// anything logged in the browser tab stays in the browser tab. Say so BEFORE she logs a set,
// not after she opens the new icon to an empty app.
const STORAGE_NOTE =
  '<p class="install-warn"><b>Do this before you log anything.</b> On an iPhone the Home ' +
  'Screen app keeps its own storage, separate from Safari, so history logged in the browser ' +
  'does not follow it across. If you already have some, use Export on the Me screen first, ' +
  'then Import inside the installed app.</p>';

function guideInstalled() {
  return '<p class="install-guide-lede">Daybreak is already on your Home Screen — you are running ' +
    'it right now. It fetches any new version by itself whenever you open it.</p>' + actionRow(doneBtn());
}

function guideAndroid() {
  return '<p class="install-guide-lede">One tap. It opens like any other app, full screen, and ' +
    'works with no signal.</p>' +
    actionRow(btn({ label: 'Install Daybreak', action: 'install-go', variant: 'primary', size: 'lg', full: true }),
      doneBtn());
}

function guideAndroidMenu() {
  return steps([
    'Tap the <b>⋮</b> menu at the top right of Chrome.',
    'Tap <b>Install app</b> — on some phones it says <b>Add to Home screen</b>.' +
      '<span class="muted">Samsung Internet: the menu is at the bottom right, then Add page to, then Home screen.</span>',
    'Tap <b>Install</b>, then open Daybreak from its new icon.',
  ]) + actionRow(doneBtn());
}

function guideInApp() {
  return '<p class="install-guide-lede"><b>This page is open inside another app’s built-in ' +
    'browser</b> — Gmail, Facebook, Instagram, the Google app. Those browsers cannot add ' +
    'anything to the Home Screen, and that is the usual reason it does not work. It needs to ' +
    'be open in Safari.</p>' +
    steps([
      'Tap <b>•••</b> ' + ICON.more + ' or the compass icon, and choose <b>Open in Safari</b>.' +
        '<span class="muted">No such option? Copy the link below, open Safari, and paste it into the address bar.</span>',
      'In Safari, tap <b>Share</b> ' + ICON.share + ', then <b>Add to Home Screen</b> ' + ICON.add + '.',
      'Tap <b>Add</b>, then open Daybreak from its new icon.',
    ]) + STORAGE_NOTE + actionRow(copyBtn(true), doneBtn());
}

function guideOtherIOS() {
  return steps([
    'Tap the <b>Share</b> button ' + ICON.share + '.' +
      '<span class="muted">In Chrome it is at the right-hand end of the address bar.</span>',
    'Tap <b>Add to Home Screen</b> ' + ICON.add + '.' +
      '<span class="muted">Not in the list? Scroll down, or tap More. On an iPhone older than ' +
      'iOS 16.4 only Safari can do this — copy the link and open it in Safari.</span>',
    'Tap <b>Add</b>, then open Daybreak from its new icon.',
  ]) + STORAGE_NOTE + actionRow(copyBtn(false), doneBtn());
}

function guideSafari() {
  const ipad = isIPad();
  return steps([
    'Tap the <b>Share</b> button ' + ICON.share +
      (ipad ? ' at the top right of the screen.' : ' in the bar at the bottom of the screen.') +
      '<span class="muted">Don’t see it? Tap <b>•••</b> ' + ICON.more + ' first — newer ' +
      'iPhones tuck Share inside that menu.</span>',
    'Scroll down and tap <b>Add to Home Screen</b> ' + ICON.add + '.' +
      '<span class="muted">It sits below the row of apps and the first few actions — swipe up ' +
      'on the list to find it.</span>',
    'If you see <b>Open as Web App</b>, leave it switched on. Then tap <b>Add</b> at the top right.',
    'From now on, open Daybreak from the new icon on your Home Screen — not from Safari.',
  ]) + STORAGE_NOTE +
    (ipad ? '' : '<div class="install-pointer">The Share button is just below this screen' + ICON.down + '</div>') +
    actionRow(doneBtn());
}

function guideDesktop() {
  return '<p class="install-guide-lede">Open this page on your phone, then add it to the Home ' +
    'Screen from there. The link is:</p>' +
    '<p class="muted">' + location.origin + location.pathname + '</p>' +
    actionRow(copyBtn(false), doneBtn());
}

function guideBody(env) {
  switch (env) {
    case 'installed': return guideInstalled();
    case 'android': return guideAndroid();
    case 'android-menu': return guideAndroidMenu();
    case 'ios-inapp': return guideInApp();
    case 'ios-other': return guideOtherIOS();
    case 'ios-safari': return guideSafari();
    default: return guideDesktop();
  }
}

/* ------------------------------------------------------------------ public API */

async function promptAndroid() {
  if (!deferredPrompt) {
    toast('Open the ⋮ menu in Chrome, then choose Install app.', 'accent');
    return;
  }
  const p = deferredPrompt;
  deferredPrompt = null;
  try {
    p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome === 'accepted') {
      closeSheet();
      await DB.setPref(INSTALLED, true);
    }
  } catch (err) {
    console.warn('Daybreak: install prompt failed.', err);
  }
}

/** Open the guide on demand, from Me or the Today card. Ignores any snooze — she came looking. */
export function showInstallHelp() {
  const env = installEnv();
  const title = env === 'installed' ? 'Already on your Home Screen'
    : env === 'android' ? 'Install Daybreak'
      : env === 'ios-inapp' ? 'Open this in Safari first'
        : 'Add Daybreak to your Home Screen';

  sheet(title, guideBody(env), {
    class: 'install-guide',
    actions: {
      async 'install-go'() { await promptAndroid(); },
      async 'install-copy'() {
        const link = location.origin + location.pathname;
        try {
          await navigator.clipboard.writeText(link);
          toast('Link copied. Paste it into Safari.', 'calm');
        } catch (_) {
          toast(link, 'accent');
        }
      },
      'install-done'() { closeSheet(); },
    },
  });
}

/**
 * Called at boot. Silent once installed or on a computer. Otherwise the guide opens by itself
 * ONCE, a moment after the first screen has drawn and never over a sheet she is already using.
 * After that the card on Today carries it until the app is installed.
 */
export async function offerInstall() {
  const env = installEnv();
  if (env === 'installed') {
    DB.setPref(INSTALLED, true).catch(() => { /* best effort */ });
    return;
  }
  if (env === 'desktop') return;

  let shown = false;
  try { shown = await DB.getPref(AUTO_SHOWN, false); } catch (_) { /* treat as not shown */ }
  if (shown) return;

  setTimeout(async () => {
    if (document.querySelector('.sheet-layer') || document.body.classList.contains('is-onboarding')) return;
    showInstallHelp();
    try { await DB.setPref(AUTO_SHOWN, true); } catch (_) { /* it will simply offer again */ }
  }, 2500);
}

/** The reminder card on Today. Empty once installed, on a computer, or while snoozed. */
export async function installCardHtml() {
  const env = installEnv();
  if (env === 'installed' || env === 'desktop') return '';
  try {
    const until = await DB.getPref(SNOOZED_UNTIL, null);
    if (until && until > DB.todayISO()) return '';
  } catch (_) { /* show it */ }

  const line = env === 'ios-inapp'
    ? 'This browser cannot add apps. Open it in Safari first — the guide shows how.'
    : env === 'android'
      ? 'One tap, and it opens like an app with no browser bar and no signal needed.'
      : 'It opens full screen, works with no signal, and takes about fifteen seconds.';

  return card({
    title: 'Put Daybreak on your Home Screen',
    body:
      '<div class="install-card-row">' +
        '<img class="install-card-icon" src="./icons/icon-180.png" alt="" width="48" height="48">' +
        '<span class="install-card-text">' + line + '</span>' +
      '</div>',
    footer:
      btn({ label: env === 'android' ? 'Install' : 'Show me how', action: 'install-show', variant: 'primary', size: 'md', full: true }) +
      btn({ label: 'Not now', action: 'install-snooze', variant: 'ghost', size: 'md', full: true }),
  });
}

/** Spread into Today's actions map. "Not now" is three days, not forever. */
export const installActions = {
  async 'install-show'() {
    if (installEnv() === 'android') { await promptAndroid(); return; }
    showInstallHelp();
  },
  async 'install-snooze'() {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    try { await DB.setPref(SNOOZED_UNTIL, DB.todayISO(d)); } catch (_) { /* nothing to do */ }
    return Router.refresh();
  },
};
