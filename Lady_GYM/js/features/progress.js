// Lady_GYM — js/features/progress.js — is it working? Rings, your body map, your bests, your photos.
//
// Daybreak's Shape tab was 554 words over nine screens. Same engine underneath; here it is
// colour first: four rings for the week, a body that fills in where you trained, trophies
// for personal bests, and your own progress photos side by side — the most convincing
// picture there is.

import { DB } from '../core/db.js';
import { Store } from '../core/store.js';
import { Nav } from '../core/nav.js';
import { byId } from '../data/exercises.js';
import { INBODY_FIELDS } from '../data/inbody.js';
import { estimate1RM } from '../engine/progression.js';
import { buildReport, reportText } from '../engine/report.js';
import { icon, tile } from '../ui/icons.js';
import { rings, sparkline, lineChart, bodyMap } from '../ui/rings.js';
import {
  esc, fmt, button, toast, sheet, closeSheet, confirmAlert, sectionTitle, bar, haptic, pickPhoto, shrinkImage,
} from '../ui/kit.js';
import {
  weekContext, weekStreak, avatarButton, addDays, PILLAR_COLOR, PILLAR_LABEL, AREA_COLOR,
} from './shared.js';
import { exThumb } from './workouts.js';

/* ------------------------------------------------------------------ data helpers */

async function personalBests(limit = 6) {
  const sets = ((await DB.getAll('sets')) || []).filter((s) => !s.isWarmup && s.weight != null && s.reps);
  const by = new Map();
  for (const s of sets) {
    const e1 = estimate1RM(s.weight, s.reps) || 0;
    if (!by.has(s.exerciseId)) by.set(s.exerciseId, { best: s, e1, series: new Map() });
    const rec = by.get(s.exerciseId);
    if (e1 > rec.e1) { rec.best = s; rec.e1 = e1; }
    // Her day, not UTC's: after 4 pm in California loggedAt is already tomorrow's date.
    const day = s.loggedAt ? DB.todayISO(new Date(s.loggedAt)) : '';
    rec.series.set(day, Math.max(rec.series.get(day) || 0, e1));
  }
  // "Getting stronger" means it: lifts whose estimated max went up, biggest gain first.
  return [...by.entries()]
    .map(([id, r]) => {
      const series = [...r.series.entries()].sort().map(([, v]) => v);
      const gain = series.length >= 2 ? series[series.length - 1] - series[0] : 0;
      return { ex: byId(id), ...r, series, gain, pct: series[0] ? gain / series[0] : 0 };
    })
    .filter((r) => r.ex && r.series.length >= 3 && r.gain > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit);
}

async function measurements() {
  const all = ((await DB.getAll('measurements')) || []).sort((a, b) => (a.date < b.date ? -1 : 1));
  return all;
}

async function photos() {
  return ((await DB.getAll('photos')) || []).sort((a, b) => (a.date < b.date ? 1 : -1));
}

/* ------------------------------------------------------------------ tab */

