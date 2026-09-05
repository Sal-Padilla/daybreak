# Daybreak — v0.2

A strength and body-composition app for women 30–55 training early mornings at
Bay Club Redondo Beach.

Vanilla JS, no build step, no dependencies, no accounts, no server. Everything lives on
the phone. Full reasoning is in [PROJECT_PLAN.md](PROJECT_PLAN.md); implementation contract
is in [docs/BUILD_CONTRACT.md](docs/BUILD_CONTRACT.md).

---

## Run it locally

```bash
node dev-server.mjs
```

Then open **http://localhost:8123**.

You need a real server — not `file://` — because the app uses ES modules and a service
worker, both of which browsers block on the file protocol.

While developing, the service worker will happily serve you stale JavaScript. If a change
does not appear, open DevTools → Application → Service Workers → Unregister, then reload.

## Put it on a phone

1. Push this folder to a GitHub Pages repo (or a subfolder of one).
2. Open the URL in Safari (iPhone) or Chrome (Android).
3. Share → **Add to Home Screen**.

Every path in the app is relative, so it works from a subpath like
`sal-padilla.github.io/daybreak/` as well as from a domain root. Anyone you send the link
to can install it the same way — there is no sign-up.

---

## What it does

**Today** — one question: what am I doing right now. Today's session, a three-tap readiness
check that adjusts the day's loads, protein, and one thing worth knowing.

**Train** — the session runner. Guided warm-up, one exercise at a time, and one-tap set
logging with last session's numbers pre-filled. Every set is written to the database the
instant it is logged, so closing the app mid-workout loses nothing.

**Week** — does my week hold together. Pick from the real Bay Club Redondo Beach morning
schedule — 14 formats, 18 slots, day by day, with the instructor and studio — and every slot
says how many minutes it leaves you to lift first and what it would help with. This is where
the Stack lives: on a class morning she
lifts at 5:30 and takes the class after, and the lift is picked to complement the class
rather than duplicate it. Cycle at 6:30 means the 5:30 block is upper body. It warns, in
plain English, when a class would wreck a leg day, and offers the fix as one tap.

**Shape** — is it working. Three layers: the **Shape Map** counts every hard set against the
places she is actually trying to change; **Training balance** grades the week across the four
pillars; and **What I would do next** turns both into named actions — a specific class at a
specific time, or two more sets of a specific movement. Waist-to-hip ratio is the headline
number, never bodyweight — in recomposition the scale can sit flat for six weeks while the
body visibly changes.

**Me** — profile, program, protein, privacy, backup, and the safety boundary.

## The four pillars

The Shape Map answers "which muscles". The pillars answer the bigger question — is the *week*
balanced? Four sessions of hip thrusts is a full Shape Map and a badly built week.

| | |
|---|---|
| **Resistive training** | Loading muscle hard enough that it has to adapt. The non-negotiable one. |
| **Control training** | Stability, mobility, balance, deep core. The one that decides whether she is still training in five years. |
| **Cardio** | Heart, lungs, conditioning. Polarised — hard and short, or genuinely easy. Not the middle. |
| **Lady improvements** | The targeted work: glutes, hips, shoulder cap, waist. |

Every exercise and every class scores on all four, so the week gets graded rather than guessed at.

## The "i" button

Every exercise, every class and every pillar has one. It never just names the muscle — it says
what that muscle changes. "Trains the gluteus medius" is a fact; "builds the shelf at the top of
the hip that people try to fix with dieting and cannot, because it is muscle" is the reason she
will do the set.

## The parts that are not obvious

- **Life Stage, not age.** Cycling / perimenopause / post-menopause changes volume, load,
  rep ranges, impact work, deload frequency and protein target. The evidence says a
  post-menopausal woman needs *more* load and volume than a 35-year-old, not less.
- **The On-Ramp.** A woman new to lifting gets four weeks on machines and dumbbells at
  RIR 4–5 with no spinal loading, then graduates to the full program.
- **The 5 AM Protocol.** Core temperature bottoms out at 4–5 AM and spinal discs are
  maximally hydrated after a night lying down. The warm-up is longer than it looks like it
  needs to be, and part one — raising core temperature — is the one with the evidence.
- **Pelvic floor.** Asked once, privately, skippably. Roughly four in ten women who lift
  report leaking and squats are the top trigger. Every heavy set carries an exhale-on-effort
  cue; the app never coaches breath-holding.
- **Female strength standards.** Real ones. The predecessor app hardcoded male norms.

## Weekly report

Built on demand or nudged on Sunday, then sent with one tap via the native share sheet,
with `mailto:`, SMS and copy-to-clipboard as fallbacks.

**An honest limit:** no web app can reliably send a scheduled email by itself. Periodic
Background Sync is Chrome-only, needs an install plus a high engagement score, and does not
exist on iOS at all. So the flow is: nudge → tap → send. `buildReport()` is a pure function
returning structured data with no display strings in it, so a small backend can be added
later to send it automatically without any of this being rewritten.

---

## Layout

```
index.html  manifest.json  sw.js  dev-server.mjs
css/     tokens · base · components · screens
js/
  core/     db (IndexedDB) · store · router (data-action delegation)
  data/     exercises (144) · classes (14 formats + real schedule) · programs · standards
            pillars (the four) · info (the "i" panel)
  engine/   lifestage · progression · shapemap · scheduler (the Stack) · readiness
            sessionplan · recommend
  features/ onboarding · warmup · today · train · week · shape · me · report
  ui/       components · charts (incl. the Shape Map body diagram) · timer · infosheet
```

## Status

Working end to end: onboarding → week → session → set logging → Shape Map → pillars →
recommendations → report → share. The real Redondo Beach morning schedule is loaded.

Not yet done: no Sunday classes in the schedule (the screenshots did not cover it), progress
photos beyond basic capture, and no data has been collected on a real phone yet.

Daybreak gives general fitness guidance. It is not medical advice.
