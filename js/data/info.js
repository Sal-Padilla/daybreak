// Daybreak — js/data/info.js — the "i" panel: what a movement is, and what it actually does for her.
//
// Hand-writing 144 explanations would rot the moment the library changed, so this composes
// from the exercise's own metadata — pattern, targets, equipment, impact, tier — against a
// library of what each target does for the shape she is training toward. The twenty-odd
// movements that carry the program get a hand-written line on top.

import { SHAPE_TARGETS } from './exercises.js';
import { PILLARS, pillarScore } from './pillars.js';

/* Why each Shape Map target matters — the "lady improvements" explanation. */
export const TARGET_WHY = {
  gluteMax: {
    label: 'Glutes',
    why: 'The big one. Building the glutes changes your outline more than anything else you can train, and it is the muscle most responsible for a strong lower back and pain-free hips.'
  },
  gluteMed: {
    label: 'Side glute and hips',
    why: 'The muscle on the side of the hip. Training it fills out the shelf at the top of the hip — the area people try to fix with dieting and cannot, because it is muscle, not fat. It is also your main defence against knees caving in under load.'
  },
  hamstrings: {
    label: 'Hamstrings',
    why: 'Lifts the glute line and separates it from the back of the thigh. Also the muscle that protects the knee and the lower back in every hinge you do.'
  },
  delts: {
    label: 'Shoulders',
    why: 'The shoulder cap is the shape lever almost nobody uses. Widening the shoulders slightly makes the waist read narrower without a pound of weight lost — it is contrast, not size.'
  },
  back: {
    label: 'Back',
    why: 'Posture and taper. A strong upper back pulls the shoulders open, which changes how you carry yourself, and it builds the V that narrows the waist visually.'
  },
  triceps: {
    label: 'Triceps',
    why: 'Two thirds of your upper arm. This is the muscle behind the complaint about the back of the arm — and it responds quickly.'
  },
  core: {
    label: 'Deep core',
    why: 'Not crunches. The deep core is what tightens the waist, keeps your lower back healthy under load, and works with the pelvic floor. It is trained by resisting movement, not creating it.'
  },
  quads: {
    label: 'Quads',
    why: 'The front of the thigh. Shape and real-world strength — stairs, hills, getting off the floor — and a major contributor to knee health.'
  },
  chest: {
    label: 'Chest',
    why: 'Trained for lift and support rather than size, and it balances all the pulling work that keeps your posture upright.'
  },
  calves: {
    label: 'Calves',
    why: 'Ankle strength and shape. Stubborn, but the ankle is the first joint in every step and jump you take.'
  },
  biceps: {
    label: 'Biceps',
    why: 'Kept deliberately light. Useful, but not a limiting factor for the shape you are after.'
  }
};

