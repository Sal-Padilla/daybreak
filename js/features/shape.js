// Daybreak — js/features/shape.js — is it working?
//
// The rule that governs this whole screen: bodyweight is NEVER the hero number. Waist-to-hip
// ratio is. In recomposition the scale can sit flat for six weeks while the body visibly
// changes, and a scale-first progress screen is the single most reliable way to make someone
// quit a program that is actually working.

import { DB } from '../core/db.js';
import { Store } from '../core/store.js';
import { Router } from '../core/router.js';
import { weeklyShapeMap } from '../engine/shapemap.js';
import { estimate1RM } from '../engine/progression.js';
import { byId } from '../data/exercises.js';
import { strengthLevel } from '../data/standards.js';
import { bodyMap, sparkline } from '../ui/charts.js';
import { weeklyPillars, PILLARS, PILLAR_IDS } from '../data/pillars.js';
import { classById } from '../data/classes.js';
import { recommendations } from '../engine/recommend.js';
import { buildWeek } from '../engine/scheduler.js';
import { infoButton, infoActions } from '../ui/infosheet.js';
import { buildReport, renderReport, reportHtml, shareReport, copyReport, smsReport, enableNudge, mondayOf }
  from './report.js';
import { card, btn, sheet, closeSheet, toast, confirmDialog, fmt } from '../ui/components.js';
import { classesForWeek } from '../data/schedule.js';

export const id = 'shape';
export const title = 'Shape';

let showSecondary = false;
let cachedReport = null;

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

function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// -------------------------------------------------------------- Shape Map

function shapeRows(shape, tier) {
  return Object.entries(shape.targets)
    .filter(([, v]) => v.tier === tier)
    .map(([key, v]) => {
      const pct = Math.max(0, Math.min(1, v.pct));
      return (
        // Order matters: components.css lays this out as a grid where the bar spans row 2,
        // so label and numbers must both come before it.
        '<button type="button" class="shape-row' + (v.done >= v.target ? ' is-met' : '') + '" ' +
            'data-action="target-detail" data-target="' + esc(key) + '">' +
          '<span class="shape-label">' + esc(v.label) + '</span>' +
          '<span class="shape-nums num"><span class="shape-done">' + fmt.num(v.done) + '</span>' +
            '<span class="shape-target"> / ' + fmt.num(v.target) + '</span></span>' +
          '<span class="shape-bar"><span class="shape-fill" style="width:' + (pct * 100) + '%"></span></span>' +
        '</button>'
      );
    }).join('');
}

function shapeSection(shape) {
  const empty = shape.totalSets === 0;

  const shortfallLine = (() => {
    if (empty) return '';
    const worst = (shape.shortfalls || []).slice().sort((a, b) => b.short - a.short)[0];
    if (!worst) return '<p class="shape-verdict tone-calm">Every primary target on plan. ' +
      'That is a good week — keep it exactly here.</p>';
    return '<p class="shape-verdict">' + esc(worst.label) + ' — ' + fmt.num(worst.short) +
      ' sets short. Add a set or two next time it comes round.</p>';
  })();

  return card({
    title: 'Shape Map',
    subtitle: empty ? 'This week' : fmt.num(shape.totalSets) + ' sets this week · ' +
      shape.primaryOnTarget + ' of ' + shape.primaryCount + ' on target',
    body:
      (empty
        ? '<p class="lede">Nothing logged yet this week. Once you train, this fills in — it ' +
          'counts every hard set toward the places you are actually trying to change.</p>'
        : '') +
      '<div class="bodymap-wrap">' + bodyMap(shape, { action: 'target-detail' }) + '</div>' +
      shortfallLine +
      '<div class="shape-list">' + shapeRows(shape, 'primary') + '</div>' +
      '<button type="button" class="link-quiet" data-action="toggle-secondary">' +
        (showSecondary ? 'Hide' : 'Show') + ' secondary targets</button>' +
      (showSecondary ? '<div class="shape-list is-secondary">' + shapeRows(shape, 'secondary') + '</div>' : ''),
  });
}

