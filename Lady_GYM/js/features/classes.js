// Lady_GYM — js/features/classes.js — the club timetable as pictures, and your week built around it.
//
// Pick a day, see that morning's classes as illustrated cards, tap + to add one. Lady_GYM
// then moves your lifting around it — the scheduling engine is Daybreak's, which already knew
// to keep a hard leg class away from leg day. The difference is you can see it at a glance.

import { DB } from '../core/db.js';
import { Nav } from '../core/nav.js';
import { CLASS_SCHEDULE, classById, DAY_NAMES } from '../data/classes.js';
import { classInfo } from '../data/info.js';
import { classPillarScore } from '../data/pillars.js';
import { rankClasses } from '../engine/recommend.js';
import { classArt, classTheme } from '../art/scenes.js';
import { icon, tile } from '../ui/icons.js';
import { esc, fmt, button, toast, actionSheet, confirmAlert, haptic, bar, sectionTitle } from '../ui/kit.js';
import { weekContext, avatarButton, addDays, mondayOf, PILLAR_COLOR, PILLAR_LABEL } from './shared.js';

const CLUB = 'Bay Club Redondo Beach';
const SCHEDULE_URL = 'https://www.bayclubs.com/classes?c2=redondobeach';

const INTENSITY = {
  low: { label: 'Gentle', color: 'mint' },
  moderate: { label: 'Moderate', color: 'sun' },
  high: { label: 'Intense', color: 'orange' },
};

function dowOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function slotKey(formatId, dow, time) { return formatId + '@' + dow + '@' + time; }

/** Her stored class records that match a schedule slot on a date. */
function mineFor(classes, slot, iso) {
  return classes.find((c) => c.active !== false && c.formatId === slot.formatId && Number(c.dayOfWeek) === slot.dayOfWeek &&
    c.time === slot.start && (!c.date || c.date === iso) && !(c.skipDates || []).includes(iso));
}

function classCard(slot, iso, ctx, ranked) {
  const f = classById(slot.formatId);
  if (!f) return '';
  const mine = mineFor(ctx.classes, slot, iso);
  const it = INTENSITY[f.intensity] || INTENSITY.moderate;
  const r = ranked.get(slotKey(slot.formatId, slot.dayOfWeek, slot.start));
  const booked = mine && (mine.bookedDates || []).includes(iso);
  let badge = '';
  if (r && r.warning) badge = '<span class="fit is-warn">' + icon('info', 13) + esc(shortReason(r.warning)) + '</span>';
  else if (r && r.score > 0 && ringsHelped(r).length) badge = '<span class="fit">' + icon('sparkle', 13) + esc(ringsHelped(r).join(' · ')) + '</span>';
  return '<article class="ccard' + (mine ? ' is-mine' : '') + '">' +
    '<button type="button" class="ccard-main" data-action="nav-push" data-page="class" data-format="' + esc(f.id) + '">' +
      '<span class="ccard-art">' + classArt(f.id, { square: true, label: f.name }) + '</span>' +
      '<span class="ccard-text">' +
        '<span class="ccard-time num">' + esc(fmt.clock(slot.start)) + '</span>' +
        '<span class="ccard-name">' + esc(f.name) + '</span>' +
        '<span class="ccard-meta">' + esc([slot.instructor, slot.studio].filter(Boolean).join(' · ')) + '</span>' +
        '<span class="ccard-chips"><span class="chip chip-' + it.color + '">' + esc(it.label) + '</span>' +
          (booked ? '<span class="chip chip-mint">' + icon('check', 12) + 'Booked</span>' : '') + '</span>' +
        badge +
      '</span>' +
    '</button>' +
    (mine
      ? '<button type="button" class="ccard-add is-on" data-action="class-mine" data-id="' + esc(mine.id) + '" data-date="' + iso +
        '" aria-label="' + esc(f.name) + ' is in your week. Options">' + icon('check', 20) + '</button>'
      : '<button type="button" class="ccard-add" data-action="class-add" data-format="' + esc(f.id) + '" data-dow="' + slot.dayOfWeek +
        '" data-time="' + esc(slot.start) + '" data-date="' + iso + '" aria-label="Add ' + esc(f.name) + ' to your week">' + icon('plus', 22) + '</button>') +
    '</article>';
}

/**
 * rankClasses() lists what a class would help in `helps`: pillar short names, lowercased, and
 * Shape Map muscles. The pillars are the four rings, so name them as the rings do; muscles have
 * no ring and are left out.
 */
