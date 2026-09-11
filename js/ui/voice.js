// Daybreak — js/ui/voice.js — say the set instead of typing it.
//
// Why this exists: the set row carries a weight stepper, a reps stepper and a log button.
// On a phone at a large system font that is 187px of chrome sitting over the movement she
// is trying to look at. Speaking the set is both faster and smaller — "one sixty five by
// five" logs in one breath, with chalk on your hands, without finding a 40px input.
//
// Web Speech API only. No library, no network call of our own, no audio stored or sent
// anywhere by us. The browser does the recognition; Chrome routes it through Google's
// service, which is why the UI says so before the first use. Unsupported browsers
// (Firefox, and any WebView without the API) simply never see the microphone button.

const SR = typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

/** True when this browser can actually listen. Callers hide the mic entirely when false. */
export function voiceSupported() {
  return Boolean(SR);
}

const SMALL = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19
};
const TENS = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90
};

/**
 * Turn spoken number words into digits, so the rest of the parser only ever sees numerals.
 * Handles the shapes people actually say in a gym:
 *   "one sixty five" -> 165      "a hundred and thirty five" -> 135
 *   "two twenty"     -> 220      "forty five"                -> 45
 * Chrome usually returns digits already; Safari and the Android WebView often do not.
 */
export function wordsToNumbers(text) {
  const tokens = String(text).toLowerCase().replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  const out = [];
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];

    // "one sixty five" / "two twenty" — a single digit followed by a tens word reads as
    // hundreds in gym speech: one-sixty-five is 165, never 1 and 65.
    if (SMALL[t] !== undefined && SMALL[t] >= 1 && SMALL[t] <= 9 && TENS[tokens[i + 1]] !== undefined) {
      let n = SMALL[t] * 100 + TENS[tokens[i + 1]];
      i += 2;
      if (SMALL[tokens[i]] !== undefined && SMALL[tokens[i]] < 10) { n += SMALL[tokens[i]]; i += 1; }
      out.push(String(n));
      continue;
    }

    // "(a|one|two) hundred (and) thirty five"
    if (t === 'hundred' || tokens[i + 1] === 'hundred') {
      let base = 100;
      if (t !== 'hundred') {
        const lead = SMALL[t] !== undefined ? SMALL[t] : Number(t);
        if (Number.isFinite(lead) && lead >= 1 && lead <= 9) base = lead * 100;
        i += 1;
      }
      i += 1;
      if (tokens[i] === 'and') i += 1;
      let rest = 0;
      if (TENS[tokens[i]] !== undefined) {
        rest = TENS[tokens[i]];
        i += 1;
        if (SMALL[tokens[i]] !== undefined && SMALL[tokens[i]] < 10) { rest += SMALL[tokens[i]]; i += 1; }
      } else if (SMALL[tokens[i]] !== undefined) {
        rest = SMALL[tokens[i]];
        i += 1;
      } else if (tokens[i] && Number.isFinite(Number(tokens[i]))) {
        rest = Number(tokens[i]);
        i += 1;
      }
      out.push(String(base + rest));
      continue;
    }

    // "forty five" -> 45
    if (TENS[t] !== undefined) {
      let n = TENS[t];
      i += 1;
      if (SMALL[tokens[i]] !== undefined && SMALL[tokens[i]] < 10) { n += SMALL[tokens[i]]; i += 1; }
      out.push(String(n));
      continue;
    }

    if (SMALL[t] !== undefined) { out.push(String(SMALL[t])); i += 1; continue; }

    out.push(t);
    i += 1;
  }

  return out.join(' ');
}

/**
 * parseSet(transcript, track) -> {weight?, reps?, seconds?, distance?} | null
 *
 * Reads what she actually says, in the order a lifter says it. `track` decides what a
 * lone number means: on a weight_reps lift a single number is the weight; on a
 * bodyweight lift it can only be reps.
 */
