// Daybreak — js/data/schedule.js — turning stored classes into dated occurrences.
//
// Why this module exists.
//
// A class record has always been a WEEKLY RECURRENCE: {formatId, dayOfWeek, time}. No date.
// That is right for "I do Cycle every Friday", and it is why the Week screen showed an
// identical week however far forward you paged — Rocio described it exactly: "Week icon
// just copies". It also made "pick weeks in advance" impossible to express, because there
// was nowhere to say WHICH week.
//
// So a record may now also carry:
//   date        'YYYY-MM-DD'  this is a one-off on that date and no other
//   skipDates   ['YYYY-MM-DD']  on a recurring class: weeks she is not going
//   bookedDates ['YYYY-MM-DD']  occurrences she has signed up for on Bay Club Connect
//
// All three are optional and absent on every existing record, so nothing already saved
// changes behaviour. IndexedDB stores are schemaless per record, so no version bump.
//
// The scheduler stays date-blind on purpose: buildWeek() takes a flat class list and maps
// it by dayOfWeek. Callers hand it classesForWeek(...) instead of the raw list, and it
// keeps working unchanged.

/** Local calendar date as YYYY-MM-DD. Never UTC — a 5am user must not slip a day. */
export function isoOf(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parse YYYY-MM-DD as a LOCAL date. new Date('2026-09-13') would be UTC midnight. */
export function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

/** The Monday on or before this date. The app's weeks run Monday to Sunday. */
export function mondayOf(iso) {
  const d = parseISO(iso);
  if (!d) return iso;
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoOf(d);
}

export function dayOfWeekOf(iso) {
  const d = parseISO(iso);
  return d ? d.getDay() : null;
}

/** Whole days from a to b. Both are local dates, so DST cannot shift the answer. */
export function daysBetween(aISO, bISO) {
  const a = parseISO(aISO);
  const b = parseISO(bISO);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
}

function list(v) {
  return Array.isArray(v) ? v : [];
}

/** Does this stored class happen on this date? */
export function occursOn(cls, iso) {
  if (!cls || cls.active === false) return false;
  if (cls.date) return cls.date === iso;
  if (dayOfWeekOf(iso) !== Number(cls.dayOfWeek)) return false;
  return !list(cls.skipDates).includes(iso);
}

/** Has she told us she booked this occurrence on Bay Club Connect? */
export function isBooked(cls, iso) {
  return list(cls && cls.bookedDates).includes(iso);
}

/**
 * Every class occurring on one date, earliest first, each tagged with the date it falls on.
 * The returned objects are shallow copies carrying `occurrenceDate` and `booked`, so a
 * caller can render and act on one occurrence without re-deriving it.
 */
export function classesOnDate(classes, iso) {
  return (Array.isArray(classes) ? classes : [])
    .filter((c) => occursOn(c, iso))
    .map((c) => ({ ...c, occurrenceDate: iso, booked: isBooked(c, iso) }))
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
}

/**
 * The classes that apply to one Monday-start week, shaped the way buildWeek() expects.
 * Pass this to buildWeek() instead of the raw store, and a week three weeks out stops
 * being a copy of this one.
 */
export function classesForWeek(classes, weekStartISO) {
  const monday = mondayOf(weekStartISO);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(monday, i);
    for (const c of classesOnDate(classes, iso)) out.push(c);
  }
  return out;
}

/** Every occurrence between two dates inclusive, in date order. Drives the month grid. */
export function occurrencesInRange(classes, fromISO, toISO) {
  const span = daysBetween(fromISO, toISO);
  if (span < 0) return [];
  const out = [];
  for (let i = 0; i <= span; i++) {
    const iso = addDays(fromISO, i);
    for (const c of classesOnDate(classes, iso)) out.push(c);
  }
  return out;
}

/** date -> occurrences, for a month grid that has to answer "is this day shaded?" fast. */
export function occurrenceMap(classes, fromISO, toISO) {
  const map = new Map();
  for (const o of occurrencesInRange(classes, fromISO, toISO)) {
    if (!map.has(o.occurrenceDate)) map.set(o.occurrenceDate, []);
    map.get(o.occurrenceDate).push(o);
  }
  return map;
}

/**
 * Occurrences she should book NOW.
 *
 * Bay Club classes fill, so the useful nudge is not "you have a class today" — it is
 * "sign up for Saturday, today, before someone else does". Default window is the three
 * days she asked for, and today itself is excluded: booking a class that starts in four
 * hours is not what this is for.
 */
export function needsBooking(classes, todayISO, daysAhead = 3) {
  const from = addDays(todayISO, 1);
  const to = addDays(todayISO, Math.max(1, daysAhead));
  return occurrencesInRange(classes, from, to)
    .filter((o) => !o.booked)
    .sort((a, b) => (a.occurrenceDate + a.time).localeCompare(b.occurrenceDate + b.time));
}

/** All the grid cells for a month view: leading blanks, the days, trailing blanks. */
export function monthGrid(anchorISO) {
  const d = parseISO(anchorISO) || new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;            // Monday-first grid

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(isoOf(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);

  return {
    year,
    month,
    label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    cells,
  };
}

/** Shift a month anchor by n months, clamped to a date that exists in the target month. */
export function shiftMonth(anchorISO, n) {
  const d = parseISO(anchorISO) || new Date();
  return isoOf(new Date(d.getFullYear(), d.getMonth() + n, 1));
}
