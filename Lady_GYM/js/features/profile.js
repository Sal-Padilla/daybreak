// Lady_GYM — js/features/profile.js — you: photo, plan settings, privacy, backup. Settings-app style.
//
// Opened from the round photo at the top right of every tab, the way Apple's own apps do it.
// Daybreak gave this its own tab and 615 words; here it is one grouped list, and the private
// question about leaking lives here — asked gently, only if she chooses to look — instead of
// in the sign-up flow where it put people off.

import { DB } from '../core/db.js';
import { Store, currentProgramWeek } from '../core/store.js';
import { Nav } from '../core/nav.js';
import { programFor, PROGRAMS } from '../data/programs.js';
import { seedDemoData, clearDemoData, isDemoData } from '../dev/seed.js';
import { icon, tile } from '../ui/icons.js';
import {
  esc, fmt, group, toast, sheet, closeSheet, confirmAlert, actionSheet, pickPhoto, shrinkImage, haptic, button,
} from '../ui/kit.js';
import { avatarHtml } from './shared.js';
import { isStandalone, showInstallGuide, shareInvite } from './install.js';
import { APP_VERSION } from '../version.js';

export const GOALS = [
  { id: 'shape', label: 'Tone & shape', sub: 'Glutes, hips, shoulders' },
  { id: 'fat-loss', label: 'Lose fat', sub: 'Lean out, keep your muscle' },
  { id: 'strong', label: 'Get stronger', sub: 'And stronger bones with it' },
  { id: 'recomp', label: 'A bit of everything', sub: 'The most popular choice' },
];
export const EXPERIENCE = [
  { id: 'new', label: 'New to weights', sub: 'Four gentle weeks learning the moves first' },
  { id: 'returning', label: 'Coming back', sub: 'You know the moves — we rebuild' },
  { id: 'experienced', label: 'I lift already', sub: 'Straight into the full plan' },
];
export const STAGES = [
  { id: 'cycling', label: 'Regular periods', sub: 'Standard plan' },
  { id: 'transition', label: 'Things are changing', sub: 'Perimenopause: irregular periods, hot flashes or poor sleep' },
  { id: 'post', label: 'Post-menopause', sub: 'A year or more since your last period' },
];
const LEAK = [
  { id: 'never', label: 'Never' },
  { id: 'sometimes', label: 'Sometimes' },
  { id: 'often', label: 'Often' },
  { id: 'prefer-not', label: 'I’d rather not say' },
];

const labelOf = (list, id) => (list.find((x) => x.id === id) || {}).label || '—';

/** Plan names were written for a coach ("Transition — 3 Day"). Say what it is instead. */
export function planName(programId) {
  return { 'on-ramp': 'Getting-started plan', 'transition-3day': '3-day strength plan' }[programId] ||
    ((PROGRAMS[programId] || {}).name || 'Your plan');
}

/** A sheet of picture-free radio rows. Resolves the chosen id or null. */
export function choose(title, list, current, note = '') {
  return new Promise((resolve) => {
    let done = false;
    sheet({
      title,
      body: (note ? '<p class="sheet-lede">' + esc(note) + '</p>' : '') +
        '<div class="group-body">' + list.map((o) =>
          '<button type="button" class="row is-tappable" data-action="pick" data-v="' + esc(o.id) + '">' +
          '<span class="row-main"><span class="row-title">' + esc(o.label) + '</span>' +
          (o.sub ? '<span class="row-sub">' + esc(o.sub) + '</span>' : '') + '</span>' +
          (o.id === current ? '<span class="row-check">' + icon('check', 20) + '</span>' : '') + '</button>').join('') + '</div>',
      onClose: () => { if (!done) resolve(null); },
      actions: {
        pick(n) { done = true; closeSheet(); resolve(n.dataset.v); },
      },
    });
  });
}

async function saveProfile(patch, message) {
  const profile = { ...(Store.get('profile') || {}), ...patch };
  const prog = programFor(profile);
  if (prog && prog.id) patch.programId = prog.id;
  await DB.saveProfile(patch);
  await Store.refreshProfile();
  const p = Store.get('profile');
  const dials = Store.get('dials') || {};
  if (p.weightLb && dials.proteinGPerKg) {
    await DB.saveProfile({ proteinTargetG: Math.round((p.weightLb / 2.2046) * dials.proteinGPerKg) });
    await Store.refreshProfile();
  }
  if (message) toast(message, { tone: 'good' });
  return Nav.invalidate();
}

