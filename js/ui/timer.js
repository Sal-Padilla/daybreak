// Daybreak — js/ui/timer.js — wall-clock rest timer that stays accurate while the phone is locked or the tab is backgrounded

/* =============================================================================
   WHY A DEADLINE, NOT A COUNTER
   -----------------------------------------------------------------------------
   She logs a set, drops the phone in her pocket, and the screen locks. iOS
   freezes timers on a hidden tab, so anything that does `remaining -= 1` on an
   interval loses however long the screen was off. This timer stores a wall-clock
   deadline (`Date.now() + ms`) and recomputes the remainder on every tick, so
   coming back to the tab shows the truth — even if that truth is "rest is over".
   The interval only decides how often we look at the clock, never what time it is.

   ONE INSTANCE, MANY RENDERS
   -----------------------------------------------------------------------------
   The train screen re-renders on every logged set. It is expected to hold ONE
   module-level RestTimer and call `bind(node)` after each render to point it at
   the fresh DOM node. The timer never attaches listeners to the content root and
   never keeps more than one interval, so re-rendering cannot leak.

   DRIVING THE VISUAL
   -----------------------------------------------------------------------------
   Of the two ring paths components.css supports, this file uses the CSS
   conic-gradient one: it writes `--pct` (0–100, per the file's convention) and
   injects no SVG. That keeps the ring working on iOS 16.0–16.3, which lack
   `:has()` and so could not suppress the CSS ring behind an injected <svg>.
   ========================================================================== */

/** How often we consult the wall clock. Sub-second so the digits turn crisply. */
const TICK_MS = 250;

/** Used when the caller gives no seconds at all. A normal accessory rest. */
const DEFAULT_SECONDS = 90;

/** Coerce anything into a whole, non-negative number of seconds. */
function toSeconds(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** 90 -> '1:30' · 45 -> '0:45' · 3725 -> '1:02:05' */
function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  return `${minutes}:${pad2(seconds)}`;
}

/** Spoken form for the aria-label — "1 minute 30 seconds", "45 seconds". */
function speakClock(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  const parts = [];
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  if (seconds > 0 || minutes === 0) parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/** A callback must never be able to kill the countdown. */
function safeCall(fn, args, where) {
  if (typeof fn !== 'function') return;
  try {
    fn.apply(null, args);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`RestTimer: ${where} callback threw`, err);
  }
}

/**
 * Rest timer for the training screen.
 *
 * States: 'idle' (loaded, not counting) · 'running' · 'paused' · 'done'.
 *
 * Every method is safe to call in any state and returns `this`, so
 * `timer.reset(90).start()` reads the way it should.
 *
 *   const timer = new RestTimer({
 *     seconds: 90,
 *     onTick: (secs) => { ... },   // remaining whole seconds
 *     onDone: () => { ... }        // fires once per countdown
 *   });
 *   timer.bind(root).reset(90).start();   // root is the .rest-timer element
 */
export class RestTimer {
  constructor(opts = {}) {
    const o = opts && typeof opts === 'object' ? opts : {};

    /** Reassignable so a re-render can hand over fresh closures. */
    this.onTick = typeof o.onTick === 'function' ? o.onTick : null;
    this.onDone = typeof o.onDone === 'function' ? o.onDone : null;

    /** Full length of the current countdown, in seconds. Drives `pct`. */
    this._total = toSeconds(o.seconds, DEFAULT_SECONDS);

    /** Remaining ms while NOT running. Ignored while running. */
    this._leftMs = this._total * 1000;

    /** Wall-clock ms at which this countdown ends. Only meaningful while running. */
    this._deadline = 0;

    this._interval = 0;
    this._state = 'idle';
    this._doneFired = false;
    this._lastEmitted = null;
    this._node = null;
    this._visBound = false;

    // Bound once so add/removeEventListener always see the same reference.
    this._onVisibility = () => {
      if (this._state === 'running') this._tick(false);
    };
  }

  /* ------------------------------------------------------------------ read */

  /** Remaining whole seconds, recomputed from the wall clock. Never negative. */
  get remaining() {
    return Math.max(0, Math.ceil(this._remainingMs() / 1000));
  }

  /** Seconds already spent resting. */
  get elapsed() {
    return Math.max(0, this._total - this.remaining);
  }