export const page = {
  id: 'progress',
  title: 'Progress',
  large: true,
  accessory: () => avatarButton(),

  async render() {
    const ctx = await weekContext();
    const streak = await weekStreak();
    const P = ctx.pillars.pillars;
    const ids = ['resistive', 'cardio', 'control', 'shape'];
    const monthStart = ctx.today.slice(0, 8) + '01';
    const monthCount = ((await DB.getSessionsInRange(monthStart, ctx.today)) || []).filter((s) => s.complete).length;

    const ringList = ids.map((id) => ({
      pct: P[id].target ? P[id].done / P[id].target : 0,
      color: 'var(--' + PILLAR_COLOR[id] + '-fill)',
      track: 'var(--' + PILLAR_COLOR[id] + '-soft)',
    }));
    const met = ids.filter((id) => P[id].met).length;

    const primary = Object.entries(ctx.shape.targets).filter(([, v]) => v.tier === 'primary');
    const bests = await personalBests();
    const ms = await measurements();
    const tape = ms.filter((m) => m.waistIn || m.hipIn);
    const latest = tape[tape.length - 1];
    const first = tape[0];
    const weights = ms.filter((m) => m.weightLb);
    const pics = await photos();

    return '<div class="progress">' +
      '<div class="stats3">' +
        statTile('flame', String(streak.weeks), 'week streak', 'orange') +
        statTile('calendarPlus', String(monthCount), 'this month', 'pink') +
        statTile('trophy', String(streak.total), 'all time', 'violet') +
      '</div>' +

      '<div class="card bigrings">' +
        '<div class="bigrings-top">' +
          rings(ringList, { size: 168, stroke: 15, gap: 3, label: 'Training balance this week' }) +
          '<div class="bigrings-text"><p class="bigrings-k">This week</p>' +
          '<p class="bigrings-v"><b class="num">' + met + '</b> of 4</p><p class="card-sub">rings closed</p></div>' +
        '</div>' +
        '<div class="legend4">' + ids.map((id) => {
          const p = P[id];
          return '<div class="legend-cell"><span class="legend-dot" style="background:var(--' + PILLAR_COLOR[id] + '-fill)"></span>' +
            '<span><span class="legend-name">' + esc(PILLAR_LABEL[id]) + '</span>' +
            '<span class="legend-num num" style="color:var(--' + PILLAR_COLOR[id] + '-ink)">' +
            (p.target ? Math.min(100, Math.round((p.done / p.target) * 100)) : 100) + '%</span></span></div>';
        }).join('') + '</div>' +
        '<p class="card-sub center">Close all four for a balanced week — strength, cardio, balance and tone.</p>' +
      '</div>' +

      sectionTitle('Where you’re building') +
      '<div class="card shapecard">' +
        bodyMap(ctx.shape.targets, (k) => 'var(--' + (AREA_COLOR[k] || 'pink') + '-fill)') +
        '<div class="areas2">' + primary.map(([k, v]) =>
          '<div class="area2"><div class="area2-top"><span>' + esc(v.label.replace('Side glute/hips', 'Hips')) + '</span>' +
          '<span class="num">' + fmt.num(v.done) + '/' + fmt.num(v.target) + (v.done >= v.target ? ' ✓' : '') + '</span></div>' +
          bar(v.target ? v.done / v.target : 0, AREA_COLOR[k] || 'pink') + '</div>').join('') + '</div>' +
        '<p class="card-sub">Hard sets this week for each area, against your goal.</p>' +
      '</div>' +

      sectionTitle('Progress photos', pics.length ? { action: 'nav-push', actionLabel: 'See All', data: { page: 'photos' } } : {}) +
      photoStrip(pics) +

      sectionTitle('Your body') +
      bodyCard(latest, first, tape, weights) +

      (bests.length ? sectionTitle('Getting stronger') + '<div class="hscroll">' + bests.map((b) =>
        '<button type="button" class="pbcard" data-action="nav-push" data-page="exercise" data-id="' + esc(b.ex.id) + '">' +
          '<span class="pbcard-top">' + exThumb(b.ex) + '<span class="pbcard-trophy">' + icon('trophy', 16) + '</span></span>' +
          '<span class="pbcard-name">' + esc(b.ex.name) + '</span>' +
          '<span class="pbcard-v num">' + esc(fmt.num(b.best.weight)) + ' lb × ' + esc(b.best.reps) + '</span>' +
          '<span class="pbcard-gain">▲ ' + Math.round(b.pct * 100) + '% stronger</span>' +
          sparkline(b.series.slice(-10), { color: 'var(--pink-fill)', width: 130, height: 34 }) +
        '</button>').join('') + '</div>' : '') +

      sectionTitle('Weekly report') +
      '<button type="button" class="card cta-card" data-action="nav-push" data-page="report">' +
        tile('share', 'var(--violet-fill)', 40) +
        '<span class="cta-text"><span class="card-title">Your week in review</span>' +
        '<span class="card-sub">A colourful summary you can send to a friend or your trainer.</span></span>' +
        icon('chevronRight', 18, 'row-chev') + '</button>' +
      '</div>';
  },

  actions: {
    'add-photo': () => addPhoto(),
    'add-measure': () => measureSheet(),
    'add-inbody': () => inbodySheet(),
    'open-photo': (node) => openPhoto(node.dataset.id),
  },
};

