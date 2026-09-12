// Daybreak — js/features/week.js — does my week actually hold together?
//
// The Stack lives here: on a class morning she lifts first at 5:30 and takes the class after,
// and the lift is chosen to complement the class rather than duplicate it. Cycle at 6:30 means
// the 5:30 block is upper body. That is the whole trick, and it is why the app needs to know
// class names rather than just "there is a class".

import { DB } from '../core/db.js';
import { Store } from '../core/store.js';
import { Router } from '../core/router.js';
import { buildWeek, detectConflicts } from '../engine/scheduler.js';
import { CLASS_FORMATS, classById, scheduleByDay, scheduleForDay, liftWindowMinutes } from '../data/classes.js';
import { planFor } from '../engine/sessionplan.js';
import { rankClasses } from '../engine/recommend.js';
import { weeklyPillars } from '../data/pillars.js';
import { weeklyShapeMap } from '../engine/shapemap.js';
import { byId } from '../data/exercises.js';
import { infoButton, infoActions } from '../ui/infosheet.js';
import { card, btn, sheet, closeSheet, toast, confirmDialog } from '../ui/components.js';
import {
  classesForWeek, classesOnDate, occurrenceMap, monthGrid, shiftMonth,
  dayOfWeekOf, parseISO,
} from '../data/schedule.js';

export const id = 'week';
export const title = 'Week';

let weekOffset = 0;          // 0 = this week
let draftClass = null;
let view = 'week';           // 'week' | 'month'
let monthAnchor = null;      // first of the month being shown, null = this month
let pickerDate = null;       // when set, a pick becomes a one-off on this exact date

// Cached on each render so the schedule picker can rank slots without refetching.
let ctx = { week: [], ranked: [], mine: new Set() };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function mondayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return DB.todayISO(dt);
}

function shiftDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return DB.todayISO(dt);
}

