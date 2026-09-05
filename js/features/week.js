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

export const id = 'week';
export const title = 'Week';

let weekOffset = 0;          // 0 = this week
let draftClass = null;

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

function warningStrip(w) {
  const fixBtn = w.fix && w.fix.action === 'move-session'
    ? btn({ label: 'Move it', action: 'apply-fix', size: 'md', variant: 'primary',
            data: { code: w.code, payload: JSON.stringify(w.fix.payload || {}) } })
    : '';
  return (
    '<div class="warn">' +
      '<span class="warn-icon" aria-hidden="true">!</span>' +
      '<div class="warn-body">' +
        '<p class="warn-text">' + esc(w.message) + '</p>' +
        '<div class="warn-actions">' + fixBtn +
          '<button type="button" class="link-quiet" data-action="dismiss-warn" ' +
            'data-code="' + esc(w.code) + '">Dismiss</button>' +
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
  const week = buildWeek(profile, classes, dials, weekStart);

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

      (conflicts.length ? '<div class="warn-stack">' + conflicts.map(warningStrip).join('') + '</div>' : '') +

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
    await DB.put('classes', {
      id: DB.uid(),
      formatId: formatid,
      dayOfWeek: parseInt(dow, 10),
      time,
      durationMin: f && f.durationMin ? f.durationMin : 50,
      active: true,
    });
    ctx.mine.add(formatid + '@' + dow + '@' + time);
    openPicker();                                   // keep the sheet open for a second pick
    toast((f ? f.name : 'Class') + ' added. Rebuilding your week around it.', 'calm');
    Router.refresh();
  },
  'add-custom'() {
    closeSheet();
    draftClass = { id: null, formatId: null, dayOfWeek: 2, time: '06:30' };
    openClassSheet();
  },
};

export const actions = {
  ...infoActions,

  'prev-week'() { weekOffset -= 1; return Router.refresh(); },
  'next-week'() { weekOffset += 1; return Router.refresh(); },

  'add-class'() { openPicker(); },

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
    const list = (await DB.getPref('warn:dismissed', [])) || [];
    if (!list.includes(node.dataset.code)) list.push(node.dataset.code);
    await DB.setPref('warn:dismissed', list);
    return Router.refresh();
  },

  async 'day-menu'(node) {
    const profile = Store.get('profile');
    const dials = Store.get('dials');
    const today = DB.todayISO();
    const weekStart = shiftDays(mondayOf(today), weekOffset * 7);
    const classes = (await DB.getAll('classes')) || [];
    const week = buildWeek(profile, classes, dials, weekStart);
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