function statTile(ic, v, k, color) {
  return '<div class="stat"><span class="stat-ic" style="color:var(--' + color + '-ink);background:var(--' + color + '-soft)">' +
    icon(ic, 18) + '</span><span class="stat-v num">' + esc(v) + '</span><span class="stat-k">' + esc(k) + '</span></div>';
}

function photoStrip(pics) {
  const add = '<button type="button" class="photo-add" data-action="add-photo">' + icon('camera', 26) + '<span>Add photo</span></button>';
  if (!pics.length) {
    return '<div class="card photo-empty">' + add +
      '<div><p class="card-title">See your change</p><p class="card-sub">Take a photo every few weeks, same spot, same light. ' +
      'They stay private on your phone.</p></div></div>';
  }
  return '<div class="hscroll photos-row">' + add + pics.slice(0, 8).map((p) =>
    '<button type="button" class="photo" data-action="open-photo" data-id="' + esc(p.id) + '">' +
      '<img src="' + esc(p.data) + '" alt="Progress photo from ' + esc(fmt.shortDate(p.date)) + '" loading="lazy">' +
      '<span>' + esc(fmt.shortDate(p.date)) + '</span></button>').join('') + '</div>';
}

function bodyCard(latest, first, tape, weights) {
  const actions = '<div class="pl-row">' +
    button({ label: 'Measure', action: 'add-measure', kind: 'tinted', size: 'md', icon: 'ruler', full: false }) +
    button({ label: 'InBody', action: 'add-inbody', kind: 'plain', size: 'md', icon: 'scale', full: false }) + '</div>';
  if (!latest && !weights.length) {
    return '<div class="card">' + '<div class="mini-head">' + tile('ruler', 'var(--teal-fill)', 34) +
      '<div><p class="card-title">Measure, don’t just weigh</p><p class="card-sub">Your waist and hips show change that the scale hides.</p></div></div>' +
      actions + '</div>';
  }
  const whr = latest && latest.waistIn && latest.hipIn ? latest.waistIn / latest.hipIn : null;
  const delta = (k) => latest && first && latest !== first && latest[k] != null && first[k] != null ? latest[k] - first[k] : null;
  const dWaist = delta('waistIn');
  const dHip = delta('hipIn');
  const chip = (d, goodDown) => d == null || Math.abs(d) < 0.05 ? '' :
    '<span class="delta ' + ((goodDown ? d < 0 : d > 0) ? 'is-good' : 'is-meh') + '">' + (d > 0 ? '+' : '−') + fmt.num(Math.abs(d)) + '"</span>';
  const recomposed = dWaist != null && dHip != null && dWaist < 0 && dHip > 0;
  return '<div class="card bodycard">' +
    '<div class="bodynums">' +
      (latest && latest.waistIn ? '<div><p class="hist-k">Waist</p><p class="hist-v num">' + fmt.num(latest.waistIn) + '<small>"</small></p>' + chip(dWaist, true) + '</div>' : '') +
      (latest && latest.hipIn ? '<div><p class="hist-k">Hips</p><p class="hist-v num">' + fmt.num(latest.hipIn) + '<small>"</small></p>' + chip(dHip, false) + '</div>' : '') +
      (whr ? '<div><p class="hist-k">Waist ÷ hips</p><p class="hist-v num">' + fmt.num(whr, 2) + '</p></div>' : '') +
    '</div>' +
    (recomposed ? '<p class="recomp">' + icon('sparkle', 16) + ' Waist down, hips up — that’s your shape changing, even if the scale doesn’t show it.</p>' : '') +
    (tape.length >= 2 ? lineChart(tape.map((m) => ({ y: m.waistIn, label: fmt.shortDate(m.date) })), { color: 'var(--teal-fill)', height: 110 }) +
      '<p class="card-sub center">Waist over time</p>' : '') +
    actions + '</div>';
}