const RING_OF = { strength: 'resistive', control: 'control', cardio: 'cardio', shape: 'shape' };
function ringsHelped(r) {
  return [...new Set((r.helps || []).map((h) => PILLAR_LABEL[RING_OF[h]]).filter(Boolean))];
}

/** Recommendation reasons were written as full sentences; a badge wants the first clause. */
function shortReason(text) {
  const s = String(text || '').split(/[.;—]/)[0].trim();
  return s.length > 56 ? s.slice(0, 54) + '…' : s;
}

/* ------------------------------------------------------------------ tab */

export const page = {
  id: 'classes',
  title: 'Classes',
  large: true,
  pre: () => CLUB,
  accessory: () => avatarButton(),

  async render(params) {
    const today = DB.todayISO();
    const offset = Number(params.week || 0);
    const weekStart = addDays(mondayOf(today), offset * 7);
    const ctx = await weekContext(weekStart);
    const selected = params.date && params.date >= weekStart && params.date <= addDays(weekStart, 6)
      ? params.date : (offset === 0 ? today : weekStart);

    let ranked = new Map();
    try {
      const list = rankClasses({ week: ctx.week, pillars: ctx.pillars, shape: ctx.shape,
        existingClassIds: ctx.classes.map((c) => slotKey(c.formatId, c.dayOfWeek, c.time)), dials: ctx.dials });
      for (const r of list) ranked.set(slotKey(r.slot.formatId, r.slot.dayOfWeek, r.slot.start), r);
    } catch (err) { console.warn(err); ranked = new Map(); }

    const strip = '<div class="daypick">' +
      '<button type="button" class="daypick-arrow" data-action="week" data-d="-1" aria-label="Previous week"' +
        (offset <= 0 ? ' disabled' : '') + '>' + icon('chevronLeft', 18) + '</button>' +
      '<div class="daypick-days">' + ctx.week.map((d) => {
        const mineCount = ctx.classesOn(d.date).length;
        return '<button type="button" class="dp' + (d.date === selected ? ' is-on' : '') + (d.date === today ? ' is-today' : '') +
          (d.date < today ? ' is-past' : '') + '" data-action="pick-day" data-date="' + d.date + '">' +
          '<span class="dp-l">' + esc(d.dayShort.slice(0, 3)) + '</span><span class="dp-n num">' + Number(d.date.slice(8)) + '</span>' +
          '<span class="dp-dot' + (mineCount ? ' is-on' : '') + '"></span></button>';
      }).join('') + '</div>' +
      '<button type="button" class="daypick-arrow" data-action="week" data-d="1" aria-label="Next week"' +
        (offset >= 3 ? ' disabled' : '') + '>' + icon('chevronRight', 18) + '</button></div>';

    const dow = dowOf(selected);
    const slots = CLASS_SCHEDULE.filter((s) => s.dayOfWeek === dow).sort((a, b) => a.start.localeCompare(b.start));
    const day = ctx.week.find((d) => d.date === selected);
    const plan = day && day.session ? '<div class="dayplan">' +
      tile('workouts', 'var(--pink-fill)', 32) +
      '<p><b>Your lift:</b> ' + esc(day.session.name) + ' at ' + esc(fmt.clock(day.session.startTime)) +
      (day.classId ? ' — then your class.' : '') + '</p></div>' : '';
    const warns = (day && day.warnings ? day.warnings : []).map((w) =>
      '<div class="warncard">' + icon('info', 18) + '<div><p>' + esc(w.message) + '</p>' +
      // The scheduler's fix is { action, payload: { programDayKey, toDayIndex } }; reading
      // w.fix.programDayKey meant the button never showed. Only offered when there is a day to move to.
      (w.fix && w.fix.action === 'move-session' && w.fix.payload && Number.isFinite(w.fix.payload.toDayIndex)
        ? button({ label: 'Fix it for me', action: 'apply-fix', kind: 'tinted', size: 'sm', full: false,
          data: { payload: JSON.stringify(w.fix.payload) } }) : '') + '</div></div>').join('');

    const empty = !ctx.classes.length && offset === 0
      ? '<div class="card intro-card">' + tile('sparkle', 'var(--blue-fill)', 38) +
        '<div><p class="card-title">Tap + on any class you like</p>' +
        '<p class="card-sub">Add it once and it repeats every week. I’ll plan your lifting around it.</p></div></div>' : '';

    return '<div class="classes">' + strip +
      '<h2 class="day-head">' + esc(selected === today ? 'Today' : DAY_NAMES[dow]) + ' <span>' + esc(fmt.shortDate(selected)) + '</span></h2>' +
      empty + plan + warns +
      (slots.length ? slots.map((s) => classCard(s, selected, ctx, ranked)).join('')
        : '<div class="empty"><p class="empty-title">No morning classes</p><p class="empty-sub">The club schedule has nothing early this day.</p></div>') +
      '<a class="ext-link" href="' + SCHEDULE_URL + '" target="_blank" rel="noopener noreferrer">' + icon('link', 16) +
        ' Book on the Bay Club website or app</a>' +
      '</div>';
  },

  actions: {
    'pick-day'(node, data, ctx) { haptic(); ctx.params.date = node.dataset.date; return ctx.refresh(); },
    week(node, data, ctx) {
      ctx.params.week = Math.max(0, Math.min(3, Number(ctx.params.week || 0) + Number(node.dataset.d)));
      ctx.params.date = null;
      return ctx.refresh();
    },
    'class-add': (node) => addClass(node.dataset),
    'class-mine': (node) => mineOptions(node.dataset.id, node.dataset.date),
    async 'apply-fix'(node) {
      let payload = {};
      try { payload = JSON.parse(node.dataset.payload || '{}'); } catch (_) { /* keep empty */ }
      if (payload.programDayKey && Number.isFinite(payload.toDayIndex)) {
        const o = (await DB.getPref('session:overrides', {})) || {};
        o[payload.programDayKey] = payload.toDayIndex;
        await DB.setPref('session:overrides', o);
        toast('Moved. Your week is clear.', { tone: 'good' });
      }
      return Nav.invalidate();
    },
  },
};

