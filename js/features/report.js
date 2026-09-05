// Daybreak — js/features/report.js — the Sunday weekly report, and getting it off the phone.
//
// buildReport() is a PURE function of the stored data and returns a STRUCTURED OBJECT with no
// display strings in it. That separation is deliberate: if a backend is ever added to email
// these automatically, it renders the same object without any of this being rewritten.
//
// On delivery, an honest note: no web app can reliably send a scheduled email by itself.
// Periodic Background Sync is Chrome-only, needs an install plus a high engagement score, and
// does not exist on iOS at all. So the flow is: Sunday nudge → she taps → one tap to share.

import { DB } from '../core/db.js';
import { Store } from '../core/store.js';
import { weeklyShapeMap } from '../engine/shapemap.js';
import { estimate1RM } from '../engine/progression.js';
import { byId } from '../data/exercises.js';
import { classById } from '../data/classes.js';
import { card, btn, toast, fmt } from '../ui/components.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function shiftDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return DB.todayISO(dt);
}

export function mondayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return DB.todayISO(dt);
}

function prettyRange(a, b) {
  const f = (iso, withMonth) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined,
      withMonth ? { month: 'short', day: 'numeric' } : { day: 'numeric' });
  };
  return f(a, true) + '–' + f(b, true);
}

function nearest(list, iso, maxDays) {
  let best = null;
  let bestGap = Infinity;
  for (const m of list) {
    const gap = Math.abs((new Date(m.date) - new Date(iso)) / 86400000);
    if (gap <= maxDays && gap < bestGap) { best = m; bestGap = gap; }
  }
  return best;
}

// ------------------------------------------------------------- buildReport()

/**
 * buildReport(weekOf) -> a plain data object. No strings for display, no formatting.
 * `weekOf` is the Monday of the week in question (YYYY-MM-DD).
 */