/* ------------------------------------------------------------------ photos */

async function addPhoto() {
  const file = await pickPhoto();
  if (!file) return;
  try {
    const data = await shrinkImage(file, 1080, 0.8);
    await DB.put('photos', { id: DB.uid(), date: DB.todayISO(), data, createdAt: new Date().toISOString() });
    haptic();
    toast('Photo saved — only on this phone', { tone: 'good', ic: 'lock' });
    return Nav.invalidate();
  } catch (err) {
    console.error(err);
    toast('Could not read that photo', { tone: 'bad', ic: 'info' });
  }
}

async function openPhoto(id) {
  const p = await DB.get('photos', id);
  if (!p) return;
  sheet({
    title: fmt.longDate(p.date),
    large: true,
    body: '<img class="photo-big" src="' + esc(p.data) + '" alt="Progress photo">' +
      button({ label: 'Delete Photo', action: 'del', kind: 'danger', icon: 'trash' }),
    actions: {
      async del() {
        const ok = await confirmAlert('Delete this photo?', '', { ok: 'Delete', danger: true });
        if (!ok) return;
        await DB.del('photos', id);
        closeSheet();
        Nav.invalidate();
      },
    },
  });
}

export const photosPage = {
  id: 'photos',
  title: 'Progress Photos',
  right: () => '<button type="button" class="nav-icon-btn" data-action="add-photo" aria-label="Add photo">' + icon('plus', 24) + '</button>',
  async render(params) {
    const pics = await photos();
    if (!pics.length) return '<div class="empty"><p class="empty-title">No photos yet</p></div>';
    const oldest = pics[pics.length - 1];
    const newest = pics[0];
    const compare = pics.length >= 2
      ? '<div class="card compare"><p class="card-title">Then and now</p><div class="compare-pair">' +
        '<figure><img src="' + esc(oldest.data) + '" alt="First photo"><figcaption>' + esc(fmt.shortDate(oldest.date)) + '</figcaption></figure>' +
        '<figure><img src="' + esc(newest.data) + '" alt="Latest photo"><figcaption>' + esc(fmt.shortDate(newest.date)) + '</figcaption></figure>' +
        '</div></div>' : '';
    return compare + '<div class="photo-grid">' + pics.map((p) =>
      '<button type="button" class="photo" data-action="open-photo" data-id="' + esc(p.id) + '">' +
      '<img src="' + esc(p.data) + '" alt="Progress photo" loading="lazy"><span>' + esc(fmt.shortDate(p.date)) + '</span></button>').join('') + '</div>';
  },
  actions: {
    'add-photo': () => addPhoto(),
    'open-photo': (node) => openPhoto(node.dataset.id),
  },
};

/* ------------------------------------------------------------------ measurements */

function numField(id, label, unit, value, step = '0.25') {
  return '<div class="row"><span class="row-main"><span class="row-title">' + esc(label) + '</span></span>' +
    '<input class="input-inline num" id="' + id + '" type="number" inputmode="decimal" step="' + step + '" placeholder="—"' +
    (value != null ? ' value="' + esc(value) + '"' : '') + ' aria-label="' + esc(label + ' in ' + unit) + '">' +
    '<span class="row-unit">' + esc(unit) + '</span></div>';
}

