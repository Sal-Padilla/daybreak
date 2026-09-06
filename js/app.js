// Daybreak — js/app.js — bootstrap: open the database, load the profile, hand over to the Router.

import { DB } from './core/db.js';
import { Store } from './core/store.js';
import { Router } from './core/router.js';
import { needsOnboarding, renderOnboarding } from './features/onboarding.js';
import { maybeNudge } from './features/report.js';
import { offerInstall } from './features/install.js';
import { toast } from './ui/components.js';

import * as today from './features/today.js';
import * as train from './features/train.js';
import * as week from './features/week.js';
import * as shape from './features/shape.js';
import * as me from './features/me.js';

const FEATURES = [today, train, week, shape, me];

function fail(message, err) {
  console.error('Daybreak:', message, err);
  const content = document.getElementById('content');
  if (content) {
    content.innerHTML =
      '<div class="boot boot-error">' +
        '<h1 class="display">Daybreak could not start</h1>' +
        '<p class="lede">' + String(message) + '</p>' +
        '<p class="muted">If this keeps happening, close the app fully and reopen it. Your data ' +
        'is still on the phone.</p>' +
      '</div>';
  }
}

async function applyTheme() {
  try {
    const theme = await DB.getPref('theme', 'auto');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  } catch (err) {
    console.warn('Daybreak: could not read the theme preference.', err);
  }
}

async function registerServiceWorker() {
  // Fails on file:// and in private modes. That must never stop the app from running.
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'daybreak:updated' && reg.active) {
        // Only tell her about an update if this wasn't the very first install.
        if (sessionStorage.getItem('daybreak:booted')) {
          toast('A new version is ready — reopen to load it.', 'accent');
        }
      }
    });
    sessionStorage.setItem('daybreak:booted', '1');
  } catch (err) {
    console.warn('Daybreak: service worker not registered (offline mode unavailable).', err);
  }
}

async function startApp() {
  const content = document.getElementById('content');
  const nav = document.getElementById('nav');

  if (await needsOnboarding()) {
    if (nav) nav.hidden = true;
    document.body.classList.add('is-onboarding');
    renderOnboarding(content, async () => {
      document.body.classList.remove('is-onboarding');
      if (nav) nav.hidden = false;
      await Router.init({ content, nav, features: FEATURES });
      await Router.go('today');
    });
    return;
  }

  if (nav) nav.hidden = false;
  await Router.init({ content, nav, features: FEATURES });

  // Sunday: offer the weekly report. This fires when the app is opened — we do not pretend
  // a web app can deliver it in the background, because it cannot.
  maybeNudge().catch((err) => console.warn('Daybreak: nudge check failed.', err));

  // Offer to add it to the home screen. Silent if installed, dismissed, or unsupported.
  offerInstall().catch((err) => console.warn('Daybreak: install offer failed.', err));
}

async function boot() {
  window.addEventListener('error', (e) => {
    console.error('Daybreak: uncaught error.', e.error || e.message);
    try { toast('Something went wrong on that screen.', 'signal'); } catch (_) { /* pre-boot */ }
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('Daybreak: unhandled rejection.', e.reason);
    try { toast('Something went wrong on that screen.', 'signal'); } catch (_) { /* pre-boot */ }
  });

  try {
    await DB.init();
  } catch (err) {
    fail('The local database would not open. Private browsing can block it.', err);
    return;
  }

  await applyTheme();

  try {
    await Store.init();
  } catch (err) {
    fail('Could not load your profile.', err);
    return;
  }

  try {
    await startApp();
  } catch (err) {
    fail('Could not start the app.', err);
    return;
  }

  registerServiceWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