export async function buildReport(weekOf) {
  const start = mondayOf(weekOf || DB.todayISO());
  const end = shiftDays(start, 6);

  const profile = Store.get('profile') || await DB.getProfile();
  const dials = Store.get('dials');
  const classes = (await DB.getAll('classes')) || [];

  const sessions = (await DB.getSessionsInRange(start, end)) || [];
  const done = sessions.filter((s) => s.complete);

  const sets = [];
  for (const s of done) {
    const rows = await DB.getSessionSets(s.id);
    for (const r of rows) if (!r.isWarmup) sets.push(r);
  }

  const shape = weeklyShapeMap(done, sets, classes, dials);

  // --- what she did, by type
  const byType = { lift: 0, class: 0, conditioning: 0, recovery: 0 };
  const classNames = [];
  for (const s of done) {
    if (s.classId) {
      byType.class += 1;
      const f = classById(s.classFormatId || s.classId);
      if (f) classNames.push(f.name);
    } else if (s.type === 'conditioning') byType.conditioning += 1;
    else if (s.type === 'recovery') byType.recovery += 1;
    else byType.lift += 1;
  }

  // --- strength movers: this week's best top set vs the previous four weeks
  const priorStart = shiftDays(start, -28);
  const priorSessions = (await DB.getSessionsInRange(priorStart, shiftDays(start, -1))) || [];
  const priorIds = new Set(priorSessions.map((s) => s.id));

  const movers = [];
  const exerciseIds = [...new Set(sets.map((s) => s.exerciseId))];
  for (const eid of exerciseIds) {
    const ex = byId(eid);
    if (!ex || ex.track !== 'weight_reps') continue;

    const mine = sets.filter((s) => s.exerciseId === eid && s.weight != null);
    if (!mine.length) continue;
    const bestNow = mine.reduce((a, b) =>
      (estimate1RM(b.weight, b.reps) || 0) > (estimate1RM(a.weight, a.reps) || 0) ? b : a);

    const all = (await DB.getExerciseSets(eid)) || [];
    const before = all.filter((s) => priorIds.has(s.sessionId) && !s.isWarmup && s.weight != null);
    if (!before.length) continue;
    const bestBefore = before.reduce((a, b) =>
      (estimate1RM(b.weight, b.reps) || 0) > (estimate1RM(a.weight, a.reps) || 0) ? b : a);

    const now = estimate1RM(bestNow.weight, bestNow.reps) || 0;
    const then = estimate1RM(bestBefore.weight, bestBefore.reps) || 0;
    if (now > then) {
      movers.push({
        exerciseId: eid, name: ex.name,
        fromWeight: bestBefore.weight, fromReps: bestBefore.reps,
        toWeight: bestNow.weight, toReps: bestNow.reps,
        pctGain: then > 0 ? (now - then) / then : 0,
      });
    }
  }
  movers.sort((a, b) => b.pctGain - a.pctGain);

  // --- measurements: the headline is waist-to-hip, never bodyweight
  const measurements = (await DB.getAll('measurements')) || [];
  measurements.sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = measurements.length ? measurements[measurements.length - 1] : null;
  const twoWeeksBack = latest ? nearest(measurements, shiftDays(latest.date, -14), 10) : null;

  function whr(m) {
    if (!m || !m.waistIn || !m.hipIn) return null;
    return Math.round((m.waistIn / m.hipIn) * 1000) / 1000;
  }
  const delta = (a, b) => (a == null || b == null ? null : Math.round((a - b) * 100) / 100);

  const body = latest ? {
    date: latest.date,
    waistIn: latest.waistIn ?? null,
    hipIn: latest.hipIn ?? null,
    thighIn: latest.thighIn ?? null,
    armIn: latest.armIn ?? null,
    weightLb: latest.weightLb ?? null,
    whr: whr(latest),
    deltas: twoWeeksBack ? {
      days: Math.round((new Date(latest.date) - new Date(twoWeeksBack.date)) / 86400000),
      waistIn: delta(latest.waistIn, twoWeeksBack.waistIn),
      hipIn: delta(latest.hipIn, twoWeeksBack.hipIn),
      weightLb: delta(latest.weightLb, twoWeeksBack.weightLb),
      whr: delta(whr(latest), whr(twoWeeksBack)),
    } : null,
  } : null;

  // The recomposition signal: waist down AND hips up is exactly what the scale cannot show.
  const recomposition = !!(body && body.deltas &&
    body.deltas.waistIn != null && body.deltas.waistIn < 0 &&
    body.deltas.hipIn != null && body.deltas.hipIn > 0);

  // --- protein adherence
  let proteinHit = 0;
  let proteinLogged = 0;
  for (let i = 0; i < 7; i++) {
    const v = await DB.getPref('protein:' + shiftDays(start, i), null);
    if (v === true) { proteinHit++; proteinLogged++; }
    else if (v === false) proteinLogged++;
  }

  // --- next actions, drawn from the actual shortfalls
  const actions = [];
  for (const s of (shape.shortfalls || []).slice().sort((a, b) => b.short - a.short).slice(0, 2)) {
    actions.push({ kind: 'shortfall', target: s.key, label: s.label, short: s.short });
  }
  if (dials && dials.impactSessionsPerWeek > 0 && shape.impactSessions === 0) {
    actions.push({ kind: 'impact', need: dials.impactSessionsPerWeek });
  }
  if (proteinLogged >= 3 && proteinHit / proteinLogged < 0.6) {
    actions.push({ kind: 'protein', hit: proteinHit, of: proteinLogged });
  }

  return {
    weekOf: start, weekEnd: end,
    name: profile ? profile.name : '',
    lifeStage: profile ? profile.lifeStage : null,
    sessions: { total: done.length, ...byType, classNames },
    shape: {
      totalSets: shape.totalSets,
      primaryOnTarget: shape.primaryOnTarget,
      primaryCount: shape.primaryCount,
      impactSessions: shape.impactSessions,
      targets: shape.targets,
      shortfalls: shape.shortfalls,
    },
    movers: movers.slice(0, 5),
    body,
    recomposition,
    protein: { hit: proteinHit, logged: proteinLogged, targetG: profile ? profile.proteinTargetG : null },
    actions,
    generatedAt: new Date().toISOString(),
  };
}

// ------------------------------------------------------------ renderReport()

