// Daybreak — js/features/today.js — the 5:25 AM screen. One question: what am I doing right now?

import { DB } from '../core/db.js';
import { Store, currentProgramWeek } from '../core/store.js';
import { Router } from '../core/router.js';
import { buildWeek } from '../engine/scheduler.js';
import { weeklyShapeMap } from '../engine/shapemap.js';
import { readinessScore, readinessAdvice } from '../engine/readiness.js';
import { planFor } from '../engine/sessionplan.js';
import { STAGE_RATIONALE } from '../engine/lifestage.js';
import { classById } from '../data/classes.js';
import { weeklyPillars } from '../data/pillars.js';
import { byId } from '../data/exercises.js';
import { recommendations } from '../engine/recommend.js';
import { infoActions } from '../ui/infosheet.js';
import { card, btn, toast, fmt } from '../ui/components.js';

export const id = 'today';
export const title = 'Today';

// Readiness answers live here until the session starts, then move onto the session record.
let pendingReadiness = null;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function mondayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const shift = (dt.getDay() + 6) % 7;          // Monday = 0
  dt.setDate(dt.getDate() - shift);
  return DB.todayISO(dt);
}

function greeting(name) {
  const hour = new Date().getHours();
  const part = hour < 11 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  return name ? `${part}, ${name}.` : `${part}.`;
}

function longDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function clockLabel(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`;
}

function endTime(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + (minutes || 0);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- hero card

function heroCard(profile, day, plan, hasOpenSession) {
  if (hasOpenSession) {
    return card({
      tone: 'accent',
      title: 'Session in progress',
      subtitle: plan && plan.name ? plan.name : '',
      body: '<p class="lede">You left one open. Pick up where you stopped.</p>',
      footer: btn({ label: 'Resume session', action: 'go-train', variant: 'primary', size: 'lg', full: true }),
    });
  }

  if (day && day.className && !day.session) {
    // A class today with no lift block. Still a training day — say so.
    return card({
      tone: 'accent',
      title: day.className,
      subtitle: clockLabel(day.classStart) + ' · class',
      body:
        '<p class="lede">No lift scheduled today — the class is the session.</p>' +
        '<p class="muted">Log it when you are done so it counts toward your week.</p>',
      footer:
        btn({ label: 'I went', action: 'log-class', variant: 'primary', size: 'lg', full: true,
              data: { classid: day.classId || '', name: day.className } }) +
        btn({ label: 'Lift instead', action: 'go-train', variant: 'ghost', size: 'md', full: true }),
    });
  }

  if (!day || !day.session) {
    return card({
      tone: 'calm',
      title: 'Rest day',
      body:
        '<p class="lede">Nothing scheduled, and that is the point. Muscle is built between ' +
        'sessions, not during them — this is when the work from yesterday actually lands.</p>' +
        '<p class="muted">A 30–45 minute walk today will help you more than another workout would.</p>',
      footer:
        btn({ label: 'Log a walk', action: 'log-walk', variant: 'ghost', size: 'lg', full: true }) +
        btn({ label: 'Train anyway', action: 'go-train', variant: 'ghost', size: 'md', full: true }),
    });
  }

  const s = day.session;
  const isStack = day.dayType === 'stack' && day.className;
  const count = plan ? plan.items.length : 0;

  let sequence = '';
  if (isStack) {
    const liftEnd = endTime(s.startTime, s.estMinutes);
    sequence =
      '<div class="stack-strip">' +
        '<div class="stack-leg"><span class="stack-time">' + clockLabel(s.startTime) + '–' +
          clockLabel(liftEnd) + '</span><span class="stack-what">' + esc(s.name) + '</span></div>' +
        '<div class="stack-arrow" aria-hidden="true">→</div>' +
        '<div class="stack-leg"><span class="stack-time">' + clockLabel(day.classStart) + '</span>' +
          '<span class="stack-what">' + esc(day.className) + '</span></div>' +
      '</div>' +
      '<p class="muted">Lift first, class after. That order is deliberate — doing it the other ' +
      'way leaves your strength work with nothing in the tank.</p>';
  }

  const meta = [
    count ? count + ' exercise' + (count === 1 ? '' : 's') : null,
    s.estMinutes ? '~' + s.estMinutes + ' min' : null,
    s.blockSize === 'short' ? 'Short block' : null,
  ].filter(Boolean).join(' · ');

  return card({
    tone: 'accent',
    title: s.name,
    subtitle: clockLabel(s.startTime) + (meta ? ' · ' + meta : ''),
    body:
      sequence +
      (s.note ? '<p class="lede">' + esc(s.note) + '</p>' : '') +
      (!isStack && !s.note ? '<p class="lede">Doors open at ' + clockLabel(s.startTime) + '.</p>' : ''),
    footer: btn({
      label: s.type === 'conditioning' || s.type === 'recovery' ? 'Start session' : 'Start warm-up',
      action: 'go-train', variant: 'primary', size: 'lg', full: true,
    }),
  });
}

// ------------------------------------------------------------ readiness rows

function scaleRow(key, label, lowLabel, highLabel, value) {
  let buttons = '';
  for (let n = 1; n <= 5; n++) {
    buttons +=
      '<button type="button" class="scale-dot' + (value === n ? ' is-selected' : '') + '" ' +
      'data-action="readiness" data-key="' + key + '" data-value="' + n + '" ' +
      'aria-label="' + esc(label) + ' ' + n + ' of 5"' + (value === n ? ' aria-pressed="true"' : '') + '>' +
      n + '</button>';
  }
  return (
    '<div class="scale-row">' +
      '<div class="scale-head"><span class="scale-label">' + esc(label) + '</span></div>' +
      '<div class="scale-dots">' + buttons + '</div>' +
      '<div class="scale-ends"><span>' + esc(lowLabel) + '</span><span>' + esc(highLabel) + '</span></div>' +
    '</div>'
  );
}

function readinessCard() {
  const r = pendingReadiness;
  const complete = r && r.sleep && r.energy && r.soreness;

  let body =
    scaleRow('sleep', 'Sleep', 'Rough', 'Great', r && r.sleep) +
    scaleRow('energy', 'Energy', 'Flat', 'Sharp', r && r.energy) +
    scaleRow('soreness', 'Soreness', 'None', 'Very sore', r && r.soreness);

  let footer = '';
  if (complete) {
    const advice = readinessAdvice(readinessScore(r));
    body += '<p class="readiness-verdict tone-' +
      (advice.band === 'good' ? 'calm' : advice.band === 'fair' ? 'accent' : 'signal') + '">' +
      esc(advice.message) + '</p>';
    footer = '<button type="button" class="link-quiet" data-action="readiness-clear">Change that</button>';
  }

  return card({
    title: 'How did you sleep?',
    subtitle: 'Three taps. It sets today’s loads.',
    body,
    footer,
    class: 'readiness-card',
  });
}

// ------------------------------------------------------------------- strips

function weekStrip(week, shape) {
  const planned = week.filter((d) => d.session && d.session.type !== 'recovery').length;
  const done = week.filter((d) => d.done).length;

  const behind = (shape.shortfalls || [])
    .slice()
    .sort((a, b) => b.short - a.short)
    .slice(0, 2);

  const chips = behind.length
    ? behind.map((s) => '<span class="chip chip-quiet">' + esc(s.label) + ' −' + fmt.num(s.short) + '</span>').join('')
    : '<span class="chip chip-quiet">On target across the board</span>';

  return card({
    title: 'This week',
    body:
      '<div class="row row-between">' +
        '<div class="stat"><span class="stat-label">Sessions</span>' +
          '<span class="stat-value num">' + done + '<span class="stat-of"> / ' + planned + '</span></span></div>' +
        '<div class="stat"><span class="stat-label">Sets logged</span>' +
          '<span class="stat-value num">' + fmt.num(shape.totalSets) + '</span></div>' +
        '<div class="stat"><span class="stat-label">On target</span>' +
          '<span class="stat-value num">' + shape.primaryOnTarget + '<span class="stat-of"> / ' +
          shape.primaryCount + '</span></span></div>' +
      '</div>' +
      '<div class="chip-row">' + chips + '</div>',
    footer: btn({ label: 'See the Shape Map', action: 'go-shape', variant: 'ghost', size: 'md', full: true }),
  });
}

function proteinCard(profile, hit) {
  if (!profile.proteinTargetG) {
    return card({
      title: 'Protein',
      body:
        '<p class="lede">Add your weight and I’ll set a target. It is the single biggest ' +
        'nutrition lever you have — more than anything else you could change.</p>',
      footer: btn({ label: 'Add my weight', action: 'go-me', variant: 'ghost', size: 'md', full: true }),
    });
  }

  const answered = hit === true || hit === false;
  return card({
    title: 'Protein',
    subtitle: profile.proteinTargetG + ' g today',
    body: answered
      ? '<p class="lede">' + (hit
          ? 'Logged — that is the one that matters.'
          : 'Noted. Tomorrow: 30 g at breakfast makes the rest of the day easy.') + '</p>'
      : '<p class="muted">Spread it across the day — about 30–40 g a meal. Getting some in ' +
        'after you train matters most.</p>',
    footer: answered
      ? '<button type="button" class="link-quiet" data-action="protein-clear">Change that</button>'
      : '<div class="btn-pair">' +
          btn({ label: 'Hit it', action: 'protein-yes', variant: 'primary', size: 'md', full: true }) +
          btn({ label: 'Missed it', action: 'protein-no', variant: 'ghost', size: 'md', full: true }) +
        '</div>',
  });
}

function noteCard(profile, day, plan, dials) {
  const notes = [];

  const rationale = STAGE_RATIONALE && STAGE_RATIONALE[profile.lifeStage];
  if (rationale) notes.push(rationale);

  if (plan && plan.items.length) {
    const lead = plan.items.find((i) => i.tier === 1) || plan.items[0];
    const breath = (lead.exercise.cues || []).find((c) => /exhale|breath/i.test(c));
    if (breath) notes.push(lead.exercise.name + ': ' + breath);
  }

  const pw = currentProgramWeek(profile);
  if (dials && dials.deloadEveryWeeks && pw) {
    const left = dials.deloadEveryWeeks - (pw % dials.deloadEveryWeeks || dials.deloadEveryWeeks);
    if (left === 0) notes.push('This is a deload week. Same movements, about 60% of the load. It is part of the plan, not a break from it.');
    else if (left === 1) notes.push('Deload week starts next week. Push a little now.');
  }

  if (!day || !day.session) {
    notes.push('Rest is not the absence of training. It is when the adaptation actually happens.');
  }

  if (!notes.length) return '';

  // Rotate by day-of-year so it changes without being random.
  const seed = Math.floor(Date.now() / 86400000);
  const note = notes[seed % notes.length];

  return '<div class="note-strip"><span class="note-mark" aria-hidden="true"></span><p>' + esc(note) + '</p></div>';
}

// -------------------------------------------------------------------- render

export async function render(el) {
  const profile = Store.get('profile') || await DB.getProfile();
  const dials = Store.get('dials');
  const today = DB.todayISO();

  if (!profile || !profile.name) { el.innerHTML = ''; return; }

  const weekStart = mondayOf(today);
  const classes = await DB.getAll('classes');
  const week = buildWeek(profile, classes || [], dials, weekStart);

  const weekEnd = week[6].date;
  const sessions = await DB.getSessionsInRange(weekStart, weekEnd);
  const completed = (sessions || []).filter((s) => s.complete);
  for (const d of week) d.done = completed.some((s) => s.date === d.date);

  const allSets = [];
  for (const s of sessions || []) {
    const rows = await DB.getSessionSets(s.id);
    for (const r of rows) allSets.push(r);
  }
  const shape = weeklyShapeMap(sessions || [], allSets, classes || [], dials);
  const pill = weeklyPillars(completed, allSets, byId, classById, dials);

  // One nudge only. The full list lives on Shape — Today stays about today.
  const recs = recommendations({
    profile, dials, week, pillars: pill, shape,
    classes: classes || [], sessions: sessions || [],
  });
  const topRec = recs.find((r) => r.kind !== 'good') || null;

  const day = week.find((d) => d.date === today) || null;
  const plan = day && day.session ? planFor(profile, day.session) : null;

  const open = Store.get('activeSession');
  const hasOpen = !!(open && !open.complete);

  const proteinHit = await DB.getPref('protein:' + today, null);

  el.innerHTML =
    '<div class="today">' +
      '<header class="today-head">' +
        '<h1 class="today-greeting display">' + esc(greeting(profile.name)) + '</h1>' +
        '<p class="today-date">' + esc(longDate(today)) + '</p>' +
      '</header>' +
      heroCard(profile, day, plan, hasOpen) +
      (day && day.session && !hasOpen ? readinessCard() : '') +
      noteCard(profile, day, plan, dials) +
      weekStrip(week, shape) +
      (topRec
        ? card({
            tone: 'brand',
            title: topRec.title,
            body:
              '<p class="lede">' + esc(topRec.body) + '</p>' +
              (topRec.suggestion ? '<p class="rec-suggestion">' + esc(topRec.suggestion) + '</p>' : ''),
            footer: btn({
              label: topRec.action === 'add-suggested-class' ? 'Add it' : 'Show me',
              action: topRec.action === 'add-suggested-class' ? 'add-suggested-class' : 'go-shape',
              variant: 'ghost', size: 'md', full: true, data: topRec.data || {},
            }),
          })
        : '') +
      proteinCard(profile, proteinHit) +
    '</div>';
}

// ------------------------------------------------------------------- actions

export const actions = {
  ...infoActions,

  'go-train': () => Router.go('train'),
  'go-shape': () => Router.go('shape'),
  'go-me': () => Router.go('me'),
  'go-week': () => Router.go('week'),

  readiness(node, data) {
    const key = data.key;
    const value = parseInt(data.value, 10);
    if (!key || !Number.isFinite(value)) return;
    pendingReadiness = { ...(pendingReadiness || {}), [key]: value };
    Store.set('pendingReadiness', pendingReadiness);
    return Router.refresh();
  },

  'readiness-clear'() {
    pendingReadiness = null;
    Store.set('pendingReadiness', null);
    return Router.refresh();
  },

  async 'protein-yes'() {
    await DB.setPref('protein:' + DB.todayISO(), true);
    toast('Logged.', 'calm');
    return Router.refresh();
  },

  async 'protein-no'() {
    await DB.setPref('protein:' + DB.todayISO(), false);
    return Router.refresh();
  },

  async 'protein-clear'() {
    await DB.setPref('protein:' + DB.todayISO(), null);
    return Router.refresh();
  },

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

  async 'log-class'(node, data) {
    const today = DB.todayISO();
    const now = new Date().toISOString();
    const cls = data.classid ? await DB.get('classes', data.classid) : null;
    await DB.put('sessions', {
      id: DB.uid(), date: today, startedAt: now, endedAt: now,
      type: 'class', name: data.name || 'Class',
      programDayKey: null, blockSize: 'full',
      classId: data.classid || null,
      classFormatId: cls ? cls.formatId : null,
      readiness: null, notes: '', complete: true,
    });
    toast('Logged. That counts toward your week.', 'calm');
    return Router.refresh();
  },

  async 'log-walk'() {
    const today = DB.todayISO();
    const session = {
      id: DB.uid(),
      date: today,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      type: 'recovery',
      programDayKey: null,
      blockSize: 'full',
      classId: null,
      readiness: null,
      notes: 'Walk',
      complete: true,
    };
    await DB.put('sessions', session);
    toast('Walk logged. That counts.', 'calm');
    return Router.refresh();
  },
};

/** Readiness collected on Today, handed to Train when the session starts. */
export function takeReadiness() {
  const r = pendingReadiness;
  pendingReadiness = null;
  return r && r.sleep && r.energy && r.soreness ? r : null;
}
