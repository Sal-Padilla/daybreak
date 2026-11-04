// Lady_GYM — js/engine/report.js — the weekly report as plain data, and as a message to send.
//
// Daybreak's buildReport()/reportText(), unchanged in substance: the headline is
// waist-to-hip, never bodyweight, and the next actions come from the week's real shortfalls.

import { DB } from '../core/db.js';
import { Store } from '../core/store.js';
import { weeklyShapeMap } from './shapemap.js';
import { estimate1RM } from './progression.js';
import { byId } from '../data/exercises.js';
import { classById } from '../data/classes.js';
import { fmt } from '../ui/kit.js';

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
    if (s.classId || s.type === 'class') {
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
  // Tape measurements only: an InBody scan has no waist or hips, and as the newest record it
  // blanked both from the report, and the recomposition check with them.
  const measurements = ((await DB.getAll('measurements')) || []).filter((m) => m && (m.waistIn || m.hipIn));
  measurements.sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = measurements.length ? measurements[measurements.length - 1] : null;
  const twoWeeksBack = latest ? nearest(measurements, shiftDays(latest.date, -14), 10) : null;
  const monthBack = latest ? nearest(measurements, shiftDays(latest.date, -30), 12) : null;

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
  // Judged over a month: hips move too slowly to clear tape-measure rounding in a fortnight.
  const recompRef = monthBack || twoWeeksBack;
  const recomposition = !!(latest && recompRef &&
    latest.waistIn != null && recompRef.waistIn != null && latest.waistIn < recompRef.waistIn &&
    latest.hipIn != null && recompRef.hipIn != null && latest.hipIn > recompRef.hipIn);

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

export function reportText(r) {
  const L = [];
  L.push('LADY_GYM · Week of ' + prettyRange(r.weekOf, r.weekEnd));
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
      // "95 → 95 lb (+5%)" reads like a bug. When the load held and the reps moved, say that.
      L.push('  ' + m.name + '  ' + (m.toWeight === m.fromWeight
        ? fmt.num(m.toWeight) + ' lb · ' + m.fromReps + ' → ' + m.toReps + ' reps'
        : fmt.num(m.fromWeight) + ' → ' + fmt.num(m.toWeight) + ' lb' +
          (m.pctGain ? '  (+' + fmt.pct(m.pctGain) + ')' : '')));
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

