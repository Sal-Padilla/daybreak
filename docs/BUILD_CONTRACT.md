# DAYBREAK v0.1 — BUILD CONTRACT

**This file is authoritative.** Every module is written against it, not against other modules.
If something here conflicts with `PROJECT_PLAN.md`, this file wins for implementation detail.

**Project root (absolute):** `C:\Users\salpa\Desktop\Claude\WorkOut_App\IronWomen_v1`

---

## 0. The user this is built for

| | |
|---|---|
| Life stage | **transition** (perimenopause) |
| Lifting experience | **new** — currently walks and jogs, has never trained with weights |
| Wake time | **4:00 AM** — up ~90 min before training. Spinal-loading risk is largely mitigated; extended warm-up retained, AM ordering relaxed to a *soft* preference (warn, don't block). |
| Trains | 5:30–6:45 AM Mon–Fri at Bay Club Redondo Beach |
| Classes | **None yet.** She will add them later. App must work perfectly with zero classes configured, and absorb them when added. |
| Equipment | Assume a fully-equipped athletic club. Every exercise is tagged with equipment; nothing is filtered out by default. |

**Consequence — the On-Ramp.** Because she is new to lifting, the default program is a 4-week
**On-Ramp** that teaches patterns at low load (RIR 4–5), then graduates to the Transition-stage
program. `programs.js` must ship both.

---

## 1. Global rules

- **Vanilla JS, ES modules, no build step, no dependencies, no CDN.**
- Every path in HTML/CSS/JS/manifest/SW is **relative** (`./…`). Never a leading `/`.
- **No inline `onclick`.** Event delegation only, via `data-action` (§6).
- All persistence is IndexedDB. Nothing leaves the device.
- No `Date.now()` restrictions here (that limit applies only to workflow scripts) — app code may use dates freely.
- Dates are stored as `YYYY-MM-DD` local-date strings. Timestamps as ISO strings.
- Units: pounds and inches. `lb`, not `lbs`.
- Every file starts with a one-line comment: `// Daybreak — <path> — <one-line purpose>`
- Target: iOS Safari 16+, Chrome Android. No IE, no polyfills.

---

## 2. File manifest

Each row is one agent's deliverable. **Exports are binding.**

| Path | Exports |
|---|---|
| `index.html` | — (shell) |
| `manifest.json` | — |
| `sw.js` | — |
| `css/tokens.css` | — |
| `css/base.css` | — |
| `css/components.css` | — |
| `js/app.js` | — (bootstrap; already written by lead) |
| `js/core/db.js` | `DB` (object) |
| `js/core/store.js` | `Store` (object) |
| `js/core/router.js` | `Router` (object) |
| `js/data/exercises.js` | `EXERCISES` (array), `SHAPE_TARGETS`, `byId(id)`, `search(q, filters)` |
| `js/data/classes.js` | `CLASS_FORMATS` (array), `classById(id)` |
| `js/data/programs.js` | `PROGRAMS` (object), `programFor(profile)` |
| `js/data/standards.js` | `strengthLevel(exerciseId, oneRM, bodyweightLb, age)`, `LEVELS` |
| `js/engine/lifestage.js` | `LIFE_STAGES`, `dialsFor(profile)` |
| `js/engine/progression.js` | `nextTarget(history, exercise, dials)`, `estimate1RM(w, r)`, `adjustForReadiness(target, readiness)` |
| `js/engine/shapemap.js` | `weeklyShapeMap(sessions, sets, classes, dials)`, `targetsFor(dials)` |
| `js/engine/scheduler.js` | `buildWeek(profile, classes, dials, weekStart)`, `detectConflicts(week)` |
| `js/engine/readiness.js` | `readinessScore(r)`, `readinessAdvice(score)` |
| `js/features/today.js` | `id`, `title`, `render(el)`, `actions` |
| `js/features/train.js` | `id`, `title`, `render(el)`, `actions` |
| `js/features/week.js` | `id`, `title`, `render(el)`, `actions` |
| `js/features/shape.js` | `id`, `title`, `render(el)`, `actions` |
| `js/features/me.js` | `id`, `title`, `render(el)`, `actions` |
| `js/features/onboarding.js` | `needsOnboarding()`, `renderOnboarding(el)` |
| `js/features/warmup.js` | `warmupFor(dials, sessionType)`, `renderWarmup(el, plan, onDone)` |
| `js/features/report.js` | `buildReport(weekOf)`, `renderReport(el, report)`, `shareReport(report)` |
| `js/ui/components.js` | `h`, `el`, `card`, `btn`, `stat`, `sheet`, `closeSheet`, `toast`, `confirmDialog`, `fmt` |
| `js/ui/charts.js` | `sparkline(values, opts)`, `barChart(data, opts)`, `ringGauge(pct, opts)`, `bodyMap(shapeData)` |
| `js/ui/timer.js` | `RestTimer` (class) |

---

## 3. Design tokens — `css/tokens.css`

Define **exactly** these names on `:root`. Dark mode overrides only the listed values under
`@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`, and again under
`:root[data-theme="dark"]`.

```css
:root{
  /* surfaces */
  --sand-50:#FBF7F4; --sand-100:#F4EDE7; --sand-200:#E7DBD1; --sand-300:#D8C7B9;
  /* ink */
  --ink-900:#241C26; --ink-700:#3D3140; --ink-500:#6B5F6E; --ink-300:#9C93A0;
  /* accents */
  --clay-500:#C4674F; --clay-600:#A85440; --clay-100:#F5E2DB;
  --plum-700:#4A2E52; --plum-500:#6B4675; --plum-100:#EDE3EF;
  --gold-500:#D99A32; --gold-100:#FAEFD9;
  --sage-500:#6E8B72; --sage-100:#E3EDE4;
  --rose-500:#B3556B; --rose-100:#F6E4E8;
  /* semantic — use these in components, not raw ramps */
  --bg:var(--sand-50); --surface:#FFFFFF; --surface-2:var(--sand-100);
  --border:var(--sand-200); --text:var(--ink-900); --text-dim:var(--ink-500);
  --accent:var(--clay-500); --accent-press:var(--clay-600); --accent-soft:var(--clay-100);
  --brand:var(--plum-700); --win:var(--gold-500); --calm:var(--sage-500); --signal:var(--rose-500);
  /* type */
  --font-display:'Fraunces',Georgia,'Times New Roman',serif;
  --font-ui:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif;
  --fs-hero:2.25rem; --fs-h1:1.75rem; --fs-h2:1.3rem; --fs-body:1.0625rem;
  --fs-sm:0.9375rem; --fs-xs:0.8125rem; --fs-num:1.5rem;
  /* space / shape */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:32px; --sp-7:48px;
  --r-sm:10px; --r:14px; --r-lg:20px; --r-full:999px;
  --shadow:0 1px 3px rgba(36,28,38,.06),0 4px 12px rgba(36,28,38,.05);
  --shadow-lg:0 8px 28px rgba(36,28,38,.12);
  --tap:56px;                 /* minimum touch target */
  --nav-h:68px; --header-h:56px;
  --ease:cubic-bezier(.2,.8,.3,1);
}
```

Dark overrides: `--bg:#171018; --surface:#221926; --surface-2:#2B2030; --border:#3A2D3F;
--text:#F6EFEA; --text-dim:#A99DAE;` plus accents lifted ~8% luminance
(`--clay-500:#D77A61; --gold-500:#E5AC4C; --sage-500:#87A48B; --rose-500:#C76B81; --plum-700:#B69BBE`).

**Fonts:** no CDN. Use `--font-display` with the serif fallback stack above; if a `Fraunces` webfont
file is not present it degrades to Georgia, which is acceptable and still differentiates from IronPulse.

**Rules:** body text ≥ 17px. Numerals use `font-variant-numeric: tabular-nums`. Every interactive
element ≥ `--tap` in its smallest dimension. Primary actions live in the bottom third.

---

## 4. Data shapes

### 4.1 Shape targets — the canonical keys
Used by exercises, shapemap, charts, report. **Do not invent others.**

```js
SHAPE_TARGETS = {
  gluteMax:   { label:'Glutes',        tier:'primary' },
  gluteMed:   { label:'Side glute/hips',tier:'primary' },
  hamstrings: { label:'Hamstrings',    tier:'primary' },
  delts:      { label:'Shoulders',     tier:'primary' },
  back:       { label:'Back',          tier:'primary' },
  triceps:    { label:'Triceps',       tier:'primary' },
  core:       { label:'Core',          tier:'primary' },
  quads:      { label:'Quads',         tier:'secondary' },
  chest:      { label:'Chest',         tier:'secondary' },
  calves:     { label:'Calves',        tier:'secondary' },
  biceps:     { label:'Biceps',        tier:'secondary' },
}
```

### 4.2 Exercise
```js
{
  id:'barbell-hip-thrust',              // kebab-case, unique, stable
  name:'Barbell Hip Thrust',
  pattern:'hinge',                      // squat|hinge|lunge|push-h|push-v|pull-h|pull-v|carry|core|iso|plyo|cardio
  primary:['gluteMax'],                 // SHAPE_TARGETS keys — counts 1.0 set each
  secondary:['hamstrings'],             // counts 0.5 set each
  equipment:['barbell','bench'],        // barbell|dumbbell|machine|cable|smith|bodyweight|band|kettlebell|bench|rack|trapbar|box|mat|cardio
  track:'weight_reps',                  // weight_reps|bodyweight_reps|time_hold|reps_only|time_distance
  tier:1,                               // 1 lead lift | 2 secondary | 3 accessory
  axialLoad:false,                      // heavy spinal compression → AM soft-warn
  impact:false,                         // counts toward the bone/impact target
  unilateral:false,
  pelvicFloorRisk:'low',                // low|moderate|high
  defaultReps:[6,8],
  cues:['Chin tucked, ribs down','Exhale as you drive up','One-count squeeze at the top'],
  swaps:['dumbbell-hip-thrust','glute-bridge'],   // same-pattern alternatives
  beginner:true                         // include in the On-Ramp program
}
```

**Library requirements:** ≥130 exercises. Depth priorities, in order:
glute max, glute med/abduction, hamstrings/hinge, core (anti-extension/anti-rotation/carry),
delts (lateral + rear), back (vertical + horizontal pull), triceps, quads, plyo/impact, cardio.
Every primary target needs ≥8 exercises across barbell / dumbbell / machine / cable / bodyweight so
substitution always has an answer. Cues must include a **breath cue** on every tier-1 and tier-2 lift.

### 4.3 Class format
```js
{
  id:'cycle', name:'Cycle', intensity:'high',        // low|moderate|high
  legFatigue:'very-high',                             // low|moderate|high|very-high
  cnsCost:'moderate',
  counts:{ conditioning:1, resistance:0 },            // resistance 0–1, partial credit allowed
  pairWith:['upper'],                                 // what the 5:30 Stack block should be
  blocks:['lower'],                                   // session types forbidden that morning
  recoveryHours:24,                                   // gap required before a heavy LOWER session
  shapeContribution:{ quads:1 },                      // sets credited toward the Shape Map
  typicalStart:'06:30', durationMin:45,
  note:'Legs take a beating. Lift upper before it.'
}
```
Ship exactly these eight: `hiit`, `hiit-express`, `cycle`, `the-battle`, `battle-on-the-turf`,
`body-pump`, `mat-pilates`, `core-and-more`. Values per `PROJECT_PLAN.md` §6.1.
**Body Pump:** `counts:{conditioning:0, resistance:0.5}`, `pairWith:['lower-heavy']`, and
`note` must say it counts but does not replace heavy work.

### 4.4 Program / session template
```js
PROGRAMS = {
  'on-ramp': {
    id:'on-ramp', name:'On-Ramp', weeks:4,
    forExperience:['new'],
    description:'Four weeks learning the movements at light load.',
    days:[ { key:'lower-a', name:'Lower A', type:'lower', focus:['gluteMax','hamstrings'],
             blocks:{ full:[ {exerciseId:'…', sets:3, reps:[8,10], rir:4, tier:1}, … ],
                      short:[ … ] } }, … ]
  },
  'transition-3day': { … forExperience:['returning','experienced'], … }
}
```
Session `type` ∈ `lower | lower-heavy | upper | full | glute | conditioning | recovery`.
Every day needs **both** a `full` (55–65 min) and a `short` (25–35 min) block list. `short` keeps the
tier-1 lift and the primary shape target; it drops tier-3 accessories.

### 4.5 IndexedDB — `DaybreakDB`, version 1
| Store | keyPath | Indexes |
|---|---|---|
| `profile` | `id` (always `'me'`) | — |
| `classes` | `id` | `dayOfWeek` |
| `sessions` | `id` | `date`, `type` |
| `sets` | `id` | `sessionId`, `exerciseId` |
| `measurements` | `id` | `date` |
| `cycleLog` | `id` | `date` |
| `reports` | `weekOf` | — |
| `prefs` | `key` | — |

```js
profile = { id:'me', name:'', lifeStage:'transition', experience:'new',
  birthYear:null, heightIn:null, weightLb:null, goal:'recomp',
  proteinTargetG:null, pelvicFloor:'unknown',   // never|sometimes|often|prefer-not|unknown
  wakeTime:'04:00', trainTime:'05:30', theme:'auto',
  programId:'on-ramp', programWeek:1, startedOn:'YYYY-MM-DD', units:'lb' }

session = { id, date, startedAt, endedAt, type, programDayKey, blockSize:'full'|'short',
  classId:null, readiness:{sleep:3,energy:3,soreness:3}, notes:'', complete:false }

set = { id, sessionId, exerciseId, setNumber, weight:null, reps:null, seconds:null,
  rir:null, isWarmup:false, loggedAt }

measurement = { id, date, weightLb, waistIn, hipIn, thighIn, armIn, note }
```

---

## 5. Engine contracts

### 5.1 `lifestage.js`
```js
LIFE_STAGES = ['cycling','transition','post']
dialsFor(profile) -> {
  stage, experience,
  heavyDaysPerWeek, rirTarget:[lo,hi], topSetReps:[lo,hi],
  weeklySetsPerPrimary, weeklySetsPerSecondary,
  impactSessionsPerWeek, sprintSessionsPerWeek, easySessionsPerWeek,
  deloadEveryWeeks, proteinGPerKg, warmupMinutes, cycleModule:'date'|'symptom'|'off'
}
```
Values per `PROJECT_PLAN.md` §5.2. **Experience override:** when `experience === 'new'`, force
`rirTarget:[4,5]`, `topSetReps:[8,12]`, `weeklySetsPerPrimary: round(base * 0.7)`,
`impactSessionsPerWeek: min(base, 1)`, `warmupMinutes: base + 2`.
For our user (transition + new): `heavyDaysPerWeek:3, rirTarget:[4,5], topSetReps:[8,12],
weeklySetsPerPrimary:~10, proteinGPerKg:1.8, warmupMinutes:14, cycleModule:'symptom'`.

### 5.2 `progression.js`
- `estimate1RM(weight, reps)` → Epley, capped at reps ≤ 12.
- `nextTarget(history, exercise, dials)` → `{weight, reps, sets, rir, reason}`.
  **Double progression:** all sets at the top of the rep range → add load next session
  (+5 lb lower / +2.5 lb upper), reset reps to the bottom of the range. Otherwise hold load and add
  reps. No history → `{weight:null, reps:dials.topSetReps[0], reason:'first-time'}` and the UI
  prompts for a starting weight.
- `adjustForReadiness(target, readiness)` → returns the target with `weight` scaled by
  1.0 / 0.95 / 0.90 for good / fair / poor, and `dropLastSet:true` when poor. Never scales `null`.

### 5.3 `shapemap.js`
```js
weeklyShapeMap(sessions, sets, classes, dials) -> {
  targets:{ gluteMax:{done:12, target:14, pct:0.86}, … },
  totalSets, primaryOnTarget:5, primaryCount:7,
  impactSessions, shortfalls:[{key,label,short:2}]
}
```
Counting: a logged working set credits **1.0** to each `primary` target and **0.5** to each
`secondary` target of its exercise. Warm-up sets never count. Class attendance credits
`shapeContribution` × `counts.resistance`. Round displayed values to 1 decimal, drop `.0`.

### 5.4 `scheduler.js` — the Stack
```js
buildWeek(profile, classes, dials, weekStartISO) -> [
  { date, dayOfWeek, dayType:'stack'|'solo'|'rest'|'weekend',
    classId:null, className:null, classStart:null,
    session:{ programDayKey, type, blockSize, startTime, estMinutes } | null,
    warnings:[{code, message, fix:{action, payload}}] }
  , … 7 entries
]
```
Rules, applied in order:
- **R0 — zero classes configured:** every training day is `solo` with `blockSize:'full'`. The week is
  just the program's days spread Mon/Wed/Fri (3-day) with weekend sprint + walk. **This is our user's
  current state and must be flawless.**
- **R1 Stack:** a class that morning → `dayType:'stack'`, `blockSize:'short'`, session `startTime`
  = club open (`05:30` weekday, `07:00` weekend), class after.
- **R2 Complement:** pick the session type from the class's `pairWith`; never a type in `blocks`.
- **R3 Protect heavy lower:** no `lower-heavy` session within `recoveryHours` **after** a class with
  `legFatigue` ∈ {high, very-high}. Emit warning `HEAVY_LOWER_TOO_SOON` with a `move-session` fix.
- **R4 Buffers:** classes with `intensity:'low'` are placed between heavy days where possible.
- **Weekend:** club opens 07:00, classes start 08:00 → Saturday defaults to sprint intervals in the
  07:00–08:00 hour; Sunday is walk + report.

`detectConflicts(week)` returns the flattened `warnings` array with `dayIndex` added.

### 5.5 `readiness.js`
`readinessScore({sleep,energy,soreness})` — each 1–5, soreness inverted → 0–100.
`readinessAdvice(score)` → `{band:'good'|'fair'|'poor', factor:1|0.95|0.9, message}`.
Messages are matter-of-fact, never scolding: *"Rough night. Taking 10% off your top sets today."*

---

## 6. UI contracts

### 6.1 Feature module shape
```js
export const id = 'today';
export const title = 'Today';
export async function render(el) { el.innerHTML = `…`; }   // populate, don't replace el
export const actions = {
  'start-session': async (node, data) => { /* data === node.dataset */ },
};
```
`Router` delegates `click` on the content root: it walks up from the target to the nearest
`[data-action]`, looks the name up in the **active feature's** `actions`, and calls
`handler(node, node.dataset)`. Features never attach their own document listeners.
Re-render with `Router.refresh()`.

### 6.2 `components.js`
```js
h(tag, attrs, ...children) -> HTMLElement      // attrs: {class, dataset:{}, on:{click:fn}, ...}
el(html) -> HTMLElement                        // parse an HTML string into one element
card({title, subtitle, body, footer, tone}) -> string   // returns HTML string
btn({label, action, data, variant:'primary'|'ghost'|'danger', size:'lg'|'md'}) -> string
stat({label, value, unit, delta, tone}) -> string
sheet(titleText, bodyHTML, {actions}) -> void  // bottom sheet, focus-trapped, Esc + backdrop close
closeSheet() -> void
toast(message, tone) -> void                   // 2.5s, bottom, above nav
confirmDialog(question, {confirmLabel, danger}) -> Promise<boolean>
fmt = { lb(n), inches(n), pct(n), date(iso), shortDate(iso), duration(sec), num(n) }
```
All builders returning strings must escape interpolated user text.

### 6.3 `charts.js`
Inline SVG only, no libraries. Theme-aware via `currentColor` and CSS vars.
```js
sparkline(values, {w, h, color}) -> svg string
barChart([{label, value, target}], {w, h, horizontal}) -> svg string
ringGauge(pct, {size, label}) -> svg string
bodyMap(shapeData) -> svg string   // front/back female silhouette, regions tinted by pct
```
`bodyMap` is the Shape Map hero. Regions must map to `SHAPE_TARGETS` keys; tint from
`--surface-2` (0%) through `--accent-soft` to `--accent` (100%). Include `<title>` per region for a11y.

### 6.4 `timer.js`
```js
class RestTimer {
  constructor({seconds, onTick, onDone})
  start(); pause(); reset(seconds); add(sec); stop();
  get remaining()
}
```
Survives re-render (module-level singleton reference held by `train.js`). Vibrates via
`navigator.vibrate?.(200)` on completion. Never plays audio in v0.1.

### 6.5 Navigation
Five tabs, bottom nav, in order: **Today · Train · Week · Shape · Me**.
Icons are inline SVG (no emoji in nav). Active tab uses `--accent`.

---

## 7. Voice

Coach, not cheerleader. Specific, warm, never breathless. No emoji in UI chrome.
No streak shaming — a broken streak reads *"Back at it."*
Never make bodyweight the hero number; waist-to-hip ratio is.

✅ "Hip thrust up 15 lb since June."
✅ "Third short night this week. Taking 10% off today."
❌ "You got this, queen! 💪✨"
❌ "No excuses!"

---

## 8. Safety copy (must appear verbatim in `me.js` → About)

> Daybreak gives general fitness guidance. It is not medical advice and does not diagnose or treat
> anything. Talk to a clinician before starting if you have a heart condition, joint injury,
> osteoporosis, or you're unsure. If you leak urine when you lift, jump, cough or sneeze, that's
> common and usually treatable — a pelvic floor physiotherapist can help.

---

## 9. Definition of done for v0.1

- Loads over HTTP with **zero console errors**, offline after first load.
- Onboarding completes in ≤ 6 questions and writes a valid `profile`.
- With **zero classes configured**, Week renders a sensible 3-lift week.
- A full session can be started, warmed up, logged set-by-set, and finished.
- Shape Map renders real numbers from logged sets.
- Weekly report builds, renders, and shares via `navigator.share` with a `mailto:` fallback.
- Data exports to one JSON file and re-imports cleanly.
- Passes at 390×844 (iPhone) with no horizontal scroll.