async function addClass({ format, dow, time, date }) {
  const f = classById(format);
  const dayName = DAY_NAMES[Number(dow)];
  const same = ((await DB.getAll('classes')) || []).filter((c) => c.active !== false && c.formatId === format &&
    Number(c.dayOfWeek) === Number(dow) && c.time === time);
  // Already in her week, skipped on this date ("Skip just this week"): + puts the date back.
  // Adding a second weekly copy doubled the class in every week after, and "Remove from every
  // week" then left one behind.
  const weekly = same.find((c) => !c.date);
  if (weekly) {
    haptic();
    await DB.put('classes', { ...weekly, skipDates: (weekly.skipDates || []).filter((d) => d !== date) });
    toast((f ? f.name : 'Class') + ' added — your week is updated', { tone: 'good', ic: 'calendarPlus' });
    return Nav.invalidate();
  }
  const pick = await actionSheet((f ? f.name : 'Class') + ' · ' + dayName + ' ' + fmt.clock(time), [
    { id: 'weekly', label: 'Every ' + dayName },
    { id: 'once', label: 'Just this once (' + fmt.shortDate(date) + ')' },
  ]);
  if (!pick) return;
  haptic();
  const rec = {
    id: DB.uid(), formatId: format, dayOfWeek: Number(dow), time,
    durationMin: f && f.durationMin ? f.durationMin : 50, active: true,
  };
  if (pick === 'once') rec.date = date;
  // One-offs of this class are covered by the weekly record now (kept, that day showed it twice).
  if (pick === 'weekly' && same.length) rec.bookedDates = [...new Set(same.flatMap((c) => c.bookedDates || []))];
  await DB.put('classes', rec);
  if (pick === 'weekly') for (const c of same) await DB.del('classes', c.id);
  toast((f ? f.name : 'Class') + ' added — your week is updated', { tone: 'good', ic: 'calendarPlus' });
  return Nav.invalidate();
}

async function mineOptions(id, date) {
  const c = await DB.get('classes', id);
  if (!c) return;
  const f = classById(c.formatId);
  const booked = (c.bookedDates || []).includes(date);
  const opts = [
    { id: 'booked', label: booked ? 'I haven’t booked it' : 'I booked it ✓' },
  ];
  if (!c.date) opts.push({ id: 'skip', label: 'Skip just this week' });
  opts.push({ id: 'remove', label: c.date ? 'Remove' : 'Remove from every week', danger: true });
  const pick = await actionSheet(f ? f.name : 'Class', opts);
  if (!pick) return;
  if (pick === 'booked') {
    const dates = new Set(c.bookedDates || []);
    if (booked) dates.delete(date); else dates.add(date);
    await DB.put('classes', { ...c, bookedDates: [...dates] });
  } else if (pick === 'skip') {
    await DB.put('classes', { ...c, skipDates: [...new Set([...(c.skipDates || []), date])] });
    toast('Skipped this week', { ic: 'calendarPlus' });
  } else if (pick === 'remove') {
    const ok = await confirmAlert('Remove ' + (f ? f.name : 'this class') + '?', 'Your lifting will be re-planned.', { ok: 'Remove', danger: true });
    if (!ok) return;
    await DB.del('classes', c.id);
  }
  return Nav.invalidate();
}

