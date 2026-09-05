// Daybreak — js/core/store.js — observable app state: profile, life-stage dials, active session, week.

import { DB } from './db.js';
import { dialsFor } from '../engine/lifestage.js';

/**
 * The whole app state. Features read it with Store.get(key) and write with
 * Store.set(key, value) / Store.update(patch); every write notifies subscribers.
 *
 *   profile        the stored profile object (never null after init)
 *   dials          dialsFor(profile) — the life-stage prescription
 *   activeSession  the open (incomplete) session for today, or null
 *   activeSets     sets already logged in activeSession (empty array when none)
 *   week           the built week array from scheduler.buildWeek(), or null
 *   today          local calendar date, YYYY-MM-DD
 */
const state = {
  profile: null,
  dials: null,
  activeSession: null,
  activeSets: [],
  week: null,
  today: DB.todayISO()
};

const listeners = new Set();
let ready = false;

function notify(keys) {
  const changed = Array.isArray(keys) ? keys.slice() : [keys];
  // Copy first: a listener may unsubscribe itself while we are iterating.
  for (const fn of Array.from(listeners)) {
    try {
      fn(state, changed);
    } catch (err) {
      console.error('Daybreak Store: a subscriber threw.', err);
    }
  }
}

/** dialsFor() must never take the app down — log loudly, carry on with null. */
function computeDials(profile) {
  try {
    return dialsFor(profile);
  } catch (err) {
    console.error('Daybreak Store: dialsFor(profile) failed.', err);
    return null;
  }
}

/** The most recently started incomplete session on `date`, or null. */
async function findOpenSession(date) {
  const rows = await DB.getAllByIndex('sessions', 'date', date);
  const open = rows.filter((s) => s && !s.complete);
  if (open.length === 0) return null;
  open.sort((a, b) => {
    const av = a.startedAt ? String(a.startedAt) : '';
    const bv = b.startedAt ? String(b.startedAt) : '';
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  return open[open.length - 1];
}

export const Store = {
  /**
   * Open the database, load the profile, compute the dials, and pick up an
   * in-progress session if she left one open this morning.
   * Safe to call more than once. Resolves with the state object.
   */
  async init() {
    await DB.init();
    state.today = DB.todayISO();
    state.profile = await DB.getProfile();
    state.dials = computeDials(state.profile);

    const session = await findOpenSession(state.today);
    state.activeSession = session;
    state.activeSets = session ? await DB.getSessionSets(session.id) : [];

    ready = true;
    notify(['profile', 'dials', 'today', 'activeSession', 'activeSets']);
    return state;
  },

  /** True once init() has completed. */
  get ready() {
    return ready;
  },

  /** Read one field. Omit `key` for the whole state object (live reference). */
  get(key) {
    return key === undefined ? state : state[key];
  },

  /** Write one field and notify. Returns the value. */
  set(key, value) {
    if (typeof key !== 'string' || key === '') {
      throw new Error('Daybreak Store: set() needs a string key.');
    }
    state[key] = value;
    notify([key]);
    return value;
  },

  /** Write several fields, then notify once. Returns the state object. */
  update(patch) {
    if (!patch || typeof patch !== 'object') return state;
    const keys = Object.keys(patch);
    if (keys.length === 0) return state;
    for (const key of keys) state[key] = patch[key];
    notify(keys);
    return state;
  },

  /**
   * Subscribe to every change. fn(state, changedKeys) is called after each
   * write. Returns an unsubscribe function.
   */
  subscribe(fn) {
    if (typeof fn !== 'function') {
      throw new Error('Daybreak Store: subscribe() needs a function.');
    }
    listeners.add(fn);
    return function unsubscribe() {
      listeners.delete(fn);
    };
  },

  /** Re-read the profile from the database and recompute the dials. */
  async refreshProfile() {
    state.profile = await DB.getProfile();
    state.dials = computeDials(state.profile);
    notify(['profile', 'dials']);
    return state.profile;
  },

  /** Re-read the sets belonging to the active session (call after logging). */
  async reloadActiveSets() {
    const session = state.activeSession;
    state.activeSets = session ? await DB.getSessionSets(session.id) : [];
    notify(['activeSets']);
    return state.activeSets;
  },

  /** Re-check for an open session on today's date (also refreshes `today`). */
  async reloadActiveSession() {
    state.today = DB.todayISO();
    const session = await findOpenSession(state.today);
    state.activeSession = session;
    state.activeSets = session ? await DB.getSessionSets(session.id) : [];
    notify(['today', 'activeSession', 'activeSets']);
    return session;
  }
};