/* Hand-written notes for the movements that carry the program. */
const OVERRIDES = {
  'barbell-hip-thrust': 'The single best glute-building exercise there is. Unlike a squat, the hardest point is at the top with the hips fully extended, which is exactly where the glute does its work. Expect to load this heavier than you expect — well past your squat over time.',
  'machine-hip-thrust': 'The hip thrust with the guesswork removed. The pad tells you where the top of the rep is and the machine holds the path, so it is the right place to learn the movement before touching a barbell.',
  'dumbbell-hip-thrust': 'A hip thrust you can set up anywhere. Load is limited by what you can balance on your hips, so it works best for higher reps or as a second glute movement.',
  'romanian-deadlift': 'The hinge. It trains the hamstrings and glutes through a long stretch, which is where most of the growth signal lives. Push the hips back rather than bending the knees — the bar should stay against your legs the whole way down.',
  'dumbbell-romanian-deadlift': 'The hinge with a friendlier setup. Same job as the barbell version and easier to learn, because the dumbbells travel either side of your legs instead of scraping down the front.',
  'cable-hip-abduction': 'Direct work for the side glute — the muscle that builds the shelf at the top of the hip. Nothing else on the floor targets it this precisely.',
  'machine-hip-abduction': 'The easiest way to load the side glute hard. Lean forward slightly and you bias the upper glute, which is the part that changes hip shape.',
  'goblet-squat': 'The squat that teaches itself. Holding the weight at your chest forces an upright torso, so you get the depth without loading the spine the way a back squat does — which matters a great deal first thing in the morning.',
  'trap-bar-deadlift': 'A deadlift with the load beside you instead of in front. That keeps your torso more upright and takes a lot of stress off the lower back, which makes it the better choice for heavy pulling early in the morning.',
  'back-squat': 'The classic, and genuinely valuable for bone density because it loads the spine directly. That same spinal loading is why it is not the first movement of a 5:30 session — give yourself twenty minutes upright before it.',
  'lat-pulldown': 'Builds the width in your upper back that makes your waist look narrower. Pull with your elbows, not your hands, and think about driving them down into your back pockets.',
  'chest-supported-row': 'All the back-building benefit of a row with the lower back taken out of the equation. The chest pad means nothing is left to cheat with.',
  'dumbbell-lateral-raise': 'The shoulder-cap exercise. Small, unglamorous, and one of the highest-leverage movements for your shape — widening the shoulder is what makes the waist read narrower.',
  'cable-lateral-raise': 'A lateral raise with constant tension from bottom to top, which the dumbbell version loses at the bottom. Slightly better stimulus for the same effort.',
  'face-pull': 'The posture exercise. It hits the rear shoulder and the muscles between your shoulder blades — the two areas that a desk and a phone quietly shut down.',
  'seated-leg-curl': 'Direct hamstring work with the hip fixed, which the deadlift and hip thrust do not give you. Worth including precisely because it covers what the big lifts miss.',
  'box-step-up': 'Single-leg strength with almost no spinal load. Step up and stand tall, then lower slowly — the lowering is where the control is built.',
  'bulgarian-split-squat': 'Brutal and worth it. The rear foot elevated puts the front leg under a long stretch, which builds the glute hard, and the single-leg position trains balance at the same time.',
  'box-jump': 'Impact work, and it is here for your bones rather than your legs. Bone responds to landing forces in a way it does not respond to lifting alone — a few sets a week measurably helps bone density.',
  'pogo-hop': 'Small, springy hops. The gentlest way to give your bones the impact signal they need, and a good place to start before box jumps.',
  'farmer-carry': 'Pick up something heavy and walk. Trains the deep core, the grip and the upper back all at once, and it is the most directly useful thing in the gym — it is literally carrying the shopping.',
  'dead-bug': 'Looks easy, is not. It teaches the deep core to hold your spine still while your limbs move, which is exactly the job it does under a heavy bar.',
  'pallof-press': 'Anti-rotation. You resist a cable trying to twist you, which builds the deep core without the loaded twisting that thickens the waist.',
  'plank': 'A held position, not an endurance contest. Thirty good seconds with the ribs down beats three minutes of sagging.',
  'rope-pushdown': 'Direct triceps work — the muscle that makes up most of the upper arm. Spread the rope at the bottom to finish the contraction.',
  'back-extension': 'Trains the glutes and hamstrings to extend the hip while the lower back holds a position. Round the upper back slightly and it becomes far more of a glute exercise.'
};

const PATTERN_WHAT = {
  squat: 'A squat pattern — knees and hips bend together, torso stays upright.',
  hinge: 'A hip hinge — the hips travel back, the knees stay softly bent, and the load is taken by the glutes and hamstrings.',
  lunge: 'A single-leg pattern — one leg does the work while the other assists with balance.',
  'push-h': 'A horizontal press — pushing weight away from your chest.',
  'push-v': 'A vertical press — pushing weight overhead.',
  'pull-h': 'A horizontal pull — rowing weight toward your torso.',
  'pull-v': 'A vertical pull — pulling weight down from overhead.',
  carry: 'A loaded carry — hold something heavy and walk under control.',
  core: 'Direct core work.',
  iso: 'An isolation movement — one joint, one muscle, no help from anywhere else.',
  plyo: 'A jumping or landing movement, done for the impact rather than the fatigue.',
  cardio: 'Conditioning work — measured in time and distance rather than sets and reps.'
};

const TRACK_HOW = {
  weight_reps: 'Logged as weight × reps.',
  bodyweight_reps: 'Logged as reps, using your bodyweight.',
  time_hold: 'Logged as a hold, in seconds.',
  reps_only: 'Logged as reps.',
  time_distance: 'Logged as time and distance.'
};

function list(items) {
  const a = items.filter(Boolean);
  if (!a.length) return '';
  if (a.length === 1) return a[0];
  if (a.length === 2) return a[0] + ' and ' + a[1];
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}

/**
 * Build the "i" panel content for an exercise.
 * @returns {{title, what, why, targets:[{key,label,why,role}], how, pillars:[{id,name,score}], flags:[string], cues:[string]}}
 */