export function renderReport(el, report) {
  el.innerHTML = reportHtml(report);
}

export function reportHtml(report) {
  const r = report;
  const sess = r.sessions;

  const summaryBits = [
    sess.lift ? sess.lift + ' lift' + (sess.lift === 1 ? '' : 's') : null,
    sess.class ? sess.class + ' class' + (sess.class === 1 ? '' : 'es') : null,
    sess.conditioning ? sess.conditioning + ' conditioning' : null,
    sess.recovery ? sess.recovery + ' recovery' : null,
  ].filter(Boolean).join(' · ');

  const primary = Object.entries(r.shape.targets)
    .filter(([, v]) => v.tier === 'primary')
    .map(([key, v]) => {
      const pct = Math.max(0, Math.min(1, v.pct));
      const met = v.done >= v.target;
      return (
        // label → numbers → bar: the bar spans row 2 of the grid in components.css.
        '<div class="shape-row' + (met ? ' is-met' : '') + '">' +
          '<span class="shape-label">' + esc(v.label) + '</span>' +
          '<span class="shape-nums num"><span class="shape-done">' + fmt.num(v.done) + '</span>' +
            '<span class="shape-target"> / ' + fmt.num(v.target) + '</span></span>' +
          '<span class="shape-bar"><span class="shape-fill" style="width:' + (pct * 100) + '%"></span></span>' +
        '</div>'
      );
    }).join('');

  const movers = r.movers.length
    ? '<ul class="mover-list">' + r.movers.map((m) =>
        '<li><span class="mover-name">' + esc(m.name) + '</span>' +
        '<span class="mover-change num">' + fmt.num(m.fromWeight) + ' → ' + fmt.num(m.toWeight) + ' lb' +
        (m.pctGain ? ' <em>(+' + fmt.pct(m.pctGain) + ')</em>' : '') + '</span></li>').join('') + '</ul>'
    : '<p class="muted">Nothing to compare yet — give it two or three weeks and this fills in.</p>';

  let bodyBlock;
  if (r.body) {
    const d = r.body.deltas;
    const row = (label, value, dv, invert) => {
      if (value == null) return '';
      let deltaHtml = '';
      if (dv != null && dv !== 0) {
        const good = invert ? dv < 0 : dv > 0;
        deltaHtml = '<span class="delta ' + (good ? 'delta-good' : 'delta-bad') + '">' +
          (dv > 0 ? '▲ ' : '▼ ') + fmt.num(Math.abs(dv)) + '</span>';
      }
      return '<div class="measure-row"><span class="measure-label">' + esc(label) + '</span>' +
        '<span class="measure-value num">' + fmt.num(value) + '</span>' + deltaHtml + '</div>';
    };

    bodyBlock =
      '<div class="measure-hero">' +
        '<span class="measure-hero-label">Waist to hip</span>' +
        '<span class="measure-hero-value num">' + (r.body.whr != null ? fmt.num(r.body.whr) : '—') + '</span>' +
        (d && d.whr != null && d.whr !== 0
          ? '<span class="delta ' + (d.whr < 0 ? 'delta-good' : 'delta-bad') + '">' +
            (d.whr > 0 ? '▲ ' : '▼ ') + fmt.num(Math.abs(d.whr)) + '</span>' : '') +
        '<span class="measure-hero-note">This is the number that matters, not the scale.</span>' +
      '</div>' +
      row('Waist', r.body.waistIn, d && d.waistIn, true) +
      row('Hips', r.body.hipIn, d && d.hipIn, false) +
      row('Weight', r.body.weightLb, d && d.weightLb, true) +
      (r.recomposition
        ? '<p class="recomp-line">Waist down, hips up. That is recomposition — you are losing fat ' +
          'and building shape at the same time, and it is exactly what the scale cannot show you.</p>'
        : '');
  } else {
    bodyBlock = '<p class="muted">No measurements logged yet. Waist and hips, once a fortnight, ' +
                'tell you far more than daily weigh-ins ever will.</p>';
  }

  const actionItems = r.actions.map((a) => {
    if (a.kind === 'shortfall') return '<li>' + esc(a.label) + ' — ' + fmt.num(a.short) +
      ' sets short. Add a set or two next time it comes up.</li>';
    if (a.kind === 'impact') return '<li>No impact work this week. Bone responds to landing, ' +
      'not just lifting — add box jumps or pogo hops.</li>';
    if (a.kind === 'protein') return '<li>Protein: ' + a.hit + ' of ' + a.of +
      ' days. Thirty grams at breakfast makes the rest of the day easy.</li>';
    return '';
  }).join('');

  return (
    '<div class="report">' +
      '<header class="report-head">' +
        '<span class="report-brand">Daybreak</span>' +
        '<h2 class="report-title display">Week of ' + esc(prettyRange(r.weekOf, r.weekEnd)) + '</h2>' +
        '<p class="report-summary">' + (sess.total
          ? esc(sess.total + ' session' + (sess.total === 1 ? '' : 's') + (summaryBits ? ' · ' + summaryBits : ''))
          : 'No sessions logged this week.') + '</p>' +
      '</header>' +

      '<section class="report-block">' +
        '<h3 class="section-label">Shape Map</h3>' +
        (primary || '<p class="muted">Nothing logged yet.</p>') +
      '</section>' +

      '<section class="report-block">' +
        '<h3 class="section-label">Moving up</h3>' + movers +
      '</section>' +

      '<section class="report-block">' +
        '<h3 class="section-label">Measurements</h3>' + bodyBlock +
      '</section>' +

      (actionItems
        ? '<section class="report-block"><h3 class="section-label">This week</h3>' +
          '<ul class="action-list">' + actionItems + '</ul></section>'
        : '<section class="report-block"><p class="lede">Everything on target. Keep it exactly here.</p></section>') +

      '<footer class="report-foot">' +
        btn({ label: 'Send it', action: 'share-report', variant: 'primary', size: 'lg', full: true }) +
        '<div class="btn-pair">' +
          btn({ label: 'Copy text', action: 'copy-report', variant: 'ghost', size: 'md', full: true }) +
          btn({ label: 'Text it', action: 'sms-report', variant: 'ghost', size: 'md', full: true }) +
        '</div>' +
      '</footer>' +
    '</div>'
  );
}

