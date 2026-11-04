// Lady_GYM — js/features/install.js — getting Lady_GYM onto an iPhone Home Screen, with pictures.
//
// "It wasn't available on my Apple phone." What that almost always means:
//   1. They looked in the App Store. A web app is not there, and nothing told them so.
//   2. They opened the link inside Instagram, Facebook, Gmail or Messages' preview, where
//      Add to Home Screen does not exist.
//   3. They found Share but not "Add to Home Screen" — it is below the fold of the share
//      sheet, and on iOS 26 Share itself moved inside the ⋯ menu.
// So the guide below is drawn, step by step, for exactly the browser she is in, and it says
// plainly that there is nothing to download from the App Store.
//
// Honest limit: Apple gives a website no way to add itself to the Home Screen. A person has
// to tap Add. Everything short of that tap is done here. For a real App Store listing, see
// docs/APP_STORE.md — the app is ready to be wrapped, but that needs a Mac and Apple account.

import { DB } from '../core/db.js';
import { Nav } from '../core/nav.js';
import { icon } from '../ui/icons.js';
import { esc, sheet, closeSheet, toast, button, isIOS } from '../ui/kit.js';

const DISMISSED = 'install:dismissedUntil';
let deferredPrompt = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    closeSheet();
    toast('Lady_GYM is on your Home Screen!', { tone: 'good', ic: 'addSquare' });
  });
}

/** True when running as an installed app: from the Home Screen, or inside the native wrapper. */
export function isStandalone() {
  const native = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform());
  return native || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
}

/**
 *   installed · ios-safari · ios-other (Chrome/Edge/Firefox on iPhone) · ios-inapp ·
 *   android (one-tap prompt ready) · android-menu · desktop
 */