// ------------------------------------------------------- the four pillars

function pillarSection(pill) {
  const rows = PILLAR_IDS.map((id) => {
    const p = pill.pillars[id];
    const pct = Math.max(0, Math.min(1, p.pct));
    return (
      '<div class="pillar-row' + (p.met ? ' is-met' : '') + '">' +
        '<div class="pillar-head">' +
          '<span class="pillar-name">' + esc(p.name) + '</span>' +
          infoButton('pillar', id, p.name) +
          '<span class="pillar-nums num">' + fmt.pct(pct) + '</span>' +
        '</div>' +
        '<span class="pillar-bar"><span class="pillar-fill pillar-' + esc(id) +
          '" style="width:' + (pct * 100) + '%"></span></span>' +
        '<span class="pillar-blurb">' + esc(PILLARS[id].blurb) + '</span>' +
      '</div>'
    );
  }).join('');

  const verdict = pill.weakest
    ? '<p class="shape-verdict">' + esc(PILLARS[pill.weakest].name) +
      ' is the thinnest part of your week. Tap the <strong>i</strong> to see why it matters.</p>'
    : '<p class="shape-verdict tone-calm">All four covered. That is a genuinely well-built week.</p>';

  return card({
    title: 'Training balance',
    subtitle: pill.metCount + ' of 4 on target this week',
    body:
      '<p class="lede">The Shape Map says which muscles. This says whether the <em>week</em> ' +
      'holds together — four sessions of hip thrusts is a full Shape Map and a badly built week.</p>' +
      '<div class="pillar-list">' + rows + '</div>' +
      verdict,
  });
}

// ------------------------------------------------------------- what to do next

function recsSection(recs) {
  if (!recs.length) return '';
  const items = recs.map((r) => (
    '<div class="rec' + (r.kind === 'good' ? ' is-good' : '') + '">' +
      '<h4 class="rec-title">' + esc(r.title) + '</h4>' +
      '<p class="rec-body">' + esc(r.body) + '</p>' +
      (r.suggestion ? '<p class="rec-suggestion">' + esc(r.suggestion) + '</p>' : '') +
      (r.action
        ? btn({
            label: r.action === 'add-suggested-class' ? 'Add it' : 'Take me there',
            action: r.action, variant: 'ghost', size: 'md', data: r.data || {},
          })
        : '') +
    '</div>'
  )).join('');

  return card({
    tone: 'brand',
    title: 'What I would do next',
    body: '<div class="rec-list">' + items + '</div>',
  });
}

// ------------------------------------------------------------ measurements

function whrOf(m) {
  if (!m || !m.waistIn || !m.hipIn) return null;
  return Math.round((m.waistIn / m.hipIn) * 1000) / 1000;
}

function nearest(list, iso, maxDays) {
  let best = null;
  let gap = Infinity;
  for (const m of list) {
    const g = Math.abs((new Date(m.date) - new Date(iso)) / 86400000);
    if (g <= maxDays && g < gap) { best = m; gap = g; }
  }
  return best;
}

/**
 * @param {boolean} [ratio] waist-to-hip moves in thousandths, so two decimals rounds a real
 *                          fortnight of change down to "0". Ratios get three.
 */
function deltaChip(now, then, invertGood, ratio) {
  if (now == null || then == null) return '';
  const places = ratio ? 1000 : 100;
  const d = Math.round((now - then) * places) / places;
  if (!d) return '<span class="delta delta-flat">no change</span>';
  const good = invertGood ? d < 0 : d > 0;
  const shown = ratio ? Math.abs(d).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
    : fmt.num(Math.abs(d));
  return '<span class="delta ' + (good ? 'delta-good' : 'delta-bad') + '">' +
    (d > 0 ? '▲ ' : '▼ ') + shown + '</span>';
}

