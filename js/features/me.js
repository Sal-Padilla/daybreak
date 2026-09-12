// Daybreak — js/features/me.js — profile, program, privacy, backup, and the safety boundary.

import { DB } from '../core/db.js';
import { Store, currentProgramWeek } from '../core/store.js';
import { Router } from '../core/router.js';
import { LIFE_STAGES, STAGE_RATIONALE, dialsFor } from '../engine/lifestage.js';
import { PROGRAMS, programFor } from '../data/programs.js';
import { seedDemoData, clearDemoData, isDemoData } from '../dev/seed.js';
import { showInstallHelp } from './install.js';
import { card, btn, sheet, closeSheet, toast, confirmDialog, fmt } from '../ui/components.js';

export const id = 'me';
export const title = 'Me';

const VERSION = '0.8.0';

const STAGE_LABEL = {
  cycling: 'Regular cycles',
  transition: 'Perimenopause',
  post: 'Post-menopause',
};

const EXPERIENCE_LABEL = {
  new: 'New to lifting',
  returning: 'Coming back after a break',
  experienced: 'Already lifting',
};

const GOAL_LABEL = {
  'fat-loss': 'Lose fat',
  shape: 'Build shape',
  strong: 'Get strong',
  recomp: 'All three',
};

const LEAK_LABEL = {
  never: 'Never', sometimes: 'Sometimes', often: 'Often',
  'prefer-not': 'Not answered', unknown: 'Not answered',
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function row(label, value, action, data) {
  const tag = action ? 'button' : 'div';
  const attrs = action
    ? ' type="button" class="list-item is-tappable" data-action="' + action + '"' +
      (data ? Object.entries(data).map(([k, v]) => ' data-' + k + '="' + esc(v) + '"').join('') : '')
    : ' class="list-item"';
  return '<' + tag + attrs + '>' +
    '<span class="list-label">' + esc(label) + '</span>' +
    '<span class="list-value">' + esc(value) + '</span>' +
    (action ? '<span class="list-chevron" aria-hidden="true">›</span>' : '') +
  '</' + tag + '>';
}

function heightLabel(inches) {
  if (!inches) return 'Not set';
  return Math.floor(inches / 12) + '′ ' + Math.round(inches % 12) + '″';
}

// -------------------------------------------------------------------- render

export async function render(el) {
  const profile = Store.get('profile') || await DB.getProfile();
  const dials = Store.get('dials') || dialsFor(profile);
  if (!profile || !profile.name) { el.innerHTML = ''; return; }

  const program = PROGRAMS[profile.programId] || programFor(profile);
  const theme = (await DB.getPref('theme', 'auto')) || 'auto';
  const restDefault = (await DB.getPref('rest:default', 90)) || 90;
  const lastBackup = await DB.getPref('backup:at', null);
  const demo = await isDemoData();

  const backupDays = lastBackup
    ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000)
    : null;
  const backupOverdue = backupDays === null || backupDays >= 14;

  const kg = profile.weightLb ? profile.weightLb / 2.2046 : null;

  el.innerHTML =
    '<div class="me">' +
      '<header class="page-head">' +
        '<h1 class="display">' + esc(profile.name) + '</h1>' +
        '<p class="page-sub">Since ' + esc(profile.startedOn || '—') + '</p>' +
      '</header>' +

      card({
        title: 'You',
        body: '<div class="list">' +
          row('Life stage', STAGE_LABEL[profile.lifeStage] || profile.lifeStage, 'edit-stage') +
          row('Experience', EXPERIENCE_LABEL[profile.experience] || profile.experience, 'edit-experience') +
          row('Goal', GOAL_LABEL[profile.goal] || profile.goal, 'edit-goal') +
          row('Height', heightLabel(profile.heightIn), 'edit-body') +
          row('Weight', profile.weightLb ? fmt.lb(profile.weightLb) : 'Not set', 'edit-body') +
        '</div>' +
        (STAGE_RATIONALE && STAGE_RATIONALE[profile.lifeStage]
          ? '<p class="rationale">' + esc(STAGE_RATIONALE[profile.lifeStage]) + '</p>' : ''),
      }) +

      card({
        title: 'Training',
        subtitle: program ? program.name : '',
        body:
          (program && program.description ? '<p class="lede">' + esc(program.description) + '</p>' : '') +
          '<div class="list">' +
            // "of N" only makes sense for a programme that ends. The On-Ramp graduates after
            // four weeks; the ongoing programme's `weeks` is its deload cycle, not a finish line,
            // so "Week 14 of 6" would be nonsense.
            row('Week', (() => {
              const pw = currentProgramWeek(profile);
              const finite = program && program.graduatesTo && program.weeks;
              return finite ? Math.min(pw, program.weeks) + ' of ' + program.weeks : String(pw);
            })()) +
            row('Heavy days a week', String(dials.heavyDaysPerWeek)) +
            row('Working effort', 'Leave ' + dials.rirTarget[0] + '–' + dials.rirTarget[1] + ' reps in the tank') +
            row('Sets per primary target', String(dials.weeklySetsPerPrimary) + ' a week') +
            row('Warm-up', dials.warmupMinutes + ' min') +
            row('Rest timer', restDefault + ' sec', 'edit-rest') +
          '</div>',
      }) +

      card({
        title: 'Protein',
        subtitle: profile.proteinTargetG ? profile.proteinTargetG + ' g a day' : 'Add your weight to set a target',
        body: profile.proteinTargetG
          ? '<p class="muted">' + fmt.num(Math.round(kg)) + ' kg × ' + dials.proteinGPerKg +
            ' g/kg. Higher than the standard advice on purpose — muscle gets harder to hold onto ' +
            'through this stage, and protein is the lever that works.</p>' +
            '<p class="muted">Aim for about 30–40 g a meal. Under roughly 30 g at once, the ' +
            'muscle-building response barely fires.</p>'
          : '<p class="muted">Log your weight and I will work it out.</p>',
        footer: btn({ label: 'Update weight', action: 'edit-body', variant: 'ghost', size: 'md', full: true }),
      }) +

      card({
        title: 'Classes',
        body: '<p class="muted">Your Bay Club classes shape the whole week — I build your lifting ' +
          'around them so they do not fight each other.</p>',
        footer: btn({ label: 'Manage classes', action: 'go-week', variant: 'ghost', size: 'md', full: true }),
      }) +

      card({
        title: 'Pelvic floor',
        subtitle: LEAK_LABEL[profile.pelvicFloor] || 'Not answered',
        body:
          '<p class="muted">Roughly four in ten women who lift report leaking, and squats are the ' +
          'most common trigger. It is not a reason to stop lifting — it is a muscle group that ' +
          'trains like any other, and a pelvic floor physical therapist can usually sort it out.</p>' +
          (profile.pelvicFloor === 'sometimes' || profile.pelvicFloor === 'often'
            ? '<p class="lede">I am keeping impact work lower and cueing you to exhale through ' +
              'the hard part of every heavy set.</p>' : ''),
        footer: btn({ label: 'Change this', action: 'edit-leak', variant: 'ghost', size: 'md', full: true }),
      }) +

      card({
        tone: backupOverdue ? 'signal' : undefined,
        title: 'Your data',
        body:
          '<p class="muted">Everything lives on this phone. No account, no server, nothing ' +
          'uploaded — not your measurements, not your photos, not your answers.</p>' +
          '<p class="' + (backupOverdue ? 'lede' : 'muted') + '">' +
            (lastBackup
              ? 'Last backed up ' + backupDays + ' day' + (backupDays === 1 ? '' : 's') + ' ago.' +
                (backupOverdue ? ' Worth doing another — phones lose data.' : '')
              : 'Never backed up. Phone browsers do quietly clear storage, so export a copy now and then.') +
          '</p>',
        footer:
          btn({ label: 'Export a backup', action: 'export', variant: backupOverdue ? 'primary' : 'ghost',
                size: 'lg', full: true }) +
          '<label class="btn btn-ghost btn-md btn-full photo-add">' +
            '<span>Restore from a backup</span>' +
            '<input type="file" accept="application/json,.json" data-action="import" hidden>' +
          '</label>',
      }) +

      card({
        title: 'Appearance',
        body: '<div class="segmented">' +
          ['auto', 'light', 'dark'].map((t) =>
            '<button type="button" class="segmented-option' + (theme === t ? ' is-selected' : '') + '" ' +
              'data-action="set-theme" data-theme="' + t + '">' +
              t.charAt(0).toUpperCase() + t.slice(1) + '</button>').join('') +
        '</div>',
      }) +

      card({
        tone: demo ? 'brand' : undefined,
        title: 'Demo data',
        subtitle: demo ? 'This device is showing generated history' : 'Fourteen weeks of invented training',
        body: demo
          ? '<p class="lede">Everything you are looking at was generated, not trained. It exists ' +
            'so the app can be judged with data in it — progression, personal bests, trend lines ' +
            'and the weekly report only appear once there is a past behind them.</p>' +
            '<p class="muted">Clear it before real training starts, or the numbers will be nonsense.</p>'
          : '<p class="lede">Load fourteen weeks of invented training so you can see how the app ' +
            'behaves with history: strength trends, personal bests, the weekly report, and a ' +
            'waist-to-hip line that shows recomposition rather than weight loss.</p>' +
            '<p class="muted">It overwrites whatever is on this device.</p>',
        footer: demo
          ? btn({ label: 'Clear the demo data', action: 'clear-demo', variant: 'danger', size: 'lg', full: true })
          : btn({ label: 'Load 14 weeks of demo data', action: 'load-demo', variant: 'ghost', size: 'lg', full: true }),
      }) +

      card({
        title: 'On your home screen',
        body:
          '<p class="muted">Daybreak can sit on your home screen and open like any other app — ' +
          'full screen, no browser bar, and it still works with no signal.</p>',
        footer: btn({ label: 'How do I do that?', action: 'install-help', variant: 'ghost', size: 'md', full: true }),
      }) +

      card({
        title: 'About Daybreak',
        subtitle: 'Version ' + VERSION,
        body:
          '<p class="safety">Daybreak gives general fitness guidance. It is not medical advice and ' +
          'does not diagnose or treat anything. Talk to a clinician before you start — and again ' +
          'before the loads get heavy — if you have a heart condition, a joint injury, osteopenia ' +
          'or osteoporosis, high blood pressure, or you’re simply not sure. This app adds weight ' +
          'and adds impact on purpose, week after week, so "cleared to exercise" once is not the ' +
          'same as cleared for where this goes.</p>' +
          '<p class="safety">Stop and get seen if you get chest pain or pressure, feel faint or ' +
          'unusually short of breath, or pick up a joint pain that does not settle within a few ' +
          'days. If you leak urine when you lift, jump, cough or sneeze, that’s common and usually ' +
          'treatable — a pelvic floor physical therapist can help, and it is worth doing rather ' +
          'than working around.</p>' +
          '<p class="muted">Built around the evidence on training through perimenopause: heavier ' +
          'loads, more volume, impact work for bone, and enough protein to hold onto what you ' +
          'build. Every exercise carries an "i" that explains what it changes and why.</p>',
        footer: btn({ label: 'Start over', action: 'reset', variant: 'danger', size: 'md', full: true }),
      }) +
    '</div>';
}

