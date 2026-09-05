// Daybreak — js/core/db.js — IndexedDB layer: stores, indexed queries, profile helpers, export/import.

const DB_NAME = 'DaybreakDB';
const DB_VERSION = 1;
const SCHEMA_VERSION = 1;

/**
 * Store definitions — BUILD_CONTRACT §4.5. Do not change without a version bump.
 */
const SCHEMA = {
  profile:      { keyPath: 'id',     indexes: [] },
  classes:      { keyPath: 'id',     indexes: [{ name: 'dayOfWeek',  keyPath: 'dayOfWeek'  }] },
  sessions:     { keyPath: 'id',     indexes: [{ name: 'date',       keyPath: 'date'       },
                                               { name: 'type',       keyPath: 'type'       }] },
  sets:         { keyPath: 'id',     indexes: [{ name: 'sessionId',  keyPath: 'sessionId'  },
                                               { name: 'exerciseId', keyPath: 'exerciseId' }] },
  measurements: { keyPath: 'id',     indexes: [{ name: 'date',       keyPath: 'date'       }] },
  cycleLog:     { keyPath: 'id',     indexes: [{ name: 'date',       keyPath: 'date'       }] },
  reports:      { keyPath: 'weekOf', indexes: [] },
  prefs:        { keyPath: 'key',    indexes: [] }
};

const STORE_NAMES = Object.keys(SCHEMA);

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

let uidCounter = 0;

/**
 * Stable unique id. crypto.randomUUID() where available, otherwise
 * timestamp + monotonic counter + random suffix (still collision-safe on device).
 */
function uid(prefix) {
  let base = '';
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
  if (c && typeof c.randomUUID === 'function') {
    try { base = c.randomUUID(); } catch (_) { base = ''; }
  }
  if (!base) {
    uidCounter = (uidCounter + 1) % 1000000;
    const stamp = Date.now().toString(36);
    const seq = uidCounter.toString(36).padStart(4, '0');
    const rand = Math.random().toString(36).slice(2, 10);
    base = `${stamp}-${seq}-${rand}`;
  }
  return prefix ? `${prefix}-${base}` : base;
}

/** Local calendar date as YYYY-MM-DD (never UTC-shifted). */
function todayISO(d) {
  const dt = d instanceof Date ? d : (d ? new Date(d) : new Date());
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function assertStore(name) {
  if (!Object.prototype.hasOwnProperty.call(SCHEMA, name)) {
    throw new Error(`Daybreak DB: unknown store "${name}"`);
  }
  return name;
}

function errOf(source, fallbackMessage) {
  const e = source && source.error;
  return e instanceof Error || (e && e.name) ? e : new Error(fallbackMessage);
}

/* ------------------------------------------------------------------ *
 * Connection
 * ------------------------------------------------------------------ */

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      reject(new Error('Daybreak needs IndexedDB, and this browser is not offering it.'));
      return;
    }

    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORE_NAMES) {
        const def = SCHEMA[name];
        const store = db.objectStoreNames.contains(name)
          ? request.transaction.objectStore(name)
          : db.createObjectStore(name, { keyPath: def.keyPath });
        for (const idx of def.indexes) {
          if (!store.indexNames.contains(idx.name)) {
            store.createIndex(idx.name, idx.keyPath, { unique: false });
          }
        }
      }
    };

    request.onblocked = () => {
      // Another tab holds an older version open. Surface it rather than hanging forever.
      console.warn('Daybreak DB: upgrade blocked by another open tab.');
    };

    request.onerror = () => reject(errOf(request, 'Daybreak DB: could not open DaybreakDB.'));

    request.onsuccess = () => {
      const db = request.result;
      // iOS Safari can drop the connection from under us; forget it so the next call reopens.
      db.onversionchange = () => { try { db.close(); } catch (_) {} dbPromise = null; };
      db.onclose = () => { dbPromise = null; };
      resolve(db);
    };
  });

  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

/**
 * Run `work(store, setResult)` inside one transaction.
 * Resolves on transaction completion (durable), rejects with the real error.
 */
