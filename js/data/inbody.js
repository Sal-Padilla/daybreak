// Daybreak — js/data/inbody.js — reading the InBody scanner by the coffee machine.
//
// Bay Club Redondo Beach has an InBody unit next to the coffee. It prints a sheet with
// two dozen numbers on it, and most of them do not matter to a perimenopausal woman who
// lifts. Four of them matter a great deal. This module says which, why, and how to read
// a change without being misled by it.
//
// WHY NOT SYNC IT AUTOMATICALLY
// The club's results live in LookinBody Web, which is a facility back-end: the login is
// for administrators and staff, there is no consumer API, and Daybreak has no server and
// no account to authenticate with. So this is typed in from the printed sheet. It is four
// numbers and takes under a minute, and it keeps every byte on her phone, which is the
// deal the rest of the app makes too.
//
// THE ONE IDEA THAT MAKES THE SHEET READABLE
// Percent body fat is a RATIO. Both halves move. Build three pounds of muscle and lose
// three pounds of fat and your weight is identical, your percentage barely twitches, and
// you have just had the best month of your training life. That is exactly the month a
// woman quits, because the scale and the percentage both said nothing happened.
// So Daybreak leads with the two ABSOLUTE numbers — pounds of muscle, pounds of fat —
// and treats the percentage as commentary.

/**
 * What to type in, in the order it appears on the sheet.
 * `key` is the stored field. `essential` marks the four worth crossing the room for.
 */
export const INBODY_FIELDS = [
  { key: 'weightLb', label: 'Weight',              unit: 'lb',  step: '0.1', essential: true },
  { key: 'smmLb',    label: 'Skeletal Muscle Mass', unit: 'lb', step: '0.1', essential: true },
  { key: 'bfmLb',    label: 'Body Fat Mass',        unit: 'lb', step: '0.1', essential: true },
  { key: 'pbf',      label: 'Percent Body Fat',     unit: '%',  step: '0.1', essential: false },
  { key: 'vfLevel',  label: 'Visceral Fat Level',   unit: '1–20', step: '1', essential: true,
    note: 'Some sheets print an area in cm² instead — use the next box for that.' },
  { key: 'vfaCm2',   label: 'Visceral Fat Area',    unit: 'cm²', step: '1', essential: false },
  { key: 'ecwTbw',   label: 'ECW/TBW',              unit: 'ratio', step: '0.001', essential: false,
    note: 'The honesty check on the whole scan. Under 0.390 is normal.' },
  { key: 'bmr',      label: 'Basal Metabolic Rate', unit: 'kcal', step: '1', essential: false },
  { key: 'legsLb',   label: 'Lean mass — both legs', unit: 'lb', step: '0.1', essential: false,
    note: 'From the segmental analysis. This is where glute and leg work shows up first.' },
];

/** Thresholds worth naming. Everything here is from InBody's own published guidance. */
export const INBODY_LIMITS = {
  vfLevelMax: 10,        // InBody: level 10 is the boundary, and equates to ~100 cm²
  vfaCm2Max: 100,        // cm², the same boundary expressed as area
  ecwTbwMax: 0.390,      // above this the reading is distorted by fluid
  pbfHealthyWomen: [18, 28],
};

/**
 * How to take it so two scans can honestly be compared. Every one of these is a real
 * source of drift, not fussiness — body composition by impedance is a water measurement
 * underneath, so anything that moves your water moves the answer.
 */
export const INBODY_PROTOCOL = [
  'Same time of day every time. Morning is best — before you have eaten or trained.',
  'Go to the bathroom first. A full bladder is weight the machine will read as you.',
  'No coffee that morning, and nothing to drink in the 45 minutes before.',
  'Do not scan within 6–12 hours of training. Exercise shifts your water around.',
  'Bare feet, same clothing weight, no jewellery.',
];

export const INBODY_CYCLE_NOTE =
  'Water retention around your period can move the numbers by a pound or two in either ' +
  'direction. Do not skip a scan because of where you are in your cycle — just note it, ' +
  'and read the trend across months rather than the jump between two scans.';

/** Is there enough in this record to call it an InBody scan at all? */
export function isInbody(m) {
  return !!(m && (m.source === 'inbody' || m.smmLb != null || m.bfmLb != null));
}

