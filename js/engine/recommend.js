// Daybreak — js/engine/recommend.js — what should she actually do next.
//
// Three kinds of advice, in priority order:
//   1. Safety and structure  — something in the week is working against her
//   2. Pillar gaps           — a whole category of training is missing
//   3. Shape Map shortfalls  — a specific target is behind
//
// Every recommendation names a concrete action: a real class at a real time, or a specific
// movement. "Do more cardio" is not advice. "Masters Swim, Thursday 6:30 — it is the only hard
// cardio that will not cost you Friday's legs" is.

import { CLASS_SCHEDULE, classById, DAY_NAMES, liftWindowMinutes } from '../data/classes.js';
import { PILLARS, PILLAR_IDS } from '../data/pillars.js';
import { SHAPE_TARGETS, EXERCISES, byId } from '../data/exercises.js';

const CLUB_OPEN = { weekday: '05:30', weekend: '07:00' };

function openTimeFor(dayOfWeek) {
  return dayOfWeek === 0 || dayOfWeek === 6 ? CLUB_OPEN.weekend : CLUB_OPEN.weekday;
}

function clock(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`;
}

/**
 * Would adding this scheduled class collide with the lifting week she already has?
 * Returns null when it is safe, or a short reason when it is not.
 */
function collisionReason(slot, week) {
  const fmt = slot.format || classById(slot.formatId);
  if (!fmt) return 'unknown class';

  const day = (week || []).find((d) => d.dayOfWeek === slot.dayOfWeek);
  const nextDay = (week || []).find((d) => d.dayIndex === (day ? day.dayIndex + 1 : -99));

  // Same morning: does the class forbid what is already scheduled?
  if (day && day.session && Array.isArray(fmt.blocks) && fmt.blocks.includes(day.session.type)) {
    return `${fmt.name} does not sit well with ${day.session.name} the same morning`;
  }

  // Next morning: a heavy lower day after a leg-expensive class.
  const legCost = fmt.legFatigue === 'high' || fmt.legFatigue === 'very-high';
  if (legCost && nextDay && nextDay.session &&
      (nextDay.session.type === 'lower-heavy' || nextDay.session.type === 'lower')) {
    return `it would leave ${nextDay.session.name} flat the next morning`;
  }

  // Is there time to lift first, if she is meant to lift that day?
  if (day && day.session) {
    const window = liftWindowMinutes(slot.start, openTimeFor(slot.dayOfWeek));
    if (window < 25) {
      return `only ${window} minutes between the doors opening and the class — not enough to lift first`;
    }
  }
  return null;
}

/**
 * Rank every class on the real schedule for how much it would help her right now.
 * @returns {Array} sorted best-first, each {slot, format, score, reason, fits, warning}
 */
export function rankClasses({ week, pillars, shape, existingClassIds = [], dials }) {
  const taken = new Set(existingClassIds);
  const out = [];

  for (const slot of CLASS_SCHEDULE) {
    const fmt = classById(slot.formatId);
    if (!fmt) continue;

    const key = slot.formatId + '@' + slot.dayOfWeek + '@' + slot.start;
    if (taken.has(key)) continue;

    let score = 0;
    const reasons = [];

    // Someone new to lifting should not be steered into the two most expensive classes on
    // the schedule in her first month. They are good classes; they are a bad first class.
    const newLifter = dials && dials.experience === 'new';
    if (newLifter) {
      if (fmt.legFatigue === 'very-high') score -= 8;
      if (fmt.cnsCost === 'high') score -= 4;
      if (fmt.intensity === 'low' || fmt.legFatigue === 'low') score += 3;
    }

    // Does it fill a pillar gap?
    for (const id of PILLAR_IDS) {
      const p = pillars && pillars.pillars ? pillars.pillars[id] : null;
      if (!p || p.met) continue;
      const contribution = (fmt.pillars && fmt.pillars[id]) || 0;
      if (contribution > 0.4) {
        const deficit = 1 - Math.min(1, p.pct);
        score += contribution * deficit * 10;
        reasons.push(PILLARS[id].short.toLowerCase());
      }
    }

    // Does it close a Shape Map shortfall?
    for (const s of (shape && shape.shortfalls) || []) {
      const credit = (fmt.shapeContribution || {})[s.key] || 0;
      if (credit > 0 && (fmt.counts.resistance || 0) > 0) {
        score += credit * (fmt.counts.resistance || 0) * 2;
        if (!reasons.includes(s.label.toLowerCase())) reasons.push(s.label.toLowerCase());
      }
    }

    // Cheap wins: low leg cost means it fits anywhere.
    if (fmt.legFatigue === 'low') score += 1.5;
    if (fmt.intensity === 'low') score += 0.5;

    const warning = collisionReason({ ...slot, format: fmt }, week);
    if (warning) score -= 6;

    const window = liftWindowMinutes(slot.start, openTimeFor(slot.dayOfWeek));

    out.push({
      key,
      slot,
      format: fmt,
      dayOfWeek: slot.dayOfWeek,
      dayName: DAY_NAMES[slot.dayOfWeek],
      start: slot.start,
      startLabel: clock(slot.start),
      liftWindow: window,
      score: Math.round(score * 10) / 10,
      helps: reasons.slice(0, 3),
      warning,
      fits: !warning
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

/** A specific exercise that would close a Shape Map shortfall, preferring what she can do. */
function exerciseFor(targetKey, profile) {
  const beginner = profile && profile.experience === 'new';
  const candidates = EXERCISES.filter((e) =>
    (e.primary || []).includes(targetKey) &&
    (!beginner || e.beginner) &&
    !e.impact
  );
  if (!candidates.length) return null;
  candidates.sort((a, b) => (a.tier || 3) - (b.tier || 3));
  return candidates[0];
}

/**
 * The full recommendation set for the week.
 * @returns {Array} [{id, kind, priority, title, body, action, data}]
 */
export function recommendations({ profile, dials, week, pillars, shape, classes = [], sessions = [], todayISO }) {
  const recs = [];
  const existing = (classes || []).map((c) => c.formatId + '@' + c.dayOfWeek + '@' + c.time);
  const done = (sessions || []).filter((s) => s.complete);

  // How far through the week are we? Nagging about a gap on Monday morning, before she has
  // trained once, is how an app teaches someone to ignore it. Gaps only become real advice
  // once most of the week has actually happened.
  const dayIndex = (() => {
    if (!week || !week.length) return 0;
    const target = todayISO || new Date().toISOString().slice(0, 10);
    const i = week.findIndex((d) => d.date === target);
    return i >= 0 ? i : 6;                      // outside this week: treat as finished
  })();
  const plannedSoFar = (week || []).slice(0, dayIndex + 1)
    .filter((d) => d.session && d.session.type !== 'recovery').length;
  const weekMatured = dayIndex >= 4 || (plannedSoFar > 0 && done.length >= plannedSoFar);

  /* ---- 1. Structure and safety ------------------------------------------ */

  const warnings = [];
  for (const d of week || []) for (const w of d.warnings || []) warnings.push({ ...w, day: d });
  for (const w of warnings.slice(0, 2)) {
    recs.push({
      id: 'warn-' + w.code,
      kind: 'structure',
      priority: 1,
      title: 'Your week is working against itself',
      body: w.message,
      action: 'go-week',
      data: {}
    });
  }

  const doneCount = done.length;
  const heavyPlanned = (week || []).filter((d) => d.session &&
    ['lower', 'lower-heavy', 'upper', 'glute', 'full'].includes(d.session.type)).length;
  if (dials && heavyPlanned < dials.heavyDaysPerWeek) {
    recs.push({
      id: 'too-few-lifts',
      kind: 'structure',
      priority: 1,
      title: `Only ${heavyPlanned} lifting ${heavyPlanned === 1 ? 'day' : 'days'} this week`,
      body: `At your stage the target is ${dials.heavyDaysPerWeek}. Muscle and bone respond to how ` +
            `often you load them, and this is the number that does the most work in the whole plan.`,
      action: 'go-week',
      data: {}
    });
  }

  /* ---- 2. Pillar gaps ---------------------------------------------------- */

  const ranked = rankClasses({ week, pillars, shape, existingClassIds: existing, dials });

  // No classes at all is a planning gap, not a performance gap — say so at any point in the
  // week, and lead with something that will not wreck her legs.
  if (!classes.length) {
    const starters = starterClasses(dials).filter((s) => s.liftWindow >= 25);
    const pick = starters[0];
    recs.push({
      id: 'no-classes',
      kind: 'planning',
      priority: 2,
      title: 'You have no classes in your week yet',
      body: 'Classes are the cheapest way to cover cardio and control — the two pillars ' +
            'that lifting alone will not fill. Add the ones you actually go to and I will build ' +
            'your lifting around them so the two never fight.',
      suggestion: pick
        ? `Start with ${pick.format.name}, ${pick.dayName} ${pick.startLabel} — it costs your ` +
          `legs almost nothing, and you would still have ${pick.liftWindow} minutes to lift first.`
        : null,
      action: pick ? 'add-suggested-class' : 'go-week',
      data: pick ? { formatid: pick.slot.formatId, dow: String(pick.slot.dayOfWeek), time: pick.slot.start } : {}
    });
  }

  if (weekMatured && pillars && pillars.weakest) {
    const p = pillars.pillars[pillars.weakest];
    const pick = ranked.find((r) => r.fits && (r.format.pillars || {})[pillars.weakest] >= 0.6);

    recs.push({
      id: 'pillar-' + p.id,
      kind: 'pillar',
      priority: 2,
      pillar: p.id,
      title: p.name + ' is the gap',
      body: PILLARS[p.id].why,
      suggestion: pick
        ? `${pick.format.name}, ${pick.dayName} ${pick.startLabel}` +
          (pick.liftWindow >= 25 ? ` — and you would still have ${pick.liftWindow} minutes to lift first.` : '.')
        : null,
      action: pick ? 'add-suggested-class' : 'go-week',
      data: pick ? { formatid: pick.slot.formatId, dow: String(pick.dayOfWeek), time: pick.slot.start } : {}
    });
  }

  /* ---- 3. Shape Map shortfalls ------------------------------------------ */

  const worst = weekMatured
    ? ((shape && shape.shortfalls) || []).slice().sort((a, b) => b.short - a.short)[0]
    : null;
  if (worst) {
    const ex = exerciseFor(worst.key, profile);
    const cls = ranked.find((r) => r.fits && ((r.format.shapeContribution || {})[worst.key] || 0) > 0);
    recs.push({
      id: 'shape-' + worst.key,
      kind: 'shape',
      priority: 3,
      target: worst.key,
      title: worst.label + ' is behind',
      body: (SHAPE_TARGETS[worst.key] ? '' : '') +
        `${worst.short} sets short this week. ` +
        (ex ? `Two extra sets of ${ex.name} covers it.` : 'Add a couple of sets next time it comes round.'),
      suggestion: cls ? `${cls.format.name} on ${cls.dayName} would also help.` : null,
      action: cls ? 'add-suggested-class' : 'go-shape',
      data: cls ? { formatid: cls.slot.formatId, dow: String(cls.dayOfWeek), time: cls.slot.start } : {}
    });
  }

  /* ---- 4. The good news -------------------------------------------------- */

  if (!recs.length) {
    recs.push({
      id: 'all-good',
      kind: 'good',
      priority: 9,
      title: weekMatured ? 'Nothing to fix' : 'Your week is well built',
      body: weekMatured
        ? 'All four pillars on target and the week hangs together. Keep it exactly here — ' +
          'consistency at this level beats any clever change you could make.'
        : 'Nothing to change yet. Train what is scheduled and I will tell you at the end of ' +
          'the week if anything came up short.',
      action: null,
      data: {}
    });
  }

  return recs.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

/** The best few classes to offer when she has none at all — the cold-start menu. */
export function starterClasses(dials) {
  // Someone new to lifting wants: one cheap conditioning hit, one control session, and one
  // that costs her legs nothing. Not three hard interval classes.
  const wanted = ['hiit-express', 'mat-pilates', 'masters-swim', 'core-and-more', 'stretch-mobility'];
  const out = [];
  for (const id of wanted) {
    const slot = CLASS_SCHEDULE.find((s) => s.formatId === id);
    if (!slot) continue;
    const fmt = classById(id);
    out.push({
      slot, format: fmt,
      dayName: DAY_NAMES[slot.dayOfWeek],
      startLabel: clock(slot.start),
      liftWindow: liftWindowMinutes(slot.start, openTimeFor(slot.dayOfWeek))
    });
  }
  return out;
}