  /** Full length of the current countdown, in seconds. */
  get duration() {
    return this._total;
  }

  /** Fraction of the rest still to go, 0–1. The ring drains as she rests. */
  get pct() {
    if (this._total <= 0) return 0;
    return clamp01(this._remainingMs() / (this._total * 1000));
  }

  /** 'idle' | 'running' | 'paused' | 'done' */
  get state() {
    return this._state;
  }

  get isRunning() {
    return this._state === 'running';
  }

  get isDone() {
    return this._state === 'done';
  }

  /** Display string for `.rest-timer-time` — '1:30'. */
  get label() {
    return formatClock(this.remaining);
  }

  /* --------------------------------------------------------------- control */

  /**
   * Start or resume. A no-op while already running — calling it twice never
   * creates a second interval. From 'done' (or an empty clock) it re-runs the
   * last full duration, so a "Start" tap after the buzzer just goes again.
   */
  start() {
    if (this._state === 'running') return this;

    let leftMs = Math.max(0, this._leftMs);
    if (leftMs <= 0) {
      if (this._total <= 0) {
        this._paint();
        return this;
      }
      leftMs = this._total * 1000;
    }

    this._doneFired = false;
    this._lastEmitted = null;
    this._leftMs = leftMs;
    this._deadline = Date.now() + leftMs;
    this._state = 'running';
    this._startLoop();
    this._tick(true);
    return this;
  }

  /** Hold the clock where it is. A no-op unless running. */
  pause() {
    if (this._state !== 'running') return this;

    const ms = Math.max(0, this._deadline - Date.now());
    this._deadline = 0;
    this._leftMs = ms;

    if (ms <= 0) {
      // It quietly finished while she was reaching for the button.
      this._finish();
      return this;
    }

    this._stopLoop();
    this._state = 'paused';
    this._paint();
    return this;
  }

  /**
   * Reload the clock to a full countdown.
   * `seconds` omitted keeps the current duration.
   * If it was running it keeps running (a restart); otherwise it waits at full,
   * ready for `start()`. Safe while paused, done, or already idle.
   */
  reset(seconds) {
    const wasRunning = this._state === 'running';
    const next = seconds === undefined || seconds === null
      ? this._total
      : toSeconds(seconds, this._total);

    this._stopLoop();
    this._total = next;
    this._leftMs = next * 1000;
    this._deadline = 0;
    this._doneFired = false;
    this._lastEmitted = null;
    this._state = 'idle';

    if (wasRunning && next > 0) return this.start();

    this._paint();
    this._emitTick(this.remaining);
    return this;
  }

  /**
   * Add (or, with a negative number, take off) seconds.
   * Running: the deadline moves, the clock never stutters.
   * Paused / idle: the stored remainder moves.
   * Done: starts a fresh countdown of `sec` seconds — the "+30" button still
   * works after the buzzer, which is exactly when she reaches for it.
   */
  add(sec) {
    const delta = Math.round(Number(sec));
    if (!Number.isFinite(delta) || delta === 0) return this;

    if (this._state === 'done') {
      if (delta < 0) return this;
      this._total = delta;
      this._leftMs = delta * 1000;
      this._deadline = 0;
      this._doneFired = false;
      this._lastEmitted = null;
      this._state = 'idle';
      return this.start();
    }

    const nextMs = Math.max(0, this._remainingMs() + delta * 1000);
    this._total = Math.max(0, this._total + delta, Math.ceil(nextMs / 1000));

    if (this._state === 'running') {
      this._leftMs = nextMs;
      this._deadline = Date.now() + nextMs;
      this._tick(true);          // handles the case where it just hit zero
      return this;
    }

    this._leftMs = nextMs;
    this._paint();
    this._emitTick(this.remaining);
    return this;
  }

  /**
   * Cancel the rest entirely: clock to zero, interval cleared, listener removed,
   * `onDone` NOT fired. Idempotent — calling it twice (or on a fresh timer) does
   * nothing. The bound node is kept, so a later `start()` still paints.
   */
  stop() {
    this._stopLoop();
    this._deadline = 0;
    this._leftMs = 0;
    this._lastEmitted = null;
    this._doneFired = false;
    this._state = 'idle';
    this._paint();
    return this;
  }

  /* ------------------------------------------------------------------- DOM */