// ------------------------------------------------------------- plain text

export function reportText(r) {
  const L = [];
  L.push('DAYBREAK · Week of ' + prettyRange(r.weekOf, r.weekEnd));
  L.push('');

  const bits = [
    r.sessions.lift ? r.sessions.lift + ' lift' + (r.sessions.lift === 1 ? '' : 's') : null,
    r.sessions.class ? r.sessions.class + ' class' + (r.sessions.class === 1 ? '' : 'es') : null,
    r.sessions.conditioning ? r.sessions.conditioning + ' conditioning' : null,
  ].filter(Boolean).join(' · ');
  L.push(r.sessions.total + ' sessions' + (bits ? '  (' + bits + ')' : ''));
  L.push('');

  L.push('SHAPE MAP        this week / target');
  for (const [, v] of Object.entries(r.shape.targets)) {
    if (v.tier !== 'primary') continue;
    const pad = (v.label + '                    ').slice(0, 20);
    const nums = (fmt.num(v.done) + ' / ' + fmt.num(v.target)).padStart(9);
    L.push('  ' + pad + nums + (v.done >= v.target ? '  on target' : ''));
  }
  L.push('');

  if (r.movers.length) {
    L.push('MOVING UP');
    for (const m of r.movers) {
      L.push('  ' + m.name + '  ' + fmt.num(m.fromWeight) + ' → ' + fmt.num(m.toWeight) + ' lb' +
        (m.pctGain ? '  (+' + fmt.pct(m.pctGain) + ')' : ''));
    }
    L.push('');
  }

  if (r.body) {
    L.push('MEASUREMENTS');
    if (r.body.waistIn != null) L.push('  Waist       ' + fmt.num(r.body.waistIn) + '"');
    if (r.body.hipIn != null) L.push('  Hips        ' + fmt.num(r.body.hipIn) + '"');
    if (r.body.whr != null) L.push('  Waist:Hip   ' + fmt.num(r.body.whr) + '   <- the one that matters');
    if (r.body.weightLb != null) L.push('  Weight      ' + fmt.num(r.body.weightLb) + ' lb');
    if (r.recomposition) {
      L.push('');
      L.push('  Waist down, hips up. That is recomposition — exactly what');
      L.push('  the scale cannot show you.');
    }
    L.push('');
  }

  if (r.actions.length) {
    L.push('THIS WEEK');
    for (const a of r.actions) {
      if (a.kind === 'shortfall') L.push('  · ' + a.label + ' — ' + fmt.num(a.short) + ' sets short.');
      else if (a.kind === 'impact') L.push('  · No impact work. Bone needs landing, not just lifting.');
      else if (a.kind === 'protein') L.push('  · Protein: ' + a.hit + ' of ' + a.of + ' days.');
    }
  }

  return L.join('\n');
}