function run(storeName, mode, work) {
  assertStore(storeName);
  return openDB().then((db) => new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(storeName, mode);
    } catch (err) {
      dbPromise = null;
      reject(err);
      return;
    }

    let result;
    let settled = false;
    const fail = (e) => { if (!settled) { settled = true; reject(e); } };

    tx.oncomplete = () => { if (!settled) { settled = true; resolve(result); } };
    tx.onerror = () => fail(errOf(tx, `Daybreak DB: transaction failed on "${storeName}".`));
    tx.onabort = () => fail(errOf(tx, `Daybreak DB: transaction aborted on "${storeName}".`));

    try {
      work(tx.objectStore(storeName), (v) => { result = v; }, fail);
    } catch (err) {
      try { tx.abort(); } catch (_) {}
      fail(err);
    }
  }));
}

/** Wrap a single IDBRequest, forwarding its value to the transaction result. */
function one(storeName, mode, fn) {
  return run(storeName, mode, (store, setResult, fail) => {
    const request = fn(store);
    request.onsuccess = () => setResult(request.result);
    request.onerror = () => fail(errOf(request, `Daybreak DB: request failed on "${storeName}".`));
  });
}

/* ------------------------------------------------------------------ *
 * Sorting helpers
 * ------------------------------------------------------------------ */

function byLoggedAt(a, b) {
  const av = a && a.loggedAt ? String(a.loggedAt) : '';
  const bv = b && b.loggedAt ? String(b.loggedAt) : '';
  if (av !== bv) return av < bv ? -1 : 1;
  return (a && a.setNumber || 0) - (b && b.setNumber || 0);
}

function bySetNumber(a, b) {
  const d = (a && a.setNumber || 0) - (b && b.setNumber || 0);
  return d !== 0 ? d : byLoggedAt(a, b);
}

