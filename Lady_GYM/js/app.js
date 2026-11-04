// Lady_GYM — js/app.js — start-up: open the database, welcome a new user, then hand over to the tabs.

import { DB } from './core/db.js';
import { Store } from './core/store.js';
import { Nav } from './core/nav.js';
import { icon } from './ui/icons.js';
import { toast } from './ui/kit.js';
import { needsOnboarding, renderOnboarding } from './features/onboarding.js';
import { installActions, maybeAutoGuide } from './features/install.js';
import { page as today } from './features/today.js';
import { page as workouts, workoutPage, exercisePage, libraryPage, historyPage, sessionPage } from './features/workouts.js';
import { page as classes, classPage } from './features/classes.js';
import { page as progress, photosPage, reportPage } from './features/progress.js';
import { profilePage } from './features/profile.js';
import { playerPage } from './features/player.js';

const TABS = [
  { id: 'today', label: 'Today', icon: icon('today', 27), page: today },
  { id: 'workouts', label: 'Workouts', icon: icon('workouts', 27), page: workouts },
  { id: 'classes', label: 'Classes', icon: icon('classes', 27), page: classes },
  { id: 'progress', label: 'Progress', icon: icon('progress', 27), page: progress },
];

function fail(message, err) {
  console.error('Lady_GYM:', message, err);
  const boot = document.getElementById('boot');
  if (boot) {
    boot.hidden = false;
    boot.innerHTML = '<div><h1>Lady_GYM couldn’t start</h1><p>' + message + '</p>' +
      '<p>Close the app fully and open it again. Your data is still on the phone.</p></div>';
  }
}

async function applyTheme() {
  try {
    const t = await DB.getPref('theme', 'auto');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  } catch (_) { /* default */ }
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  try {
    // Only Lady_GYM's own worker counts. On a phone that has Daybreak, Daybreak's worker controls
    // this page on its first visit; Lady_GYM's worker taking over from it is not an update, and a
    // reload then threw her back to the start of sign-up.
    const ctl = navigator.serviceWorker.controller;
    const had = !!ctl && ctl.scriptURL === new URL('./sw.js', location.href).href;
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    let reloading = false;
    // A Home Screen app is resumed, not relaunched, so "reopen to update" never happens on an
    // iPhone. When a new version takes over, reload once so the code on screen is the new code.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!had || reloading || Nav.isPresenting()) return;
      reloading = true;
      location.reload();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  } catch (err) {
    console.warn('Lady_GYM: offline mode unavailable.', err);
  }
}

async function startTabs() {
  Nav.register(workoutPage, exercisePage, libraryPage, historyPage, sessionPage, classPage, photosPage, reportPage, profilePage, playerPage);
  Nav.init({
    host: document.getElementById('stacks'),
    tabbar: document.getElementById('tabbar'),
    tabs: TABS,
    actions: { ...installActions },
  });
  // A Home Screen app is resumed, not relaunched: opened the next morning it still showed
  // yesterday — yesterday's date, "You did it!" and no Start button. When the day has turned,
  // redraw. Not under an open workout, which keeps the session it started with.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Nav.isPresenting()) return;
    if (DB.todayISO() === Store.get('today')) return;
    Store.reloadActiveSession().then(() => Nav.invalidate()).catch((err) => console.error(err));
  });
  await Nav.tab('today');
  // A workout left open (app closed mid-session) comes straight back.
  const active = Store.get('activeSession');
  if (active && !active.complete) {
    toast('Your workout is still going — tap Resume', { ic: 'play', ms: 3200 });
  }
  maybeAutoGuide().catch(() => {});
}

async function boot() {
  window.addEventListener('unhandledrejection', (e) => console.error('Lady_GYM: unhandled', e.reason));
  try {
    await DB.init();
  } catch (err) {
    fail('The phone’s storage wouldn’t open. Private Browsing can block it — try a normal Safari tab.', err);
    return;
  }
  await applyTheme();
  try {
    await Store.init();
  } catch (err) {
    fail('Your profile couldn’t be loaded.', err);
    return;
  }
  const bootEl = document.getElementById('boot');
  try {
    if (await needsOnboarding()) {
      document.body.classList.add('is-onboarding');
      const ob = document.getElementById('onboarding');
      ob.hidden = false;
      if (bootEl) bootEl.hidden = true;
      renderOnboarding(ob, async () => {
        ob.hidden = true;
        ob.innerHTML = '';
        document.body.classList.remove('is-onboarding');
        await startTabs();
      });
    } else {
      if (bootEl) bootEl.hidden = true;
      await startTabs();
    }
  } catch (err) {
    fail('Something went wrong starting up.', err);
    return;
  }
  registerSW();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
