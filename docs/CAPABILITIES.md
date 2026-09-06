# Daybreak — what it can and cannot do

A working reference for someone deciding whether to use this app or build on it. Everything
below was checked against the source, not against the README. Where the code does something
different from what the documentation claims, this file says so.

---

## 1. What it is

Daybreak is a single-user, offline-first progressive web app for women aged roughly 30–55 who
lift early in the morning at Bay Club Redondo Beach. It is vanilla JavaScript ES modules — no
build step, no framework, no dependencies, no CDN, no server, no accounts — roughly 14,600 lines
of JavaScript across 30 files, plus four stylesheets, a 93-line shell and a service worker. All
state lives in one IndexedDB
database (`DaybreakDB`, version 1, eight object stores) on the device; nothing is ever
transmitted anywhere. It does four things another training app generally does not: it re-dials
volume, load and rep range by menopausal life stage rather than by age; it schedules the lifting
week around the member's actual class timetable so the two do not interfere; it counts weekly
hard sets against named body-shape targets instead of total pounds lifted; and it grades the
week across four training pillars so a week of nothing but hip thrusts reads as unbalanced. It
was built for one named user — perimenopausal, wakes at 04:00, trains 05:30–06:45 weekdays, no
lifting history — and the defaults are opinionated in her direction.

---

## 2. The five screens

Bottom nav, fixed order: **Today · Train · Week · Shape · Me** (`js/core/router.js`, `TAB_ORDER`).
Routing is by hash (`#today`), rendering is async, and every screen re-renders wholesale via
`Router.refresh()`. All five feature modules open with the same guard — if there is no profile
name, they render nothing and let onboarding take over.

### Today — "what am I doing right now?"

`js/features/today.js` (456 lines).

Builds the current week on every render (`buildWeek`), finds today's entry, resolves it into a
concrete exercise list (`planFor`), and stacks up to six cards:

1. **Hero card**, which has four mutually exclusive states:
   - *Session in progress* — an incomplete session exists for today. One button: Resume.
   - *Class-only day* — a class this morning with no lift block. Buttons: "I went" (writes a
     complete `type:'class'` session immediately) and "Lift instead".
   - *Rest day* — no session scheduled. Buttons: "Log a walk" (writes a complete
     `type:'recovery'` session) and "Train anyway".
   - *Scheduled session* — name, start time, exercise count, estimated minutes. On a Stack
     morning it also draws a `.stack-strip`: lift window → arrow → class time, with the reason
     the order is that way round.
2. **Readiness check** — shown only when there is a session today and none is already open.
   Three 1–5 scales (sleep, energy, soreness) rendered as `.scale-dot` buttons. Once all three
   are answered it shows the verdict inline and offers "Change that". The answers live in a
   module-level `pendingReadiness` variable, handed to `train.js` via `takeReadiness()` when the
   session actually starts — so they are **lost if the app is closed between answering and
   starting**.
3. **Note strip** — one rotating line: the life-stage rationale, the lead lift's breath cue,
   or a deload countdown. Rotation is `Math.floor(Date.now() / 86400000) % notes.length`, so it
   changes daily and deterministically rather than randomly.
4. **This week strip** — sessions done / planned, sets logged, primary targets on target,
   and up to two shortfall chips.
5. **One recommendation** — the highest-priority non-"all good" item from `recommendations()`.
   Deliberately one, not four; the full list lives on Shape.
6. **Protein card** — the daily target if weight is known, otherwise a prompt to add weight.
   A binary Hit it / Missed it, stored as a pref keyed `protein:YYYY-MM-DD`.

Empty state: with no logged data the week strip reads 0 / 3 and the shortfall chips show the
full targets. Offline: everything on this screen is computed locally, so it is unaffected.

### Train — the session runner

`js/features/train.js` (895 lines). A four-state machine held in module scope:
`idle → warmup → active → done`.

**idle** shows the scheduled session with its full exercise list and four ways in: start
warm-up, skip the warm-up, pick a different program day (bottom sheet), or start an empty
session. On a rest day it offers only the last two.

**warmup** hands the whole content element to `renderWarmup()` from `js/features/warmup.js`.
One item at a time, big countdown, progress bar, pause, "short version", and skip. For the
built-for user (transition + new) the plan is 14 minutes / 850 seconds across nine items: three
minutes easy bike or row, four mobility drills at 70 seconds each, three activation drills at
70 seconds, then three minutes of ramp sets. The three-minute temperature raise is fixed and
never trimmed, and it carries an on-screen note explaining why it is the part with the evidence
behind it. `shortWarmup()` keeps the raise, the ramp, and three named drills.

**active** is the screen the app lives or dies on. One exercise at a time, with:
- a target line (`165 lb · 8 reps · 4 sets · leave 4 in the tank`) from `nextTarget()`,
  already adjusted for the morning's readiness;
- the progression message in plain English underneath it;
- the breath cue promoted above the other cues, for tier 1 and 2 movements only;
- a stepper row pre-filled from the last set she logged (falling back to the progression
  target), and a single large check button;
- the list of sets already logged this session, each tappable to edit or delete;
- an inline rest timer with −15s / +15s / skip.

Field shape follows `exercise.track`: `weight_reps` gets weight + reps, `time_hold` gets a
seconds field, `time_distance` gets minutes + distance, and so on. The weight step is 2.5 lb for
dumbbells, 1 for bands and bodyweight, 5 otherwise.

Every logged set is written to IndexedDB immediately (`await DB.put('sets', record)` — the code
comment is explicit that nothing is batched), then `Store.reloadActiveSets()` re-reads. Closing
the app mid-session loses nothing; reopening finds the incomplete session via
`Store.init() → findOpenSession(today)` and drops straight back into **active**. A short
`navigator.vibrate(30)` fires on log, and the rest timer starts automatically. On the last
planned set of a movement a sheet asks "How hard was that?" on a 1–5 scale and writes
`rir = 5 − answer` back onto that set.

Also available mid-session: **Swap** (same-pattern alternatives from `exercise.swaps`, plus a
live search over all 144 exercises) and **Add an exercise** (search, appended to the plan).

**done** shows elapsed time, set count, exercise count, any new best (a heavier estimated 1RM on
a `weight_reps` lift than anything logged before today), the Shape Map targets that moved, and a
post-session protein nudge. Finishing with zero sets logged asks whether to discard, and deletes
the session record if so.

### Week — "does my week hold together?"

`js/features/week.js` (515 lines).

A seven-day list, Monday first, with previous/next week navigation. Each row shows the day, the
date, and one of four layouts: a Stack (lift leg + class leg side by side), a single session, a
class with no lift, or Rest. Completed days get a "Done" badge. Tapping a row opens a sheet with
"Start this session" (today only) and "Add a class this day", which jumps straight to that day
in the real schedule rather than a blank form.

Above the list, any conflicts from `detectConflicts(week)` render as `.warn` strips in plain
English, each with a "Move it" button and a "Dismiss" link.

Below it, **Your classes** — an empty state that explains why classes matter, or the configured
list with, for each, the day and time, how many minutes it leaves to lift beforehand
(`liftWindowMinutes`), an info button, and Remove.