export const profilePage = {
  id: 'profile',
  title: 'Profile',

  async render() {
    const p = Store.get('profile') || {};
    const theme = await DB.getPref('theme', 'auto');
    const rest = await DB.getPref('rest:default', 90);
    const demo = await isDemoData();
    const backupAt = await DB.getPref('backup:at', null);
    const height = p.heightIn ? Math.floor(p.heightIn / 12) + '′ ' + Math.round(p.heightIn % 12) + '″' : '';

    return '<div class="profile">' +
      '<div class="me-head">' +
        '<button type="button" class="me-photo" data-action="photo" aria-label="Change your photo">' + await avatarHtml(p) +
          '<span class="me-cam">' + icon('camera', 16) + '</span></button>' +
        '<h1 class="me-name">' + esc(p.name || 'You') + '</h1>' +
        '<p class="me-sub">' + esc(planName(p.programId) + ' · week ' + currentProgramWeek(p)) + '</p>' +
      '</div>' +

      group([
        { lead: tile('person', 'var(--pink-fill)'), title: 'Name', value: p.name || '', action: 'edit-name' },
        { lead: tile('star', 'var(--orange-fill)'), title: 'Goal', value: labelOf(GOALS, p.goal), action: 'edit-goal' },
        { lead: tile('workouts', 'var(--violet-fill)'), title: 'Experience', value: labelOf(EXPERIENCE, p.experience), action: 'edit-exp' },
        { lead: tile('heart', 'var(--red-fill)'), title: 'Life stage', value: labelOf(STAGES, p.lifeStage), action: 'edit-stage' },
        { lead: tile('ruler', 'var(--teal-fill)'), title: 'Height & weight',
          value: [height, p.weightLb ? fmt.num(p.weightLb) + ' lb' : ''].filter(Boolean).join(' · ') || 'Add', action: 'edit-body' },
        { lead: tile('drop', 'var(--blue-fill)'), title: 'Protein goal', value: p.proteinTargetG ? p.proteinTargetG + ' g a day' : 'Add your weight', chevron: false },
      ], { header: 'About you' }) +

      group([
        { lead: tile('lock', 'var(--mint-fill)'), title: 'Pelvic floor', sub: 'A private question that tailors your exercises',
          value: p.pelvicFloor && p.pelvicFloor !== 'unknown' ? labelOf(LEAK, p.pelvicFloor) : 'Not answered', action: 'edit-leak' },
      ], { header: 'Comfort & privacy', footer: 'Everything stays on this phone. Nothing is sent anywhere.' }) +

      group([
        { lead: tile('timer', 'var(--orange-fill)'), title: 'Rest between sets', value: fmt.mmss(rest), action: 'edit-rest' },
      ], { header: 'Workouts' }) +

      group([
        { lead: tile('sparkle', 'var(--violet-fill)'), title: 'Appearance', value: { auto: 'Automatic', light: 'Light', dark: 'Dark' }[theme] || 'Automatic', action: 'edit-theme' },
        isStandalone() ? null : { lead: tile('addSquare', 'var(--blue-fill)'), title: 'Add to Home Screen', sub: 'Open it like any other app', action: 'install' },
        { lead: tile('friends', 'var(--pink-fill)'), title: 'Invite a friend', sub: 'Training together is more fun', action: 'invite' },
        { lead: tile('refresh', 'var(--mint-fill)'), title: 'Check for updates', action: 'update' },
      ], { header: 'App' }) +

      group([
        { lead: tile('download', 'var(--blue-fill)'), title: 'Back up my data', sub: backupAt ? 'Last backup ' + fmt.shortDate(DB.todayISO(new Date(backupAt))) : 'Never backed up', action: 'export' },
        { lead: tile('upload', 'var(--teal-fill)'), title: 'Restore from a backup', sub: 'Daybreak backups work too', action: 'import' },
        demo
          ? { lead: tile('sparkle', 'var(--sun-fill)'), title: 'Clear the demo data', action: 'clear-demo' }
          : { lead: tile('sparkle', 'var(--sun-fill)'), title: 'Try it with demo data', sub: '14 weeks of example training', action: 'load-demo' },
        { lead: tile('trash', 'var(--red-fill)'), title: 'Start over', action: 'reset', danger: true },
      ], { header: 'Your data', footer: 'Browsers on iPhone can clear website data you haven’t opened in a while. A backup every few weeks keeps your history safe.' }) +

      '<p class="about">Lady_GYM ' + esc(APP_VERSION) + '<br>General fitness guidance — not medical advice. ' +
      'Check with your doctor before starting if you’re pregnant, recovering from surgery or have a health condition.</p>' +
      '</div>';
  },

  actions: {
    async photo(node) {
      // Read it off the screen, not the database: iPhone Safari opens the photo picker only while
      // it is still handling the tap, and waiting for a database read first meant nothing opened.
      const has = !!node.querySelector('img');
      const pick = has
        ? await actionSheet('Profile photo', [{ id: 'new', label: 'Choose a new photo' }, { id: 'remove', label: 'Remove photo', danger: true }])
        : 'new';
      if (pick === 'remove') { await DB.setPref('avatar', null); return Nav.invalidate(); }
      if (pick !== 'new') return;
      const file = await pickPhoto();
      if (!file) return;
      try {
        await DB.setPref('avatar', await shrinkImage(file, 400, 0.85));
        haptic();
        toast('Looking good!', { tone: 'good', ic: 'camera' });
        return Nav.invalidate();
      } catch (_) { toast('Could not read that photo', { tone: 'bad', ic: 'info' }); }
    },
    'edit-name'() {
      const p = Store.get('profile') || {};
      sheet({
        title: 'Your name',
        left: { label: 'Cancel', action: 'close' },
        right: { label: 'Save', action: 'save' },
        body: '<input class="input input-big" id="nm" value="' + esc(p.name || '') + '" maxlength="40" autocapitalize="words" autocomplete="given-name" autofocus aria-label="Your name">',
        actions: {
          async save(n, d, h) {
            const v = h.el.querySelector('#nm').value.trim();
            if (!v) return;
            closeSheet();
            await saveProfile({ name: v });
          },
        },
      });
    },
    async 'edit-goal'() {
      const v = await choose('Your goal', GOALS, (Store.get('profile') || {}).goal);
      if (v) await saveProfile({ goal: v }, 'Goal updated');
    },
    async 'edit-exp'() {
      const v = await choose('Experience', EXPERIENCE, (Store.get('profile') || {}).experience);
      if (v) await saveProfile({ experience: v }, 'Your plan has been updated');
    },
    async 'edit-stage'() {
      const v = await choose('Life stage', STAGES, (Store.get('profile') || {}).lifeStage,
        'Hormones change how muscles respond to training, so this sets your weights, volume and recovery.');
      if (v) await saveProfile({ lifeStage: v }, 'Your plan has been updated');
    },
    async 'edit-leak'() {
      const v = await choose('Any leaking when you jump, cough, sneeze or lift?', LEAK, (Store.get('profile') || {}).pelvicFloor,
        'It’s very common — around 4 in 10 women who lift — and very treatable. If it happens, I’ll swap jumps and heavy squats for moves that are kinder to your pelvic floor.');
      if (v) await saveProfile({ pelvicFloor: v }, 'Thanks — saved privately');
    },
    'edit-body'() {
      const p = Store.get('profile') || {};
      sheet({
        title: 'Height & weight',
        left: { label: 'Cancel', action: 'close' },
        right: { label: 'Save', action: 'save' },
        body: '<div class="group-body">' +
          '<div class="row"><span class="row-main"><span class="row-title">Height</span></span>' +
            '<input class="input-inline num" id="hf" type="number" inputmode="numeric" placeholder="5" value="' + (p.heightIn ? Math.floor(p.heightIn / 12) : '') + '" aria-label="Feet"><span class="row-unit">ft</span>' +
            '<input class="input-inline num" id="hi" type="number" inputmode="numeric" placeholder="5" value="' + (p.heightIn ? Math.round(p.heightIn % 12) : '') + '" aria-label="Inches"><span class="row-unit">in</span></div>' +
          '<div class="row"><span class="row-main"><span class="row-title">Weight</span></span>' +
            '<input class="input-inline num" id="wt" type="number" inputmode="decimal" placeholder="150" value="' + esc(p.weightLb || '') + '" aria-label="Weight in pounds"><span class="row-unit">lb</span></div>' +
          '</div><p class="group-footer">Only used to set your protein goal and strength numbers.</p>',
        actions: {
          async save(n, d, h) {
            const ft = parseInt(h.el.querySelector('#hf').value, 10);
            const inch = parseInt(h.el.querySelector('#hi').value, 10) || 0;
            const wt = parseFloat(h.el.querySelector('#wt').value);
            closeSheet();
            await saveProfile({
              heightIn: Number.isFinite(ft) && ft > 0 ? ft * 12 + inch : p.heightIn || null,
              weightLb: Number.isFinite(wt) && wt > 0 ? wt : p.weightLb || null,
            }, 'Saved');
          },
        },
      });
    },
    async 'edit-rest'() {
      const cur = await DB.getPref('rest:default', 90);
      const v = await choose('Rest between sets', [60, 90, 120, 150, 180].map((s) => ({ id: String(s), label: fmt.mmss(s) +
        (s === 90 ? ' — most exercises' : s === 150 ? ' — heavy lifts' : '') })), String(cur));
      if (v) { await DB.setPref('rest:default', Number(v)); toast('Saved'); return Nav.refresh(); }
    },
    async 'edit-theme'() {
      const cur = await DB.getPref('theme', 'auto');
      const v = await choose('Appearance', [
        { id: 'auto', label: 'Automatic', sub: 'Match my iPhone' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' },
      ], cur);
      if (!v) return;
      await DB.setPref('theme', v);
      if (v === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', v);
      return Nav.refresh();
    },
    install: () => showInstallGuide(true),
    invite: () => shareInvite(),
    async update() {
      toast('Checking for updates…', { ic: 'refresh' });
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      } catch (_) { /* offline */ }
      setTimeout(() => location.reload(), 900);
    },
    async export() {
      try {
        const data = await DB.exportAll();
        const json = JSON.stringify(data);
        const name = 'lady-gym-backup-' + DB.todayISO() + '.json';
        const file = new File([json], name, { type: 'application/json' });
        // On iPhone the share sheet is the friendly way: Save to Files, AirDrop, Mail. iOS can refuse
        // it once the tap is a moment old (the database is read first), so anything but her
        // cancelling falls back to a plain download, as Daybreak did — never "Could not make the backup".
        let shared = false;
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'Lady_GYM backup' });
            shared = true;
          } catch (err) {
            if (err && err.name === 'AbortError') return;
            console.warn('Lady_GYM: share refused, downloading instead.', err);
          }
        }
        if (!shared) {
          const url = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url; a.download = name;
          document.body.appendChild(a); a.click(); a.remove();
          // Kept a minute: iPhone asks "Download?" first, and the file must still be there then.
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
        await DB.setPref('backup:at', new Date().toISOString());
        toast('Backup ready — keep it somewhere safe', { tone: 'good', ic: 'download' });
        return Nav.refresh();
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        console.error(err);
        toast('Could not make the backup', { tone: 'bad', ic: 'info' });
      }
    },
    async import() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.style.display = 'none';
      input.onchange = async () => {
        const f = input.files && input.files[0];
        input.remove();
        if (!f) return;
        const ok = await confirmAlert('Restore this backup?', 'It’s added to what’s already here.', { ok: 'Restore' });
        if (!ok) return;
        try {
          await DB.importAll(JSON.parse(await f.text()));
          toast('Restored — reloading', { tone: 'good' });
          setTimeout(() => location.reload(), 700);
        } catch (_) { toast('That file isn’t a backup I can read', { tone: 'bad', ic: 'info' }); }
      };
      // In the page while the picker is open, as pickPhoto does: on iPhone a file input that is not
      // in the document can be thrown away before she picks, and then nothing happens.
      document.body.appendChild(input);
      input.click();
    },
    async 'load-demo'() {
      const ok = await confirmAlert('Load demo data?', '14 weeks of example workouts, classes and measurements. This replaces what’s on this phone.', { ok: 'Load It' });
      if (!ok) return;
      toast('Building 14 weeks…', { ic: 'sparkle' });
      const p = Store.get('profile') || {};
      const s = await seedDemoData({ name: p.name || 'Rocio' });
      await Store.init();
      toast(s.sessions + ' workouts loaded', { tone: 'good' });
      await Nav.invalidate();
      return Nav.tab('progress');
    },
    async 'clear-demo'() {
      const ok = await confirmAlert('Clear the demo data?', 'You’ll start fresh.', { ok: 'Clear', danger: true });
      if (!ok) return;
      await clearDemoData();
      location.reload();
    },
    async reset() {
      const ok = await confirmAlert('Delete everything?', 'Every workout, measurement and photo on this phone. This can’t be undone.', { ok: 'Delete All', danger: true });
      if (!ok) return;
      await DB.clearAll();
      location.reload();
    },
  },
};