function measureSection(list) {
  if (!list.length) {
    return card({
      title: 'Measurements',
      body:
        '<p class="lede">Waist and hips, every two weeks. That is it.</p>' +
        '<p class="muted">Waist-to-hip ratio tells you what is actually happening to your shape. ' +
        'The scale cannot — it can sit still for six weeks while your body changes underneath it.</p>',
      footer: btn({ label: 'Log measurements', action: 'log-measure', variant: 'primary', size: 'lg', full: true }),
    });
  }

  const latest = list[list.length - 1];
  const back14 = nearest(list, shiftDays(latest.date, -14), 10);
  const back30 = nearest(list, shiftDays(latest.date, -30), 12);
  const whr = whrOf(latest);

  // Recomposition is judged over a month, not a fortnight. Hips grow slowly and a tape
  // measure reads to the nearest eighth of an inch, so at 14-day resolution the hip change
  // is usually inside the rounding and the signal never fires even when it is really there.
  const recompRef = back30 || back14;
  const recomp = recompRef &&
    latest.waistIn != null && recompRef.waistIn != null && latest.waistIn < recompRef.waistIn &&
    latest.hipIn != null && recompRef.hipIn != null && latest.hipIn > recompRef.hipIn;

  const row = (label, key, invertGood) => {
    if (latest[key] == null) return '';
    return '<div class="measure-row">' +
      '<span class="measure-label">' + esc(label) + '</span>' +
      '<span class="measure-value num">' + fmt.num(latest[key]) +
        (key === 'weightLb' ? ' lb' : '″') + '</span>' +
      deltaChip(latest[key], back14 ? back14[key] : null, invertGood) +
    '</div>';
  };

  const whrSeries = list.map(whrOf).filter((v) => v != null);

  return card({
    title: 'Measurements',
    subtitle: 'Last logged ' + shortDate(latest.date),
    body:
      '<div class="measure-hero">' +
        '<span class="measure-hero-label">Waist to hip</span>' +
        '<span class="measure-hero-value num">' + (whr != null ? fmt.num(whr) : '—') + '</span>' +
        (back14 ? deltaChip(whr, whrOf(back14), true, true) : '') +
        '<span class="measure-hero-note">The number that matters.</span>' +
      '</div>' +
      (whrSeries.length > 2
        ? '<div class="chart-wrap">' + sparkline(whrSeries, { label: 'Waist to hip', w: 300, h: 50 }) + '</div>'
        : '') +
      row('Waist', 'waistIn', true) +
      row('Hips', 'hipIn', false) +
      row('Thigh', 'thighIn', false) +
      row('Arm', 'armIn', false) +
      row('Weight', 'weightLb', true) +
      (recomp
        ? '<p class="recomp-line">Waist down, hips up. That is recomposition — losing fat and ' +
          'building shape at once. The scale will never show you this.</p>' : '') +
      (back30 ? '<p class="muted">Compared with 14 days ago. Thirty-day waist change: ' +
        fmt.num(Math.round((latest.waistIn - back30.waistIn) * 100) / 100) + '″.</p>' : ''),
    footer: btn({ label: 'Log measurements', action: 'log-measure', variant: 'ghost', size: 'md', full: true }),
  });
}

// ------------------------------------------------------------------ photos

function photoSection(photos) {
  const grid = photos.length
    ? '<div class="photo-grid">' + photos.map((p) =>
        '<button type="button" class="photo-cell" data-action="view-photo" data-id="' + esc(p.id) + '">' +
          '<img src="' + esc(p.url) + '" alt="Progress photo from ' + esc(shortDate(p.date)) + '" loading="lazy">' +
          '<span class="photo-date num">' + esc(shortDate(p.date)) + '</span>' +
        '</button>').join('') + '</div>'
    : '<p class="muted">No photos yet. Same light, same spot, same time of day — every two weeks ' +
      'is plenty.</p>';

  return card({
    title: 'Photos',
    body: grid +
      '<p class="privacy-line">These stay on this phone. They are never uploaded anywhere.</p>',
    footer:
      '<label class="btn btn-ghost btn-md btn-full photo-add">' +
        '<span>Add a photo</span>' +
        '<input type="file" accept="image/*" capture="environment" data-action="add-photo" hidden>' +
      '</label>',
  });
}