**Browse the schedule** opens the real Bay Club Redondo Beach morning timetable as a bottom
sheet: day tabs, then each slot with its time, studio, instructor, an "i" button, and an Add
button. Each slot carries badges — what pillar or shape target it would help ("helps control,
shape, back"), any collision warning ("it would leave Legs & Bone flat the next morning"), and
the lift window ("60 min to lift first" in sage, "no time to lift first" in the signal colour).
The sheet stays open after an Add so several can be picked in one pass. "Add one that is not
listed" falls through to a manual editor with format, day and time chips.

Offline: the schedule is a hardcoded array, so the picker works with no signal.

### Shape — "is it working?"

`js/features/shape.js` (570 lines). Seven cards, in this order:

1. **Shape Map** — an inline-SVG front-and-back female silhouette (`bodyMap()` in
   `js/ui/charts.js`) with regions tinted by completion, over a list of the seven primary
   targets as label / done / target / bar rows. Tapping a row or a body region opens a sheet
   breaking that target down by exercise ("Hip Thrust Machine — 3 sets"). Secondary targets are
   behind a "Show secondary targets" toggle. Empty state: the map renders at zero with a line
   explaining what will fill it.
2. **Training balance** — the four pillars, each with a percentage, a coloured bar, a one-line
   blurb and an "i" button, plus a verdict naming the thinnest pillar.
3. **What I would do next** — up to four recommendations, each a named action.
4. **Measurements** — waist-to-hip ratio as the hero number with a 14-day delta rendered to
   three decimal places (two rounds a real fortnight of change away to "0"), a sparkline once
   there are more than two readings, then waist, hips, thigh, arm and finally weight, each with
   its own delta. If waist fell and hips rose it prints an explicit recomposition line — judged
   against the 30-day reading where one exists, falling back to 14 days, because hips grow
   slowly and a tape measure reads to the nearest eighth of an inch. Logging weight here also
   recomputes and saves the protein target.
5. **Strength** — up to four tier-1 lifts, each with best estimated 1RM, a sparkline of the
   trend, and a female strength level where a standard exists.
6. **Photos** — a grid of locally stored image blobs with the date, an explicit "these stay on
   this phone" line, and a file input that accepts the camera. Tapping one opens it full size
   with a delete button (double-confirmed).
7. **Weekly report** — builds on demand, renders in place, and offers Send it / Copy text /
   Text it.

Every card has a designed empty state; none of them break with an empty database.

### Me — profile, program, privacy, backup

`js/features/me.js` (421 lines). Nine cards: You (life stage, experience, goal, height, weight,
plus the life-stage rationale in prose), Training (program, week, heavy days, working RIR range,
sets per primary target, warm-up minutes, rest timer), Protein (the arithmetic shown, not just
the answer), Classes (a pointer to Week), Pelvic floor (the current answer, the prevalence
figure, and what the app changes if it is flagged), Your data, Appearance (auto / light / dark),
Demo data, and About.

**Your data** turns amber-toned when the last backup is 14 or more days old, or has never
happened. Export writes one JSON file (`daybreak-backup-YYYY-MM-DD.json`) containing every store;
Restore merges a file back in, tolerating missing or malformed stores rather than throwing.
"Start over" wipes everything behind two separate confirmations.

**Demo data** — `js/dev/seed.js` (470 lines) generates fourteen weeks of deterministic invented
history for a user called Rocio: On-Ramp for four weeks then the three-day programme,
Mon/Wed/Fri, roughly one session in twelve missed, load following an exponential approach curve
(about 63% of the total gain by week 5, 86% by week 10) with occasional two-week stalls, two
classes a week attended about 72% of the time, Saturday sprints in 62% of weeks, Sunday walks in
70%, protein logged most days with adherence improving over time, and fortnightly measurements
where the waist falls, the hips grow and the scale barely moves. It is built from the real
programme definitions, so every exercise id is valid by construction, and it clears the
`sessions`, `sets`, `measurements`, `classes`, `cycleLog` and `reports` stores before writing —
seeding on top of an existing past interleaves two of them and produces trend lines that go
backwards. It exists because an empty fitness app demonstrates nothing: progression, personal
bests, trend lines and the weekly report all need a past behind them.

---

## 3. The training engine

### `js/engine/lifestage.js` — the Life Stage dials

The premise: as oestrogen falls, the same moderate programme stops producing the same result, so
the dials go **up** with stage, not down. Stage is chosen by symptoms in onboarding, never by
birthday, and is changeable at any time.

The table as it is actually coded (ranges in the plan are collapsed to midpoints, `.5` rounding
up, because the app needs one number to prescribe against):

| Dial | `cycling` | `transition` | `post` |
|---|---|---|---|
| `heavyDaysPerWeek` | 3 | 3 | 3 |
| `rirTarget` | 2–3 | 2–3 | **1–2** |
| `topSetReps` | 6–10 | 5–8 | **3–6** |
| `weeklySetsPerPrimary` | 12 | 14 | **17** |
| `weeklySetsPerSecondary` | 6 | 7 | 9 |
| `impactSessionsPerWeek` | 1 | 2 | **3** |
| `sprintSessionsPerWeek` | 2 | 2 | 2 |
| `easySessionsPerWeek` | 3 | 3 | 3 |
| `deloadEveryWeeks` | 7 | 6 | 5 |
| `proteinGPerKg` | 1.6 | 1.8 | **2.1** |
| `warmupMinutes` | 10 | 12 | 15 |
| `cycleModule` | `date` | `symptom` | `off` |

Note what stays flat across all three stages: heavy days, sprint sessions and easy sessions. The
stage changes how hard and how much, not how often.

On top of that sits one **experience override**. When `experience === 'new'`, `rirTarget` is
forced to 4–5, `topSetReps` to 8–12, `weeklySetsPerPrimary` is multiplied by 0.7 and rounded,
`impactSessionsPerWeek` is capped at 1, and `warmupMinutes` gains 2. Deliberately unchanged:
heavy days, protein, sprints, easy work, deload cadence and the cycle module — being new is a
reason to start lighter, not to train less often. `weeklySetsPerSecondary` is also left alone,
which is arguably an oversight but a small one.

For the built-for user (transition + new) the result is verified as: 3 heavy days, RIR 4–5, reps
8–12, **10 sets per primary target per week**, 7 per secondary, 1 impact session, 6-week deload
cadence, 1.8 g/kg protein, **14-minute warm-up**, symptom-based cycle module.

Bad input degrades safely: an unknown stage falls back to `transition` (the middle), an unknown
experience to `new` (the lighter, longer-warm-up direction). Each call returns a fresh mutable
copy, so a feature can override one dial locally without editing the table.

### `js/engine/scheduler.js` — the Stack

816 lines, and the most opinionated file in the project. It returns exactly seven day entries,
Monday first, built from local calendar parts only (no `toISOString`, no `getUTC*` — those would
move a Monday session to Sunday either side of midnight).

Placement is an **exhaustive search**, not a heuristic. It enumerates every ordered subset of
Mon–Fri of the size the programme needs — C(5,3) = 10 candidates for a three-day programme —
keeps programme order, scores each, and takes the cheapest. The cost weights are:

| Cost | Value | Meaning |
|---|---|---|
| `COST_BLOCKED` | 1000 | R2 — the class forbids this session type outright |
| `COST_RECOVERY` | 500 | R3 — legs will not be recovered |
| `COST_BACK_TO_BACK` | 200 | two lower days with no day between |
| `COST_STACK_MISMATCH` | 45 | stacking onto a class that did not ask for this type |
| `COST_ADJACENT` | 12 | any two lift days on consecutive mornings |
| `COST_STACK_MATCH` | 10 | stacking at all — it costs volume |
| `COST_ORDER` | 5 | per pair of programme days run out of written order |
| `COST_DRIFT` | 3 | per day away from Mon/Wed/Fri — the tie-breaker |
| `BONUS_BUFFER` | −4 | R4 — a low-intensity class left between two lift days |

The hard rules cost enough that no accumulation of soft preferences can outvote them.

**R0 — zero classes.** Every training day is `solo`, `blockSize: 'full'`, spread Mon/Wed/Fri via
`CANONICAL_SPREAD[3] = [0, 2, 4]`, Saturday sprint intervals at 07:00, Sunday walk plus report.
This is the built-for user's actual state and it is verified to produce exactly that: Lower A
Monday 05:30 (70 min), Upper Wednesday, Lower B Friday with impact work attached, Saturday
sprints 30 min, Sunday walk 50 min, no warnings.

**R1 — Stack.** A class that morning makes the day `dayType: 'stack'`, the lift block `short`,
and the lift starts at club open — 05:30 weekday, 07:00 weekend. `MIN_STACK_WINDOW` is 20
minutes; if the class starts at the door there is no room, so the lift moves *after* it rather
than being dropped, with a note saying she will already be warm.

**R2 — Complement.** The session type comes from the class's `pairWith` list, never from its
`blocks` list. Types share a family, so `lower` can satisfy a `pairWith` of `lower-heavy`.

**R3 — Protect heavy lower.** No lower-body session within `recoveryHours` after a class with
`legFatigue` of high or very-high. Classes recur weekly, so each one is also tested at
`dayIndex − 7`: a Sunday cycle class really does sit 21 hours before Monday's lift. Emits
`HEAVY_LOWER_TOO_SOON` with a `move-session` fix.

**R4 — Buffers.** A free morning carrying a low-intensity class, sitting between two lift days,
earns a small bonus.

Four warning codes are emitted: `HEAVY_LOWER_TOO_SOON`, `BACK_TO_BACK_HEAVY`, `TOO_MANY_HEAVY`
(more lifting days than `heavyDaysPerWeek`) and `NO_IMPACT` (no landings anywhere in a week where
`impactSessionsPerWeek > 0`). Each carries a `fix` with an action and a payload, and
`detectConflicts()` flattens them with the day index attached.

Impact work is assigned after placement: the **last** full-block lower or full session of the
week carries it first, and if the pelvic-floor answer is `sometimes` or `often` the copy changes
from "3 × 8 box jumps or pogo hops" to "low landings — 3 × 8 pogo hops or step-downs, exhaling
on the effort".

**An honest note on the Stack.** Stacking costs 10 in the layout scorer and a clear morning costs
nothing, so the scheduler takes a free morning when one is genuinely cheaper. But it does stack
readily, and from a single class. Verified with a three-day programme on the week of 7 Sep 2026:

| Classes configured | Result |
|---|---|
| none | Mon/Wed/Fri solo, no stacking — R0 |
| Core & More **Thursday** (a rest day) | lifts stay Mon/Wed/Fri; Thursday is class-only |
| Core & More **Monday** (a lift day) | **Monday stacks** — Glutes & Hamstrings *short* at 05:30, class at 06:30 |
| Mat Pilates Tue + Core & More Thu | lifts stay Mon/Wed/Fri; both class days are class-only |
| four weekday classes | four days stack, two of them with a lift block |

So the deciding factor is not *how many* classes there are but *where they land*: a class on a
morning the programme already wants produces a real Stack, and a class on a rest day does not
displace anything. The README's framing holds. What is fair criticism is that `dayType` is set to
`'stack'` for **any** day carrying a class, including days with no lift block at all, which makes
the field a poor thing to branch on — `week.js` correctly checks `day.session` as well, and
anything new reading `dayType` should do the same.

Also verified: with HIIT on Monday 06:00, BODYPUMP Wednesday and Cycle Friday, the scheduler
puts Lower A on Tuesday, Upper on Wednesday (stacked before BODYPUMP, short block) and Lower B
on Thursday, then raises `HEAVY_LOWER_TOO_SOON` on the Tuesday because Monday's HIIT needs 24
hours and only 22.7 are available. There is no free weekday to move it to, so the message ends
"Move it later in the week, or take 10% off the top set" rather than offering a false fix. That
is the right behaviour: it does not pretend the week is clean.

### `js/engine/progression.js` — double progression and autoregulation

Three exports. Nothing in the file throws; empty history, null weights, a malformed set object
or a missing `dials` all return a usable target. The stated reason is that this runs at 05:40 on
a phone in a concrete room, and a thrown error is a lost session.

`estimate1RM(weight, reps)` is Epley — `w × (1 + r / 30)` — and returns `null` above 12 reps,
where the formula stops being honest, or without a real weight.

`nextTarget(history, exercise, dials)` groups prior sets into sessions (by `sessionId`, falling
back to the logged date, then to one bucket), drops warm-ups entirely, and returns one of four
outcomes:

- **`first-time`** — no history. Weight `null`, reps at the bottom of the range, the easier end
  of the RIR range, and the message "First time — pick a weight you could do about 12 times and
  stop 4 short."
- **`add-load`** — every working set last session reached the top of the rep range. Load goes up
  by `+5 lb` for lower-body or tier-1 movements and `+2.5 lb` for anything upper-body, isolation
  or tier-3, and reps reset to the bottom. If the movement is loadable but no weight was ever
  written down, it asks for one once, without scolding. If it is a bodyweight movement it
  suggests a dumbbell, a vest or the harder variation instead.
- **`stalled`** — three sessions on the board and not one improved on load, reps at the top load,
  or total reps. It names the first entry in `exercise.swaps` and says to rotate rather than
  grind.
- **`add-reps`** — the default. Hold the load, chase one more rep (or five more seconds on a
  hold), and say explicitly what unlocks the next jump.

Rep ranges follow the life-stage dials for tier 1 and 2, but a tier-3 accessory keeps its own
`defaultReps` — five reps of a cable abduction is not a thing — and any time-based movement
always keeps its own, because a 60-second plank measured against an 8–12 "rep" range would read
as permanently past the top.

`adjustForReadiness(target, readiness)` returns a **new** object, never mutating the input, so
the UI can honestly show "adjusted for today". Weight is scaled by 1.0 / 0.95 / 0.90 for good /
fair / poor, re-rounded to the movement's grain (5 lb for barbells and machines, 2.5 lb for
dumbbells and kettlebells), and `dropLastSet` is set on poor. A `null` weight stays `null`. It
accepts either the advice object from `readiness.js` or the raw `{sleep, energy, soreness}`
triple, so a caller cannot get the order wrong.