/* ------------------------------------------------------------------ class detail */

export const classPage = {
  id: 'class',
  title: (p) => { const f = classById(p.format); return f ? f.name : 'Class'; },

  async render(params) {
    const f = classById(params.format);
    if (!f) return '<div class="empty"><p class="empty-title">Class not found</p></div>';
    const info = classInfo(f) || {};
    const it = INTENSITY[f.intensity] || INTENSITY.moderate;
    const score = classPillarScore(f);
    const ids = ['resistive', 'cardio', 'control', 'shape'];
    const classes = (await DB.getAll('classes')) || [];
    const slots = CLASS_SCHEDULE.filter((s) => s.formatId === f.id)
      .sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7) || a.start.localeCompare(b.start));
    const theme = classTheme(f.id);
    const today = DB.todayISO();
    const nextDate = (dow) => {
      for (let i = 0; i < 7; i++) { const d = addDays(today, i); if (dowOf(d) === dow) return d; }
      return today;
    };

    return '<div class="cdetail">' +
      '<div class="cdetail-hero">' + classArt(f.id, { label: f.name }) + '</div>' +
      '<h1 class="wdetail-title">' + esc(f.name) + '</h1>' +
      '<div class="chip-row"><span class="chip chip-' + it.color + '">' + esc(it.label) + '</span>' +
        '<span class="chip chip-blue">' + icon('clock', 12) + esc((f.durationMin || 50) + ' min') + '</span></div>' +
      (info.what ? '<p class="wdetail-desc">' + esc(info.what) + '</p>' : '') +
      sectionTitle('What it does for you') +
      // Scores are in "sets-equivalent" units (0–9); show them on one fixed scale so a cardio
      // class reads as mostly cardio and a yoga class as mostly balance & core.
      '<div class="card pillars">' + ids.map((id) => {
        const v = Math.min(1, (score[id] || 0) / 6);
        return '<div class="pillar-row"><span class="pillar-name">' + esc(PILLAR_LABEL[id]) + '</span>' +
          bar(v, PILLAR_COLOR[id]) + '</div>';
      }).join('') + '</div>' +
      (info.why ? '<p class="card why">' + esc(firstSentences(info.why, 2)) + '</p>' : '') +
      sectionTitle('When it’s on') +
      '<div class="group-body">' + slots.map((s) => {
        const iso = nextDate(s.dayOfWeek);
        const mine = mineFor(classes, s, iso);
        return '<div class="row"><span class="row-lead">' + tile('classes', theme.a, 34) + '</span>' +
          '<span class="row-main"><span class="row-title">' + esc(DAY_NAMES[s.dayOfWeek] + ' · ' + fmt.clock(s.start)) + '</span>' +
          '<span class="row-sub">' + esc([s.instructor, s.studio].filter(Boolean).join(' · ')) + '</span></span>' +
          (mine
            ? '<button type="button" class="pillbtn is-on" data-action="class-mine" data-id="' + esc(mine.id) + '" data-date="' + iso + '">' + icon('check', 14) + 'Added</button>'
            : '<button type="button" class="pillbtn" data-action="class-add" data-format="' + esc(f.id) + '" data-dow="' + s.dayOfWeek +
              '" data-time="' + esc(s.start) + '" data-date="' + iso + '">' + icon('plus', 14) + 'Add</button>') +
          '</div>';
      }).join('') + '</div>' +
      '<a class="ext-link" href="' + SCHEDULE_URL + '" target="_blank" rel="noopener noreferrer">' + icon('link', 16) +
        ' Book on the Bay Club website or app</a>' +
      '</div>';
  },

  actions: {
    'class-add': (node) => addClass(node.dataset),
    'class-mine': (node) => mineOptions(node.dataset.id, node.dataset.date),
  },
};

// No regex lookbehind here: Safari before iOS 16.4 cannot even parse it, and one unparseable
// module stops the whole app from starting on those phones.
function firstSentences(text, n) {
  const parts = String(text).match(/[^.!?]+[.!?]+(\s+|$)/g) || [String(text)];
  return parts.slice(0, n).join('').trim();
}