function byDate(a, b) {
  const av = a && a.date ? String(a.date) : '';
  const bv = b && b.date ? String(b.date) : '';
  if (av !== bv) return av < bv ? -1 : 1;
  const as = a && a.startedAt ? String(a.startedAt) : '';
  const bs = b && b.startedAt ? String(b.startedAt) : '';
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/* ------------------------------------------------------------------ *
 * Profile
 * ------------------------------------------------------------------ */

/** The documented default profile — BUILD_CONTRACT §4.5. */
function defaultProfile() {
  return {
    id: 'me',
    name: '',
    lifeStage: 'transition',
    experience: 'new',
    birthYear: null,
    heightIn: null,
    weightLb: null,
    goal: 'recomp',
    proteinTargetG: null,
    pelvicFloor: 'unknown',
    wakeTime: '04:00',
    trainTime: '05:30',
    theme: 'auto',
    programId: 'on-ramp',
    programWeek: 1,
    startedOn: todayISO(),
    units: 'lb'
  };
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export const DB = {
  name: DB_NAME,
  version: DB_VERSION,
  schemaVersion: SCHEMA_VERSION,
  stores: STORE_NAMES.slice(),

  uid,
  todayISO,
  defaultProfile,

  /** Open (or reopen) the database. Idempotent. Resolves with the IDBDatabase. */
  init() {
    return openDB();
  },

  /**
   * Write one record. For id-keyed stores an id is generated when missing.
   * Resolves with the stored object (so callers get the generated id).
   */
  put(storeName, obj) {
    assertStore(storeName);
    if (!obj || typeof obj !== 'object') {
      return Promise.reject(new Error(`Daybreak DB: put("${storeName}") needs an object.`));
    }
    const keyPath = SCHEMA[storeName].keyPath;
    const record = Object.assign({}, obj);
    if (keyPath === 'id' && (record.id === undefined || record.id === null || record.id === '')) {
      record.id = uid();
    }
    if (record[keyPath] === undefined || record[keyPath] === null || record[keyPath] === '') {
      return Promise.reject(new Error(`Daybreak DB: "${storeName}" records need a "${keyPath}".`));
    }
    return one(storeName, 'readwrite', (store) => store.put(record)).then(() => record);
  },

  /** Read one record by key. Resolves undefined when absent. */
  get(storeName, id) {
    return one(storeName, 'readonly', (store) => store.get(id));
  },

  /** Read every record in a store. */
  getAll(storeName) {
    return one(storeName, 'readonly', (store) => store.getAll()).then((r) => r || []);
  },

  /** Read every record whose index value equals `value`. */
  getAllByIndex(storeName, index, value) {
    return one(storeName, 'readonly', (store) => store.index(index).getAll(value)).then((r) => r || []);
  },

  /**
   * Inclusive range read over an index. `lo` or `hi` may be null/undefined
   * for an open-ended bound; both open reads the whole index in key order.
   */
  getRange(storeName, index, lo, hi) {
    const hasLo = lo !== undefined && lo !== null && lo !== '';
    const hasHi = hi !== undefined && hi !== null && hi !== '';
    let low = lo;
    let high = hi;
    if (hasLo && hasHi && low > high) { const t = low; low = high; high = t; }
    let range = null;
    try {
      if (hasLo && hasHi) range = IDBKeyRange.bound(low, high, false, false);
      else if (hasLo) range = IDBKeyRange.lowerBound(low, false);
      else if (hasHi) range = IDBKeyRange.upperBound(high, false);
    } catch (err) {
      return Promise.reject(err);
    }
    return one(storeName, 'readonly', (store) => store.index(index).getAll(range)).then((r) => r || []);
  },

  /** Delete one record by key. */
  del(storeName, id) {
    return one(storeName, 'readwrite', (store) => store.delete(id)).then(() => true);
  },

  /** Empty a store. */
  clear(storeName) {
    return one(storeName, 'readwrite', (store) => store.clear()).then(() => true);
  },

  /** Number of records in a store. */
  count(storeName) {
    return one(storeName, 'readonly', (store) => store.count()).then((n) => n || 0);
  },

  /** Write many records in one transaction. Resolves with the stored objects. */
  putAll(storeName, arr) {
    assertStore(storeName);
    const list = Array.isArray(arr) ? arr : [];
    if (list.length === 0) return Promise.resolve([]);
    const keyPath = SCHEMA[storeName].keyPath;
    const records = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const record = Object.assign({}, item);
      if (keyPath === 'id' && (record.id === undefined || record.id === null || record.id === '')) {
        record.id = uid();
      }
      if (record[keyPath] === undefined || record[keyPath] === null || record[keyPath] === '') continue;
      records.push(record);
    }
    if (records.length === 0) return Promise.resolve([]);
    return run(storeName, 'readwrite', (store, setResult, fail) => {
      for (const record of records) {
        const request = store.put(record);
        request.onerror = () => fail(errOf(request, `Daybreak DB: putAll failed on "${storeName}".`));
      }
      setResult(records);
    });
  },

  /* ---------------- domain helpers ---------------- */

  /** True when onboarding has already written a profile. */
  hasProfile() {
    return this.get('profile', 'me').then((p) => !!p);
  },

  /**
   * The stored profile, merged over the documented defaults so a profile
   * written by an older build never has missing fields. Returns the default
   * object (id 'me') when nothing is stored. Does not write.
   */
  getProfile() {
    return this.get('profile', 'me').then((stored) => {
      const base = defaultProfile();
      if (!stored || typeof stored !== 'object') return base;
      return Object.assign(base, stored, { id: 'me' });
    });
  },

  /** Merge a patch (or a whole profile) into the stored profile and save it. */
  saveProfile(p) {
    return this.getProfile().then((current) => {
      const next = Object.assign({}, current, p && typeof p === 'object' ? p : {}, { id: 'me' });
      return this.put('profile', next);
    });
  },

  /** Every set logged in one session, in set order. */
  getSessionSets(sessionId) {
    return this.getAllByIndex('sets', 'sessionId', sessionId).then((rows) => rows.sort(bySetNumber));
  },

  /** Every set ever logged for one exercise, oldest first. */
  getExerciseSets(exerciseId) {
    return this.getAllByIndex('sets', 'exerciseId', exerciseId).then((rows) => rows.sort(byLoggedAt));
  },

  /**
   * Working sets (warm-ups excluded) from the most recent session that
   * contained this exercise, in set order. Empty array when it is new.
   * This is the pre-fill source for one-tap logging.
   */
  getLastSetsForExercise(exerciseId) {
    return this.getExerciseSets(exerciseId).then((rows) => {
      const working = rows.filter((s) => s && !s.isWarmup);
      if (working.length === 0) return [];
      const groups = new Map();
      for (const s of working) {
        const key = s.sessionId == null ? '' : String(s.sessionId);
        const g = groups.get(key);
        if (g) g.push(s); else groups.set(key, [s]);
      }
      let best = null;
      let bestStamp = '';
      for (const group of groups.values()) {
        let stamp = '';
        for (const s of group) {
          const v = s.loggedAt ? String(s.loggedAt) : '';
          if (v > stamp) stamp = v;
        }
        if (best === null || stamp > bestStamp) { best = group; bestStamp = stamp; }
      }
      return (best || []).slice().sort(bySetNumber);
    });
  },

  /** Sessions whose `date` falls in [startISO, endISO] inclusive, oldest first. */
  getSessionsInRange(startISO, endISO) {
    return this.getRange('sessions', 'date', startISO, endISO).then((rows) => rows.sort(byDate));
  },

  /* ---------------- prefs ---------------- */

  /** Read one pref value, or `fallback` when unset. */
  getPref(key, fallback) {
    return this.get('prefs', key).then((row) => (row && 'value' in row ? row.value : fallback));
  },

  /** Write one pref value. */
  setPref(key, value) {
    return this.put('prefs', { key, value }).then((row) => row.value);
  },

  /* ---------------- backup ---------------- */

  /**
   * Everything on the device as one plain object, ready for JSON.stringify.
   * Shape: { app, schemaVersion, exportedAt, <storeName>: [...], ... }
   */
  exportAll() {
    return openDB()
      .then(() => Promise.all(STORE_NAMES.map((name) => this.getAll(name))))
      .then((results) => {
        const out = {
          app: 'Daybreak',
          schemaVersion: SCHEMA_VERSION,
          dbVersion: DB_VERSION,
          exportedAt: new Date().toISOString()
        };
        STORE_NAMES.forEach((name, i) => { out[name] = results[i] || []; });
        return out;
      });
  },

  /**
   * Merge an exported object back in. Missing, empty or malformed stores are
   * skipped rather than thrown on. Existing records with the same key are
   * overwritten. Resolves with a per-store count of what landed.
   */
  importAll(data) {
    if (!data || typeof data !== 'object') {
      return Promise.reject(new Error('Daybreak DB: import needs the exported object.'));
    }
    const summary = { imported: {}, total: 0, skipped: [] };
    return openDB().then(() => {
      let chain = Promise.resolve();
      for (const name of STORE_NAMES) {
        const raw = data[name];
        let rows;
        if (Array.isArray(raw)) rows = raw;
        else if (raw && typeof raw === 'object') rows = [raw];   // tolerate a bare profile object
        else { if (raw !== undefined) summary.skipped.push(name); continue; }
        const clean = rows.filter((r) => r && typeof r === 'object');
        if (clean.length === 0) { summary.imported[name] = 0; continue; }
        if (name === 'profile') clean.forEach((r) => { r.id = 'me'; });
        chain = chain
          .then(() => this.putAll(name, clean))
          .then((written) => {
            summary.imported[name] = written.length;
            summary.total += written.length;
          });
      }
      return chain.then(() => summary);
    });
  },

  /** Wipe every store. Used by "erase all data" — the caller does the confirming. */
  clearAll() {
    return openDB().then(() => {
      let chain = Promise.resolve();
      for (const name of STORE_NAMES) chain = chain.then(() => this.clear(name));
      return chain.then(() => true);
    });
  },

  /** Close the connection (next call reopens). Mostly for tests and teardown. */
  close() {
    const p = dbPromise;
    dbPromise = null;
    if (!p) return Promise.resolve(true);
    return p.then((db) => { try { db.close(); } catch (_) {} return true; }, () => true);
  }
};