Worked example, verified: three sets of the hip thrust machine at 90 lb × 12 (the top of an 8–12
range) produces `95 lb × 8, 3 sets, RIR 5, reason "add-load"`. Push that through a readiness
score of 20 and the prescription becomes `85 lb`, `dropLastSet: true`, with both messages
concatenated.

### `js/engine/readiness.js` — the three-tap check

Three 1–5 inputs, weighted **sleep 0.5, energy 0.3, soreness 0.2** (soreness inverted), scaled
to 0–100. Sleep carries the most weight because at a 04:00 wake and a 05:30 lift it is the best
single predictor of a session that will not go well, and the one input she cannot fix in the
moment.

Bands: **0–39 poor** (factor 0.90, drop the last set), **40–66 fair** (0.95), **67–100 good**
(1.0). Each band has four message variants selected by position within the band, so the same
morning always produces the same sentence — no reshuffling on re-render. Messages never claim a
specific cause ("you slept badly"), because a score can reach a band by several routes. All
threes scores 50, which lands in *fair*: the default answer costs 5% off the top set.

### `js/engine/shapemap.js` — the credit maths

The unit is the hard set, not the pound. Rules, all of them:

- A logged working set credits **1.0** to every key in the exercise's `primary` array and
  **0.5** to every key in `secondary`.
- A key listed in both arrays of one exercise is credited once, at 1.0.
- Warm-up sets never count. A set whose `exerciseId` does not resolve is skipped silently.
- An attended class credits `shapeContribution × counts.resistance` per key. Cycle is resistance
  0, so it credits nothing at all. BODYPUMP is 0.5, so its `quads: 2` lands as 1.0 — verified.
- Unknown keys in a class's `shapeContribution` are ignored; `SHAPE_TARGETS` is the whole world.
- `totalSets` counts logged set records only. It deliberately excludes class credit, because a
  class is not a set she logged; class credit shows up in the per-target numbers instead.
- `pct` is a fraction, not a percentage, clamped at 1.5 so one enormous week cannot blow out a
  chart. A target of 0 yields `pct` 1 rather than `Infinity`.
- A target that rounds level with its goal counts as hit rather than being nagged over 0.04.

**Targets are weighted per muscle, not flat.** This is the most recent change to the engine and
it is worth understanding, because the naive version was actively harmful. The 10–20 sets a week
evidence is about major muscle groups; applying it flat across triceps and glutes alike sets a
bar the programme itself cannot clear. A perfect week of Transition — 3 Day delivers 24 sets of
glute work and 4.5 of triceps, so a flat target of 14 would have marked her permanently short on
the small muscles no matter what she did, and an app that always says you failed is one you stop
opening. `targetsFor(dials)` therefore multiplies the base by a per-key weight and rounds to the
nearest half set:

| Key | Weight | Rationale |
|---|---|---|
| `gluteMax`, `quads` | 1.00 | the headline targets; get the most direct work |
| `back` | 0.90 | |
| `hamstrings` | 0.85 | |
| `chest` | 0.80 | |
| `delts` | 0.75 | lateral and rear only, not pressing volume |
| `gluteMed`, `calves`, `biceps` | 0.70 | small muscle, high frequency, less volume needed |
| `core` | 0.60 | quality over quantity, and classes add plenty |
| `triceps` | 0.45 | gets substantial indirect work from every press |

For the built-for user (base 10 primary / 7 secondary) that resolves to: glutes 10, back 9,
hamstrings 8.5, shoulders 7.5, side glute 7, core 6, triceps 4.5, quads 7, chest 5.5, calves 5,
biceps 5.

Verified worked examples:

- One full On-Ramp Lower A block is **17 logged sets** and credits gluteMax 9, hamstrings 7.5,
  gluteMed 3, quads 3, core 2, back 1.5, calves 1.5, and nothing to delts or triceps. Ordered
  biggest first, the shortfalls are Back −7.5, Shoulders −7.5, Triceps −4.5, Core −4, Side glute
  −4, Glutes −1, Hamstrings −1 — which is exactly the list the recommendation engine reads
  top-down.
- A **perfect On-Ramp week** (all three days, full blocks, no classes) is 53 sets and puts
  **7 of 7** primary targets on plan.
- A **perfect Transition — 3 Day week** is 59 sets and puts **4 of 7** on plan, short by 2.5 sets
  of core, 2 of triceps and 0.5 of shoulders. Adding her two actual classes (Mat Pilates and
  Core & More) closes core to 0.5 short. The targets are reachable but not automatic, which is
  the point.

Note what neither of those weeks does: the `cardio` pillar sits at 6–9% on lifting alone. The
pillar grade, not the Shape Map, is what tells her that.

### `js/data/pillars.js` — the four pillars

The Shape Map answers "which muscles". The pillars answer "is the week balanced?"

| Pillar | What it is | Why the app insists on it |
|---|---|---|
| **Resistive** | Loading muscle hard enough that it has to adapt | The non-negotiable one — 10–20% of lean muscle can go through the transition |
| **Control** | Stability, mobility, balance, deep core | Decides whether she is still training in five years |
| **Cardio** | Heart, lungs, conditioning — polarised, not the middle | Where most of the fat-loss and heart-health return lives |
| **Shape** ("Lady improvements") | Glutes, hips, shoulder cap, waist | The targeted work; contrast does more than weight loss |

Weekly targets in "pillar points", by stage, scaled by 0.7 for a beginner so her first month does
not open with four red bars:

| | resistive | control | cardio | shape |
|---|---|---|---|---|
| cycling | 30 | 10 | 12 | 24 |
| transition | 34 | 12 | 14 | 28 |
| post | 40 | 14 | 14 | 32 |
| transition + new (verified) | 24 | 8 | 10 | 20 |

`pillarScore(exercise)` is **derived from the exercise's own metadata**, so a newly added
exercise is scored automatically with no table to update: loaded compounds score 1.0 resistive
(×1.2 for tier 1, ×0.8 for tier 3), bodyweight 0.5, cardio 0; control accrues 0.8 for a core or
carry pattern, 0.4 for unilateral, 0.2 for unloaded, 0.3 for plyo, capped at 1.2; cardio is 1.0
for `time_distance` or `pattern: 'cardio'`, 0.3 for plyo; shape is 1.0 per primary and 0.5 per
secondary key that is in the primary tier, capped at 2. Classes contribute
`format.pillars[id] × (durationMin / 50) × 6`. A completed conditioning session adds a flat 6 to
cardio; a recovery session adds 2 control and 1.5 cardio.

### `js/engine/recommend.js` — what to do next

Three tiers of advice in priority order — structure and safety, pillar gaps, then Shape Map
shortfalls — capped at four items and sorted by priority. Every recommendation names a concrete
action. "Do more cardio" is not advice; "Masters Swim, Thursday 6:30 — the only hard cardio that
will not cost you Friday's legs" is.

**The `weekMatured` guard** is the part worth copying. Nagging about a gap on Monday morning,
before she has trained once, is how an app teaches someone to ignore it. So:

```js
const weekMatured = dayIndex >= 4 || (plannedSoFar > 0 && done.length >= plannedSoFar);
```

Pillar-gap and shortfall advice is suppressed entirely until either it is Friday or later, or
she has already completed everything planned so far this week. Verified: on the Monday of an
untrained week the only recommendation is the class-planning one (a planning gap, not a
performance gap, so it is exempt); by Friday the same inputs produce three, including
"Resistive training is the gap" and "Back is behind — 10 sets short this week. Two extra sets of
Lat Pulldown covers it." The "nothing to fix" card also changes wording depending on maturity:
"Your week is well built" before, "Nothing to fix" after.

**Beginner down-ranking** in `rankClasses()`: when `dials.experience === 'new'`, a class with
`legFatigue: 'very-high'` loses 8 points, `cnsCost: 'high'` loses 4, and a low-intensity or
low-leg-cost class gains 3. The comment is honest about it — these are good classes; they are a
bad first class. Beyond that, a class scores on the pillar gaps it would fill
(`contribution × deficit × 10` where contribution exceeds 0.4), the shape shortfalls it would
close (`credit × resistance × 2`), plus small bonuses for low leg cost, and loses 6 for any
collision with the existing week.

`collisionReason()` checks three things: does the class forbid what is already scheduled that
morning; would it leave a lower-body day flat the next morning; and is there at least 25 minutes
between the doors opening and the class starting.

Verified ranking for an empty week for the built-for user: Core & More Thursday 6:30 (21.5),
Masters Swim Tuesday and Thursday (20.3), Mat Pilates Tuesday (16.5), BODYPUMP Wednesday (15.5),
Stretch & Mobility Friday (15). No very-high-leg-cost class in the top six — the down-ranking is
doing its job.

`starterClasses()` is the cold-start menu: HIIT Express, Mat Pilates, Masters Swim, Core & More
and Stretch & Mobility, filtered to those leaving at least 25 minutes to lift first.

### `js/engine/sessionplan.js` — the small but load-bearing one

84 lines that resolve a scheduled day into concrete movements, so Today and Train agree on
exactly one answer rather than each deriving their own. `planFor(profile, session)` picks the
programme day by `programDayKey`, reads `blocks.full` or `blocks.short` per the session's
`blockSize`, and resolves every `exerciseId` through `byId()`. **Items whose exercise no longer
resolves are dropped with a console warning rather than rendered as a blank row** — an exercise
library edit should never strand her mid-session.

### `js/data/standards.js` — female strength standards

This file exists to fix one specific defect in the predecessor app, which shipped
`strengthLevel(exercise, oneRM, bodyweight = 180, gender = 'male')` and quietly graded women
against male norms. Here there is no gender parameter, no default bodyweight, and no fallback:
without a real bodyweight it returns `null` rather than inventing one.

**15 lifts** are graded, with **36 aliases** absorbing common id spellings. Thresholds are 1RM as
a multiple of bodyweight, at the point of entering each level, with the load basis recorded
per lift (`barbell` = total on the bar, `machine` = the stack, `per-hand` = one dumbbell, which
is what the set logger stores). The hip thrust runs far higher than anything else — novice 1.00,
elite 2.60 — because a strong woman thrusting twice bodyweight is normal.

Age adjustment is 0.5% off the required ratio per year past 40, floored at 15% off at age 70.
Deliberately mild: LIFTMOR had post-menopausal women training above 85% 1RM safely, so age lowers
the bar a little, not out of reach. The `untrained` level is a real category but is displayed as
"Starting out"; nothing in the app calls a woman untrained to her face.

**Coverage is the weak spot.** 15 of 144 exercises are gradable, and 12 of the 17 tier-1 lifts.
The five uncovered tier-1 movements are `machine-hip-thrust`, `smith-hip-thrust`,
`bulgarian-split-squat`, `pull-up` and `chest-supported-row` — and the first of those is the lead
lift of the On-Ramp, so a beginner's headline movement shows no strength level at all for her
first four weeks.

---

## 4. The data

### Exercises — `js/data/exercises.js`, 2,870 lines, 144 entries

Integrity, checked by loading the module: **zero** duplicate ids, **zero** broken `swaps`
references, **zero** entries without cues, **zero** entries without swaps.

By tier: 17 tier-1 lead lifts, 56 tier-2, 71 tier-3 accessories.

By primary shape target (an exercise can hit several; the count is exercises naming that key in
`primary`, with beginner-safe ones in brackets):

| Target | Tier | Primary | Secondary | Beginner-safe primaries |
|---|---|---|---|---|
| `gluteMax` | primary | 35 | 11 | 23 |
| `core` | primary | 21 | 14 | 16 |
| `hamstrings` | primary | 14 | 16 | 8 |
| `gluteMed` | primary | 13 | 11 | 12 |
| `delts` | primary | 13 | 10 | 10 |
| `back` | primary | 13 | 18 | 10 |
| `triceps` | primary | 9 | 11 | 7 |
| `quads` | secondary | 23 | 5 | 16 |
| `chest` | secondary | 9 | 3 | 8 |
| `calves` | secondary | 7 | 3 | 7 |
| `biceps` | secondary | 6 | 12 | 5 |