// -------------------------------------------------------------- edit sheets

function pickerSheet(titleText, options, currentValue, onPick, note) {
  const body = options.map((o) =>
    '<button type="button" class="option-row' + (o.id === currentValue ? ' is-selected' : '') + '" ' +
      'data-action="pick" data-value="' + esc(o.id) + '">' +
      '<span class="option-row-main"><span class="option-row-label">' + esc(o.label) + '</span>' +
      (o.note ? '<span class="option-row-note">' + esc(o.note) + '</span>' : '') + '</span></button>'
  ).join('');

  sheet(titleText,
    (note ? '<p class="lede">' + esc(note) + '</p>' : '') +
    '<div class="option-list">' + body + '</div>',
    { actions: { async pick(node) { await onPick(node.dataset.value); closeSheet(); Router.refresh(); } } });
}

// ------------------------------------------------------------------- actions

export const actions = {
  'go-week': () => Router.go('week'),

  'edit-stage'() {
    const profile = Store.get('profile');
    pickerSheet('Life stage',
      LIFE_STAGES.map((s) => ({ id: s, label: STAGE_LABEL[s] || s, note: STAGE_RATIONALE && STAGE_RATIONALE[s] })),
      profile.lifeStage,
      async (v) => {
        await DB.saveProfile({ lifeStage: v });
        await Store.refreshProfile();
        toast('Updated. Your loads and volume just changed with it.', 'calm');
      },
      'This is asked by symptoms, not birthday — what your body is actually doing.');
  },

  'edit-experience'() {
    const profile = Store.get('profile');
    pickerSheet('Experience',
      Object.entries(EXPERIENCE_LABEL).map(([id, label]) => ({ id, label })),
      profile.experience,
      async (v) => {
        const next = { experience: v };
        const p = { ...profile, experience: v };
        const prog = programFor(p);
        if (prog) next.programId = prog.id;
        await DB.saveProfile(next);
        await Store.refreshProfile();
        toast('Program updated.', 'calm');
      });
  },

  'edit-goal'() {
    const profile = Store.get('profile');
    pickerSheet('Goal',
      Object.entries(GOAL_LABEL).map(([id, label]) => ({ id, label })),
      profile.goal,
      async (v) => { await DB.saveProfile({ goal: v }); await Store.refreshProfile(); });
  },

  'edit-leak'() {
    const profile = Store.get('profile');
    pickerSheet('Any leaking when you jump, cough, sneeze or lift heavy?',
      [
        { id: 'never', label: 'Never' },
        { id: 'sometimes', label: 'Sometimes' },
        { id: 'often', label: 'Often' },
        { id: 'prefer-not', label: 'I’d rather not say' },
      ],
      profile.pelvicFloor,
      async (v) => { await DB.saveProfile({ pelvicFloor: v }); await Store.refreshProfile(); },
      'Stays on this phone. It changes which exercises I put in front of you.');
  },

  'edit-body'() {
    const profile = Store.get('profile');
    const ft = profile.heightIn ? Math.floor(profile.heightIn / 12) : '';
    const inch = profile.heightIn ? Math.round(profile.heightIn % 12) : '';
    sheet('Height and weight',
      '<div class="sheet-fields">' +
        '<div class="field"><label class="field-label">Height</label><div class="row gap-2">' +
          '<input class="input num" id="p-ft" type="number" inputmode="numeric" placeholder="5" value="' + ft + '" aria-label="Feet">' +
          '<span class="ob-unit">ft</span>' +
          '<input class="input num" id="p-in" type="number" inputmode="numeric" placeholder="6" value="' + inch + '" aria-label="Inches">' +
          '<span class="ob-unit">in</span></div></div>' +
        '<div class="field"><label class="field-label" for="p-wt">Weight (lb)</label>' +
          '<input class="input num" id="p-wt" type="number" inputmode="decimal" step="0.5" value="' +
            (profile.weightLb || '') + '"></div>' +
      '</div>' +
      btn({ label: 'Save', action: 'save-body', variant: 'primary', size: 'lg', full: true }),
      {
        actions: {
          async 'save-body'() {
            const f = parseInt((document.getElementById('p-ft') || {}).value, 10);
            const i = parseInt((document.getElementById('p-in') || {}).value, 10);
            const w = parseFloat((document.getElementById('p-wt') || {}).value);
            const patch = {};
            if (Number.isFinite(f)) patch.heightIn = f * 12 + (Number.isFinite(i) ? i : 0);
            if (Number.isFinite(w) && w > 0) {
              patch.weightLb = w;
              const dials = Store.get('dials');
              patch.proteinTargetG = Math.round((w / 2.2046) * dials.proteinGPerKg);
            }
            await DB.saveProfile(patch);
            await Store.refreshProfile();
            closeSheet();
            toast('Saved.', 'calm');
            Router.refresh();
          },
        },
      });
  },

  async 'edit-rest'() {
    const current = (await DB.getPref('rest:default', 90)) || 90;
    pickerSheet('Default rest',
      [60, 90, 120, 150, 180].map((n) => ({ id: String(n), label: n + ' seconds' })),
      String(current),
      async (v) => { await DB.setPref('rest:default', parseInt(v, 10)); });
  },

  async 'set-theme'(node) {
    const t = node.dataset.theme;
    await DB.setPref('theme', t);
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    return Router.refresh();
  },

  'install-help'() { showInstallHelp(); },

  async 'load-demo'() {
    const ok = await confirmDialog(
      'Load fourteen weeks of invented training? This replaces everything currently on this device.',
      { confirmLabel: 'Load it' });
    if (!ok) return;
    toast('Building fourteen weeks…');
    try {
      const profile = Store.get('profile') || {};
      const summary = await seedDemoData({ name: profile.name || 'Rocio' });
      await Store.init();
      toast(summary.sessions + ' sessions and ' + summary.sets + ' sets loaded.', 'calm');
      return Router.go('shape');
    } catch (err) {
      console.error('Daybreak: seeding failed.', err);
      toast('Could not build the demo data.', 'signal');
    }
  },

  async 'clear-demo'() {
    const ok = await confirmDialog('Clear everything and start fresh?', {
      confirmLabel: 'Clear it', danger: true,
    });
    if (!ok) return;
    await clearDemoData();
    window.location.reload();
  },

  async export() {
    try {
      const data = await DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'daybreak-backup-' + DB.todayISO() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      await DB.setPref('backup:at', new Date().toISOString());
      toast('Backup saved. Keep it somewhere safe.', 'calm');
      return Router.refresh();
    } catch (err) {
      console.error('Daybreak: export failed.', err);
      toast('Could not build the backup.', 'signal');
    }
  },

  async import(node) {
    const file = node.files && node.files[0];
    if (!file) return;
    const ok = await confirmDialog('Restore from this backup? Anything already on this phone stays, ' +
      'and the backup is merged on top.', { confirmLabel: 'Restore' });
    if (!ok) { node.value = ''; return; }
    try {
      const text = await file.text();
      await DB.importAll(JSON.parse(text));
      toast('Restored. Reloading.', 'calm');
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      console.error('Daybreak: import failed.', err);
      toast('That file did not look like a Daybreak backup.', 'signal');
    }
  },

  async reset() {
    const ok = await confirmDialog(
      'This deletes every session, set, measurement and photo on this phone. It cannot be undone.',
      { confirmLabel: 'Delete everything', danger: true });
    if (!ok) return;
    const sure = await confirmDialog('Really? Export a backup first if there is any doubt.',
      { confirmLabel: 'Yes, delete it all', danger: true });
    if (!sure) return;
    await DB.clearAll();
    window.location.reload();
  },
};
