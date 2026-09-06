# DAYBREAK — Project Plan
### A strength & body-composition app for women 30–55 training at 5:30 AM, Bay Club Redondo Beach

**Status:** v0.3 — live at https://sal-padilla.github.io/daybreak/ and verified there. See [README.md](README.md).
**Author:** Claude (Opus 5) for Sal Padilla
**Date:** 2026-09-04
**Predecessor reviewed:** IronPulse v3.6 (`WorkOut_App/IronPulse_v3`)
**Target folder:** `WorkOut_App/IronWomen_v1`

---

## 0. How I read your request

You wrote it fast, so let me say back what I think you're asking for. Correct me on any of these
before I build — every one changes the app.

| You said | I read it as |
|---|---|
| "lose fat and increase muscle in the lady places" | **Body recomposition** with hypertrophy deliberately steered to glutes, hips (side-glute "shelf"), hamstrings, shoulder caps, upper back, triceps and deep core — and deliberately *low* volume on traps and loaded oblique work, which thicken the neck and waist. That is the classic X-frame / hourglass result, and it is a legitimate, programmable target. I call it the **Shape Map** (§5.3). |
| "women 30–55" | This band is not one population — it straddles **perimenopause**. A 32-year-old and a 52-year-old need materially different loads, volumes, impact work and recovery. The app needs a **Life Stage** setting, not an age field. Biggest design decision in the project. |
| "Bay Club... has HIIT, yoga, etc. classes... should be added into the app as part of the training" | Classes are **not decoration** — they are training load, and badly-placed HIIT the morning before leg day measurably blunts strength adaptation. The app's real job is to build the lifting week **around** her actual classes so the two don't fight. No app on the market does this. Our best differentiator. |
| "colors for men... needs to be specific for a women" | Yes — but the research says the trap is making it *pink and cute*. See §2.9 and §4. The strongest predictor of women continuing to use a fitness app is **usefulness**, not decoration. |
| "email or **test** weekly progress report" | Reading "test" as **text**. So email *and* SMS. §7 covers this honestly, including the one thing that genuinely cannot work the way people assume. |
| "early morning workouts {5am to 6am start time}" | **Hard conflict flagged:** the club opens **5:30 AM Mon–Fri**, **7:00 AM Sat/Sun**. A 5:00 AM start is not possible at the club. Plan assumes 5:30 arrival, out by ~6:45. §1.1. |
| "I am a bad communicator but you are smart" | Understood. Where I had to guess I marked it **[ASSUMPTION]** and collected them all in §14 so you can shoot any of them down in one pass. |

---

## 1. Hard constraints I found (read these first)

Verified facts, not opinions. Each one changes the build.

### 1.1 The club opens at 5:30 AM, not 5:00 AM
Bay Club Redondo Beach, 819 N Harbor Dr: **Mon–Fri 5:30 AM – 9:00 PM, Sat–Sun 7:00 AM – 7:00 PM.**
Your stated 5:00–6:00 AM window only partly exists.  This is the start time, change to 5:30 am ~ 6 am

**What the app does:** default weekday session is **5:30–6:45 AM**. For anyone who wants to be moving
at 5:00, the app ships a **6-minute at-home pre-warm** (§5.4) — which is the medically better answer
anyway, per 1.4. Weekend sessions move to 7:00 AM or become outdoor/at-home.  add notes or pop ups for this

### 1.2 The Bay Club class schedule cannot be auto-synced
I tried. The public schedule page (`bayclubs.com/classes?c2=redondobeach`) renders class data
client-side from an authenticated **Bay Club Connect** endpoint — the public HTML contains only
`{{NAME}}` / `{{Time}}` template placeholders, and I found no unauthenticated API in the site
bundles. Schedule data is member-gated and rotates seasonally. { will give you class list later}

**Design consequence — and this is genuinely better:** we do **not** scrape. The app ships a built-in
**library of Bay Club class formats** with training-load metadata (§6.1), and she enters her actual
recurring classes **once**, in about 60 seconds. If you send me screenshots of the current Redondo
Beach schedule I will pre-seed the real times, so setup becomes "tap the 4 classes you go to"
instead of typing. Fastest path, and it never breaks when their API changes. {i need you to proceed until I get all this info}

### 1.3 A static PWA cannot reliably email you on a schedule by itself
The thing everyone assumes works, and doesn't. Web apps have no dependable scheduled background
execution: Periodic Background Sync is Chrome-only, requires install plus a high engagement score,
and **does not exist on iOS at all**. Anyone promising "automatic weekly email, no backend" is wrong. {ok}