Every primary target clears the contract's floor of eight movements, and the depth ordering
matches the stated priorities: glute max is by far the deepest at 35, then core at 21.

By pattern: `iso` 38, `hinge` 22, `core` 17, `push-h` 11, `cardio` 10, `lunge` 9, `plyo` 9,
`squat` 7, `pull-h` 7, `pull-v` 6, `carry` 4, `push-v` 4.

By tracking type: `weight_reps` 93, `bodyweight_reps` 22, `reps_only` 12, `time_distance` 10,
`time_hold` 7.

By equipment (an exercise may list several): bodyweight 35, dumbbell 31, machine 25, mat 23,
bench 20, cable 20, barbell 16, rack 9, cardio 9, kettlebell 6, box 6, band 4, smith 2,
trapbar 1. The bias toward bodyweight, dumbbells, machines and cables over barbells is
deliberate — it is what makes the On-Ramp buildable and what makes substitution always have an
answer.

Flags:
- **`beginner: true` on 111 of 144** (77%). Every movement pattern has at least one machine,
  cable, dumbbell or bodyweight option marked beginner, so the whole On-Ramp is built from them.
- **`impact: true` on 9**: box jump, pogo hop, broad jump, skater jump, split jump, drop squat,
  step-down, jump rope, heel drop. These are the movements that count toward the bone target.
- **`axialLoad: true` on 7**: conventional deadlift, sumo deadlift, good morning, back squat,
  front squat, smith machine squat, overhead press. These are the ones the 05:30 ordering rule
  is about, and none of them appear anywhere in the On-Ramp.
- **`unilateral: true` on 27.**
- **`pelvicFloorRisk`**: 110 low, 17 moderate, 17 high.

**Breath cues.** 138 of 144 exercises carry a cue matching exhale / breath / breathe / inhale,
and **all 73 tier-1 and tier-2 movements do, with none missing**. Nothing in the file coaches
breath-holding or a Valsalva brace — that is the exact mechanism behind the pelvic-floor
symptoms this population reports. The six without a breath cue are all tier-3.

**Deliberate omissions**, and they are real, not accidental: there is no heavy shrug, no loaded
side-bend and no weighted twist anywhere in the library. Exactly one lightly loaded rotational
movement ships (`standing-cable-woodchop`, tier 3), and the upright row ships tier 3 with a cue
explaining it is de-emphasised in favour of lateral raises.

`search(q, filters)` supports free text over name and id, plus filters on target, equipment,
pattern, tier and beginner, sorting name-prefix matches first, then by tier, then alphabetically.

### Classes — `js/data/classes.js`

**14 formats**, each carrying load metadata (intensity, `legFatigue`, `cnsCost`,
`counts.conditioning`, `counts.resistance`, `pairWith`, `blocks`, `recoveryHours`,
`shapeContribution`, four pillar scores, `typicalStart`, `durationMin`) plus a `note`, a `what`
(what happens in the room) and a `why` (what it does for her). The eight the contract mandated —
`hiit`, `hiit-express`, `cycle`, `the-battle`, `battle-on-the-turf`, `body-pump`, `mat-pilates`,
`core-and-more` — plus six more from the real timetable: `masters-swim`, `box-n-burn`,
`kickboxing`, `stretch-mobility`, `vinyasa-flow`, `zumba`.

The metadata is where the scheduling intelligence actually lives. Some illustrative rows:

| Format | `legFatigue` | `recoveryHours` | `counts.resistance` | `pairWith` | `blocks` |
|---|---|---|---|---|---|
| Cycle | very-high | 24 | 0 | upper | lower, lower-heavy, glute |
| Battle on the Turf | very-high | 36 | 0.5 | upper | lower, lower-heavy, glute, full |
| HIIT | high | 24 | 0.25 | upper | lower, lower-heavy, glute, full |
| Box n Burn | moderate | 12 | 0.25 | lower-heavy, lower, glute | **upper** |
| BODYPUMP | moderate | 12 | 0.5 | lower-heavy | *(none)* |
| Masters Swim | low | 0 | 0.25 | lower-heavy, lower, glute | *(none)* |
| Mat Pilates | low | 0 | 0.25 | lower-heavy, upper | *(none)* |
| Stretch & Mobility | low | 0 | 0 | all four | *(none)* |

Box n Burn is a good example of the metadata earning its keep: it barely touches the legs so it
pairs with a lower-body lift, but it hammers the shoulders, so it *blocks* an upper day.

**18 real schedule slots**, transcribed from the Bay Club Connect app for the week of 14 Sep
2026, each with day, start, end, studio and instructor:

| Day | Slots |
|---|---|
| Monday | HIIT 06:00, The Battle 07:00, Cycle 07:30 |
| Tuesday | HIIT Express 06:00, Mat Pilates 06:30, Masters Swim 06:30 |
| Wednesday | BODYPUMP 06:30, Battle on the Turf 07:00, Box n Burn 08:00 |
| Thursday | HIIT Express 06:00, Masters Swim 06:30, Core & More 06:30 |
| Friday | HIIT 06:00, Cycle 06:15, Stretch & Mobility 07:00 |
| Saturday | Kickboxing 08:00, All Level Vinyasa Flow 08:00, Zumba 09:00 |
| Sunday | **none** |

`liftWindowMinutes(start, openTime)` computes how much room each slot leaves for a lift
beforehand, given 05:30 weekday and 07:00 weekend opening. The comment is explicit that
instructors and times drift and that this is a starting menu, not a contract — every slot's time
is editable after adding.

### Programs — `js/data/programs.js`

**Two programmes, three days each.**

`on-ramp` — 4 weeks, `forExperience: ['new']`, the default. Lower A (Glutes & Hamstrings), Upper
(Shoulders & Back), Lower B (Legs & Bone). Every exercise in it is `beginner: true` and **not
one is `axialLoad: true`** — machines, dumbbells and cables ahead of barbells, RIR 4 throughout
(RIR 5 in week 1), reps 8–12. The lead lifts are the hip thrust machine, the lat pulldown and
the goblet squat, and impact is introduced as the heel drop rather than the box jump.

`transition-3day` — 6 weeks, `forExperience: ['returning', 'experienced']`. Lower A leads with
the barbell hip thrust; Upper leads with the lat pulldown and contains no shrugs and no heavy
upright rows, with the reason written into the day's description; Lower B is `lower-heavy`, leads
with a trap-bar deadlift at 5×5, and carries the box jump for bone.

**Block sizes, verified:** every programme day is 6 exercises in `full` and 4 in `short`.
Estimated minutes run 55–64 for full and 29–34 for short, matching the contract's 55–65 / 25–35.
The `short` block is triage, not dilution: it keeps the tier-1 lift and the day's primary shape
target and drops the tier-3 accessories.

**Six session templates** — `upper`, `lower`, `lower-heavy`, `glute`, `conditioning`, `recovery`
— shared by both programmes and used by the scheduler on Stack days and for substitutions. The
four lifting templates are 6 full / 4 short; `conditioning` and `recovery` are 5 full / 3 short.

There is a **load-time integrity check** at the bottom of the file that re-validates every
`exerciseId` in every block of every programme and template, and additionally asserts that every
On-Ramp movement is beginner-flagged and non-axial. It logs to `console.warn` and is silent when
everything resolves, which is the shipping state. This is a genuinely good pattern: the failure
mode it prevents is a blank exercise card mid-session, which is the worst possible place to find
out.

`programFor(profile)` is driven by experience alone; an explicit `programId` is honoured only
when the experience value matches no programme. Graduating out of the On-Ramp is therefore a
matter of changing `experience` and nothing else.

### Info panels — `js/data/info.js`

Hand-writing 144 explanations would rot the moment the library changed, so the "i" panel is
composed from the exercise's own metadata — pattern, targets, equipment, impact, tier — against
`TARGET_WHY`, a library of what each of the eleven shape targets actually changes. **26
movements that carry the programme get a hand-written override on top.** The rule is stated in the file header and
followed: never just name the muscle, say what it changes. Contextual flags are appended
automatically for impact, axial load, high pelvic-floor risk and unilateral work.

---

## 5. What it deliberately does not do

These are decisions, argued in `PROJECT_PLAN.md` sections 2 and 13 and implemented in the code.