function clockLabel(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`;
}

function rangeLabel(startISO, endISO) {
  const f = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  return f(startISO) + ' – ' + f(endISO);
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ------------------------------------------------------------------ day rows

function dayRow(day, isToday, exerciseCount) {
  const s = day.session;
  const stack = day.dayType === 'stack' && day.className;

  let what;
  if (day.className && !s) {
    // A class on a day with no lift block. Common — she adds a class to a rest day.
    what =
      '<div class="day-single">' +
        '<span class="day-time num">' + clockLabel(day.classStart) + '</span>' +
        '<span class="day-what">' + esc(day.className) + '</span>' +
        '<span class="day-meta">Class · no lift scheduled</span>' +
      '</div>';
  } else if (stack) {
    what =
      '<div class="day-stack">' +
        '<div class="day-leg"><span class="day-time num">' + clockLabel(s.startTime) + '</span>' +
          '<span class="day-what">' + esc(s.name) + '</span>' +
          '<span class="day-meta">' + (s.estMinutes ? s.estMinutes + ' min' : '') +
            (exerciseCount ? ' · ' + exerciseCount + ' exercises' : '') + '</span></div>' +
        '<div class="day-leg is-class"><span class="day-time num">' + clockLabel(day.classStart) + '</span>' +
          '<span class="day-what">' + esc(day.className) + '</span>' +
          '<span class="day-meta">Class</span></div>' +
      '</div>';
  } else if (s) {
    what =
      '<div class="day-single">' +
        '<span class="day-time num">' + clockLabel(s.startTime) + '</span>' +
        '<span class="day-what">' + esc(s.name) + '</span>' +
        '<span class="day-meta">' + (s.estMinutes ? s.estMinutes + ' min' : '') +
          (exerciseCount ? ' · ' + exerciseCount + ' exercises' : '') +
          (s.blockSize === 'short' ? ' · short block' : '') + '</span>' +
      '</div>';
  } else {
    what = '<div class="day-single is-rest"><span class="day-what">Rest</span>' +
           '<span class="day-meta">Recovery is when it lands</span></div>';
  }

  const badge = day.done
    ? '<span class="day-badge is-done" aria-label="Completed">Done</span>'
    : (s ? '<span class="day-badge" aria-hidden="true"></span>' : '');

  return (
    '<li class="day-row' + (isToday ? ' is-today' : '') + (day.done ? ' is-complete' : '') + '" ' +
        'data-action="day-menu" data-index="' + day.dayIndex + '">' +
      '<div class="day-label">' +
        '<span class="day-name">' + esc(day.dayName) + '</span>' +
        '<span class="day-date num">' + esc(day.date.slice(5).replace('-', '/')) + '</span>' +
      '</div>' +
      what + badge +
    '</li>'
  );
}

// ------------------------------------------------------------------ warnings

function warningStrip(w, weekStart) {
  // Only offer the button when there is somewhere to move to. When the week is saturated
  // with leg-heavy classes the scheduler returns toDayIndex null — a "Move it" button that
  // cannot move anything is worse than no button.
  const payload = (w.fix && w.fix.payload) || {};
  const movable = w.fix && w.fix.action === 'move-session' && Number.isFinite(payload.toDayIndex);

  const fixBtn = movable
    ? btn({ label: 'Move it', action: 'apply-fix', size: 'md', variant: 'primary',
            data: { code: w.code, payload: JSON.stringify(payload) } })
    : '';
  const noRoom = w.fix && w.fix.action === 'move-session' && !movable
    ? '<p class="warn-note">There is no clear morning to move it to this week. Drop a class, ' +
      'or take the lift lighter and accept it.</p>'
    : '';
  return (
    '<div class="warn">' +
      '<span class="warn-icon" aria-hidden="true">!</span>' +
      '<div class="warn-body">' +
        '<p class="warn-text">' + esc(w.message) + '</p>' + noRoom +
        '<div class="warn-actions">' + fixBtn +
          '<button type="button" class="link-quiet" data-action="dismiss-warn" ' +
            'data-code="' + esc(w.code) + '" data-week="' + esc(weekStart) + '">Dismiss</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// ------------------------------------------------------------------- classes

function classesSection(classes) {
  if (!classes.length) {
    return card({
      tone: 'calm',
      title: 'Your classes',
      body:
        '<p class="lede">Pick the classes you actually go to and I will build your lifting around ' +
        'them, so the two do not fight each other.</p>' +
        '<p class="muted">A hard Cycle class the morning before leg day costs you real strength. ' +
        'Put it in and I will move things so that never happens — and on class mornings I will ' +
        'give you a short lift beforehand that works the opposite half of your body.</p>',
      footer: btn({ label: 'Browse the schedule', action: 'add-class', variant: 'primary', size: 'lg', full: true }),
    });
  }

  const rows = classes.map((c) => {
    const f = classById(c.formatId);
    const window = liftWindowMinutes(c.time, (c.dayOfWeek === 0 || c.dayOfWeek === 6) ? '07:00' : '05:30');
    return (
      '<li class="class-row">' +
        '<button type="button" class="class-main" data-action="edit-class" data-id="' + esc(c.id) + '">' +
          '<span class="class-name">' + esc(f ? f.name : c.formatId) + '</span>' +
          '<span class="class-when num">' + esc(DAY_NAMES[(c.dayOfWeek + 6) % 7]) + ' · ' +
            clockLabel(c.time) + '</span>' +
          (window >= 25
            ? '<span class="class-window">' + window + ' min to lift first</span>'
            : '<span class="class-window is-tight">No room to lift first</span>') +
        '</button>' +
        (f ? infoButton('class', f.id, f.name) : '') +
        '<button type="button" class="class-del" data-action="delete-class" data-id="' + esc(c.id) + '" ' +
          'aria-label="Remove ' + esc(f ? f.name : 'class') + '">Remove</button>' +
      '</li>'
    );
  }).join('');

  return card({
    title: 'Your classes',
    body: '<ul class="class-list">' + rows + '</ul>',
    footer: btn({ label: 'Browse the schedule', action: 'add-class', variant: 'ghost', size: 'md', full: true }),
  });
}

/* ------------------------------------------------- the schedule picker ---- */

// Which day the picker is showing. Defaults to Monday.
let pickerDay = 1;

function pickerBody(week, ranked, mine) {
  const days = scheduleByDay().filter((d) => d.classes.length);

  const tabs = '<div class="chip-row nowrap day-tabs">' + days.map((d) =>
    '<button type="button" class="chip' + (d.dayOfWeek === pickerDay ? ' chip-selected' : '') + '" ' +
      'data-action="picker-day" data-dow="' + d.dayOfWeek + '">' +
      esc(d.dayName.slice(0, 3)) + '</button>').join('') + '</div>';

  const day = days.find((d) => d.dayOfWeek === pickerDay) || days[0];
  const open = (pickerDay === 0 || pickerDay === 6) ? '07:00' : '05:30';

  const rows = day.classes.map((c) => {
    const key = c.formatId + '@' + c.dayOfWeek + '@' + c.start;
    const already = mine.has(key);
    const rank = ranked.find((r) => r.key === key);
    const window = liftWindowMinutes(c.start, open);

    const badges = [];
    if (rank && rank.helps.length && rank.fits) {
      badges.push('<span class="badge badge-good">helps ' + esc(rank.helps.join(', ')) + '</span>');
    }
    if (rank && rank.warning) {
      badges.push('<span class="badge badge-warn">' + esc(rank.warning) + '</span>');
    }
    badges.push(window >= 25
      ? '<span class="badge">' + window + ' min to lift first</span>'
      : '<span class="badge badge-warn">no time to lift first</span>');

    return (
      '<li class="slot-row' + (already ? ' is-mine' : '') + '">' +
        '<div class="slot-time num">' + clockLabel(c.start) + '</div>' +
        '<div class="slot-main">' +
          '<span class="slot-name">' + esc(c.format.name) + '</span>' +
          '<span class="slot-meta">' + esc(c.studio) + ' · ' + esc(c.instructor) + '</span>' +
          '<div class="slot-badges">' + badges.join('') + '</div>' +
        '</div>' +
        infoButton('class', c.format.id, c.format.name) +
        (already
          ? '<span class="slot-added" aria-label="Already in your week">Added</span>'
          : '<button type="button" class="slot-add" data-action="add-slot" ' +
            'data-formatid="' + esc(c.formatId) + '" data-dow="' + c.dayOfWeek + '" ' +
            'data-time="' + esc(c.start) + '" aria-label="Add ' + esc(c.format.name) + '">Add</button>') +
      '</li>'
    );
  }).join('');

  return (
    '<p class="lede">The Redondo Beach morning schedule. Tap <strong>i</strong> on anything to ' +
    'see what it does for you.</p>' +
    tabs +
    '<ul class="slot-list">' + rows + '</ul>' +
    '<p class="muted">Times drift — if yours is different, add it and then tap it to edit. ' +
    'The club opens ' + clockLabel(open) + ' on ' + (pickerDay === 0 || pickerDay === 6 ? 'weekends' : 'weekdays') + '.</p>' +
    btn({ label: 'Add one that is not listed', action: 'add-custom', variant: 'ghost', size: 'md', full: true })
  );
}

// -------------------------------------------------------------- class editor

function classSheetBody() {
  const chips = CLASS_FORMATS.map((f) =>
    '<button type="button" class="chip' + (draftClass.formatId === f.id ? ' chip-selected' : '') + '" ' +
      'data-action="pick-format" data-id="' + esc(f.id) + '">' + esc(f.name) + '</button>'
  ).join('');

  const f = classById(draftClass.formatId);
  const isWeekend = draftClass.dayOfWeek === 0 || draftClass.dayOfWeek === 6;

  const dayChips = DAY_NAMES.map((name, i) => {
    const dow = i === 6 ? 0 : i + 1;            // Monday-first display, JS day numbers
    return '<button type="button" class="chip' + (draftClass.dayOfWeek === dow ? ' chip-selected' : '') + '" ' +
      'data-action="pick-day" data-dow="' + dow + '">' + name.slice(0, 3) + '</button>';
  }).join('');

  const slots = isWeekend
    ? ['08:00', '08:30', '09:00', '09:30', '10:00']
    : ['06:00', '06:15', '06:30', '06:45', '07:00'];

  const timeChips = slots.map((t) =>
    '<button type="button" class="chip' + (draftClass.time === t ? ' chip-selected' : '') + '" ' +
      'data-action="pick-time" data-time="' + t + '">' + clockLabel(t) + '</button>'
  ).join('');

  return (
    '<h3 class="section-label">Which class?</h3>' +
    '<div class="chip-row">' + chips + '</div>' +
    (f ? '<p class="class-note">' + esc(f.note || '') + '</p>' : '') +
    '<h3 class="section-label">Which day?</h3>' +
    '<div class="chip-row">' + dayChips + '</div>' +
    '<h3 class="section-label">What time?</h3>' +
    '<div class="chip-row">' + timeChips + '</div>' +
    '<p class="muted">' + (isWeekend
      ? 'The club opens at 7:00 on weekends and classes start at 8:00.'
      : 'The club opens at 5:30 on weekdays and classes run 6:00–7:00. You will lift before it.') + '</p>' +
    btn({ label: draftClass.id ? 'Save' : 'Add it', action: 'save-class',
          variant: 'primary', size: 'lg', full: true, disabled: !draftClass.formatId }) +
    (draftClass.id
      ? btn({ label: 'Remove this class', action: 'delete-class', variant: 'danger', size: 'md',
              full: true, data: { id: draftClass.id } })
      : '')
  );
}

function openClassSheet() {
  sheet(draftClass.id ? 'Edit class' : 'Add a class', classSheetBody(), { actions: classSheetActions });
}

const classSheetActions = {
  'pick-format'(node) {
    draftClass.formatId = node.dataset.id;
    const f = classById(draftClass.formatId);
    if (f && f.typicalStart) draftClass.time = f.typicalStart;
    openClassSheet();
  },
  'pick-day'(node) {
    draftClass.dayOfWeek = parseInt(node.dataset.dow, 10);
    const weekend = draftClass.dayOfWeek === 0 || draftClass.dayOfWeek === 6;
    if (weekend && draftClass.time < '08:00') draftClass.time = '08:00';
    if (!weekend && draftClass.time >= '08:00') draftClass.time = '06:30';
    openClassSheet();
  },
  'pick-time'(node) { draftClass.time = node.dataset.time; openClassSheet(); },
  async 'save-class'() {
    if (!draftClass.formatId) return;
    const f = classById(draftClass.formatId);
    const record = {
      id: draftClass.id || DB.uid(),
      formatId: draftClass.formatId,
      dayOfWeek: draftClass.dayOfWeek,
      time: draftClass.time,
      durationMin: f && f.durationMin ? f.durationMin : 45,
      active: true,
    };
    await DB.put('classes', record);
    closeSheet();
    toast(f ? f.name + ' added. I will build around it.' : 'Class saved.', 'calm');
    Router.refresh();
  },
  async 'delete-class'(node) {
    const cid = node.dataset.id || draftClass.id;
    if (!cid) return;
    await DB.del('classes', cid);
    closeSheet();
    Router.refresh();
  },
};

// -------------------------------------------------------------------- render

export async function render(el) {
  const profile = Store.get('profile') || await DB.getProfile();
  const dials = Store.get('dials');
  if (!profile || !profile.name) { el.innerHTML = ''; return; }

  const today = DB.todayISO();
  const weekStart = shiftDays(mondayOf(today), weekOffset * 7);
  const classes = (await DB.getAll('classes')) || [];
  const overrides = (await DB.getPref('session:overrides', {})) || {};
  const week = buildWeek(profile, classesForWeek(classes, weekStart), dials, weekStart, { overrides });

  const sessions = await DB.getSessionsInRange(week[0].date, week[6].date);
  for (const d of week) d.done = (sessions || []).some((s) => s.date === d.date && s.complete);

  const dismissed = (await DB.getPref('warn:dismissed', [])) || [];
  const conflicts = detectConflicts(week).filter((w) => !dismissed.includes(w.code));

  // Rank the real schedule against what she is missing, so the picker can say why.
  const done = (sessions || []).filter((s) => s.complete);
  const sets = [];
  for (const s of done) {
    for (const r of await DB.getSessionSets(s.id)) if (!r.isWarmup) sets.push(r);
  }
  const shape = weeklyShapeMap(done, sets, classes, dials);
  const pillars = weeklyPillars(done, sets, byId, classById, dials);
  const mine = new Set(classes.map((c) => c.formatId + '@' + c.dayOfWeek + '@' + c.time));
  ctx = {
    week,
    mine,
    ranked: rankClasses({ week, pillars, shape, existingClassIds: [...mine], dials })
  };

  const rows = week.map((d) => dayRow(
    d, d.date === today,
    d.session && d.session.programDayKey ? planFor(profile, d.session).items.length : 0
  )).join('');

  const confirmed = (await DB.getPref('week:confirmed', [])) || [];

  const toggle =
    '<div class="segmented view-toggle" role="group" aria-label="Week or month">' +
      '<button type="button" class="segmented-option" ' +
        'data-action="view-week" aria-pressed="' + (view === 'week') + '">Week</button>' +
      '<button type="button" class="segmented-option" ' +
        'data-action="view-month" aria-pressed="' + (view === 'month') + '">Month</button>' +
    '</div>';

  if (view === 'month') {
    el.innerHTML = '<div class="week">' + toggle + monthView(classes, today) + '</div>';
    return;
  }

  el.innerHTML =
    '<div class="week">' +
      '<header class="week-head">' +
        '<button type="button" class="week-nav" data-action="prev-week" aria-label="Previous week">‹</button>' +
        '<div class="week-title">' +
          '<h1 class="display">' + (weekOffset === 0 ? 'This week' : rangeLabel(week[0].date, week[6].date)) + '</h1>' +
          (weekOffset === 0 ? '<p class="week-sub">' + rangeLabel(week[0].date, week[6].date) + '</p>' : '') +
        '</div>' +
        '<button type="button" class="week-nav" data-action="next-week" aria-label="Next week">›</button>' +
      '</header>' +

      toggle +

      confirmBar(weekStart, confirmed) +

      (conflicts.length ? '<div class="warn-stack">' + conflicts.map((c) => warningStrip(c, weekStart)).join('') + '</div>' : '') +

      '<ul class="day-list">' + rows + '</ul>' +

      classesSection(classes) +
    '</div>';
}

// ------------------------------------------------------------------- actions

function openPicker() {
  sheet('Bay Club schedule', pickerBody(ctx.week, ctx.ranked, ctx.mine), {
    actions: pickerActions,
    class: 'picker-sheet',
  });
}

const pickerActions = {
  'picker-day'(node) {
    pickerDay = parseInt(node.dataset.dow, 10);
    openPicker();
  },
  ...infoActions,
  async 'add-slot'(node) {
    const { formatid, dow, time } = node.dataset;
    const f = classById(formatid);
    // A pick made from a CALENDAR DAY is a one-off bound to that date. A pick made from
    // the Week screen is the weekly recurrence it has always been. Same picker; the
    // difference is which screen she opened it from.
    const record = {
      id: DB.uid(),
      formatId: formatid,
      dayOfWeek: parseInt(dow, 10),
      time,
      durationMin: f && f.durationMin ? f.durationMin : 50,
      active: true,
    };
    if (pickerDate) record.date = pickerDate;
    await DB.put('classes', record);
    ctx.mine.add(formatid + '@' + dow + '@' + time);
    openPicker();                                   // keep the sheet open for a second pick
    toast((f ? f.name : 'Class') + (pickerDate
      ? ' added for that day only.'
      : ' added. Rebuilding your week around it.'), 'calm');
    Router.refresh();
  },
  'add-custom'() {
    closeSheet();
    draftClass = { id: null, formatId: null, dayOfWeek: 2, time: '06:30' };
    openClassSheet();
  },
};

/**
 * A week you are only LOOKING at is not a week you have agreed to.
 *
 * Paging forward used to render an identical grid with no acknowledgement that it was a
 * projection rather than a plan — "Week icon just copies". It IS a projection: classes
 * repeat weekly and the lifts are generated around them. So say so, and ask.
 */
function confirmBar(weekStartISO, confirmed) {
  if (weekOffset <= 0) return '';                 // this week and the past are not proposals
  if (confirmed.includes(weekStartISO)) {
    return '<p class="week-confirmed">You have said this week works. ' +
      '<button type="button" class="link-quiet" data-action="unconfirm-week" ' +
      'data-week="' + weekStartISO + '">Change it</button></p>';
  }
  return (
    '<div class="week-ask">' +
      '<p class="week-ask-q">This is how ' +
        (weekOffset === 1 ? 'next week' : 'that week') +
        ' would fall. Your classes repeat weekly, and the lifts are built around them.</p>' +
      '<p class="week-ask-sub">Does that work, or would you rather it were different?</p>' +
      '<div class="week-ask-acts">' +
        btn({ label: 'That works', action: 'confirm-week', variant: 'primary', size: 'md',
              data: { week: weekStartISO } }) +
        btn({ label: 'Change something', action: 'add-class', variant: 'ghost', size: 'md' }) +
      '</div>' +
    '</div>'
  );
}

// ------------------------------------------------------------ the month view
//
// "Add month calendar that shows shaded area if class has been scheduled; click area to
// open which class was picked and allow changes or updates."
//
// Shading is by CLASS, not by session — a lift is scheduled on most days and would shade
// nearly the whole grid, which tells her nothing. A class is the thing she has to book,
// travel for, and plan around, so a class is what earns the shade.

function monthCell(iso, occ, todayISO, monthIdx) {
  if (!iso) return '<div class="cal-cell is-blank" aria-hidden="true"></div>';

  const day = Number(iso.slice(8, 10));
  const classes = occ.get(iso) || [];
  const has = classes.length > 0;
  const allBooked = has && classes.every((c) => c.booked);
  const past = iso < todayISO;

  const label = classes.length
    ? day + ': ' + classes.map((c) => {
      const f = classById(c.formatId);
      return (f ? f.name : 'class') + ' at ' + clockLabel(c.time);
    }).join(', ') + (allBooked ? ' — booked' : ' — not booked yet')
    : String(day);

  return (
    '<button type="button" class="cal-cell' +
      (has ? ' has-class' : '') +
      (allBooked ? ' is-booked' : '') +
      (iso === todayISO ? ' is-today' : '') +
      (past ? ' is-past' : '') + '" ' +
      'data-action="day-open" data-date="' + iso + '" aria-label="' + esc(label) + '">' +
      '<span class="cal-num num">' + day + '</span>' +
      (has
        ? '<span class="cal-dots" aria-hidden="true">' +
            classes.slice(0, 3).map(() => '<span class="cal-dot"></span>').join('') +
          '</span>'
        : '') +
    '</button>'
  );
}

function monthView(classes, todayISO) {
  const grid = monthGrid(monthAnchor || todayISO);
  const first = grid.cells.find(Boolean);
  const last = [...grid.cells].reverse().find(Boolean);
  const occ = occurrenceMap(classes, first, last);
  const total = [...occ.values()].reduce((n, a) => n + a.length, 0);

  const heads = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    .map((d, i) => '<span class="cal-head" aria-hidden="true">' + d + '</span>').join('');

  return (
    '<div class="calendar">' +
      '<header class="cal-bar">' +
        '<button type="button" class="week-nav" data-action="prev-month" aria-label="Previous month">‹</button>' +
        '<h2 class="cal-title">' + esc(grid.label) + '</h2>' +
        '<button type="button" class="week-nav" data-action="next-month" aria-label="Next month">›</button>' +
      '</header>' +
      '<div class="cal-heads">' + heads + '</div>' +
      '<div class="cal-grid">' +
        grid.cells.map((iso) => monthCell(iso, occ, todayISO, grid.month)).join('') +
      '</div>' +
      '<p class="cal-key">' +
        '<span class="cal-swatch has-class"></span> class scheduled' +
        '<span class="cal-swatch is-booked"></span> booked' +
      '</p>' +
      '<p class="cal-note">' + (total
        ? total + ' ' + (total === 1 ? 'class' : 'classes') + ' this month. Tap any day to see it, change it, or add one.'
        : 'No classes this month. Tap any day to add one — you can plan as far ahead as you like.') +
      '</p>' +
    '</div>'
  );
}

/** The sheet behind a tapped calendar day: what is on, and everything she can do to it. */
async function openDaySheet(iso) {
  const classes = (await DB.getAll('classes')) || [];
  const on = classesOnDate(classes, iso);
  const todayISO = DB.todayISO();
  const dow = dayOfWeekOf(iso);
  const d = parseISO(iso);
  const pretty = d ? d.toLocaleDateString(undefined,
    { weekday: 'long', month: 'long', day: 'numeric' }) : iso;

  const rows = on.map((c) => {
    const f = classById(c.formatId);
    return (
      '<div class="day-class">' +
        '<div class="day-class-main">' +
          '<span class="day-class-name">' + esc(f ? f.name : 'Class') + '</span>' +
          '<span class="day-class-meta">' + clockLabel(c.time) +
            (c.date ? ' · this date only' : ' · every ' + DAY_NAMES[(dow + 6) % 7]) +
            (c.booked ? ' · booked' : '') + '</span>' +
        '</div>' +
        (f ? infoButton('class', f.id, f.name) : '') +
      '</div>' +
      '<div class="day-class-acts">' +
        btn({ label: c.booked ? 'Booked ✓' : 'I booked it',
              action: 'toggle-booked', variant: c.booked ? 'ghost' : 'primary', size: 'md',
              data: { id: c.id, date: iso } }) +
        btn({ label: c.date ? 'Remove' : 'Skip this week', action: 'skip-occurrence',
              variant: 'ghost', size: 'md', data: { id: c.id, date: iso } }) +
      '</div>'
    );
  }).join('');

  const body =
    (on.length
      ? rows
      : '<p class="lede">Nothing booked this day.</p>') +
    (iso >= todayISO
      ? btn({ label: 'Add a class this day', action: 'add-on-date', variant: on.length ? 'ghost' : 'primary',
              size: 'lg', full: true, data: { date: iso, dow: String(dow) } })
      : '<p class="muted">This day has already passed.</p>');

  sheet(pretty, body, {
    actions: {
      ...infoActions,
      async 'toggle-booked'(n) {
        const c = await DB.get('classes', n.dataset.id);
        if (!c) return;
        const dates = Array.isArray(c.bookedDates) ? c.bookedDates.slice() : [];
        const at = dates.indexOf(n.dataset.date);
        if (at >= 0) dates.splice(at, 1); else dates.push(n.dataset.date);
        await DB.put('classes', { ...c, bookedDates: dates });
        closeSheet();
        toast(at >= 0 ? 'Marked as not booked.' : 'Marked as booked. It will stop nagging you.', 'calm');
        return Router.refresh();
      },
      async 'skip-occurrence'(n) {
        const c = await DB.get('classes', n.dataset.id);
        if (!c) return;
        if (c.date) {
          // A one-off: there is nothing to skip, only to delete.
          await DB.del('classes', c.id);
          toast('Removed.', 'calm');
        } else {
          const skips = Array.isArray(c.skipDates) ? c.skipDates.slice() : [];
          if (!skips.includes(n.dataset.date)) skips.push(n.dataset.date);
          await DB.put('classes', { ...c, skipDates: skips });
          toast('Skipped just this week. The rest of your weeks are unchanged.', 'calm');
        }
        closeSheet();
        return Router.refresh();
      },
      'add-on-date'(n) {
        pickerDay = parseInt(n.dataset.dow, 10);
        pickerDate = n.dataset.date;          // one-off: bind the pick to this exact day
        openPicker();
      },
    },
  });
}

export const actions = {
  ...infoActions,

  'prev-week'() { weekOffset -= 1; return Router.refresh(); },
  'next-week'() { weekOffset += 1; return Router.refresh(); },

  'view-week'() { view = 'week'; return Router.refresh(); },
  'view-month'() { view = 'month'; monthAnchor = monthAnchor || DB.todayISO(); return Router.refresh(); },
  'prev-month'() { monthAnchor = shiftMonth(monthAnchor || DB.todayISO(), -1); return Router.refresh(); },
  'next-month'() { monthAnchor = shiftMonth(monthAnchor || DB.todayISO(), 1); return Router.refresh(); },
  'day-open'(node) { return openDaySheet(node.dataset.date); },

  async 'confirm-week'(node) {
    const list = (await DB.getPref('week:confirmed', [])) || [];
    if (!list.includes(node.dataset.week)) list.push(node.dataset.week);
    await DB.setPref('week:confirmed', list);
    toast('Good. That week is set.', 'calm');
    return Router.refresh();
  },

  async 'unconfirm-week'(node) {
    const list = ((await DB.getPref('week:confirmed', [])) || [])
      .filter((w) => w !== node.dataset.week);
    await DB.setPref('week:confirmed', list);
    return Router.refresh();
  },

  'add-class'() { pickerDate = null; openPicker(); },

  async 'edit-class'(node) {
    const c = await DB.get('classes', node.dataset.id);
    if (!c) return;
    draftClass = { id: c.id, formatId: c.formatId, dayOfWeek: c.dayOfWeek, time: c.time };
    openClassSheet();
  },

  async 'delete-class'(node) {
    const c = await DB.get('classes', node.dataset.id);
    const f = c ? classById(c.formatId) : null;
    const ok = await confirmDialog('Remove ' + (f ? f.name : 'this class') + ' from your week?', {
      confirmLabel: 'Remove', danger: true,
    });
    if (!ok) return;
    await DB.del('classes', node.dataset.id);
    return Router.refresh();
  },

  async 'apply-fix'(node) {
    let payload = {};
    try { payload = JSON.parse(node.dataset.payload || '{}'); } catch (_) { /* keep empty */ }
    if (payload.programDayKey && Number.isFinite(payload.toDayIndex)) {
      const overrides = (await DB.getPref('session:overrides', {})) || {};
      overrides[payload.programDayKey] = payload.toDayIndex;
      await DB.setPref('session:overrides', overrides);
      toast('Moved. Your week is clear.', 'calm');
    } else {
      toast('Nothing to move automatically — drag it yourself below.', 'accent');
    }
    return Router.refresh();
  },

  async 'dismiss-warn'(node) {
    const key = node.dataset.week + '|' + node.dataset.code;
    const list = (await DB.getPref('warn:dismissed', [])) || [];
    if (!list.includes(key)) list.push(key);
    await DB.setPref('warn:dismissed', list);
    return Router.refresh();
  },

  async 'day-menu'(node) {
    const profile = Store.get('profile');
    const dials = Store.get('dials');
    const today = DB.todayISO();
    const weekStart = shiftDays(mondayOf(today), weekOffset * 7);
    const classes = (await DB.getAll('classes')) || [];
    const week = buildWeek(profile, classesForWeek(classes, weekStart), dials, weekStart);
    const day = week[parseInt(node.dataset.index, 10)];
    if (!day) return;

    const body =
      (day.session
        ? '<p class="lede">' + esc(day.session.name) + ' at ' + clockLabel(day.session.startTime) + '</p>'
        : '<p class="lede">Rest day.</p>') +
      (day.className ? '<p class="muted">' + esc(day.className) + ' at ' + clockLabel(day.classStart) + '</p>' : '') +
      (day.date === today && day.session
        ? btn({ label: 'Start this session', action: 'start-today', variant: 'primary', size: 'lg', full: true })
        : '') +
      btn({ label: 'Add a class this day', action: 'add-class-here', variant: 'ghost', size: 'md',
            full: true, data: { dow: String(day.dayOfWeek) } });

    sheet(day.dayName, body, {
      actions: {
        'start-today'() { closeSheet(); Router.go('train'); },
        'add-class-here'(n) {
          // Jump straight to that day in the real schedule rather than a blank form.
          pickerDay = parseInt(n.dataset.dow, 10);
          openPicker();
        },
      },
    });
  },
};