**What we ship instead:** a Sunday local notification → she taps → report renders → **one tap** sends
it via the native share sheet (Mail / Messages / WhatsApp) or `mailto:` / `sms:`. Optional EmailJS
button for true one-tap-to-inbox. If you want it *fully* hands-off later, that needs a small backend
— costed in §7.4. Full detail and recommendation in §7. {let's try it}

### 1.4 5:30 AM is the highest-risk hour of the day for spinal loading
Core body temperature bottoms out around 4–5 AM, and spinal discs are maximally hydrated after a
night lying down, raising disc injury risk; spinal stiffness is highest in the first hour after
waking. Morning sessions need **10–15 min** of warm-up versus 5–8 min later in the day. {this person wakes at 4am}

**This produces a programming rule, not a disclaimer.** The app enforces an **AM Ordering Rule**
(§5.4): the first heavy movement of a 5:30 session is hip-hinge-supported or machine/bench-supported
— hip thrust, trap-bar, leg press, chest-supported row. **Heavy back squat and conventional deadlift
move later in the session (after 20+ min upright) or to weekend slots.** Almost no app does this. For
a 5:30 AM demographic it is the difference between a program that lasts two years and one that ends
in a disc injury in month four. {this process is already start but needs structure and records}

### 1.5 iOS will quietly delete her data
Safari can evict site storage after ~7 days of non-use, and installed PWAs still have weaker
durability guarantees than native apps. IronPulse carries this exposure today. {we will work on this, move forward}

**Consequence:** **automatic data export is a v1 requirement, not a nice-to-have.** The app prompts
for a backup every 14 days and exports one JSON file. Usefully, the weekly report doubles as a
human-readable backup trail. ok

### 1.6 Deployment: IronPulse's paths will break a second app
IronPulse's `manifest.json` uses `"start_url": "/"` and its service worker caches `'/'`,
`'/index.html'`, `'/js/app.js'` — **absolute** paths. That works only because it sits at the root of
`sal-padilla.github.io`. A second app must live at a subpath (`sal-padilla.github.io/daybreak/`), so
**every path in the new app must be relative**, `start_url` must be `"./"`, and the service worker
scope must be explicit. Trivial to get right up front; painful to retrofit. Noting it now. {fix this , I can send an invite and they can download the app}

---

## 2. What the research actually says

I went to the literature rather than the fitness-marketing layer. Sources in §16. Where the evidence
is genuinely contested I say so — building rigid features on shaky science is how apps end up giving
bad advice confidently.

### 2.1 The 30–55 band straddles perimenopause, and that changes everything
- Women can lose **10–20% of lean muscle mass** across the perimenopausal transition; post-menopausal
  women show roughly **10% less arm and leg muscle** than early-perimenopausal women.
- When estrogen drops, **muscle stem-cell regenerative capacity falls an estimated 30–60%**.
- In a 20-week controlled trial, resistance training raised fat-free mass, muscle mass and muscle
  thickness in **pre**-menopausal women — **and those gains did not appear in post-menopausal women
  at the same intensities**.
- For postmenopausal women, higher volume wins: roughly **15 sets/exercise/week beat 9**.

**This is the core insight of the product.** The same program does not produce the same result across
this age band. Post-menopausal women need **more volume and heavier load** to get what a 35-year-old
gets from a moderate program.

→ **Feature: the Life Stage engine (§5.2).** Not an age field — a stage that re-dials volume, load,
impact and deload frequency.

### 2.2 Heavy lifting is required, not optional — and it is safe
The **LIFTMOR** randomised controlled trial put postmenopausal women with osteopenia/osteoporosis
through **8 months of twice-weekly, 30-minute supervised 5×5 at >85% 1RM plus impact loading**.
Result: **~4% lumbar spine BMD improvement** versus low-intensity control, improved physical
function, **safe and well-tolerated, >90% adherence**.

This matters because this demographic has been told for thirty years to use light weights and high
reps — advice that actively produces the outcome they fear. The app should be unembarrassed about
heavy work, with excellent technique support.

Dr. Stacy Sims' recommendations for this population converge: **3 heavy resistance sessions/week at
2–3 reps in reserve**, plus **sprint intervals (10–30 s all-out, 1–2×/week)** rather than long
steady-state, plus genuinely easy recovery work — a **polarised** structure.

### 2.3 For glutes: hip thrust *and* squat, not either/or
Best available evidence is a 9-week MRI study: **hip thrust and back squat produced equivalent
gluteus maximus hypertrophy** (upper, middle, lower and total) and transferred similarly to the
deadlift. Squats added more quad and adductor growth.

Note the trap: hip thrusts show **higher glute EMG**, and EMG is widely cited as proof — but **EMG
activation is not a reliable predictor of muscle growth**. So the honest answer is **both**, which is
what the app prescribes. Per §1.4, at 5:30 AM the hip thrust goes first.

### 2.4 Menstrual cycle: track it, don't let it dictate the program
The evidence is genuinely mixed and I won't pretend otherwise:
- A 2022 *Sports Medicine* review: follicular-phase-based training **may** be superior to luteal for
  strength and mass.
- A 2023 *Frontiers* review: **no** influence of cycle phase on acute strength performance **or** on
  adaptations to resistance training.
- A 2026 *Scientific Reports* study: half-squat performance peaked in follicular phases and around
  ovulation, lowest in **late luteal** — while handgrip strength did the opposite. Self-reported
  **vigour highest in follicular; fatigue and low mood rose sharply in late luteal**.
- Reviewers repeatedly cite near-negligible effect sizes, high between-study variability and poor
  study quality, concluding **general recommendations should not be made**.

**So: no rigid phase-based mesocycle.** What the app does instead:
1. Optional, private, skippable cycle + symptom logging.
2. **One-tap autoregulation** on a bad day — drop top set 5–10%, cut the last set. Good practice
   regardless of cause.
3. After ~3 cycles, show **her own** pattern from **her own** data: *"Your top sets run about 4%
   lighter in the 5 days before your period. That's normal — we're adjusting."*

Defensible, personal, no overclaiming. For Transition-stage users with erratic cycles it switches
from date-based to **symptom-based** automatically.

### 2.5 Protein is the highest-leverage nutrition variable — and morning trainers miss it
- Older adults show **anabolic resistance**, needing roughly **67% more protein per meal** than
  younger adults to maximally stimulate muscle protein synthesis — about **0.4 g/kg per meal**.
- **1.6–2.2 g/kg/day** preserves lean mass and drives MPS even in a modest deficit.
- **Leucine content**, not just total protein, is a primary determinant of the anabolic response in
  older women.
- Post-exercise, **~20–30 g** of high-quality protein maximally stimulates MPS (evidence that ~40 g
  is better after whole-body training).

A 5:30 AM trainer whose first real protein is at noon is the most common failure mode in this
demographic. → **Feature: one protein target and one post-session nudge (§5.7).** Not a food diary —
nobody sustains those.

### 2.6 Fat loss: modest deficit, or it backfires
- Healthy recomposition runs **0.5–1.0% of body weight per week**.
- A **~200–400 kcal/day** deficit is the sweet spot. Larger deficits stacked on heavy training, a
  4:45 AM alarm and perimenopausal cortisol dysregulation is how people lose muscle and sleep.
- Adequate dietary fat must be maintained for hormone production.
- Women gain muscle at roughly **half** the rate men do. **The app's expectations, graphs and
  language must be calibrated to that**, or it will feel like failure when it is actually success.
  IronPulse's grading curve is tuned for a man and would be quietly demoralising here.

### 2.7 Class placement is a training variable, not a scheduling detail
- The interference effect is **maximised when HIIT at 95–100% VO2max is combined with resistance work
  at ≥10RM**.
- Same day: **lift first, then condition at moderate intensity (~60–80% HRmax)**, or separate by
  several hours.
- **Short** HIIT/SIT bouts **minimise** interference — sprint intervals pair better than a 45-minute
  bootcamp.
- Combined resistance + aerobic beats either alone for body composition and metabolic health.

→ **Feature: the Week Planner flags conflicts** — *"Box n Burn Tuesday 6 AM is 24 h before Lower A.
Move Lower A to Wednesday?"* This is the feature I would build the app around.

### 2.8 Pelvic floor: 40–55% prevalence, and squats are the top trigger
Urinary incontinence prevalence is **41.0–48.8% in female powerlifters** and **36.6–54.1% in
weightlifters**; **squats** are the most likely lift to provoke leakage; breath-holding under load
drives downward pressure on the pelvic floor. Women who had had a pelvic floor examination, or were
confident performing pelvic floor exercises correctly, reported **less severe** symptoms.

This is the **silent** reason a large share of this demographic avoids heavy lifting, and essentially
no mainstream app addresses it. → **Feature: the Pelvic Floor module (§5.6).** Private, skippable,
never framed as shameful — framed as a trainable muscle group, with an exhale-on-effort cue on heavy
sets and a "see a pelvic floor PT" prompt if symptoms are flagged.

### 2.9 What actually makes women keep using a fitness app — the finding that shapes the design
The most important research in this document, and it points away from the obvious answer.

- **74% of fitness app users stop within 10 uses**; 26% use it once.
- Attributes female users value most: **instructiveness, interaction, personalization, ease of use,
  convenience**.
- The finding that matters most: **health value and utilitarian value drive continued use; hedonic
  (fun/decorative) value affects satisfaction but does *not* significantly predict continuance.** The
  published recommendation is explicit — design for utilitarian and health value **rather than
  overemphasising hedonic content**.
- **A long or confusing onboarding causes users to quit before they ever try the app.**

**Translation, bluntly:** the way to make a woman actually use this is *not* to make it pink and
cute. It is to make it **visibly more useful to her than IronPulse would be** — better warm-ups,
class-aware scheduling, life-stage-correct loading, measurements that aren't just bodyweight — and
then dress it in a palette that reads adult and premium rather than like gym equipment.

**Onboarding budget: 90 seconds, 6 questions. Everything else deferred and skippable.**

---

## 3. What IronPulse gives us, and what has to go

I read the whole IronPulse v3.6 codebase: 98 exercises, ~2,090-line `app.js`, IndexedDB with 9 object
stores, vanilla JS, 5-tab PWA. It is solid work and the bones are proven.

### Keep the architecture
- Vanilla JS, no build step, no framework. Easy to maintain, loads instantly, nothing to break.
- IndexedDB, on-device only, no accounts, no backend. **Privacy is a real feature for this audience**
  — cycle data, pelvic floor symptoms, body photos and measurements must never leave the phone.
- PWA + add-to-home-screen. Proven on your phone already.
- The generic DB CRUD layer (`DB.put/get/getAll/getAllByIndex`) is clean — port it nearly as-is.
- The tracking-type system (`weight_reps`, `bodyweight_time`, `time_distance`, …) is well designed and
  extends naturally to classes.

### Rewrite completely
| IronPulse | Why it fails here |
|---|---|
| `analytics.js:295` — `strengthLevel(exercise, oneRM, bodyweight = 180, gender = 'male')` | **Hardcoded male defaults.** Female strength norms are different across every lift. Ship female standards or ship nothing. |
| `exercises.js` — `volumeCalc` defaults `bodyweight = 160` / `180` | Same problem in the volume math. Bodyweight comes from the profile, with a female default. |
| `db.js:getProfile()` — `age: 56` default | Wrong cohort. Needs life stage, not a number. |
| AMOLED-dark `#0a0a0f` + indigo `#6366f1` | Reads as gym equipment. Full redesign, light-first. See §4. |
| Volume-and-grade dashboard ("Week Grade: B", "Total Volume lbs") | Wrong metric set. Total pounds lifted is a men's-strength-culture metric; it rewards heavy compound work and makes lateral raises look worthless. Replaced by the **Shape Map** (§5.3). |
| 12 global `<script>` tags with `window.X = X` | Move to ES modules. Cleaner, and prevents the load-order fragility IronPulse has. |
| Service worker: cache-first, absolute paths, no update flow | Rewrite. Relative paths (§1.6), versioned cache, and an "update available" prompt. |
| Exercise library skewed to barbell push/pull | Needs full glute/hip/posterior-chain depth, plus every machine actually on the Redondo Beach floor. |
| No class concept | The whole point. |

### Naming
"IronWomen" is fine as a folder, but as a product name it is IronPulse with the gender bolted on —
the opposite of "a new design so women will actually use it." Options:

| Name | Rationale |
|---|---|
| **Daybreak** ← my recommendation | Owns the 5 AM identity. Warm, adult, not derivative, not gendered-cute. Sunrise-over-the-harbour palette writes itself. |
| **Harbor** | Place-rooted (819 N Harbor Dr, King Harbor). Calm, premium, coastal. |
| **Bayline** | Club-adjacent without infringing. |
| **Foundry** | Strong and neutral; less warm. |

Folder stays `IronWomen_v1`; product name is a one-line change. **Everything below says Daybreak.**

---

## 4. Design direction

Driven by §2.9: **useful first, beautiful second, cute never.**

### 4.1 The three things it must not be
1. **Not IronPulse in pink.** Same layout with a hue rotation is exactly what she'll notice.
2. **Not bubblegum.** "Girl boss", sparkles, hearts, "you got this queen". This audience is 30–55,
   pays athletic-club dues, and is at the gym at 5:30 AM. Condescension is the fastest uninstall.
3. **Not scale-obsessed.** Bodyweight as the hero number is the #1 quit trigger in recomposition,
   where the scale can sit flat for six weeks while the body visibly changes.

### 4.2 Palette — "Harbor Dawn"
Actual sunrise over King Harbour: deep blue-violet night, warm clay, sand, a low gold sun.
Sophisticated, warm, unmistakably not-men's-app, and it never says "pink".

```
Light (default)
  --sand-50    #FBF7F4   page background — warm off-white, not clinical grey
  --sand-100   #F4EDE7   card background
  --sand-200   #E7DBD1   borders / dividers
  --ink-900    #241C26   primary text — deep plum-black, warmer than #000
  --ink-500    #6B5F6E   secondary text
  --clay-500   #C4674F   PRIMARY ACCENT — warm terracotta. Buttons, active nav, progress.
  --clay-600   #A85440   pressed state
  --plum-700   #4A2E52   headers, depth, the "premium" note
  --gold-500   #D99A32   PRs, streaks, achievements (used sparingly — it must stay special)
  --sage-500   #6E8B72   recovery, rest, yoga, "easy" days
  --rose-500   #B3556B   cycle / body-signal accent (a signal colour, never chrome)

Dark (opt-in, for 5:30 AM in a dim club)
  --bg-900     #171018   warm near-black, NOT IronPulse's blue-black #0a0a0f
  --bg-800     #221926
  --ink-50     #F6EFEA
  accents unchanged, lifted ~8% luminance
```

Note what's absent: no indigo, no neon, no pure black, no pink. The differentiation from IronPulse is
**temperature** (warm vs cool) and **default mode** (light vs dark) — legible in a half-second glance.

### 4.3 Typography
IronPulse is system-sans everywhere, which is why it reads generic. Daybreak uses two faces:

- **Display / headings:** a humanist serif — *Fraunces* or *Instrument Serif*. This single choice does
  more differentiation work than the entire palette. Instantly "considered product", not "utility".
- **UI / numbers:** *Inter* with tabular figures for weights and reps so digits don't jitter as they
  change during a set.
- **Sizes bumped up one step** from IronPulse. 30–55-year-old eyes, 5:30 AM, sweaty hands, and
  possibly no reading glasses. Body text 17px minimum, set numerals 22px+.

### 4.4 Interaction principles
1. **One-tap set logging.** Strongest retention lever there is. Pre-fill last session's numbers; the
   common case is one tap on a big checkmark. Adjust only when something changed.
2. **Thumb-zone layout.** Every primary action in the bottom third. She's holding a phone one-handed
   with a dumbbell in the other.
3. **56 px minimum touch targets** (IronPulse uses smaller). Sweaty fingers, chalk, gloves.
4. **No streak shaming.** A broken streak shows as *"Back at it"* — never a red zero and never a
   guilt-trip. The literature is clear that this cohort churns on negative feedback.
5. **Offline-first, always.** The weight room at 819 N Harbor Dr is a concrete box; assume no signal.
6. **Every screen answers one question.** Today: *what am I doing?* Week: *does my week hold
   together?* Shape: *is it working?*

### 4.5 Voice
Coach, not cheerleader. Specific, warm, never breathless.

- ✅ "Hip thrust up 15 lb since June. Your top set is now bodyweight × 1.2."
- ❌ "OMG amazing job queen! 💅✨"
- ✅ "Third session under 6 hours' sleep. Taking 10% off the top set today."
- ❌ "No excuses! Push through!"

---

## 5. The training system

### 5.1 The shape of a week
Anchor: **3 heavy lift days + 2 class days + 1 sprint day + 1 walk/report day.** Fits 5:30–6:45 AM
weekdays with the weekend at 7:00 AM, and matches the polarised structure in §2.2.

Worked example — **Transition stage**, a member who does Box n Burn and Barre:

| Day | Time | Session | Why |
|---|---|---|---|
| **Mon** | 5:30 | **LOWER A — glute-dominant** · Hip thrust 4×6–8 heavy → RDL 3×8 → Bulgarian split 3×10/leg → Cable abduction 3×15 → Pallof press 3×12 | Hip thrust first per the AM Ordering Rule (§1.4). Abduction is the side-glute "shelf". |
| **Tue** | 5:45 | **Box n Burn** (club) + 8 min core | Class day. Conditioning, not a lift day. |
| **Wed** | 5:30 | **UPPER — shoulder cap + back** · Incline DB press 3×8 → Lat pulldown 4×10 → Chest-supported row 3×10 → Lateral raise 4×15 → Face pull 3×15 → Rope pushdown 3×12 | Delts + lats build the V that makes the waist read smaller. Note: **no shrugs, no upright rows.** |
| **Thu** | 5:45 | **Barre / Yoga Flow / Pilates** (club) | Mobility, core, genuine recovery. The "easy" pole of polarised training. |
| **Fri** | 5:30 | **LOWER B — quad + bone** · Trap-bar or goblet squat 5×5 heavy → Step-up 3×10 → Leg curl 3×12 → **Box jump / pogo 3×8 (impact)** → Farmer carry 3×40 yd | LIFTMOR-style heavy 5×5 plus impact loading for bone. Trap-bar over back squat = more upright, kinder to a morning spine. |
| **Sat** | 7:00 | **Sprint intervals** — 6–8 × 20 s all-out bike/rower, 2 min easy | Sims' SIT prescription. Short bouts minimise interference (§2.7). |
| **Sun** | — | 45–60 min walk + **Weekly Report** | Recovery + the accountability loop. |

The app **generates** this, adapted to her actual classes and life stage. It is not a static PDF.

### 5.2 The Life Stage engine — the heart of the app

Three stages, chosen in onboarding by **symptoms**, not birthday (a 44-year-old may be in any of
them). Re-askable any time; never permanent.

| Dial | **Cycling** (~30–43) | **Transition** (~42–52, perimenopause) | **Post** (12+ mo no period) |
|---|---|---|---|
| Heavy lift days/wk | 3 | 3 | 3 — non-negotiable |
| Working RIR | 2–3 | 2–3 | **1–2** (needs to be heavier) |
| Top-set reps | 6–10 | 5–8 | **3–6** (LIFTMOR 5×5 territory) |
| Weekly sets / major muscle | 10–14 | 12–16 | **14–20** (§2.1: 15 beat 9) |
| Impact / plyo | optional | 2×/wk | **3×/wk** (bone) |
| Sprint intervals | 1–2×/wk | 2×/wk | 2×/wk |
| Easy / Zone-2 | 2–3×/wk | 2–3×/wk | 3×/wk |
| Deload every | 6–8 wk | 5–6 wk | 4–6 wk |
| Protein target | 1.6 g/kg | 1.8 g/kg | **2.0–2.2 g/kg** |
| Cycle module | date-based | symptom-based | off (symptom log only) |
| Warm-up | 10 min | 12 min | 15 min |

**Why this is the differentiator:** every other app treats a 52-year-old as a 32-year-old with a
smaller number in the age field. The evidence says that's exactly backwards — she needs *more*, not
less. Daybreak is the app that knows that.

### 5.3 The Shape Map — "the lady places", made measurable

This replaces IronPulse's total-volume-in-pounds dashboard, which rewards heavy compounds and makes a
lateral raise look worthless. Instead: **weekly hard sets per shape target**, against a life-stage
target, shown as a body diagram that fills in.

**Primary targets (drive the goal)**
| Target | What it does visually | Lead movements |
|---|---|---|
| **Glute max** | Size, roundness, projection | Hip thrust, RDL, squat, back extension |
| **Glute med/min** | The side shelf; hip width; kills the "hip dip" look | Cable/machine abduction, banded walk, step-up, single-leg work |
| **Hamstrings** | Lifts the glute line, separates it from the thigh | RDL, leg curl, good morning, hip thrust |
| **Side + rear delts** | The shoulder cap — makes the waist read smaller | Lateral raise, face pull, rear fly, overhead press |
| **Lats / upper back** | Posture and V-taper | Pulldown, chest-supported row, pullover |
| **Triceps** | Rear-arm definition | Rope pushdown, overhead extension, dips |
| **Deep core / TVA** | Waist tightness, pelvic floor, back health | Dead bug, Pallof, carries, hollow hold |

**Secondary:** quads, calves, chest, biceps — trained for function and balance, lower priority.

**Deliberately minimised** — and the app will *tell her why*, because otherwise it looks like an
oversight:
- Heavy shrugs / upright rows → trap bulk shortens the neckline
- Loaded side-bends and weighted twists → thicken the waist, the opposite of the goal
- High-volume direct biceps → not a limiting factor for this look

> The Shape Map is the direct, honest answer to "increase muscle in the lady places." It turns a
> vague aesthetic goal into a weekly set count she can actually hit and see.

### 5.4 The 5 AM Protocol

Two parts, both driven by §1.4.

**Part 1 — the warm-up** (10/12/15 min by life stage), guided, with a timer, not a wall of text:
1. **3 min** easy bike or row — raise core temperature. *The non-negotiable one.*
2. **3 min** mobility — 90/90 hips, cat-cow, thoracic opener, ankle rocks.
3. **3 min** activation — glute bridge, banded lateral walk, dead bug, scap pull-up.
4. **2–3 ramp sets** on the first movement before the working set.

**Part 2 — the AM Ordering Rule** (this is the part that matters):
> The first heavy movement of a session starting before 7:00 AM must be **hip-hinge-supported,
> machine-based or bench-supported**. Heavy axial spinal loading is placed **later in the session**
> (20+ minutes upright) or moved to a weekend slot.

- ✅ First: hip thrust, trap-bar deadlift, leg press, goblet squat, chest-supported row
- ⏳ Later in session: back squat, conventional deadlift, standing overhead press
- The exercise picker **shows this constraint live** while she builds a session, with the reason —
  one line, not a lecture.

**Optional home pre-warm** (6 min) for the 5:00 AM crowd: gets her upright and moving before the
5:30 door opens, which is exactly what the disc-hydration evidence recommends. Turns your 5:00 AM
constraint into a feature.

### 5.5 Progression & autoregulation
- **Double progression:** hit the top of the rep range on all sets → add load next session
  (+5 lb lower / +2.5 lb upper). Simple, self-correcting, and it survives a missed week.
- **RIR-based**, per life stage (§5.2). She rates the last set 1–5; the app converts to RIR and
  adjusts. No 1RM testing — unnecessary risk at 5:30 AM and unappealing to this audience.
- **Readiness check** — 3 taps at session start: sleep, energy, soreness. Poor readiness →
  **auto-regulate**: −5–10% on top sets, drop the last set of accessories. Shown as *"Adjusted for
  today"*, never as failure.
- **Deload** auto-suggested on the life-stage cadence, or early if readiness has been poor for 5+ days
  or progression has stalled 3 sessions running.
- **Plateau handling:** exercise rotation from a same-pattern pool, not endless load-adding.

### 5.6 Pelvic floor module *(nobody else ships this)*
Given 40–55% prevalence (§2.8), this is not an edge case.

- **Onboarding, private, skippable:** *"Any leaking when you jump, cough, sneeze or lift heavy?"* —
  Never / Sometimes / Often / Prefer not to say.
- **If flagged:** substitute lower-impact options (step-up for box jump, hip thrust emphasis over
  deep heavy squat), surface the breath cue on every heavy set, add a 2-min daily PFM routine, and —
  clearly and once, not repeatedly — *"A pelvic floor physio can usually fix this. It's common and
  it's treatable."*
- **For everyone:** exhale-on-effort cue on heavy sets. **No default Valsalva coaching** — the
  standard powerlifting cue is exactly the mechanism that drives symptoms in this population.
- **Tone:** a trainable muscle group. Not a problem, not a confession. If tone is wrong here the
  feature does harm — I'd want this copy reviewed before shipping (§14).

### 5.7 Nutrition — one number, not a food diary
Food logging has famously terrible adherence and the payoff here is concentrated in one variable.

- **Protein target** in grams/day from bodyweight × life-stage multiplier (§5.2). One number.
- **Per-meal floor:** ~0.4 g/kg (≈30–40 g) to clear the anabolic-resistance threshold (§2.5).
- **Post-session nudge:** end a workout at 6:40 AM → *"25–30 g protein in the next hour."* This is
  the single highest-value nutrition intervention for a 5:30 AM trainer and it costs one notification.
- **Optional daily tap:** did you hit protein? Y/N. Binary. Ten seconds. Trend goes in the report.
- **Deficit guidance** only if she opts into fat loss: 200–400 kcal, with an explicit warning against
  going harder — and no calorie *counting* feature. We give the target, not the diary.
- **Hard boundary:** general nutrition guidance only. No meal plans, no supplements, no medical
  advice, explicit disclaimer, and clinician prompts where warranted (§15).

---

## 6. Bay Club integration

### 6.1 The class library
From the Bay Club site, the formats offered across the system (and the Redondo Beach page
specifically confirms yoga, barre, boxing studio, cycling, an outdoor cardio deck, and pool/aqua):

**Confirmed formats:** Yoga / Yoga Flow · Pilates (Mat & Reformer) · Barre · HIIT · Cardio ·
Circuit Training · Strength / Group Strength · **BODYPUMP** · **Box n Burn** (boxing + HIIT) ·
Indoor Cycling · Dance / Zumba · Tai Chi · Mind Body · Stretch · Water Fitness / Aqua ·
Cardio Bootcamp · Ignite · Flight · Small Group Training · plus court sports (tennis, pickleball,
squash, racquetball).

Each entry in the library carries **training-load metadata** — this is what makes the scheduler work:

```js
{
  id: 'box-n-burn',
  name: 'Box n Burn',
  intensity: 'high',           // low | moderate | high | max
  systems: ['cardio', 'anaerobic'],
  bodyParts: ['fullBody', 'shoulders', 'core'],
  legFatigue: 'moderate',      // drives conflict detection with lift days
  cnsCost: 'high',
  counts: { conditioning: 1 },
  recoveryHours: 24,           // min gap before a heavy lower session
  shapeContribution: { core: 2, delts: 1 }
}
```

### 6.2 The scheduler — the feature to build the app around
1. **Setup once:** "Which classes do you go to?" → pick format, day, time. ~60 seconds.
2. **The app builds the lift week around them**, applying the §2.7 rules:
   - Never a heavy lower day within 24 h **after** a high-leg-fatigue class (Box n Burn, bootcamp,
     cycle, HIIT).
   - Same-day pairing → **lift first, class after**, and drop the class to moderate intensity.
   - Yoga / barre / stretch / mat Pilates → treated as **recovery**, actively placed *between*
     heavy days.
   - Reformer Pilates and Group Strength → counted as **partial resistance volume** in the Shape Map,
     because they genuinely are.
3. **Conflict warnings in plain English:**
   > *"Box n Burn is Tuesday 5:45. Lower A on Wednesday will be flat. Move Lower A to Thursday?"*
   > [Move it] [Keep it — I'll adjust the load]
4. **Class attendance logs as a session** — it counts. Nothing kills adherence faster than an app
   that shows a zero for a week she trained five times, just because it wasn't barbell work.
5. **Substitution:** class cancelled or full? One tap → an equivalent solo session, sized to the time
   she has left.

### 6.3 Equipment awareness
**[ASSUMPTION — needs your input, §14]** Every exercise is tagged with required equipment, and she
sets what Redondo Beach actually has. Confirmed from the club page: fitness centre (indoor and
outdoor), outdoor studio with cardio deck, boxing studio, barre studio, cycling, GlideFit, pool,
sauna, steam room, 2 racquetball courts.

**What I don't know and can't verify online:** whether they have a hip thrust machine, glute-ham
developer, trap bar, cable abduction machine, reverse hyper, or heavy dumbbells past 50 lb. **These
determine roughly a third of the program.** A handful of photos of the weight floor solves it
permanently — see §14.

---

## 7. The weekly progress report

You asked for this specifically, so here it is in full — including the honest limits.

### 7.1 What's in it
Sunday morning. Scannable in 30 seconds on a phone. Warm, specific, never scolding.

```
DAYBREAK · Week of Sep 1–7

  4 sessions · 2 lifts · 1 Box n Burn · 1 Barre
  ─────────────────────────────────────────────
  SHAPE MAP          this week / target
    Glutes                 14 / 14  ●●●●●●● on target
    Side glute / hips        9 / 10  ●●●●●○ close
    Hamstrings              10 / 10  ●●●●●● on target
    Shoulders (cap)         12 / 12  ●●●●●● on target
    Back                    11 / 12  ●●●●●○ close
    Core                     8 / 10  ●●●●○○ short

  MOVING UP
    Hip thrust      165 → 175 lb   (+6%)
    Lat pulldown     85 →  90 lb   (+6%)
    Lateral raise    15 lb × 12 → 15 lb × 15

  MEASUREMENTS (14-day change)
    Waist        31.5"  ▼ 0.5"
    Hips         40.0"  ▲ 0.25"
    Waist:Hip     0.79  ▼ 0.02     ← the number that matters
    Weight       148.5  ▼ 0.5 lb

  Waist down, hips up. That's recomposition — exactly what the
  scale can't show you.

  THIS WEEK
    Core is 2 sets short. Add a carry finisher Monday.
    Protein: 5 of 7 days on target.
    Deload week starts in 2 weeks.
```

Note the deliberate choices: **waist-to-hip ratio is the hero number, not bodyweight** (§4.1),
Shape Map before strength numbers, and the "short" line phrased as a next action rather than a
failure.

### 7.2 Delivery — what actually works
Recall §1.3: **no PWA can reliably send scheduled email on its own, and iOS can't at all.**

| Method | Automatic? | Cost | Notes |
|---|---|---|---|
| **Native share sheet** (`navigator.share`) | No — one tap | Free | **Primary.** Sends to Mail, Messages, WhatsApp, anything. Can share text *and* a generated PNG. Best mobile UX by a distance. |
| **`mailto:`** pre-filled | No — one tap | Free | Fallback for desktop / no-share-API. Body length is limited, plain text only. |
| **`sms:`** pre-filled | No — one tap | Free | Covers your "text" request. Needs platform detection (`sms:&body=` on iOS, `sms:?body=` on Android). |
| **PNG export** | No | Free | Renders the report card to an image via canvas. Sharable anywhere, saves to Photos, doubles as a progress archive. |
| **EmailJS** | Yes, when app is open | Free ≤200/mo | Real send-to-inbox. Caveat: the API key sits in client code — fine for a personal app, not for anything sensitive. |
| **Cloudflare Worker + Resend** | **Yes, truly** | ~$0 at this volume | The only way to get a report with the app closed. Requires her data to leave the device — a real privacy trade-off for this feature set. |

### 7.3 Recommended v1
1. **Sunday 8:00 AM local notification** — *"Your week is ready."*
2. Tap → the report renders in-app (the nicest screen in the product).
3. **One tap: Share** → share sheet → Mail / Messages / whatever she uses.
4. Secondary: **Save as image**, **Email me** (EmailJS, opt-in), **Copy text**.
5. The report generator is written as a **pure function** — `buildReport(weekData) → structured
   object` — with the renderer separate, so a Worker can be bolted on later **without a rewrite**.

That last point is the whole architectural bet: v1 ships free, private and offline, and the fully
automatic path stays open.

### 7.4 If you want it fully automatic later
Cloudflare Worker + Cron Trigger + Resend. ~150 lines, ~free at this volume, roughly a half-day.
Cost: an encrypted weekly summary leaves the device. **Recommendation: don't do this in v1.** Ship
the one-tap version, see whether she actually wants it hands-off, and keep the privacy story clean
while the app is proving itself.

---

## 8. Technical architecture

```
IronWomen_v1/
├── index.html                 relative paths only (§1.6)
├── manifest.json              "start_url": "./"
├── sw.js                      versioned cache, relative, update prompt
├── css/
│   ├── tokens.css             Harbor Dawn palette, type scale, spacing
│   ├── base.css               reset, typography, a11y
│   └── components.css         cards, buttons, sheets, charts
├── js/
│   ├── core/
│   │   ├── db.js              IndexedDB — ported from IronPulse, extended
│   │   ├── store.js           app state + event bus
│   │   └── router.js          tab routing
│   ├── data/
│   │   ├── exercises.js       ~140 exercises, female-first, Shape Map tagged
│   │   ├── classes.js         Bay Club class library + load metadata (§6.1)
│   │   ├── programs.js        program templates per life stage
│   │   └── standards.js       FEMALE strength standards (fixes IronPulse's male default)
│   ├── engine/
│   │   ├── lifestage.js       the Life Stage dials (§5.2)
│   │   ├── scheduler.js       class-aware week builder + conflict detection (§6.2)
│   │   ├── progression.js     double progression + RIR autoregulation
│   │   ├── shapemap.js        weekly sets per shape target (§5.3)
│   │   └── readiness.js       3-tap check → load adjustment
│   ├── features/
│   │   ├── today.js  train.js  week.js  shape.js  me.js
│   │   ├── warmup.js          the 5 AM Protocol (§5.4)
│   │   ├── pelvicfloor.js     §5.6
│   │   └── report.js          buildReport() + renderers + share (§7)
│   └── ui/
│       ├── components.js  charts.js  sheet.js  timer.js
├── icons/
└── docs/
    ├── PROJECT_PLAN.md        ← this file
    ├── PROGRAM_DESIGN.md      full exercise + program spec
    └── DESIGN_SYSTEM.md       tokens, components, examples
```

**Stack:** vanilla JS ES modules, no build step, no dependencies, IndexedDB, PWA.
**Why no framework:** it loads instantly on a cold 5:30 AM phone, there's nothing to break in two
years, and you can read every line of it. Same reasoning that made IronPulse work.

### 8.1 Data model (new stores beyond IronPulse's)
```js
profile        { lifeStage, birthYear?, heightIn, weightLb, goal,
                 proteinTarget, pelvicFloorFlag, equipment[], units }
classes        { id, formatId, dayOfWeek, time, durationMin, active }
sessions       { id, date, type: 'lift'|'class'|'conditioning'|'recovery',
                 classId?, readiness{sleep,energy,soreness}, durationMin, notes }
sets           { id, sessionId, exerciseId, setNumber, weight, reps, rir, flags[] }
measurements   { id, date, waistIn, hipIn, thighIn, armIn, weightLb, photoBlob? }
cycleLog       { id, date, phase?, flow?, symptoms[], energy }
shapeWeekly    { weekOf, targets: { gluteMax: 14, gluteMed: 9, ... } }
reports        { id, weekOf, payload, sentAt?, method? }
```

All local. No accounts, no sync, no telemetry. Photos as blobs, never uploaded. Given cycle data,
pelvic floor symptoms and body photos, **on-device-only is a hard requirement, not a default.**

---

## 9. Screens

Five tabs. Each answers exactly one question.

**① TODAY** — *what am I doing right now?*
Date, life-stage-aware greeting, one big card: today's session (or class), estimated time, one
primary button. Below: readiness check, protein status, the one thing to know today. Nothing else.

**② TRAIN** — *the session runner.*
Warm-up flow (timed, guided) → exercise cards, one at a time → **one-tap set logging** with last
session pre-filled → auto rest timer → breath cue on heavy sets → finish → summary. This screen is
where the app is won or lost; it gets the most design attention.

**③ WEEK** — *does my week hold together?*
7-day view: lifts, classes, conditioning, recovery. Drag to move. Conflict warnings inline (§6.2).
"Add a class" and "swap a day" both one tap.

**④ SHAPE** — *is it working?*
The Shape Map body diagram (weekly sets vs target) · measurements + waist-to-hip trend · progress
photos (local) · strength trend on lead lifts · PRs · **the weekly report**.

**⑤ ME** — profile, life stage, goals, classes, equipment, pelvic floor settings, protein target,
export/backup, theme, about.

---

## 10. Build phases

| Phase | Deliverable | Est. |
|---|---|---|
| **0** | This plan. Your sign-off + the answers in §14. | ✅ done |
| **1** | Design system + shell: tokens, type, nav, PWA install, offline. Clickable, empty. | ~1 session |
| **2** | Data layer + exercise library (~140, Shape Map tagged) + female strength standards. | ~1 session |
| **3** | **TRAIN** — warm-up flow, one-tap logging, rest timer, session summary. *The core loop; usable on its own.* | ~2 sessions |
| **4** | Life Stage engine + program templates + progression/autoregulation. | ~1–2 sessions |
| **5** | Bay Club class library + **WEEK** scheduler + conflict detection. | ~1–2 sessions |
| **6** | **SHAPE** — Shape Map, measurements, waist-to-hip, photos, charts. | ~1–2 sessions |
| **7** | **Weekly report** + share/email/SMS + Sunday notification. | ~1 session |
| **8** | Pelvic floor module, protein nudges, deload logic, polish. | ~1 session |
| **9** | Real-device testing, GitHub Pages deploy, quick-start guide. | ~1 session |

**End of Phase 3 the app is genuinely usable** — she can train with it while the rest gets built.
That matters: it means feedback arrives early, from a real user, not at the end.

---

## 11. What makes this different from every other app

| | Daybreak | IronPulse | Generic women's app |
|---|---|---|---|
| Life-stage-aware loading | ✅ 3 stages, all dials shift | ❌ | ❌ age field at best |
| Knows her actual gym's classes | ✅ + conflict detection | ❌ | ❌ |
| 5 AM injury-risk ordering | ✅ enforced | ❌ | ❌ |
| Shape-targeted volume tracking | ✅ Shape Map | ❌ total lbs | ❌ generic muscles |
| Pelvic floor | ✅ | ❌ | ❌ (40–55% prevalence) |
| Female strength standards | ✅ | ❌ hardcoded male | partial |
| Waist:hip over bodyweight | ✅ | ❌ | ❌ scale-first |
| Weekly report | ✅ email/SMS/share | ❌ | usually paywalled |
| Private, on-device, offline | ✅ | ✅ | ❌ account required |
| Cost | free | free | $10–30/mo |

---

## 12. Risks, and how each is handled

| Risk | Handling |
|---|---|
| **She uses it twice and stops** (74% baseline) | 90-second onboarding; one-tap logging; useful from day one; no shame mechanics; report as the weekly re-entry hook. §2.9 drives every one of these. |
| **Bay Club changes their schedule** | We never scraped it. She edits her classes in 10 seconds. |
| **5:30 AM injury** | AM Ordering Rule + mandatory extended warm-up + conservative early progression. §1.4/§5.4. |
| **iOS eats the data** | 14-day backup prompts, one-file JSON export, report as paper trail. §1.5. |
| **Program is wrong for her specifically** | Everything overridable; readiness autoregulation; explicit "this is general guidance, see a clinician" boundary. §15. |
| **Pelvic floor copy lands wrong** | Flagged for human review before ship. §14. |
| **Scope creep** | Phases 1–3 are the product. 4–9 are additive. Ship early, learn. |
| **I got the goal wrong** | §14 — answer those seven questions and I'll correct before writing code. |

---

## 13. Explicitly out of scope for v1
Social feed · trainer marketplace · food/calorie diary · wearable sync (Apple Health / Garmin —
strong Phase 10 candidate) · video demos (start with clear text cues + static form images) ·
multi-user accounts · Apple/Google Play native builds · Bay Club booking integration (member-gated,
§1.2) · AI chat coach.

---

## 14. What I need from you before I write code

Seven things. Most take a minute.

1. **Who is this actually for?** One specific person (your wife/partner/friend), or a general app you
   might share more widely? **[ASSUMPTION: one specific woman first, shareable later]** — this
   changes onboarding depth and how opinionated the defaults are.
2. **Her age / life stage** — cycling, perimenopause, or post-menopause? **This drives more of the
   program than anything else** (§5.2). Approximate is fine.
3. **Screenshots of the Bay Club Redondo Beach class schedule** — especially the 5:30–7:00 AM block,
   Mon–Sun. I'll pre-seed the real class names and times so her setup is four taps (§1.2).
4. **Photos of the weight floor** — I specifically need to know: hip thrust machine? Glute-ham
   developer? Trap bar? Cable column with an abduction attachment? Dumbbells above 50 lb? These
   determine about a third of the program (§6.3).
5. **Training history** — total beginner, returning after a break, or already lifting? Sets the
   starting loads and the first 8 weeks.
6. **Any injuries, or pregnancy history?** Low back, knee, shoulder; C-section or vaginal delivery
   (both affect core and pelvic floor programming). Skip if you'd rather not say — the app will ask
   her privately instead.
7. **Name** — Daybreak, Harbor, Bayline, IronWomen, or something of yours? (§3)

**Optional but useful:** does she want the report emailed, texted, or both? And to her only, or also
to you?

---

## 15. Safety boundary

Daybreak provides **general fitness and exercise guidance**. It is not a medical device and does not
diagnose or treat.

- Clear disclaimer at onboarding and in Settings.
- Prompts to consult a clinician for: pelvic floor symptoms (§5.6), suspected osteoporosis, persistent
  joint pain, unusual perimenopausal symptoms, and before starting if there is any cardiac history.
- No HRT advice, no supplement protocols, no meal plans, no diagnosis.
- Conservative defaults: the app **always** errs toward less load and more warm-up, never the reverse.
- All health data stays on the device. No accounts, no sync, no telemetry, no third parties.

---

## 16. Sources

**Bay Club Redondo Beach**
- [Club page — hours, amenities](https://www.bayclubs.com/clubs/redondobeach)
- [Class schedule (member-gated)](https://www.bayclubs.com/classes/?c2=redondobeach)
- [Group exercise formats](https://www.bayclubs.com/amenity/group-exercise)

**Menopause, muscle & body composition**
- [Resistance training alters body composition in middle-aged women depending on menopause — 20-week control trial (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10559623/)
- [NIH — Key body composition changes during perimenopause](https://wellnessatnih.ors.od.nih.gov/Documents/Menopause%20HWC%20Flyer.pdf)
- [Herstasis — Muscle loss during menopause](https://www.herstasis.com/menopause-muscle-health/)

**Heavy loading & bone**
- [LIFTMOR RCT — High-intensity resistance & impact training, postmenopausal women (PubMed)](https://pubmed.ncbi.nlm.nih.gov/28975661/)
- [LIFTMOR — Journal of Bone and Mineral Research](https://onlinelibrary.wiley.com/doi/full/10.1002/jbmr.3284)
- [Exercise for Postmenopausal Bone Health — Can We Raise the Bar? (Springer)](https://link.springer.com/article/10.1007/s11914-025-00912-7)
- [Dr. Stacy Sims — Training during perimenopause](https://www.drstacysims.com/newsletters/articles/posts/Harness_the_Perimenopause_Power_Window)
- [Fast Talk Labs — Training through menopause with Dr. Stacy Sims](https://www.fasttalklabs.com/coaching/training-through-menopause-with-dr-stacy-sims/)

**Glute training**
- [Hip thrust and back squat elicit similar gluteus hypertrophy — MRI study (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10593473/)
- [Henselmans — analysis of the same trial](https://mennohenselmans.com/new-study-hip-thrust-and-back-squat-training-elicit-similar-gluteus-muscle-hypertrophy-and-transfer-similarly-to-the-deadlift/)

**Menstrual cycle (contested — see §2.4)**
- [Follicular vs luteal phase-based resistance training — Sports Medicine 2022](https://link.springer.com/article/10.1007/s40279-022-01679-y)
- [No influence of cycle phase on strength or adaptations — Frontiers 2023](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2023.1054542/full)
- [Menstrual cycle effects on physical and psychological parameters — Scientific Reports 2026](https://www.nature.com/articles/s41598-026-47706-0)

**Protein & anabolic resistance**
- [Leucine content determines MPS response in older women — AJCN](https://ajcn.nutrition.org/article/S0002-9165(22)02773-3/fulltext)
- [Critical variables regulating age-related anabolic responses — Frontiers in Nutrition 2024](https://www.frontiersin.org/journals/nutrition/articles/10.3389/fnut.2024.1419229/full)
- [40 g vs 20 g whey after whole-body resistance exercise (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4985555/)

**Concurrent training**
- [Barbell Medicine — Concurrent training and the interference effect](https://www.barbellmedicine.com/blog/concurrent-training-and-the-interference-effect/)
- [Optimizing concurrent training programs — Medicine 2024](https://journals.lww.com/md-journal/fulltext/2024/12270/optimizing_concurrent_training_programs__a_review.22.aspx)
- [A brief review on concurrent training: laboratory to field (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6315763/)

**Early morning training risk**
- [Sports Injury Bulletin — Chronobiology: rhythms and athletic injury](https://www.sportsinjurybulletin.com/diagnose--treat/chronobiology-rhythms-and-athletic-injury)
- [Delaying early morning workouts to protect sleep (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10825006/)

**Pelvic floor**
- [Urinary incontinence in competitive women powerlifters (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8651931/)
- [Pelvic floor muscle training for stress urinary incontinence in power- and weightlifters (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11245411/)
- [Prevalence of pelvic floor dysfunction in recreational athletes (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10590299/)

**Fitness app retention & female users**
- [How to encourage continuous use of fitness apps among female users (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11241510/)
- [Exploring female fitness app users' motivations and perceptions — qualitative study (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11537609/)

**Body recomposition**
- [Comparing weight loss rates between males and females (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12377079/)

---

*Nothing gets built until you sign off on §14. Answer those seven and I'll start at Phase 1.*

ok sign off start v0.1