export function exerciseInfo(exercise) {
  if (!exercise) return null;

  const primary = (exercise.primary || []).map((k) => ({
    key: k, role: 'primary',
    label: (SHAPE_TARGETS[k] && SHAPE_TARGETS[k].label) || k,
    why: (TARGET_WHY[k] && TARGET_WHY[k].why) || ''
  }));
  const secondary = (exercise.secondary || []).map((k) => ({
    key: k, role: 'secondary',
    label: (SHAPE_TARGETS[k] && SHAPE_TARGETS[k].label) || k,
    why: (TARGET_WHY[k] && TARGET_WHY[k].why) || ''
  }));

  const equipment = (exercise.equipment || []).filter((e) => e !== 'bodyweight');
  const what = [
    PATTERN_WHAT[exercise.pattern] || '',
    equipment.length ? 'Uses ' + list(equipment) + '.' : 'Bodyweight only.'
  ].filter(Boolean).join(' ');

  const why = OVERRIDES[exercise.id] || (() => {
    // Cardio has no shape target, so the muscle-first composer has nothing to say about it.
    // Explain what it is actually for instead.
    if (exercise.track === 'time_distance' || exercise.pattern === 'cardio') {
      const isIntervals = /interval|sprint/i.test(exercise.id + ' ' + exercise.name);
      const lowImpact = /bike|row|elliptical|swim|cycl/i.test(exercise.id);
      return (isIntervals
        ? 'Short, hard intervals. This is the version of cardio that does the most for body ' +
          'composition through perimenopause, and because the efforts are brief it costs your ' +
          'strength training far less than long steady sessions do.'
        : 'Steady conditioning. Its job is your heart, your lungs and your recovery between ' +
          'hard sessions — not muscle. Keep it genuinely easy so it supports your lifting ' +
          'rather than competing with it.') +
        (lowImpact
          ? ' No impact, so it is kind to joints — but it does not load bone, which is why it ' +
            'supplements your lifting rather than replacing any of it.'
          : ' Weight-bearing, so unlike the bike or the rower it does give your bones something.');
    }

    const names = primary.map((p) => p.label.toLowerCase());
    if (!names.length) {
      const sec = secondary.map((s) => s.label.toLowerCase());
      return sec.length
        ? 'Supporting work for ' + list(sec) + '.'
        : 'Accessory work — it fills a gap the main lifts leave.';
    }
    const lead = 'Trains ' + list(names) + '.';
    const extra = primary[0].why ? ' ' + primary[0].why : '';
    return lead + extra;
  })();

  const score = pillarScore(exercise);
  const pillars = Object.keys(PILLARS)
    .map((id) => ({ id, name: PILLARS[id].name, short: PILLARS[id].short, score: score[id] }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);

  const flags = [];
  if (exercise.impact) {
    flags.push('Impact work — this is here for your bones. Landing forces build bone density in a way that lifting alone does not.');
  }
  if (exercise.axialLoad) {
    flags.push('Loads the spine directly. Excellent for bone, but not the first thing to do at 5:30 — give yourself twenty minutes upright first.');
  }
  if (exercise.pelvicFloorRisk === 'high') {
    flags.push('Higher pressure on the pelvic floor. Exhale through the hard part rather than holding your breath. If you leak, say so in your profile and this gets swapped automatically.');
  }
  if (exercise.unilateral) {
    flags.push('One side at a time — it evens out left/right differences you cannot see in a two-legged lift.');
  }

  return {
    title: exercise.name,
    what,
    why,
    targets: primary.concat(secondary),
    how: TRACK_HOW[exercise.track] || '',
    pillars,
    flags,
    cues: exercise.cues || []
  };
}

/** The "i" panel for a class format. */
export function classInfo(format) {
  if (!format) return null;

  const pillars = Object.keys(PILLARS)
    .map((id) => ({ id, name: PILLARS[id].name, short: PILLARS[id].short, score: (format.pillars || {})[id] || 0 }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);

  const contributes = Object.entries(format.shapeContribution || {})
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => ({
      key: k,
      label: (SHAPE_TARGETS[k] && SHAPE_TARGETS[k].label) || k,
      why: (TARGET_WHY[k] && TARGET_WHY[k].why) || ''
    }));

  const flags = [];
  if (format.legFatigue === 'very-high') {
    flags.push('Very expensive for your legs. Keep heavy lower-body lifting a clear day away from it.');
  } else if (format.legFatigue === 'high') {
    flags.push('Costs your legs real fatigue — do not put a heavy squat or hip thrust day right after it.');
  }
  if (format.counts && format.counts.resistance > 0 && format.counts.resistance < 1) {
    flags.push('Counts toward your weekly sets at ' + Math.round(format.counts.resistance * 100) +
      '% credit — real training, but not a replacement for heavy lifting.');
  }
  if (format.cnsCost === 'high') {
    flags.push('High nervous-system cost. Follow it with something genuinely easy.');
  }
  if (format.legFatigue === 'low' && format.intensity !== 'low') {
    flags.push('Barely touches your legs, so it pairs cleanly with a lower-body lift the same morning.');
  }

  return {
    title: format.name,
    what: format.what || '',
    why: format.why || format.note || '',
    targets: contributes,
    pillars,
    flags,
    pairing: format.note || ''
  };
}

/** The "i" panel for a training pillar. */
export function pillarInfo(id) {
  const p = PILLARS[id];
  if (!p) return null;
  return { title: p.name, what: p.blurb, why: p.why, targets: [], pillars: [], flags: [] };
}