async function measureSheet() {
  const all = await measurements();
  const last = [...all].reverse().find((m) => m.waistIn || m.hipIn) || {};
  sheet({
    title: 'Measurements',
    left: { label: 'Cancel', action: 'close' },
    right: { label: 'Save', action: 'save' },
    body: '<p class="sheet-lede">Measure first thing in the morning, tape snug but not tight.</p>' +
      '<div class="group-body">' +
        numField('m-waist', 'Waist', 'in', null) +
        numField('m-hip', 'Hips', 'in', null) +
        numField('m-thigh', 'Thigh', 'in', null) +
        numField('m-arm', 'Upper arm', 'in', null) +
        numField('m-weight', 'Weight (optional)', 'lb', null, '0.1') +
      '</div>' +
      (last.date ? '<p class="group-footer">Last time (' + esc(fmt.shortDate(last.date)) + '): waist ' + esc(fmt.num(last.waistIn)) +
        '", hips ' + esc(fmt.num(last.hipIn)) + '"</p>' : ''),
    actions: {
      async save(n, d, h) {
        const v = (id) => { const x = parseFloat(h.el.querySelector('#' + id).value); return Number.isFinite(x) && x > 0 ? x : null; };
        const rec = { id: DB.uid(), date: DB.todayISO(), waistIn: v('m-waist'), hipIn: v('m-hip'), thighIn: v('m-thigh'), armIn: v('m-arm'), weightLb: v('m-weight') };
        if (!rec.waistIn && !rec.hipIn && !rec.thighIn && !rec.armIn && !rec.weightLb) {
          toast('Add at least one number', { tone: 'warn', ic: 'info' });
          return;
        }
        await DB.put('measurements', rec);
        if (rec.weightLb) await updateWeight(rec.weightLb);
        closeSheet();
        toast('Saved', { tone: 'good' });
        Nav.invalidate();
      },
    },
  });
}

async function inbodySheet() {
  sheet({
    title: 'InBody Scan',
    large: true,
    left: { label: 'Cancel', action: 'close' },
    right: { label: 'Save', action: 'save' },
    body: '<p class="sheet-lede">Copy the numbers from your InBody printout. The first four matter most.</p>' +
      '<div class="group-body">' + INBODY_FIELDS.map((f) =>
        numField('ib-' + f.key, f.label + (f.essential ? ' ★' : ''), f.unit, null, f.step)).join('') + '</div>',
    actions: {
      async save(n, d, h) {
        const rec = { id: DB.uid(), date: DB.todayISO(), source: 'inbody', note: '' };
        for (const f of INBODY_FIELDS) {
          const x = parseFloat(h.el.querySelector('#ib-' + f.key).value);
          rec[f.key] = Number.isFinite(x) && x > 0 ? x : null;
        }
        if (rec.smmLb == null && rec.bfmLb == null && rec.weightLb == null) {
          toast('Add muscle, fat or weight', { tone: 'warn', ic: 'info' });
          return;
        }
        await DB.put('measurements', rec);
        if (rec.weightLb) await updateWeight(rec.weightLb);
        closeSheet();
        toast('Scan saved', { tone: 'good' });
        Nav.invalidate();
      },
    },
  });
}

async function updateWeight(lb) {
  const profile = await DB.getProfile();
  const dials = Store.get('dials') || {};
  if (!profile) return;
  profile.weightLb = lb;
  if (dials.proteinGPerKg) profile.proteinTargetG = Math.round((lb / 2.2046) * dials.proteinGPerKg);
  await DB.saveProfile(profile);
  await Store.refreshProfile();
}

/* ------------------------------------------------------------------ weekly report */

