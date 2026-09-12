# Daybreak — v0.8.3

**Live: https://sal-padilla.github.io/daybreak/**

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

There is nothing to download and no app store. The link is the app.

**https://sal-padilla.github.io/daybreak/**

It opens as an ordinary web page and works fully that way. Installing just gives it a home
screen icon and removes the browser chrome.

**iPhone — must be Safari.** Chrome and Firefox on iOS cannot add web apps to the home screen.
Open the link in Safari, tap the Share button in the bottom toolbar, scroll down, tap
**Add to Home Screen**. The app shows a hint pointing at the right button, because Safari
offers no prompt of its own.

**Android — Chrome.** A banner appears with an **Install** button. If it has been dismissed,
use the ⋮ menu → **Install app** (or **Add to Home screen**).

That is the whole install. No sign-up, no account, no app store. Anyone you send the link to
can do the same, and their data stays on their own phone — nothing is shared and nothing
reaches a server.

Deploying an update is `git push`; Pages serves `main` from the repository root. Every path in
the app is relative, which is what lets it run from the `/daybreak/` subpath at all.

**One thing to know when testing.** The service worker is stale-while-revalidate: a device that
already has the app serves the version it has, fetches the new one behind it, and shows the new
version on the *next* open. So after a deploy, expect to open the app twice before a change
appears. That is deliberate — it is what makes it launch instantly and work with no signal in
the weight room — but it looks like a failed deploy if you are not expecting it.

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

## Seeing it with data in it

An empty fitness app tells you nothing. **Me → Demo data → Load 14 weeks** generates a
believable past for Rocio: three lifts a week, classes she went to and some she skipped,
progression on a decelerating novice-gains curve with real stalls, and measurements showing
waist down, hips up, scale nearly flat.

It is deterministic, so the same past appears every time, and it clears whatever was there
first. Building it is what exposed the Shape Map target bug described in the commit history —
the app was setting a bar its own program could not clear.

Clear it from the same screen before real training starts.

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
  dev/      seed (fourteen weeks of generated history)
```

## Status

Working end to end: onboarding → week → session → set logging → Shape Map → pillars →
recommendations → report → share. The real Redondo Beach morning schedule is loaded.

Live at https://sal-padilla.github.io/daybreak/ and verified working there — all assets
resolve from the subpath, the service worker scopes correctly, and the full flow runs.

Not yet done: no Sunday classes in the schedule (the screenshots did not cover it), progress
photos beyond basic capture, and no real training data has been collected on a physical phone.

Daybreak gives general fitness guidance. It is not medical advice.