  /**
   * Point the timer at a `.rest-timer` element (or a CSS selector for one).
   * Call it after every re-render; it replaces the previous node, so only one is
   * ever held. The timer writes:
   *   --pct        0–100 on the root and on `.rest-timer-dial`
   *   textContent  of `.rest-timer-time`
   *   is-paused / is-done classes on the root
   * It attaches no listeners — buttons stay with the feature's `data-action`s.
   */
  bind(node) {
    let target = node;
    if (typeof target === 'string') {
      target = typeof document !== 'undefined' ? document.querySelector(target) : null;
    }
    this._node = target && target.nodeType === 1 ? target : null;

    if (this._node) {
      if (!this._node.hasAttribute('role')) this._node.setAttribute('role', 'timer');
      const time = this._node.querySelector('.rest-timer-time');
      if (time) time.setAttribute('aria-hidden', 'true');
    }
    this._paint();
    return this;
  }

  /** Forget the DOM node. The countdown itself is untouched. */
  unbind() {
    this._node = null;
    return this;
  }

  /** The node currently being painted, or null. */
  get node() {
    return this._node;
  }

  /** 90 -> '1:30'. Exposed so the feature can label buttons consistently. */
  static format(seconds) {
    return formatClock(seconds);
  }

  /* --------------------------------------------------------------- private */

  _remainingMs() {
    if (this._state === 'running') return Math.max(0, this._deadline - Date.now());
    return Math.max(0, this._leftMs);
  }

  _startLoop() {
    this._stopLoop();
    this._interval = setInterval(() => this._tick(false), TICK_MS);

    // A locked screen freezes the interval; this fires the moment she's back so
    // the digits are right before the next 250 ms poll.
    if (!this._visBound && typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', this._onVisibility);
      this._visBound = true;
    }
  }

  _stopLoop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = 0;
    }
    if (this._visBound && typeof document !== 'undefined' && document.removeEventListener) {
      document.removeEventListener('visibilitychange', this._onVisibility);
    }
    this._visBound = false;
  }

  _tick(force) {
    if (this._state !== 'running') {
      this._paint();
      return;
    }

    const ms = Math.max(0, this._deadline - Date.now());
    this._leftMs = ms;

    if (ms <= 0) {
      this._finish();
      return;
    }

    this._paint();
    const secs = Math.ceil(ms / 1000);
    if (force || secs !== this._lastEmitted) {
      this._emitTick(secs);
    }
  }

  _finish() {
    this._stopLoop();
    this._leftMs = 0;
    this._deadline = 0;
    this._state = 'done';
    this._paint();

    if (this._lastEmitted !== 0) this._emitTick(0);

    if (!this._doneFired) {
      this._doneFired = true;      // set before the callback: onDone fires once
      this._vibrate();
      safeCall(this.onDone, [this], 'onDone');
    }
  }

  _emitTick(secs) {
    this._lastEmitted = secs;
    safeCall(this.onTick, [secs, this], 'onTick');
  }

  _vibrate() {
    // No audio in v0.1. iOS Safari has no vibrate at all, hence the guard.
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(200);
      }
    } catch (_) {
      /* a blocked or unsupported vibrate must never stop the timer */
    }
  }

  _paint() {
    const root = this._node;
    if (!root) return;

    const secs = this.remaining;
    const pct = Math.round(this.pct * 1000) / 10;   // 0–100, one decimal

    try {
      root.style.setProperty('--pct', String(pct));
      const dial = root.querySelector('.rest-timer-dial');
      if (dial) dial.style.setProperty('--pct', String(pct));

      const time = root.querySelector('.rest-timer-time');
      const text = formatClock(secs);
      if (time) {
        if (time.textContent !== text) time.textContent = text;
      } else if (root.classList.contains('rest-timer-time')) {
        if (root.textContent !== text) root.textContent = text;
      }

      root.classList.toggle('is-paused', this._state === 'paused');
      root.classList.toggle('is-done', this._state === 'done');

      const aria = this._state === 'done'
        ? 'Rest complete.'
        : `Rest timer. ${speakClock(secs)} remaining${this._state === 'paused' ? ', paused' : ''}.`;
      root.setAttribute('aria-label', aria);
    } catch (_) {
      /* a detached or half-built node must never break the countdown */
    }
  }
}

export default RestTimer;
