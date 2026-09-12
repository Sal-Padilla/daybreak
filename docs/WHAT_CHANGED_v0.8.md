# Daybreak v0.8 — what changed, and why

Everything here came from one message of Rocio's feedback after trying the app on her
Android. Each section names what she reported, what was actually wrong, and how it was
verified — because several of these looked like nothing until they were measured.

---

## 1. "The information links don't work, they are greyed out and i cant pick anything"

This was **two separate bugs** producing the same symptom.

### a) Every sheet rendered behind its own scrim

`components.js` injects a fallback stylesheet so the module works standalone. It gives
`.sheet-backdrop` no `z-index`, so backdrop and panel — siblings, both `z-index:auto` —
paint in DOM order and the panel lands on top. Correct.

`css/components.css` then re-declared `.sheet-backdrop` with `z-index:60` while `.sheet`
stayed `auto`. That promoted the backdrop **above** the panel. Every sheet in the app
rendered behind a 48%-black scrim, and the backdrop swallowed every tap — and its handler
dismisses the sheet, so tapping an option closed it and did nothing.

Each stylesheet is correct alone. Only the combination breaks, which is why it survived
review. Found with `document.elementFromPoint` at the centre of every control.

### b) The palette failed WCAG AA

Not a perception problem. Measured:

| token | on cream | needs | what it is |
|---|---|---|---|
| `--accent` #C4674F | 3.65 | 4.5 | every quiet link |
| `--win` #D99A32 | 2.29 | 4.5 | badly failing |
| `--calm` #6E8B72 | 3.52 | 4.5 | |
| `--signal` #B3556B | 4.45 | 4.5 | just under |
| white on primary button | 3.89 | 4.5 | every CTA |
| white on **dark-mode** accent | 3.07 | 4.5 | every CTA, dark theme |

Terracotta text at 3.65:1 does not read as a link. It reads as a disabled control.

Fixed by re-cutting every foreground token, adding an `--on-accent` token (white in light,
`#171018` in dark — eight places had hard-coded `#fff` on a themed fill), and making it
permanent with `tools/check-contrast.mjs`: 96 pairings, non-zero exit on failure.

---

## 2. "Ladies app should have more color"

The four training pillars each have their own hue instead of four bars of identical
terracotta: **resistive** clay, **control** plum, **cardio** teal, **shape** bronze. All
four clear AA and are 29-72 deltaE apart. On the Shape screen a 15% cardio bar in teal
beside three full bars is legible at a glance in a way four terracotta bars never were.

An automated search for maximum saturation returned a magenta plum and a neon green, which
is not this app. The values are hand-picked and measured.

---

## 3. "Trap-Bar Deadlift page is clumpsy... weight and reps is in the way"

The set row is pinned to the bottom of the session view, and expanded it stands **187px
tall** — covering the target line by 7px and sitting over the movement diagram.

Collapsed by default now: one 85px line with the numbers, a microphone and the tick.

**"can you make this a verbal input as well"** — Web Speech API, no library, no audio kept.
It parses how a lifter actually speaks:

- "one sixty five by five" -> 165 lb x 5
- "forty five pounds eight reps" -> 45 lb x 8
- "a hundred and thirty five" -> 135 lb
- "thirty seconds" -> 30 sec

A lone number resolves against the exercise's track, so "95" is weight on a barbell lift
and reps on a bodyweight one. 14/14 parser cases pass. Speaking **fills** the draft and
echoes what it heard; logging stays one deliberate tap, because a misheard "fifty" for
"fifteen" must never write itself into her history.

---

## 4. "MISSING IMAGES OF WHAT TO DO"

First, an audit of all 144 exercises found that **of the 111 showing a picture, 63 showed a
different movement.** Leg Extension and Leg Press were both drawn as a squat. Three
rear-delt pulls were drawn as a bench press. Worse, the info sheet prints the diagram's own
caption and setup steps, so Leg Extension shipped the caption *"Squat"* and the instruction
*"hold the weight against your chest."*

Regex name-matching cannot tell a Leg Press from a Squat. Replaced with an explicit
id-to-shape map; anything unlisted shows no picture, which is the right answer until its
shape is drawn.

Then nine new shapes were drawn: deadlift-from-floor, tricep-extension, jump-land,
bicep-curl, supine-core, calf-raise, bent-over-row, high-plank, chest-fly.

**86 of 144 exercises now have an honest picture**, up from 48 correct ones before.

Four were redrawn after looking at them rendered — the only test that catches this:

- the first deadlift had a near-straight leg, which is a Romanian deadlift
- the calf raise floated the step beside the figure and the foot never touched it
- "in the air" had its feet on the ground line and read as standing
- the dead bug put the floor 4px under the trunk, so body and floor merged into a smear

The **warm-up** had no imagery at all. Two of its twelve movements map to shapes we have;
all twelve now carry a "Show me" demonstration link.

---

## 5. "Week icon just copies"

Correct, and the cause was structural: a class was only ever a weekly recurrence
(`dayOfWeek` + `time`, no date), so every future week was literally the same data.

`js/data/schedule.js` turns stored classes into dated occurrences. A record may now carry
`date` (one-off), `skipDates` (weeks she is not going) and `bookedDates`. All optional and
absent on existing records, so nothing saved changes and no DB version bump. 28 unit cases,
including DST-safe local dates — `new Date('2026-09-13')` is UTC midnight and would slip a
day for a 5am user.

A future week now says it is a projection and **asks** whether it works, instead of
presenting a copy as a plan.

---

## 6. Month calendar, planning ahead, and booking

- **Month calendar** with shaded days. Shading is by **class**, not session: a lift is
  scheduled most days and would shade the whole grid. Today is ringed, past days dimmed,
  booked days outlined in sage. Tap any day to see it, mark it booked, skip just that week,
  remove a one-off, or add a class.
- **Planning weeks ahead** — a pick made from a calendar day binds to that exact date; a
  pick from the Week screen stays the weekly recurrence. Same picker; the difference is
  which screen it was opened from.
- **The three-day booking nudge.** An installed web app cannot reliably wake itself and
  send anything — no push without a server, and iOS evicts storage from apps left unopened.
  So it does not pretend to. It tells her the moment she opens it, hands her a shareable
  list, and offers a local notification only as a bonus. She opens this app every training
  morning, so the reminder lands days before the class fills.

---

## 7. Sunday

Five real classes from the Bay Club Connect screenshot, with full scheduler metadata:
Les Mills Strength Development, Hatha Yoga, Gentle Yoga, Cycle, Barre Strong.

Les Mills is the only one carrying real resistance credit (0.75) and it blocks every lift
that morning — it *is* the lift. Barre Strong is honest about the trade: 0.25 credit, high
quad fatigue, no bone loading.

Two bugs found while testing it, either of which would have made Sunday useless: the seven
day-chips needed 483px in a 310px sheet, so Sunday sat behind an invisible sideways scroll;
and "LES MILLS Strength Development" rendered six lines tall in a 74px column.

---

## 8. Everything else

- **Home-screen icon** — the old one stacked a dome, two gold bars, a dark bar and a pale
  bar, which at icon size reads as a hamburger. It is now one horizon line and one sun,
  where the horizon *is* a barbell.
- **About** — pointed at "the project plan", a 53KB internal doc that is not served and not
  reachable. The medical disclaimer said "before starting" for a program that adds load and
  impact every week, named osteoporosis but not osteopenia, and had no stop-and-get-seen
  trigger. All fixed.
- **US English** — physiotherapist to physical therapist, fortnight to every two weeks.
- **Service worker** — `voice.js` and later `schedule.js` were each missing from the
  precache list. Both are statically imported, so offline they would have taken whole
  screens down. The completeness check is now part of the routine.
- **Dead-control audit** — every `data-action` emitted on every screen and in every sheet,
  checked against the handlers actually reachable from it. **Nothing dead.**

---

## How this was verified

Everything above was checked in a real browser at **375x812** and at **320x640 with a 22px
root font** — Android's accessibility text sizing, the configuration that made onboarding
impassable for her — in **both light and dark themes**.

Final sweep across all five screens, both sizes, both themes: zero controls outside the
viewport, zero covered by another element, zero under 40px, zero below 4.5:1 contrast, zero
horizontal overflow. Onboarding completes end to end at the worst-case size.

**Not yet verified:** nothing has been run on a physical phone. Voice input, the PWA install
flow, the share sheet, notification permission and iOS storage eviction are all unverified
on real hardware. That remains the next real test.

---

## Still open

- 58 of 144 exercises have no diagram. The ranked list of remaining shapes is in
  `docs/AGENT_REVIEW_2026-09-11.md`; the id-to-shape map already names them, so each new
  drawing goes live with no code change.
- `cycleLog` and `cycleModule` are unused.
- The pelvic-floor answer changes only the impact wording — no exercise substitution,
  despite `pelvicFloorRisk` being tagged on 34 movements.
- Only 5 of 20 lead lifts have female strength standards. Deliberately not faked: a machine
  stack is not a barbell load, so `standards.js` returns null rather than invent one.