**No food diary, and no calorie counting.** Food logging has famously poor adherence and the
payoff for this population is concentrated in one variable. So the app ships one number —
bodyweight in kg × the life-stage multiplier, computed at onboarding and recomputed whenever
weight is logged — a per-meal floor of roughly 30–40 g, a post-session nudge on the Train summary
screen, and an optional binary daily tap. That is the entire nutrition feature. Deficit guidance
exists only as prose (200–400 kcal, with an explicit warning against going harder) and there is
no mechanism anywhere to log or count food.

**The cycle module tracks, it does not dictate.** The evidence on phase-based programming is
genuinely contested — one 2022 review suggests follicular-phase training may be superior, a 2023
review finds no effect on either acute performance or adaptation, and reviewers repeatedly cite
near-negligible effect sizes and conclude that general recommendations should not be made. So
there is no phase-based mesocycle. `dialsFor()` returns a `cycleModule` value of `date`,
`symptom` or `off` by stage, and the intended design is optional private logging plus one-tap
autoregulation on a bad day — which is good practice regardless of cause. In the shipped build
this restraint is total: the `cycleLog` store exists in the schema and **nothing reads or writes
it**, and `cycleModule` is computed and never consumed. Under-promising here is the correct
direction, but see section 6 — it currently under-delivers as well.

**Bodyweight is never the hero number.** This is enforced at three separate levels. In
`shape.js` the `.measure-hero` block is waist-to-hip ratio, and weight is the *last* of five
rows. In `report.js` the same ordering holds and the hero carries the line "This is the number
that matters, not the scale." In `shapemap.js` the whole unit of account is the hard set rather
than total pounds lifted, because pounds reward the squat and make a lateral raise look like
nothing — which is exactly backwards for this goal. Both the Shape screen and the report detect
waist-down-and-hips-up over a 30-day window and name it: "That is recomposition — exactly what
the scale cannot show you." In recomposition the scale can sit flat for six weeks while the body
visibly changes, and a scale-first progress screen is the most reliable way to make someone quit
a programme that is working. The commitment goes as far as the rounding: waist-to-hip deltas
render to three decimal places specifically because a real fortnight of change is a few
thousandths, and two decimals displayed it as "0".

**Heavy shrugs and loaded twists are minimised, and the app says why.** Trap bulk shortens the
neckline and loaded rotation thickens the waist — both the opposite of the shoulder-to-waist
contrast the whole programme is steering toward. So there are no heavy shrugs, no loaded
side-bends and no weighted twists in the library at all; the upright row ships tier 3 with a cue
explaining its demotion; the one rotational movement is a light cable woodchop. The Upper day's
description says it outright, and the `shape` pillar's `why` text says it again: "heavy shrugs
and loaded twists are kept low precisely because they thicken the neck and waist." Telling her
this matters, because otherwise the omission looks like an oversight.

**BODYPUMP counts at half credit and no more.** `counts: { conditioning: 0, resistance: 0.5 }`,
so its `shapeContribution` is halved before it lands on the Shape Map — `quads: 2` becomes 1.0,
everything else 0.5. Its `pairWith` is `['lower-heavy']` and its `blocks` list is empty. The
reasoning is in its own `why` text and is not hedged: this is real resistance training and it
counts, but a light bar for sixty reps does not load bone or muscle the way heavy sets do, and at
this stage heavy loading is the part that protects bone density. Cycle, by contrast, gets
`resistance: 0` and credits nothing to the Shape Map at all — it is excellent cardio that builds
almost no muscle, and the app refuses to let it look like lower-body training. The info sheet
surfaces the credit percentage explicitly for any class between 0 and 1: "Counts toward your
weekly sets at 50% credit — real training, but not a replacement for heavy lifting."

**No streak shaming and no negative framing.** Poor readiness produces "Going lighter, not
skipping — this still counts", never a failure state. A missed week is invisible rather than
punished. `PROJECT_PLAN` is explicit that this cohort churns on negative feedback.

---

## 6. Honest limits

**No scheduled email is possible from a static PWA.** This is the one everybody assumes works.
Periodic Background Sync is Chrome-only, requires an install plus a high engagement score, and
does not exist on iOS at all. `maybeNudge()` is honest about it in a code comment: it fires
*while the app is open*, on Sundays, once per day, and shows a `Notification` only if permission
has already been granted. The actual flow is nudge → tap → render → one tap to share, via
`navigator.share`, falling back to `mailto:` (body trimmed at 1,800 characters), then to the
clipboard, then to a `textarea` + `execCommand` trick for in-app browsers that block the
Clipboard API. SMS needs different syntax per platform (`sms:&body=` on iOS, `sms:?body=` on
Android) and `report.js` handles both. The mitigation for the future is architectural rather
than promised: `buildReport(weekOf)` is a pure function returning a structured object with no
display strings in it, and rendering is entirely separate, so a small backend could send these
automatically without any of this being rewritten.

**iOS will quietly delete the data.** Safari can evict site storage after roughly seven days of
non-use, and installed PWAs still have weaker durability guarantees than native apps. Daybreak's
answer is a 14-day backup prompt (the Your data card turns amber), one-file JSON export and a
merge-tolerant import — but that is a mitigation, not a fix. Nothing about IndexedDB on iOS is
guaranteed, and there is no cloud copy by design.

**The class schedule cannot auto-sync.** The public Bay Club schedule page renders from an
authenticated Bay Club Connect endpoint; the public HTML contains only template placeholders and
there is no unauthenticated API. So the 18 slots in `classes.js` are transcribed by hand from a
single week in September 2026, complete with instructor names that will drift. The app's response
is to treat the list as a starting menu — every slot's time is editable after adding, and
"Add one that is not listed" covers anything missing. It will never break when their API changes,
because it never depended on it; it will silently go stale when their timetable does.

**No Sunday classes.** The loaded schedule covers Monday to Saturday only, because the source
screenshots did not include Sunday. The scheduler defaults Sunday to a walk plus the weekly
report, which is a reasonable stand-in, but a member with a Sunday class has to add it manually.

**No wearable sync.** No Apple Health, no Garmin, no heart rate, no step count, no sleep data.
Readiness is three taps, not a HRV reading. Explicitly out of scope in `PROJECT_PLAN` §13.

**No video demos.** Every movement is taught by text cues — typically three per exercise — and
nothing else. There are no images, no animations and no links out. For a first-time lifter this
is the app's largest single gap: "Bench across the shoulder blades, not the neck" is a good cue,
and it is still not a picture.

**Single-user only.** The profile is keyed `'me'`, there is one IndexedDB database per origin,
and there is no concept of a second person. Two women sharing a phone share a training history.
Anyone can install the same URL and get their own private copy, but there is no way to move
between profiles on one device.

**Several settings are stored but never read.** Verified by grep:
- `rest:default` — the "Rest timer" row in Me writes this pref, but `train.js` never reads it;
  rest comes from the programme item's `restSec`, or 150 seconds for a tier-1 lift and 90
  otherwise. Changing the setting does nothing.
- `session:overrides` — the "Move it" button on a Week warning writes
  `{ programDayKey: toDayIndex }` and toasts "Moved. Your week is clear." The scheduler never
  reads this pref, so the week is rebuilt unchanged and the warning returns on the next render.
  This is the most user-visible of the gaps.
- `warn:dismissed` stores warning **codes**, not instances, so dismissing
  `HEAVY_LOWER_TOO_SOON` once suppresses every future occurrence of that class of warning,
  permanently, across all weeks.

**`programWeek` never advances.** It is written as 1 at onboarding and incremented nowhere. So
Me's "Week 1 of 4" is static and Today's deload countdown never counts down. Relatedly, the
On-Ramp's `weekPlan` array — the week-by-week RIR ramp and the optional week-3 upgrade from the
goblet squat to the smith machine squat — is data that nothing reads, and `graduatesTo` is never
acted on. Graduating from the On-Ramp to the three-day programme requires changing "Experience"
by hand in Me.

**Pelvic floor screening changes less than the plan promised.** The question is asked once,
privately, skippably, and the answer is stored. Exhale-on-effort cues are universal across all
73 tier-1 and tier-2 lifts regardless of the answer, which is the right default. But the answer
itself drives exactly **one** behaviour in the whole app: the wording of the scheduler's impact
line, from "box jumps or pogo hops" to "low landings — pogo hops or step-downs". There is no
exercise substitution — the `pelvicFloorRisk` tag on 34 movements is used only to add an
informational flag to high-risk ones in the "i" sheet — and there is no 2-minute daily PFM
routine. The clinician prompt does appear verbatim in Me → About.