export function parseSet(transcript, track) {
  const t = wordsToNumbers(transcript)
    .replace(/\bpounds?\b|\blbs?\b/g, ' lb ')
    .replace(/\bby\b|\btimes\b|\bx\b/g, ' x ')
    .replace(/\bseconds?\b|\bsecs?\b/g, ' sec ')
    .replace(/\bminutes?\b|\bmins?\b/g, ' min ')
    .replace(/\bmiles?\b/g, ' mi ')
    .replace(/\breps?\b|\brepetitions?\b/g, ' rep ')
    .replace(/\s+/g, ' ')
    .trim();

  const num = (re) => {
    const m = t.match(re);
    return m ? Number(m[1]) : null;
  };

  const out = {};

  // Explicitly-unitted values win, wherever they appear.
  const lb = num(/(\d+(?:\.\d+)?)\s*lb/);
  const rep = num(/(\d+(?:\.\d+)?)\s*rep/);
  const sec = num(/(\d+(?:\.\d+)?)\s*sec/);
  const min = num(/(\d+(?:\.\d+)?)\s*min/);
  const mi = num(/(\d+(?:\.\d+)?)\s*mi\b/);

  if (lb != null) out.weight = lb;
  if (rep != null) out.reps = rep;
  if (sec != null) out.seconds = sec;
  if (min != null) out.seconds = Math.round(min * 60);
  if (mi != null) out.distance = mi;

  // "165 x 5" — the bare cross form, only for values not already spelled out.
  const cross = t.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
  if (cross) {
    if (track === 'time_distance') {
      if (out.seconds == null) out.seconds = Math.round(Number(cross[1]) * 60);
      if (out.distance == null) out.distance = Number(cross[2]);
    } else if (track === 'weight_reps') {
      if (out.weight == null) out.weight = Number(cross[1]);
      if (out.reps == null) out.reps = Number(cross[2]);
    } else if (out.reps == null) {
      out.reps = Number(cross[2]);
    }
  }

  // A lone number. What it means depends entirely on what we are tracking.
  if (!Object.keys(out).length) {
    const lone = t.match(/(\d+(?:\.\d+)?)/);
    if (!lone) return null;
    const n = Number(lone[1]);
    if (track === 'weight_reps') out.weight = n;
    else if (track === 'time_hold') out.seconds = n;
    else out.reps = n;
  }

  return Object.keys(out).length ? out : null;
}

/** A plain-English echo of what we heard, for the confirmation line. */
export function describeSet(parsed) {
  if (!parsed) return '';
  const bits = [];
  if (parsed.weight != null) bits.push(parsed.weight + ' lb');
  if (parsed.reps != null) bits.push(parsed.reps + ' reps');
  if (parsed.seconds != null) {
    bits.push(parsed.seconds >= 120
      ? Math.round(parsed.seconds / 60) + ' min'
      : parsed.seconds + ' sec');
  }
  if (parsed.distance != null) bits.push(parsed.distance + ' mi');
  return bits.join(' · ');
}

/**
 * listen({onResult, onState, lang}) -> stop()
 *
 * One shot. Reports the best transcript through onResult, then stops itself.
 * onState reports 'listening' | 'thinking' | 'idle' | 'error' so the caller can show it.
 */
export function listen(opts = {}) {
  if (!SR) {
    if (opts.onState) opts.onState('error', 'This browser cannot listen.');
    return () => {};
  }

  const rec = new SR();
  rec.lang = opts.lang || (navigator.language || 'en-US');
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  rec.continuous = false;

  let done = false;
  const finish = (state, detail) => {
    if (done) return;
    done = true;
    if (opts.onState) opts.onState(state, detail);
  };

  rec.onstart = () => { if (opts.onState) opts.onState('listening'); };

  rec.onresult = (e) => {
    const alts = [];
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      for (let j = 0; j < r.length; j++) alts.push(r[j].transcript);
    }
    if (opts.onState) opts.onState('thinking');
    if (opts.onResult) opts.onResult(alts[0] || '', alts);
    finish('idle');
  };

  rec.onerror = (e) => {
    const code = e && e.error;
    const message = code === 'not-allowed' || code === 'service-not-allowed'
      ? 'Microphone blocked. Allow it in the browser site settings.'
      : code === 'no-speech'
        ? 'Did not catch that.'
        : 'Could not listen just now.';
    finish('error', message);
  };

  rec.onend = () => finish('idle');

  try {
    rec.start();
  } catch (err) {
    finish('error', 'Could not start listening.');
  }

  return () => { try { rec.abort(); } catch (_) { /* already stopped */ } };
}