export const reportPage = {
  id: 'report',
  title: 'Weekly Report',
  async render(params) {
    const offset = Number(params.week || 0);
    const weekOf = addDays(DB.todayISO(), -7 * offset);
    const r = await buildReport(weekOf);
    reportPage._last = r;
    const t = r.sessions;
    const primary = Object.values(r.shape.targets).filter((v) => v.tier === 'primary');
    return '<div class="report">' +
      '<div class="segmented">' +
        '<button type="button" class="seg' + (offset === 0 ? ' is-on' : '') + '" data-action="wk" data-v="0">This week</button>' +
        '<button type="button" class="seg' + (offset === 1 ? ' is-on' : '') + '" data-action="wk" data-v="1">Last week</button>' +
      '</div>' +
      '<div class="report-hero">' +
        '<p class="report-range">' + esc(fmt.shortDate(r.weekOf) + ' – ' + fmt.shortDate(r.weekEnd)) + '</p>' +
        '<p class="report-big num">' + t.total + '</p><p class="report-k">' + (t.total === 1 ? 'workout' : 'workouts') + '</p>' +
        '<div class="report-split">' +
          (t.lift ? '<span>' + icon('workouts', 16) + t.lift + ' lifting</span>' : '') +
          (t.class ? '<span>' + icon('classes', 16) + t.class + ' class' + (t.class > 1 ? 'es' : '') + '</span>' : '') +
          (t.conditioning ? '<span>' + icon('bolt', 16) + t.conditioning + ' cardio</span>' : '') +
        '</div></div>' +
      '<div class="card"><p class="card-title">Areas trained</p>' + primary.map((v) =>
        '<div class="area2"><div class="area2-top"><span>' + esc(v.label.replace('Side glute/hips', 'Hips')) + '</span><span class="num">' +
        fmt.num(v.done) + '/' + fmt.num(v.target) + '</span></div>' + bar(v.target ? v.done / v.target : 0, 'pink') + '</div>').join('') + '</div>' +
      (r.movers.length ? '<div class="card"><p class="card-title">' + icon('trophy', 18) + ' Getting stronger</p>' + r.movers.map((m) =>
        // "95 → 95 lb" reads like a bug: when the load held and the reps moved, say that.
        '<p class="mover"><b>' + esc(m.name) + '</b><span class="num">' + (m.toWeight === m.fromWeight
          ? fmt.num(m.toWeight) + ' lb · ' + m.fromReps + ' → ' + m.toReps + ' reps'
          : fmt.num(m.fromWeight) + ' → ' + fmt.num(m.toWeight) + ' lb') + '</span></p>').join('') + '</div>' : '') +
      (r.body ? '<div class="card"><p class="card-title">' + icon('ruler', 18) + ' Measurements</p>' +
        '<p class="mover"><b>Waist</b><span class="num">' + fmt.num(r.body.waistIn) + '"</span></p>' +
        '<p class="mover"><b>Hips</b><span class="num">' + fmt.num(r.body.hipIn) + '"</span></p>' +
        (r.recomposition ? '<p class="recomp">' + icon('sparkle', 16) + ' Waist down, hips up — real change.</p>' : '') + '</div>' : '') +
      (r.actions.length ? '<div class="card"><p class="card-title">' + icon('sparkle', 18) + ' For next week</p>' + r.actions.map((a) =>
        '<p class="next-act">' + esc(a.kind === 'shortfall' ? 'A few more sets for ' + a.label.toLowerCase().replace('side glute/hips', 'hips')
          : a.kind === 'impact' ? 'Add a little jumping — bones love landing.'
          : 'Protein most days: you hit it ' + a.hit + ' of ' + a.of) + '</p>').join('') + '</div>' : '') +
      '<div class="pl-cta">' + button({ label: 'Share My Week', action: 'share', kind: 'primary', icon: 'share' }) + '</div>' +
      '</div>';
  },
  actions: {
    wk(node, data, ctx) { ctx.params.week = node.dataset.v; return ctx.refresh(); },
    async share() {
      const r = reportPage._last;
      if (!r) return;
      const text = reportText(r);
      try {
        if (navigator.share) await navigator.share({ title: 'My week — Lady_GYM', text });
        else { await navigator.clipboard.writeText(text); toast('Copied — paste it into a message'); }
      } catch (_) { /* closed */ }
    },
  },
};