// ---------------------------------------------------------------- strength

async function strengthSection(profile) {
  const sessions = (await DB.getAll('sessions')) || [];
  const byId_ = new Map(sessions.map((s) => [s.id, s]));
  const allSets = (await DB.getAll('sets')) || [];

  const working = allSets.filter((s) => !s.isWarmup && s.weight != null && s.reps);
  if (!working.length) {
    return card({
      title: 'Strength',
      body: '<p class="lede">Log a few weeks of lifting and your lead lifts show up here — ' +
        'what they were, what they are now.</p>',
    });
  }

  // Best estimated 1RM per exercise per session date.
  const byExercise = new Map();
  for (const s of working) {
    const sess = byId_.get(s.sessionId);
    if (!sess) continue;
    const e1 = estimate1RM(s.weight, s.reps);
    if (!e1) continue;
    if (!byExercise.has(s.exerciseId)) byExercise.set(s.exerciseId, new Map());
    const dates = byExercise.get(s.exerciseId);
    dates.set(sess.date, Math.max(dates.get(sess.date) || 0, e1));
  }

  const leads = [...byExercise.entries()]
    .map(([eid, dates]) => ({ eid, exercise: byId(eid), dates }))
    .filter((x) => x.exercise && x.exercise.tier === 1)
    .sort((a, b) => b.dates.size - a.dates.size)
    .slice(0, 4);

  const list = (leads.length ? leads : [...byExercise.entries()].slice(0, 3).map(([eid, dates]) =>
    ({ eid, exercise: byId(eid), dates }))).filter((x) => x.exercise);

  const rows = list.map((x) => {
    const series = [...x.dates.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((e) => e[1]);
    const best = Math.max(...series);
    const level = profile.weightLb
      ? strengthLevel(x.eid, best, profile.weightLb,
          profile.birthYear ? new Date().getFullYear() - profile.birthYear : undefined)
      : null;

    return (
      '<div class="strength-row">' +
        '<div class="strength-main">' +
          '<span class="strength-name">' + esc(x.exercise.name) + '</span>' +
          '<span class="strength-value num">' + fmt.lb(Math.round(best)) +
            '<span class="strength-note"> est. best</span></span>' +
          (level ? '<span class="strength-level">' + esc(level.level) + '</span>' : '') +
        '</div>' +
        '<div class="chart-wrap">' + sparkline(series, { w: 120, h: 40, label: x.exercise.name, unit: 'lb' }) + '</div>' +
      '</div>'
    );
  }).join('');

  return card({
    title: 'Strength',
    subtitle: 'Your lead lifts over time',
    body: rows + '<p class="muted">These are estimates from your working sets — no max testing ' +
      'required, and none wanted at 5:30 in the morning.</p>',
  });
}

// -------------------------------------------------------------------- render

export async function render(el) {
  const profile = Store.get('profile') || await DB.getProfile();
  const dials = Store.get('dials');
  if (!profile || !profile.name) { el.innerHTML = ''; return; }

  const today = DB.todayISO();
  const weekStart = mondayOf(today);
  const weekEnd = shiftDays(weekStart, 6);

  const classes = (await DB.getAll('classes')) || [];
  const sessions = (await DB.getSessionsInRange(weekStart, weekEnd)) || [];
  const done = sessions.filter((s) => s.complete);

  const sets = [];
  for (const s of done) {
    const rows = await DB.getSessionSets(s.id);
    for (const r of rows) if (!r.isWarmup) sets.push(r);
  }
  const shape = weeklyShapeMap(done, sets, classes, dials);
  const pill = weeklyPillars(done, sets, byId, classById, dials);
  const week = buildWeek(profile, classesForWeek(classes, weekStart), dials, weekStart);
  const recs = recommendations({ profile, dials, week, pillars: pill, shape, classes, sessions });

  const measurements = ((await DB.getAll('measurements')) || [])
    .slice().sort((a, b) => (a.date < b.date ? -1 : 1));

  const photos = measurements
    .filter((m) => m.photo)
    .map((m) => ({ id: m.id, date: m.date, url: URL.createObjectURL(m.photo) }))
    .reverse();

  const strengthHtml = await strengthSection(profile);

  const lastWeek = shiftDays(weekStart, -7);
  const stored = await DB.get('reports', lastWeek);

  el.innerHTML =
    '<div class="shape">' +
      '<header class="page-head"><h1 class="display">Shape</h1>' +
        '<p class="page-sub">Is it working?</p></header>' +
      shapeSection(shape) +
      pillarSection(pill) +
      recsSection(recs) +
      measureSection(measurements) +
      strengthHtml +
      photoSection(photos) +
      card({
        title: 'Weekly report',
        subtitle: stored ? 'Last built for the week of ' + shortDate(lastWeek) : 'Sunday summary',
        body: cachedReport
          ? reportHtml(cachedReport)
          : '<p class="lede">A one-screen summary of the week — what moved, what is short, and ' +
            'the measurements that matter. Send it to yourself or anyone keeping you honest.</p>',
        footer: cachedReport ? '' :
          btn({ label: 'Build this week’s report', action: 'build-report', variant: 'primary', size: 'lg', full: true }) +
          btn({ label: 'Nudge me on Sundays', action: 'enable-nudge', variant: 'ghost', size: 'md', full: true }),
      }) +
    '</div>';
}

// ------------------------------------------------------------------- actions

export const actions = {
  ...infoActions,

  'toggle-secondary'() { showSecondary = !showSecondary; return Router.refresh(); },

  'go-week': () => Router.go('week'),
  'go-shape'() { return Router.refresh(); },

  async 'add-suggested-class'(node, data) {
    const { formatid, dow, time } = data;
    if (!formatid) return Router.go('week');
    const f = classById(formatid);
    await DB.put('classes', {
      id: DB.uid(),
      formatId: formatid,
      dayOfWeek: parseInt(dow, 10),
      time,
      durationMin: f && f.durationMin ? f.durationMin : 50,
      active: true,
    });
    toast((f ? f.name : 'Class') + ' added. Your week is rebuilt around it.', 'calm');
    return Router.refresh();
  },

  async 'target-detail'(node) {
    const key = node.dataset.target;
    if (!key) return;
    const dials = Store.get('dials');
    const profile = Store.get('profile');
    const weekStart = mondayOf(DB.todayISO());
    const sessions = ((await DB.getSessionsInRange(weekStart, shiftDays(weekStart, 6))) || [])
      .filter((s) => s.complete);

    const counts = new Map();
    for (const s of sessions) {
      for (const set of await DB.getSessionSets(s.id)) {
        if (set.isWarmup) continue;
        const ex = byId(set.exerciseId);
        if (!ex) continue;
        const credit = (ex.primary || []).includes(key) ? 1 : (ex.secondary || []).includes(key) ? 0.5 : 0;
        if (credit) counts.set(ex.name, (counts.get(ex.name) || 0) + credit);
      }
    }

    const shape = weeklyShapeMap(sessions, [], [], dials);
    const t = shape.targets[key];

    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) =>
      '<li class="detail-row"><span>' + esc(name) + '</span><span class="num">' + fmt.num(n) + ' sets</span></li>'
    ).join('');

    sheet(t ? t.label : key,
      (rows
        ? '<ul class="detail-list">' + rows + '</ul>'
        : '<p class="lede">Nothing has hit this target yet this week.</p>') +
      (t ? '<p class="muted">Target: ' + fmt.num(t.target) + ' hard sets a week at your stage.</p>' : ''));
  },

  'log-measure'() {
    const field = (id, label, unit, step) =>
      '<div class="field"><label class="field-label" for="' + id + '">' + label +
        ' <span class="field-unit">' + unit + '</span></label>' +
        '<input class="input num" id="' + id + '" type="number" inputmode="decimal" step="' + step + '"></div>';

    sheet('Log measurements',
      '<p class="lede">All optional. Waist and hips are the two that earn their keep.</p>' +
      '<div class="sheet-fields">' +
        field('m-waist', 'Waist', 'in', '0.25') +
        field('m-hip', 'Hips', 'in', '0.25') +
        field('m-thigh', 'Thigh', 'in', '0.25') +
        field('m-arm', 'Arm', 'in', '0.25') +
        field('m-weight', 'Weight', 'lb', '0.5') +
      '</div>' +
      btn({ label: 'Save', action: 'save-measure', variant: 'primary', size: 'lg', full: true }),
      {
        actions: {
          async 'save-measure'() {
            const num = (id) => {
              const n = parseFloat((document.getElementById(id) || {}).value);
              return Number.isFinite(n) && n > 0 ? n : null;
            };
            const record = {
              id: DB.uid(), date: DB.todayISO(),
              waistIn: num('m-waist'), hipIn: num('m-hip'), thighIn: num('m-thigh'),
              armIn: num('m-arm'), weightLb: num('m-weight'), note: '',
            };
            if (!record.waistIn && !record.hipIn && !record.thighIn && !record.armIn && !record.weightLb) {
              toast('Nothing to save yet.', 'signal'); return;
            }
            await DB.put('measurements', record);
            if (record.weightLb) {
              const p = Store.get('profile');
              const dials = Store.get('dials');
              await DB.saveProfile({
                weightLb: record.weightLb,
                proteinTargetG: Math.round((record.weightLb / 2.2046) * dials.proteinGPerKg),
              });
              await Store.refreshProfile();
            }
            closeSheet();
            toast('Logged.', 'calm');
            Router.refresh();
          },
        },
      });
  },

  async 'add-photo'(node) {
    const file = node.files && node.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('That is not an image.', 'signal'); return; }
    await DB.put('measurements', {
      id: DB.uid(), date: DB.todayISO(), photo: file,
      waistIn: null, hipIn: null, thighIn: null, armIn: null, weightLb: null, note: 'photo',
    });
    toast('Saved to this phone only.', 'calm');
    return Router.refresh();
  },

  async 'view-photo'(node) {
    const m = await DB.get('measurements', node.dataset.id);
    if (!m || !m.photo) return;
    const url = URL.createObjectURL(m.photo);
    sheet(shortDate(m.date),
      '<img class="photo-full" src="' + url + '" alt="Progress photo">' +
      btn({ label: 'Delete this photo', action: 'del-photo', variant: 'danger', size: 'md',
            full: true, data: { id: m.id } }),
      {
        actions: {
          async 'del-photo'(n) {
            const ok = await confirmDialog('Delete this photo?', { confirmLabel: 'Delete', danger: true });
            if (!ok) return;
            await DB.del('measurements', n.dataset.id);
            closeSheet();
            Router.refresh();
          },
        },
        onClose() { URL.revokeObjectURL(url); },
      });
  },

  async 'build-report'() {
    const weekStart = mondayOf(DB.todayISO());
    cachedReport = await buildReport(weekStart);
    await DB.put('reports', { weekOf: weekStart, payload: cachedReport, builtAt: new Date().toISOString() });
    return Router.refresh();
  },

  async 'share-report'() {
    if (!cachedReport) return;
    const result = await shareReport(cachedReport);
    if (result === 'shared') toast('Sent.', 'calm');
  },

  async 'copy-report'() { if (cachedReport) await copyReport(cachedReport); },
  'sms-report'() { if (cachedReport) smsReport(cachedReport); },

  async 'enable-nudge'() { await enableNudge(); },
};