/** Every InBody scan, oldest first. */
export function inbodyScans(measurements) {
  return (Array.isArray(measurements) ? measurements : [])
    .filter(isInbody)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/**
 * Can this scan be trusted against the last one?
 *
 * ECW/TBW is the InBody's own tell. It is the share of your body water sitting OUTSIDE
 * the cells, and it climbs with inflammation, swelling, a hard session two days ago, a
 * salty dinner, or the week before a period. When it is high the muscle and fat split is
 * being computed from distorted water, and a scan that says "you lost two pounds of
 * muscle" is far more likely to be a fluid reading than two pounds of actual muscle.
 */
export function scanQuality(scan) {
  if (!scan || scan.ecwTbw == null) {
    return { ok: true, known: false, message: null };
  }
  if (scan.ecwTbw > INBODY_LIMITS.ecwTbwMax) {
    return {
      ok: false,
      known: true,
      message: 'ECW/TBW is ' + scan.ecwTbw.toFixed(3) + ', above 0.390. You were holding ' +
        'extra fluid — from a hard session, a salty day, or where you are in your cycle. ' +
        'Read this one gently: the muscle and fat split is computed from body water, and ' +
        'today your water was unusual.',
    };
  }
  return { ok: true, known: true, message: null };
}

/** Visceral fat, whichever way her sheet prints it, judged against InBody's own line. */
export function visceralStatus(scan) {
  if (!scan) return null;
  if (scan.vfaCm2 != null) {
    return {
      value: scan.vfaCm2, unit: 'cm²', limit: INBODY_LIMITS.vfaCm2Max,
      over: scan.vfaCm2 > INBODY_LIMITS.vfaCm2Max,
    };
  }
  if (scan.vfLevel != null) {
    return {
      value: scan.vfLevel, unit: '', limit: INBODY_LIMITS.vfLevelMax,
      over: scan.vfLevel > INBODY_LIMITS.vfLevelMax,
    };
  }
  return null;
}

/**
 * The recomposition read: what actually changed between two scans, and what it means.
 *
 * This is the whole point of scanning. Muscle up and fat down at once is the outcome the
 * training is for, and it is the one the bathroom scale actively hides.
 */
export function compareScans(now, before) {
  if (!now || !before) return null;
  const d = (k) => (now[k] != null && before[k] != null ? +(now[k] - before[k]).toFixed(1) : null);

  const dSmm = d('smmLb');
  const dBfm = d('bfmLb');
  const dWeight = d('weightLb');

  let verdict = null;
  // Thresholds at half a pound: below that is inside the machine's own noise.
  const up = (v) => v != null && v >= 0.5;
  const down = (v) => v != null && v <= -0.5;
  const flat = (v) => v != null && Math.abs(v) < 0.5;

  if (up(dSmm) && down(dBfm)) {
    verdict = {
      tone: 'win',
      headline: 'Recomposition',
      detail: 'Muscle up and fat down at the same time. This is the hardest thing to do ' +
        'and the reason you lift. Notice what the scale did — it is the least useful ' +
        'number on the sheet.',
    };
  } else if (up(dSmm) && flat(dBfm)) {
    verdict = { tone: 'win', headline: 'Muscle up',
      detail: 'You added muscle and held your fat mass. Through perimenopause, holding ' +
        'muscle is the win; adding it is better than the win.' };
  } else if (flat(dSmm) && down(dBfm)) {
    verdict = { tone: 'calm', headline: 'Fat down, muscle held',
      detail: 'Fat off without giving muscle back. That is a well-run deficit — most ' +
        'weight loss takes a quarter of it out of your muscle.' };
  } else if (down(dSmm) && down(dBfm)) {
    verdict = { tone: 'signal', headline: 'Both down',
      detail: 'You are losing weight but some of it is muscle. Two usual causes: not ' +
        'enough protein, or not enough hard lifting. Neither is hard to fix, but ignoring ' +
        'it through perimenopause is expensive.' };
  } else if (down(dSmm)) {
    verdict = { tone: 'signal', headline: 'Muscle down',
      detail: 'Muscle mass has dropped. Check protein first, then whether the heavy sets ' +
        'have actually been heavy. Also check the scan quality note above before you ' +
        'react to a single reading.' };
  } else if (up(dBfm)) {
    verdict = { tone: 'accent', headline: 'Fat up',
      detail: 'Fat mass is up. One scan is not a trend — look at the line, not the jump.' };
  }

  return { dSmm, dBfm, dWeight, dPbf: d('pbf'), dVf: d('vfLevel') ?? d('vfaCm2'), verdict };
}

/**
 * Muscle-to-fat ratio. One number that moves the right way under recomposition whichever
 * direction the scale goes, which is exactly what percent body fat fails to do.
 */
export function muscleToFat(scan) {
  if (!scan || !scan.smmLb || !scan.bfmLb) return null;
  return +(scan.smmLb / scan.bfmLb).toFixed(2);
}