// ---------------------------------------------------------------- delivery

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Share the report. Tries the native share sheet, then mailto, then clipboard. Never throws. */
export async function shareReport(report) {
  const text = reportText(report);
  const subject = 'Daybreak — week of ' + prettyRange(report.weekOf, report.weekEnd);

  if (navigator.share) {
    try {
      await navigator.share({ title: subject, text });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';   // she closed the sheet; not a failure
      console.warn('Daybreak: share sheet unavailable, falling back to mail.', err);
    }
  }

  try {
    const body = text.length > 1800 ? text.slice(0, 1780) + '\n\n…(trimmed)' : text;
    window.location.href = 'mailto:?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
    return 'mailto';
  } catch (err) {
    console.warn('Daybreak: mailto failed, falling back to clipboard.', err);
  }

  return copyReport(report);
}

export async function copyReport(report) {
  const text = reportText(report);
  try {
    await navigator.clipboard.writeText(text);
    toast('Report copied. Paste it wherever you like.', 'calm');
    return 'copied';
  } catch (_) {
    // Clipboard API is blocked in some in-app browsers; the old trick still works.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Report copied.', 'calm');
      return 'copied';
    } catch (err) {
      console.error('Daybreak: could not copy the report.', err);
      toast('Could not copy it. Screenshot works too.', 'signal');
      return 'failed';
    }
  }
}

/** SMS needs different syntax per platform — iOS wants &body=, Android wants ?body=. */
export function smsReport(report) {
  const text = reportText(report);
  const short = text.length > 1200 ? text.slice(0, 1180) + '\n…' : text;
  const sep = isIOS() ? '&' : '?';
  try {
    window.location.href = 'sms:' + sep + 'body=' + encodeURIComponent(short);
    return 'sms';
  } catch (err) {
    console.warn('Daybreak: sms link failed.', err);
    return copyReport(report);
  }
}

// --------------------------------------------------------------- the nudge

/**
 * Sunday nudge. This is a local notification shown while the app is open — we do NOT claim
 * background delivery, because no PWA can do it reliably and iOS cannot do it at all.
 */
export async function maybeNudge() {
  const optedIn = await DB.getPref('report:nudge', false);
  if (!optedIn) return false;

  const today = DB.todayISO();
  const [y, m, d] = today.split('-').map(Number);
  if (new Date(y, m - 1, d).getDay() !== 0) return false;         // Sundays only

  const already = await DB.getPref('report:nudged', null);
  if (already === today) return false;
  await DB.setPref('report:nudged', today);

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Your week is ready', { body: 'Tap to see how it went.', tag: 'daybreak-week' });
    } catch (_) { /* some browsers require a service worker registration; the toast still fires */ }
  }
  toast('Your week is ready — check Shape.', 'accent');
  return true;
}

export async function enableNudge() {
  if ('Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (_) { /* denied is fine */ }
  }
  await DB.setPref('report:nudge', true);
  toast('I will nudge you on Sunday mornings when you open the app.', 'calm');
}

export function reportCard(report) {
  return card({
    title: 'Weekly report',
    subtitle: prettyRange(report.weekOf, report.weekEnd),
    body: reportHtml(report),
    class: 'report-card',
  });
}