**The weekly report is not persisted for viewing.** `build-report` writes the payload to the
`reports` store, but the Shape screen only reads it back to render a subtitle ("Last built for
the week of Sep 1"). The rendered report is held in a module-level `cachedReport` variable and is
gone on reload; there is no history of past reports.

**No tests.** There is no test file, no test runner and no `package.json` in the repository. The
`dev-server.mjs` is a 70-line zero-dependency static server for local work, and that is the whole
tooling story.

**Fonts degrade.** `--font-display` is `'Fraunces', Georgia, 'Times New Roman', serif` with no
webfont file shipped and no CDN allowed, so in practice every display heading renders in Georgia.
That is an acceptable outcome, not the designed one.

**A few smaller ones.** The readiness answers collected on Today are held in memory and lost if
the app closes before the session starts. Progress photos are stored as blobs with no
compression, resizing or EXIF stripping. The bodyMap SVG has no `hamstrings` region on the front
view and no `chest`, `core` or `quads` on the back, which is anatomically right but means four of
the eleven keys appear in only one of the two silhouettes. And `.shape-row.tier-secondary` is
styled in `components.css` but never emitted by any feature — the secondary list is
differentiated by a wrapper class instead.

---

## 7. Extending it

### The module contract

`docs/BUILD_CONTRACT.md` is authoritative and every module was written against it rather than
against other modules. Global rules that matter if you touch anything:

- Vanilla JS, ES modules, no build step, no dependencies, no CDN.
- **Every path is relative** (`./…`), never a leading slash — in HTML, CSS, JS, the manifest and
  the service worker. This is what lets the app install from a GitHub Pages subpath. `start_url`
  and `scope` in `manifest.json` are both `"./"`.
- No inline `onclick`. Event delegation only, via `data-action`.
- Dates are `YYYY-MM-DD` local-date strings; timestamps are ISO strings. Pounds and inches;
  `lb`, not `lbs`.
- Every file starts with `// Daybreak — <path> — <one-line purpose>`.

A **feature module** exports exactly four things:

```js
export const id = 'today';
export const title = 'Today';
export async function render(el) { el.innerHTML = '…'; }   // populate, don't replace el
export const actions = { 'start-session': async (node, data) => { … } };
```

The Router walks up from a click target to the nearest `[data-action]`, looks the name up in the
**active feature's** `actions` map (router-owned actions are checked first), and calls
`handler(node, node.dataset, event)`. Features never attach their own document listeners. Return
a promise and rejections are logged rather than swallowed. Re-render with `Router.refresh()`,
which preserves scroll position; `Router.go(tab)` does not.

Adding a sixth tab means adding it to `TAB_ORDER` and `ICONS` in `router.js`, to `FEATURES` in
`app.js`, to the static nav markup in `index.html`, and to the `ASSETS` array in `sw.js`.

### Adding an exercise

Append an `ex({ … })` entry to `EXERCISES` in `js/data/exercises.js`. The `ex()` helper fills in
defaults, so you only state what differs. The required-in-practice fields:

- `id` — kebab-case, unique, stable. It is the foreign key used by every `set` record ever
  written, so **never rename one**.
- `name`, `pattern`, `primary[]`, `secondary[]`, `equipment[]`, `track`, `tier`.
- `primary` and `secondary` must use canonical `SHAPE_TARGETS` keys — `gluteMax`, `gluteMed`,
  `hamstrings`, `delts`, `back`, `triceps`, `core`, `quads`, `chest`, `calves`, `biceps`. Do not
  invent others; `shapemap.js`, `charts.js`, `pillars.js` and `report.js` all key off this list.
- `defaultReps` units follow `track`: reps for `weight_reps` / `bodyweight_reps` / `reps_only`,
  **seconds** for `time_hold`, **minutes** for `time_distance`, lengths for carries.
- `cues` — include an exhale-on-effort cue if the movement is tier 1 or 2. Nothing in this file
  may coach breath-holding.
- `swaps` — every id must exist in the file. There is no automated check on this one, unlike
  programme references.
- `beginner: true` only if it belongs in the On-Ramp; `impact`, `axialLoad`, `unilateral` and
  `pelvicFloorRisk` as appropriate.

You do **not** need to touch the pillars or the info panel: `pillarScore()` derives its four
numbers from the metadata, and `exerciseInfo()` composes an explanation from the pattern,
targets and equipment. Add an entry to `OVERRIDES` in `js/data/info.js` only if the movement
carries the programme and deserves a hand-written line.

If you add a `weight_reps` lift that people will want graded, add it to `STANDARDS` in
`js/data/standards.js` with the correct `basis` (`barbell` / `machine` / `per-hand`) — otherwise
`strengthLevel()` returns `null` and the Strength card just omits the level.

### Adding a class format

Append to `CLASS_FORMATS` in `js/data/classes.js`. The scheduling behaviour is entirely a
function of the metadata, so get these right:

- `legFatigue` and `recoveryHours` drive `HEAVY_LOWER_TOO_SOON`. Only `high` and `very-high`
  trigger it.
- `pairWith` (best first) chooses what the Stack block should be; `blocks` forbids session types
  that morning. `blocks` is matched **exactly**, so list every forbidden variant
  (`'lower'`, `'lower-heavy'`, `'glute'`, `'full'`) rather than relying on family matching —
  `pairWith` does family-match, `blocks` does not.
- `counts.resistance` (0–1) multiplies `shapeContribution` on the Shape Map. Set it to 0 for
  anything that should credit nothing.
- `pillars` — four numbers 0–1, scaled by `durationMin / 50 × 6` when the week is rolled up.
- `what` and `why` populate the "i" sheet; `note` is the pairing advice shown in the editor.

To put it on the real timetable, add a row to `CLASS_SCHEDULE` with `formatId`, `dayOfWeek`
(0 = Sunday), `start`, `end`, `studio` and `instructor`. `classById()` is tolerant of casing,
whitespace and underscores, so stored ids from older exports still resolve.

### Adding a programme or a programme day

Add a day object to a programme's `days` array in `js/data/programs.js`, or a whole programme to
the `PROGRAMS` object. A day needs `key`, `name`, `type` (one of `lower`, `lower-heavy`, `upper`,
`full`, `glute`, `conditioning`, `recovery`), `focus[]`, `description`, `estMinutes`, and
`blocks` with **both** a `full` and a `short` list. Build prescriptions with the local `item()`
helper — `item(exerciseId, sets, [lo, hi], rir, tier, extra)` — which fills `restSec` from the
tier (150 / 105 / 60). Note that the `tier` you pass is the movement's **role in this session**,
not necessarily its library tier, and that is what drives short-block triage. Use `rir: null` for
impact work, sprints and walks, which are quality- or clock-governed and never taken near
failure.

`PROGRAMS` is walked in insertion order by `programFor()`, which returns the first programme
whose `forExperience` contains the profile's experience — so ordering matters, and the On-Ramp is
first on purpose.

The integrity check at the bottom of the file will warn on any unknown `exerciseId`, and on any
On-Ramp movement that is not beginner-flagged or that is axially loaded. Watch the console after
an edit; it is silent when everything is fine.

Also remember `CANONICAL_SPREAD` in `scheduler.js` only has entries for 0–5 programme days, and
`normalizeProgramDays()` truncates at 5. A six-day programme will be silently clipped.

### Gotchas

These are the ones that will cost you an hour if you do not know them.

1. **The Router serves form controls on `change`, not `click`.** `isFormControl()` returns true
   for `select`, `textarea` and any `input` that is not a button/submit/reset/image, and
   `onClick` returns early for those. `controlEvent()` then decides between `change` (the
   default) and `input` (for `type="range"`, or anything carrying `data-on="input"`). A weight
   field that must commit as she types needs `data-on="input"` explicitly — `train.js` sets it on
   every stepper input, with a comment explaining that without it, whether the value lands before
   the log tap depends on blur ordering.
2. **Sheets delegate `click` only.** `sheet()` attaches one click listener to the layer and
   nothing else, so a live search box or any other input inside a sheet needs its own listener,
   wired after the sheet is created. `train.js` has a `wireSearch()` helper that does exactly
   this. Sheet actions come from the `actions` map passed to `sheet()`, not from the feature's
   own map — though every sheet action also fires a `daybreak:action` CustomEvent on `document`
   with a `handled` flag, if you need to observe them.
3. **`.shape-row` markup must be label → nums → bar, in that order.** The row is a two-column
   grid and `.shape-bar` is `grid-column: 1 / -1`, so it lands on row 2 only if both the label
   and the numbers precede it. Both `shape.js` and `report.js` carry a comment saying so. Get the
   order wrong and the bar silently moves into the label's cell.
4. **`components.js` and `router.js` emit class names that `components.css` does not define.**
   `card-head` / `card-foot` (versus `card-title` / `card-footer`), `sheet-head` (versus
   `sheet-header`), `btn-icon`, `nav-btn`, `view-error` and `plan-item` are all aliased in a
   clearly labelled block at the **bottom of `screens.css`**. They were written in parallel
   against the same contract and drifted; aliasing was judged safer than renaming in either file.
   If you add a component, check that block before assuming a class is undefined.
5. **`pct` from the Shape Map is a fraction 0–1.5, not a percentage.** The CSS custom property
   `--pct` is read as 0–100, so multiply by 100 at the point of use. Both callers do.
6. **The service worker will serve stale JavaScript during development.** If a change does not
   appear: DevTools → Application → Service Workers → Unregister, then reload. Every new file
   also needs adding to the `ASSETS` array in `sw.js`, and the `CACHE` constant
   (`daybreak-v0.1.0`) bumping, or it will not be precached.
7. **All builders that return strings escape interpolated text.** `card()`, `btn()`, `stat()` and
   `infoButton()` escape their text parameters; `body`, `footer` and a sheet's `bodyHTML` are
   raw HTML by design. Every feature also carries its own local `esc()`. Keep that habit — user
   text reaches these paths through the profile name and measurement notes.
8. **Exercise ids are permanent.** Every `set` record stores an `exerciseId` string. `planFor()`
   drops unresolvable items and `weeklyShapeMap()` skips them silently, so a rename does not
   crash anything — it just quietly erases history for that movement.

---

## 8. Verification status

**What has actually been exercised.** The whole app was driven end to end in a real desktop
browser during the build: onboarding through to profile creation, the week builder with and
without classes, starting a session, the guided warm-up, set-by-set logging, the Shape Map
filling in from logged sets, the pillar grades, the recommendations, and the weekly report
building, rendering and sharing. The `docs/BUILD_CONTRACT.md` definition of done for v0.1 —
zero console errors over HTTP, offline after first load, onboarding in six questions writing a
valid profile, a sensible three-lift week with zero classes, a full session logged and finished,
real Shape Map numbers, a report that builds and shares, a JSON round trip, and no horizontal
scroll at 390 × 844 — was the checklist it was driven against.

While writing this document, the pure logic was additionally verified by importing the modules
under Node and running them: `dialsFor` across all three stages and both experience branches;
`buildWeek` across five class configurations (zero, one, three, four and five weekday classes,
plus a class starting at the door); `targetsFor`, `weeklyShapeMap` and `pillarTargets`, including
three whole simulated weeks — a perfect On-Ramp week, a perfect Transition — 3 Day week, and the
same week with her two real classes attached; `readinessScore` and `readinessAdvice` across the
band boundaries; `nextTarget` in all four of its outcomes and `adjustForReadiness` on top of one;
`estimate1RM` including its 12-rep cutoff; `recommendations` on both sides of the `weekMatured`
guard; `rankClasses` and `starterClasses`; `warmupFor`; `strengthLevel` including its null paths;
and full integrity sweeps over the exercise library. The numbers quoted throughout this document
are outputs of those runs, not readings of the documentation. No integrity failures were found:
no duplicate ids, no broken swap references, no unresolvable programme exercise, no tier-1 or
tier-2 lift missing a breath cue. What that exercise cannot verify is anything involving the DOM,
IndexedDB, the service worker or a real browser — which is most of the app by line count.

**What has not.** There is no automated test suite of any kind — no test files, no runner, no
`package.json`. Nothing here has been run on a physical phone, in Safari on iOS, or as an
installed home-screen app, so the PWA install flow, the iOS storage-eviction behaviour, the
native share sheet, `sms:` handoff, `navigator.vibrate`, camera capture for progress photos and
notification permission are all unverified against real devices. No real user has used
it and **no real training data exists**: every number the app has ever displayed came either from
manual test entry or from `js/dev/seed.js`, which generates deterministic invented history.
Nothing in the exercise library, the class metadata or the female strength standards has been
reviewed by a coach, a physiotherapist or a clinician, and `PROJECT_PLAN` §14 explicitly flags
the pelvic-floor copy as wanting human review before it ships to anyone.

**Deployed and observed.** Since this section was first written the app has been published to
GitHub Pages at **https://sal-padilla.github.io/daybreak/** and driven there. The relative-path
claim is now verified by observation rather than inspection: all 34 assets resolve from the
`/daybreak/` subpath with zero failures, `manifest.json` resolves to the subpath, the service
worker registers with scope `https://sal-padilla.github.io/daybreak/`, and the full flow —
onboarding as Rocio, loading the demo history through the Me card, then all five tabs — runs with
no console errors. That closes the single largest inspection-only claim in this document. It
remains untested on a physical phone.

**Repository state.** Four commits on `main`, working tree otherwise clean.

- `4712594` (5 Sep 2026) — "feat: Daybreak v0.2 — women's strength PWA for Bay Club Redondo
  Beach". The whole app.
- `ba32687` (6 Sep 2026) — "feat: demo history for Rocio, and the defects it exposed". Adds
  `js/dev/seed.js` and the Me card that drives it, and fixes five defects that only became
  visible once there was data in the app: the flat Shape Map target that no programme could
  clear (now the per-muscle weighting described in section 3); the seeder writing without
  clearing, which interleaved two pasts and made trend lines run backwards; class sessions
  counted as lifts in the weekly report, because the report keyed on `classId` while the record
  carried only `classFormatId`; waist-to-hip deltas rounding to "0"; and the recomposition line
  never firing because hip growth at fourteen-day resolution sits inside tape-measure rounding.
  It also stops the report printing "30 → 30 lb (+5%)" when the load held and only the reps
  moved.
- `72a0a14` (6 Sep 2026) — "docs: live URL, install steps, and the demo-data
  walkthrough". Pages enabled, serving `main` from the repository root.
- `ae6afee` (6 Sep 2026) — this document.

`ba32687` is a useful signal about the codebase in general: it is the app's own demo data
catching four real bugs and one bad design decision that no amount of reading would have found.
It is also a reminder that the target numbers on the Shape Map are recent, and calibrated
against generated rather than observed training.

---

*Daybreak gives general fitness guidance. It is not medical advice and does not diagnose or treat
anything.*

---

## Appendix — audit follow-up (6 Sep 2026)

The findings in this document were acted on the same day. Fixed in `22a56b9`:

- **`session:overrides` was written and never read.** The Week screen's "Move it" button
  toasted "Moved. Your week is clear." and the week rebuilt unchanged. `buildWeek` now accepts
  an overrides map and the layout scorer gives a hand-moved session a decisive bonus.
  Verified: `{lower-b: 3}` moves Legs & Bone from Friday to Thursday.
- **That button appeared even when there was nowhere to move to.** A saturated week returns
  `toDayIndex: null`; the button is now hidden in that case and replaced with a line explaining
  there is no clear morning.
- **`warn:dismissed` stored warning codes**, so one dismissal silenced that warning class for
  every future week. Dismissals are now scoped to the week.
- **`programWeek` never incremented.** Now derived from `startedOn` via `currentProgramWeek()`.
  "of N" is shown only for a programme that ends — the ongoing programme's `weeks` is its deload
  cycle, so "Week 14 of 6" was nonsense.
- **`rest:default` was stored and never read.** The session runner now falls back to it.

Not fixed, deliberately: the strength-standards coverage gap. Aliasing `machine-hip-thrust` onto
`barbell-hip-thrust` would give a wrong number — a machine stack is not the same load as a bar —
and `standards.js` was built to return `null` rather than invent one. Real ratios or nothing.

Still open from this document: `cycleLog` and `cycleModule` are unused, the On-Ramp's `weekPlan`
and `graduatesTo` are data nothing reads, and the pelvic-floor answer changes the impact wording
but performs no exercise substitution despite `pelvicFloorRisk` being tagged on 34 movements.