export function installEnv() {
  if (isStandalone()) return 'installed';
  const ua = navigator.userAgent || '';
  if (isIOS) {
    if (/FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Snapchat|Twitter|MicroMessenger|Pinterest|TikTok|Line\/|GSA\//.test(ua)) return 'ios-inapp';
    if (/CriOS|EdgiOS|FxiOS|OPiOS/.test(ua)) return 'ios-other';
    if (!ua.includes('Safari/')) return 'ios-inapp';
    return 'ios-safari';
  }
  if (deferredPrompt) return 'android';
  if (/Android/.test(ua)) return 'android-menu';
  return 'desktop';
}

export function appUrl() {
  return new URL('./', location.href).href;
}

export function getUrl() {
  return new URL('./get.html', location.href).href;
}

/* ------------------------------------------------------------------ the drawn steps */

const PINK = '#FF2D78';

function phone(inner, label) {
  return '<svg class="phone" viewBox="0 0 120 210" role="img" aria-label="' + esc(label) + '">' +
    '<rect x="4" y="2" width="112" height="206" rx="20" fill="#1C1C1E"/>' +
    '<rect x="9" y="7" width="102" height="196" rx="16" fill="#F2F2F7"/>' +
    '<rect x="44" y="11" width="32" height="8" rx="4" fill="#1C1C1E"/>' +
    inner + '</svg>';
}

function pulse(cx, cy, r) {
  return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + PINK + '" stroke-width="3">' +
    '<animate attributeName="r" values="' + r + ';' + (r + 5) + ';' + r + '" dur="1.6s" repeatCount="indefinite"/>' +
    '<animate attributeName="opacity" values="1;.35;1" dur="1.6s" repeatCount="indefinite"/></circle>';
}

const shareGlyph = (x, y, c = '#0A84FF') =>
  '<g transform="translate(' + x + ' ' + y + ')" stroke="' + c + '" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M0 -6v8M-3 -3l3 -3 3 3M-4 -1h-1.5v7h11v-7H4"/></g>';

// A page that looks like Lady_GYM, so she recognises it in the drawing.
const pageBits =
  '<rect x="16" y="26" width="60" height="7" rx="3.5" fill="#111"/>' +
  '<rect x="16" y="40" width="88" height="50" rx="9" fill="url(#pg)"/>' +
  '<rect x="16" y="96" width="88" height="22" rx="7" fill="#fff"/>' +
  '<rect x="16" y="122" width="42" height="34" rx="7" fill="#fff"/><rect x="62" y="122" width="42" height="34" rx="7" fill="#fff"/>' +
  '<defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF5C93"/><stop offset="1" stop-color="#FFB37A"/></linearGradient></defs>';

function stepShare() {
  return phone(pageBits +
    '<rect x="9" y="166" width="102" height="37" rx="0" fill="#FBFBFD"/>' +
    '<rect x="16" y="171" width="88" height="14" rx="7" fill="#E5E5EA"/>' +
    '<text x="60" y="181" text-anchor="middle" font-size="6.5" fill="#555" font-family="-apple-system,system-ui">lady_gym</text>' +
    '<text x="24" y="197" font-size="10" fill="#0A84FF" font-family="-apple-system,system-ui">‹</text>' +
    '<text x="38" y="197" font-size="10" fill="#C7C7CC" font-family="-apple-system,system-ui">›</text>' +
    shareGlyph(60, 195) + pulse(60, 194, 8) +
    '<g fill="#0A84FF"><circle cx="90" cy="194" r="1.2"/><circle cx="94" cy="194" r="1.2"/><circle cx="98" cy="194" r="1.2"/></g>',
  'Tap the Share button at the bottom of Safari');
}

function stepAdd() {
  return phone(pageBits +
    '<rect x="9" y="70" width="102" height="133" rx="12" fill="#fff"/>' +
    '<rect x="50" y="74" width="20" height="3" rx="1.5" fill="#D1D1D6"/>' +
    '<g font-family="-apple-system,system-ui" font-size="7" fill="#111">' +
      '<text x="18" y="96">Copy</text><text x="18" y="114">Add to Reading List</text>' +
      '<text x="18" y="132">Add Bookmark</text>' +
      '<rect x="13" y="140" width="94" height="17" rx="6" fill="#FFE4EE"/>' +
      '<text x="18" y="151" font-weight="700" fill="#C80D55">Add to Home Screen</text>' +
      '<text x="18" y="172">Find on Page</text>' +
    '</g>' +
    '<g stroke="#8E8E93" stroke-width="1.3" fill="none"><rect x="95" y="144.5" width="8" height="8" rx="2" stroke="#C80D55"/>' +
    '<path d="M99 146.5v4M97 148.5h4" stroke="#C80D55"/></g>' +
    '<line x1="13" y1="102" x2="107" y2="102" stroke="#E5E5EA"/><line x1="13" y1="120" x2="107" y2="120" stroke="#E5E5EA"/>' +
    pulse(60, 148, 10),
  'Scroll down and tap Add to Home Screen');
}

function stepConfirm() {
  return phone(
    '<rect x="9" y="7" width="102" height="196" rx="16" fill="#F2F2F7"/>' +
    '<g font-family="-apple-system,system-ui" font-size="7">' +
      '<text x="16" y="34" fill="#0A84FF">Cancel</text>' +
      '<text x="60" y="34" text-anchor="middle" font-weight="700" fill="#111">Add to Home Screen</text>' +
      '<text x="104" y="34" text-anchor="end" font-weight="700" fill="#0A84FF">Add</text>' +
    '</g>' + pulse(97, 32, 9) +
    '<rect x="14" y="44" width="92" height="40" rx="9" fill="#fff"/>' +
    '<rect x="20" y="50" width="28" height="28" rx="7" fill="url(#ic)"/>' +
    '<defs><linearGradient id="ic" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF4F8B"/><stop offset="1" stop-color="#FFB36B"/></linearGradient></defs>' +
    '<text x="34" y="68" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="ui-rounded,-apple-system,system-ui">L</text>' +
    '<text x="54" y="62" font-size="7" font-weight="600" fill="#111" font-family="-apple-system,system-ui">Lady_GYM</text>' +
    '<rect x="14" y="90" width="92" height="18" rx="7" fill="#fff"/>' +
    '<text x="20" y="101.5" font-size="6.2" fill="#111" font-family="-apple-system,system-ui">Open as Web App</text>' +
    '<rect x="88" y="94" width="14" height="9" rx="4.5" fill="#34C759"/><circle cx="97.5" cy="98.5" r="3.6" fill="#fff"/>' +
    // home screen preview
    '<g transform="translate(0 6)">' +
      '<rect x="22" y="120" width="18" height="18" rx="5" fill="#8E5CF7"/><rect x="51" y="120" width="18" height="18" rx="5" fill="#34C759"/>' +
      '<rect x="80" y="120" width="18" height="18" rx="5" fill="url(#ic)"/>' +
      '<text x="89" y="133" text-anchor="middle" font-size="9" font-weight="800" fill="#fff" font-family="ui-rounded,-apple-system,system-ui">L</text>' +
      '<text x="89" y="146" text-anchor="middle" font-size="5" fill="#111" font-family="-apple-system,system-ui">Lady_GYM</text>' +
    '</g>',
  'Tap Add in the top corner');
}

function stepInApp() {
  return phone(pageBits +
    '<rect x="9" y="7" width="102" height="22" fill="#fff"/>' +
    '<text x="16" y="22" font-size="7" fill="#111" font-family="-apple-system,system-ui">Done</text>' +
    '<g fill="#111"><circle cx="96" cy="19" r="1.3"/><circle cx="100" cy="19" r="1.3"/><circle cx="104" cy="19" r="1.3"/></g>' +
    pulse(100, 19, 8) +
    '<rect x="40" y="34" width="68" height="30" rx="7" fill="#fff" stroke="#E5E5EA"/>' +
    '<rect x="43" y="37" width="62" height="11" rx="4" fill="#FFE4EE"/>' +
    '<text x="47" y="45" font-size="6" font-weight="700" fill="#C80D55" font-family="-apple-system,system-ui">Open in Safari</text>' +
    '<text x="47" y="58" font-size="6" fill="#111" font-family="-apple-system,system-ui">Copy Link</text>',
  'Tap the menu and choose Open in Safari');
}

function stepList(steps) {
  return '<ol class="iguide">' + steps.map(([art, title, sub], i) =>
    '<li class="iguide-step"><div class="iguide-art">' + art + '</div>' +
    '<div class="iguide-text"><span class="iguide-n">' + (i + 1) + '</span><p class="iguide-title">' + title + '</p>' +
    (sub ? '<p class="iguide-sub">' + sub + '</p>' : '') + '</div></li>').join('') + '</ol>';
}

/** The picture guide for a given browser, as HTML. Used by the in-app sheet and by get.html. */
export function guideBody(env) {
  const noStore = '<div class="iguide-note">' + icon('apple', 18) +
    '<p><b>No App Store needed.</b> Lady_GYM installs straight from Safari, free, in about 15 seconds. ' +
    'It gets its own icon, opens full screen and works without signal.</p></div>';
  const copy = button({ label: 'Copy the Link', action: 'copy-link', kind: 'plain', icon: 'copy', size: 'md' });

  if (env === 'ios-inapp') {
    return noStore +
      '<p class="iguide-lead">You’re viewing this inside another app, which can’t add apps to your Home Screen. Open it in Safari first:</p>' +
      stepList([
        [stepInApp(), 'Tap ⋯ or the compass, then “Open in Safari”', 'In Instagram or Facebook it’s the ⋯ at the top right.'],
        [stepShare(), 'Then in Safari, tap Share', 'On iOS 26, tap ⋯ first, then Share.'],
        [stepAdd(), 'Tap “Add to Home Screen”', 'Scroll down the list if you don’t see it.'],
      ]) + '<p class="iguide-lead">Or copy the link and paste it into Safari:</p>' + copy;
  }
  if (env === 'ios-other') {
    return noStore + stepList([
      [stepShare(), 'Tap the Share button', 'In Chrome it’s at the top right, next to the address.'],
      [stepAdd(), 'Tap “Add to Home Screen”', 'Scroll down if you don’t see it. If it’s missing, open this page in Safari.'],
      [stepConfirm(), 'Tap Add', 'Lady_GYM appears on your Home Screen.'],
    ]) + copy;
  }
  if (env === 'android') {
    return '<p class="iguide-lead">One tap and it’s on your Home Screen.</p>' +
      button({ label: 'Install Lady_GYM', action: 'android-install', kind: 'primary', icon: 'download' });
  }
  if (env === 'android-menu') {
    return '<p class="iguide-lead">In Chrome, tap the ⋮ menu at the top right, then <b>Install app</b> or <b>Add to Home screen</b>.</p>';
  }
  if (env === 'desktop') {
    return '<p class="iguide-lead">Lady_GYM is made for your phone. Scan this with your iPhone camera to open it there:</p>' +
      '<img class="iguide-qr" src="./icons/qr.svg" alt="QR code for the Lady_GYM link" width="200" height="200">' + copy;
  }
  return noStore + stepList([
    [stepShare(), 'Tap the Share button', 'It’s at the bottom of Safari. On iOS 26, tap ⋯ first, then Share.'],
    [stepAdd(), 'Tap “Add to Home Screen”', 'Scroll down the list if you don’t see it straight away.'],
    [stepConfirm(), 'Tap Add', 'Keep “Open as Web App” on. Then find the Lady_GYM icon on your Home Screen.'],
  ]) + '<p class="iguide-warn">' + icon('info', 16) + '<span>Do this before you log workouts — the Home Screen app keeps its own copy of your data.</span></p>';
}

export function showInstallGuide() {
  const env = installEnv();
  if (env === 'installed') { toast('You’re already using the app version', { tone: 'good' }); return; }
  sheet({
    title: 'Get the App',
    large: env.startsWith('ios'),
    body: guideBody(env),
    actions: {
      async 'copy-link'() {
        try { await navigator.clipboard.writeText(appUrl()); toast('Link copied — paste it into Safari', { ic: 'copy' }); } catch (_) {
          toast(appUrl(), { ic: 'link', ms: 6000 });
        }
      },
      async 'android-install'() {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        try { await deferredPrompt.userChoice; } catch (_) { /* ignore */ }
        deferredPrompt = null;
        closeSheet();
      },
    },
  });
}

/** The small reminder card on Today, until it is installed or snoozed. */
export async function installCard() {
  if (isStandalone()) return '';
  const until = await DB.getPref(DISMISSED, null);
  if (until && until > DB.todayISO()) return '';
  return '<div class="card installcard">' +
    '<img class="installcard-icon" src="./icons/icon-180.png" alt="" width="52" height="52">' +
    '<div class="installcard-text"><p class="card-title">Add Lady_GYM to your Home Screen</p>' +
    '<p class="card-sub">Full screen, its own icon, works with no signal. No App Store needed.</p>' +
    '<div class="installcard-btns">' +
      button({ label: 'Show Me How', action: 'install-guide', kind: 'primary', size: 'sm', full: false }) +
      button({ label: 'Later', action: 'install-later', kind: 'plain', size: 'sm', full: false }) +
    '</div></div></div>';
}

/** Share the invite link (to the get page, which explains the iPhone install with pictures). */
export async function shareInvite() {
  const url = getUrl();
  const text = 'I’m using Lady_GYM for my workouts — made for women, with a picture for every move. ' +
    'It’s free and installs from Safari in 15 seconds:';
  try {
    if (navigator.share) { await navigator.share({ title: 'Lady_GYM', text, url }); return; }
    await navigator.clipboard.writeText(text + ' ' + url);
    toast('Invite copied — paste it in a message', { ic: 'copy' });
  } catch (_) { /* closed */ }
}

export const installActions = {
  'install-guide': () => showInstallGuide(),
  async 'install-later'() {
    const d = new Date(); d.setDate(d.getDate() + 5);
    await DB.setPref(DISMISSED, DB.todayISO(d));
    return Nav.refresh();
  },
};

/** First visit in a browser on a phone: open the guide by itself once. */
export async function maybeAutoGuide() {
  if (isStandalone()) return;
  const env = installEnv();
  if (env === 'desktop') return;
  const shown = await DB.getPref('install:autoShown', false);
  if (shown) return;
  await DB.setPref('install:autoShown', true);
  setTimeout(showInstallGuide, 900);
}
