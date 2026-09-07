// Daybreak — js/ui/infosheet.js — the "i" panel, shared by exercises, classes and pillars.
//
// One rule: never just name the muscle. Say what it changes. "Trains the gluteus medius" is
// a fact; "builds the shelf at the top of the hip that people try to fix with dieting and
// cannot, because it is muscle" is the reason she will do the set.

import { sheet } from './components.js';
import { exerciseInfo, classInfo, pillarInfo } from '../data/info.js';
import { byId } from '../data/exercises.js';
import { classById } from '../data/classes.js';
import { DIAGRAMS } from '../data/diagrams.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** The small circular "i" button. Put it next to anything worth explaining. */
export function infoButton(kind, id, label) {
  return '<button type="button" class="info-btn" data-action="show-info" ' +
    'data-kind="' + esc(kind) + '" data-id="' + esc(id) + '" ' +
    'aria-label="What is ' + esc(label || id) + ', and what does it do?">i</button>';
}

/** The movement diagram, if we have one for this shape. Silent when we do not. */
function diagramBlock(info) {
  if (!info || !info.diagramKey) return '';
  const d = DIAGRAMS[info.diagramKey];
  if (!d || !d.svg) return '';

  const setup = (d.setup || []).length
    ? '<ol class="ex-setup">' + d.setup.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>'
    : '';

  return '<figure class="ex-figure">' + d.svg +
    '<figcaption>' + esc(d.name || info.title) + '</figcaption></figure>' + setup;
}

/** A link out to a demonstration. The app ships no video, so this is the honest answer. */
function watchBlock(info) {
  if (!info || !info.watchUrl) return '';
  return '<a class="btn btn-ghost btn-md btn-full watch-link" href="' + esc(info.watchUrl) + '" ' +
    'target="_blank" rel="noopener noreferrer">' +
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M10.5 9.5l5 2.5-5 2.5z"/></svg>' +
    '<span>Watch how it is done</span></a>';
}

function renderPanel(info) {
  if (!info) return '<p class="lede">Nothing to explain here yet.</p>';

  const targets = (info.targets || []).length
    ? '<h3 class="section-label">What it changes</h3>' +
      '<div class="info-targets">' + info.targets.map((t) =>
        '<div class="info-target' + (t.role === 'secondary' ? ' is-secondary' : '') + '">' +
          '<span class="info-target-name">' + esc(t.label) +
            (t.role === 'secondary' ? ' <em>(assists)</em>' : '') + '</span>' +
          (t.why ? '<span class="info-target-why">' + esc(t.why) + '</span>' : '') +
        '</div>').join('') + '</div>'
    : '';

  const pillars = (info.pillars || []).length
    ? '<h3 class="section-label">Counts toward</h3>' +
      '<div class="chip-row">' + info.pillars.map((p) =>
        '<span class="chip chip-quiet">' + esc(p.short || p.name) + '</span>').join('') + '</div>'
    : '';

  const flags = (info.flags || []).length
    ? '<div class="info-flags">' + info.flags.map((f) =>
        '<p class="info-flag">' + esc(f) + '</p>').join('') + '</div>'
    : '';

  const cues = (info.cues || []).length
    ? '<h3 class="section-label">How to do it well</h3>' +
      '<ul class="info-cues">' + info.cues.map((c) =>
        '<li>' + esc(c) + '</li>').join('') + '</ul>'
    : '';

  return (
    diagramBlock(info) +
    (info.what ? '<p class="info-what">' + esc(info.what) + '</p>' : '') +
    (info.why ? '<p class="info-why">' + esc(info.why) + '</p>' : '') +
    targets + cues + pillars + flags + watchBlock(info)
  );
}

/** Open the info sheet for an exercise id, class format id, or pillar id. */
export function showInfo(kind, id) {
  let info = null;
  if (kind === 'exercise') info = exerciseInfo(byId(id));
  else if (kind === 'class') info = classInfo(classById(id));
  else if (kind === 'pillar') info = pillarInfo(id);

  if (!info) {
    sheet('Not found', '<p class="lede">Could not find that one.</p>');
    return;
  }
  sheet(info.title, renderPanel(info), { class: 'info-sheet' });
}

/**
 * Drop this into any feature's `actions` map to enable every info button on that screen:
 *   export const actions = { ...infoActions, ...myActions };
 */
export const infoActions = {
  'show-info'(node, data) {
    showInfo(data.kind, data.id);
  }
};
