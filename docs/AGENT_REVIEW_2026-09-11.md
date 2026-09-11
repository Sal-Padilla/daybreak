# Daybreak — agent review, 11 September 2026

Five review agents were launched; **four finished before the account hit its monthly
spend limit**, and 27 verification agents were cut off mid-run. Everything those four
produced is preserved here verbatim, including the ready-to-paste code.

**What did NOT complete, and is still owed:**

| Agent | Purpose | Status |
|---|---|---|
| `audit:dead-controls` | every emitted `data-action` vs every registered handler; dead links | **did not run** |
| `review:colour-direction` | the "ladies app should have more color" palette review | **did not run** |
| verification pass | 27 adversarial checks on the findings below | **cut off** — findings below are UNVERIFIED except where noted |

Treat every finding below as a strong lead rather than a confirmed defect: the
adversarial pass that would normally kill the wrong ones never ran. The one verdict
that did land is recorded in section 3.

---


## 1. About screen, version numbers and user-facing copy

### Summary

The About card has three real defects. It points the user at "the project plan" — `PROJECT_PLAN.md` is a 53KB internal engineering doc that is not in `sw.js`'s precache list, not linked from `index.html`, and not reachable from any screen; it is a dead end (and not something to hand a user anyway). Its "Version 0.1.0" disagrees with two other version statements in the repo: `sw.js` says `daybreak-v0.6.1` and `README.md` says `v0.4`; `index.html` and `manifest.json` state no version, so nothing corroborates the number she sees. And the medical disclaimer is mis-scoped for what this app actually prescribes: it names osteoporosis but not osteopenia (far more common in this population), it says "before starting" for a program that escalates load and adds impact over weeks, it carries no stop-and-get-seen trigger, and it is the ninth card down a screen the user may never reach — onboarding asks six questions, none about health, then prescribes trap-bar fives and box jumps. Branding is clean: "Daybreak" is consistent across `index.html` (`<title>`, wordmark, apple-mobile-web-app-title, noscript), `manifest.json`, and both install prompts; the only "IronPulse"/"IronWomen" leftovers are in code comments and docs. The copy sweep turned up one false capability claim (`info.js:189` promises an automatic exercise swap for pelvic-floor symptoms that `sessionplan.js` does not implement), a user-facing pillar named "Lady improvements", a "kills the hip-dip look" promise the program cannot deliver, and a cluster of British idiom ("fortnight", "physiotherapist", "per cent") in an app for a woman in Redondo Beach.

### Findings (24)

#### 1. 🔴 BLOCKER — About card cites "the project plan", which never reaches the user

`js/features/me.js:228`

"The programming rationale is in the project plan." PROJECT_PLAN.md sits in the repo root but is absent from the ASSETS array in sw.js (lines 9-54), is not referenced by index.html, and no screen links to it. On GitHub Pages it is served as raw markdown at /daybreak/PROJECT_PLAN.md, unreachable from the app and unavailable offline. It is also an internal engineering document — it argues about the product name, contains unresolved author notes like "{we will work on this, move forward}", and discusses Rocio in the third person. Pointing a user at it is both a dead end and the wrong document. The rationale she can actually reach ships already: STAGE_RATIONALE (lifestage.js:29-39) renders on the Me screen, and every exercise, class and pillar has an "i" button wired through infosheet.js.

**Fix:** Replace the sentence with a pointer to what ships. In the replacement About card below the final paragraph ends: "...and enough protein to hold onto what you build. Tap the <strong>i</strong> next to any movement, class or pillar to see the reasoning behind it." If you want the plan public, that is a separate decision — it would need adding to sw.js ASSETS and a real link, and it should be rewritten for a reader first.

#### 2. 🔴 BLOCKER — Three version numbers, none of which agree

`js/features/me.js:15`

Every place a version is stated: me.js:15 `const VERSION = '0.1.0'` (rendered as the About subtitle at me.js:219); sw.js:5 `const CACHE = 'daybreak-v0.6.1'`; README.md:1 `# Daybreak — v0.4`. index.html states no version; manifest.json states no version. me.js:15 has not been touched since the file was written (last three commits to me.js are 9d58d31, 22a56b9, ba32687 — none change it), while sw.js's cache name was bumped to v0.6.1 in c24bedf. So the one number the user can see is the most stale of the three, and it is the number she would quote when something is wrong.

**Fix:** Pick the cache name as the source of truth (it is the one that must change per deploy) and make the other two follow it:

  js/features/me.js:15
    const VERSION = '0.6.1';   // keep in step with CACHE in sw.js and the heading in README.md

  sw.js:5  (unchanged)
    const CACHE = 'daybreak-v0.6.1';

  README.md:1
    # Daybreak — v0.6.1

Add a one-line note above sw.js:5: `// Three places state the version: this line, VERSION in js/features/me.js, and the README heading. Bump all three together.`

#### 3. 🔴 BLOCKER — Medical disclaimer is mis-scoped for heavy barbell loading and impact work, and appears after the prescription

`js/features/me.js:221`

Current text: "Daybreak gives general fitness guidance. It is not medical advice and does not diagnose or treat anything. Talk to a clinician before starting if you have a heart condition, joint injury, osteoporosis, or you're unsure. If you leak urine when you lift, jump, cough or sneeze, that's common and usually treatable — a pelvic floor physiotherapist can help."

Four problems. (1) It names osteoporosis but not osteopenia — the condition a large share of perimenopausal women actually carry, and a woman with osteopenia reads that list and correctly concludes it is not about her. The app meanwhile prescribes impactSessionsPerWeek up to 3 (lifestage.js:88), box jumps at programs.js:479, and back squat described at info.js:70 as "genuinely valuable for bone density because it loads the spine directly". (2) "before starting" is the wrong moment for a program that escalates: the On-Ramp graduates to trap-bar 5x5 after four weeks and RIR drops to 1-2 post-menopause (lifestage.js:85). (3) There is no stop-and-get-seen line anywhere in the app — the one place a red flag would matter. (4) It is the ninth card on the Me screen and is never shown during onboarding (onboarding.js asks six questions, none about health, then finish() at line 231 assigns a program). The exercise data already carries `impact`, `axialLoad` and `pelvicFloorRisk` flags, so the honest copy can name exactly which movements need clearing.

No scaremongering intended in the replacement: the framing is "this is what the app will ask of you, here is who should get it cleared first", not "lifting is dangerous".

**Fix:** Replace me.js:221-228 with the block in the deliverable field. Key changes: name what the app prescribes before the caveat; add osteopenia, previous fracture from a minor fall, high blood pressure, hernia or prolapse, recent surgery, pregnancy and early postpartum to the clear-it-first list; change "before starting" to also cover load increases; add one short red-flag sentence; and change "physiotherapist" to "physical therapist" (US).

Separately, add a one-line safety note to the last onboarding screen so the boundary is seen before the first session. In onboarding.js q6() (line 197-207), after the existing .ob-note paragraph:

  '<p class="ob-note">One more thing before we start: Daybreak will ask you to lift heavy and ' +
  'to jump and land. If you have a heart condition, thin bones, a hernia or prolapse, or a ' +
  'joint you are unsure about, get it cleared first. The full note is in Me.</p>'

#### 4. 🔴 BLOCKER — The app claims an automatic exercise swap for pelvic-floor symptoms that does not exist

`js/data/info.js:189`

The "i" panel flag on all 17 exercises with `pelvicFloorRisk: 'high'` reads: "If you leak, say so in your profile and this gets swapped automatically." Nothing swaps. planFor() (sessionplan.js:34-77) walks the program's fixed block list and resolves exerciseIds straight through; it never reads profile.pelvicFloor. The only consumer of profile.pelvicFloor in the whole engine is scheduler.js:677, which changes the wording of the impact note from "3 × 8 box jumps" to "3 × 8 pogo hops or step-downs". A woman who answers "Often", reads that flag on a heavy squat, and trusts it is being told something untrue about the app's behaviour on exactly the question she was most reluctant to answer.

**Fix:** Either implement the swap or tell the truth. The copy fix, at info.js:188-190:

  if (exercise.pelvicFloorRisk === 'high') {
    flags.push('Higher pressure on the pelvic floor. Exhale through the hard part rather than ' +
      'holding your breath, and drop the load before you drop the exhale. If this one leaks, ' +
      'swap it — tap Swap on the exercise card and pick from the alternatives.');
  }

If you do implement it, the hook is planFor() in sessionplan.js, filtering on exercise.pelvicFloorRisk when profile.pelvicFloor is 'sometimes' or 'often' and substituting from exercise.swaps; then the original sentence becomes true and can go back.

#### 5. 🟠 MAJOR — A user-facing training pillar is named "Lady improvements"

`js/data/pillars.js:43`

PILLARS.shape.name = 'Lady improvements'. This is rendered as a heading in the Training balance card (shape.js:109, `p.name`), as the title of its "i" sheet (info.js:318, pillarInfo returns `title: p.name`), and in recommendation titles (recommend.js:241, `title: p.name + ' is the gap'`). Everywhere else the app's voice is precise and adult — "Resistive training", "Control training", "the muscle most responsible for a strong lower back". "Lady improvements" reads as a placeholder that escaped, and it is the one string on the screen that talks down to her. The `short` value is already 'Shape', which is what the chips use and what the app calls the whole feature (Shape Map, the Shape tab).

**Fix:** js/data/pillars.js:43 — change `name: 'Lady improvements',` to `name: 'Shape work',`. Leave `short: 'Shape'` as is, so the chips are unchanged. Also update the two prose references: README.md:96 table row `| **Lady improvements** |` to `| **Shape work** |`, and the comment at js/data/info.js:11 `/* Why each Shape Map target matters — the "lady improvements" explanation. */` to `/* Why each Shape Map target matters — the shape-work explanation. */`.

#### 6. 🟠 MAJOR — "Kills the hip-dip look" promises something training cannot do

`js/data/programs.js:419`

Session description: "Hip thrust leads. Glute max, hamstrings, and the side shelf that kills the hip-dip look." This surfaces to the user in the Pick a session sheet (train.js:581, `esc(d.description)`) and as the session lede via planFor's `note: session.note || day.description` (sessionplan.js:72, rendered at train.js:335). "Hip dips" are the gap between the greater trochanter and the iliac crest — skeletal geometry. Gluteus medius hypertrophy can soften the contour; it cannot remove it. The app is otherwise careful to promise only what it can deliver ("it is muscle, not fat", info.js:19), and this line both over-promises and imports a body-anxiety term from social media into an app whose stated position is that shape comes from building muscle.

**Fix:** js/data/programs.js:419 — replace with:

  description: 'Hip thrust leads. Glute max, hamstrings, and the side glute that fills out the top of the hip.',

#### 7. 🟠 MAJOR — "Thickens the neck and waist" frames muscle as damage, and the program contradicts it

`js/data/pillars.js:47`

Three places tell the user that certain muscle growth is a thing to avoid: pillars.js:47 "heavy shrugs and loaded twists are kept low precisely because they thicken the neck and waist" (shown in the Shape pillar "i" sheet and as recommendation body text at recommend.js:242); programs.js:447 "No shrugs, no heavy upright rows — those work against the shape you are after"; info.js:83 "without the loaded twisting that thickens the waist". This is the one strand of copy that contradicts the app's own stance — everywhere else muscle is the goal and dieting-for-shape is the thing being argued against. It is also contradicted by the program itself: farmer carries are prescribed 3 sets at programs.js:481 and described at info.js:81 as training "the deep core, the grip and the upper back all at once", which is a heavy trap and oblique load by any measure. Either the avoidance rule is real and farmer carries break it, or the rule is aesthetic folklore stated as fact.

**Fix:** State the programming choice without the body-anxiety justification.

  js/data/pillars.js:47 — replace the final sentence. From '...This is deliberately steered: heavy shrugs and loaded twists are kept low precisely because they thicken the neck and waist.' to:
    '...This is deliberately steered: the volume goes to the glutes, side hip and shoulder cap, because those are the ones that change your outline for the effort spent.'

  js/data/programs.js:447 — from 'Delts and lats build the V that makes the waist read smaller. No shrugs, no heavy upright rows — those work against the shape you are after.' to:
    'Delts and lats build the V that makes the waist read smaller. The volume goes there rather than into shrugs and upright rows, which do less for it.'

  js/data/info.js:83 — from '...which builds the deep core without the loaded twisting that thickens the waist.' to:
    '...which builds the deep core the way it actually works under a bar: holding your spine still, not twisting it.'

#### 8. 🟠 MAJOR — "I am keeping impact work lower" overstates what the app does

`js/features/me.js:155`

When pelvicFloor is 'sometimes' or 'often', the Pelvic floor card says: "I am keeping impact work lower and cueing you to exhale through the hard part of every heavy set." Neither half is quite true. Impact frequency is unchanged — dials.impactSessionsPerWeek comes straight from the life-stage table (lifestage.js:73, 88) and scheduler.js:676-679 only rewords the note from "box jumps" to "pogo hops or step-downs". And the exhale cue is shown only when `showCues` is true, which train.js:263 gates on `item.tier <= 2`; tier-3 accessories render no cues at all.

**Fix:** js/features/me.js:155-156 — replace with:

  ? '<p class="lede">I am swapping box jumps for low landings — pogo hops and step-downs — ' +
    'and every heavy lift carries an exhale-on-effort cue. Never hold your breath through ' +
    'the hard part.</p>' : ''

#### 9. 🟠 MAJOR — Me screen header shows a raw ISO date

`js/features/me.js:89`

`'<p class="page-sub">Since ' + esc(profile.startedOn || '—') + '</p>'`. profile.startedOn is set to DB.todayISO() at onboarding.js:241, so this renders as "Since 2026-09-11" under her name — the only unformatted date in the app. Every other screen formats dates (shape.js:44-47 shortDate, today.js:44-49 longDate, report.js:39-46 prettyRange).

**Fix:** js/features/me.js — add a helper next to heightLabel (line 60) and use it at line 89:

  function sinceLabel(iso) {
    if (!iso) return '—';
    const [y, m, d] = String(iso).split('-').map(Number);
    if (!y || !m || !d) return '—';
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  '<p class="page-sub">Since ' + esc(sinceLabel(profile.startedOn)) + '</p>' +

That gives "Since September 2026", which is also the right precision for a start date.

#### 10. 🟠 MAJOR — "You are losing fat" asserted from two tape measurements

`js/features/report.js:287`

The recomposition line reads: "Waist down, hips up. That is recomposition — you are losing fat and building shape at the same time, and it is exactly what the scale cannot show you." The same claim appears at shape.js:250. The trigger (report.js:164-166, shape.js:215-217) is waist strictly less and hips strictly greater than a reading 30 days earlier, measured with a tape to the nearest 0.25in (shape.js:479-483). That pattern is consistent with recomposition, but it is not evidence of fat loss — it clears the rounding by a hair and is sensitive to time of day, tape placement and bloating. The app's whole argument is that it does not over-read a single number, and this over-reads two.

**Fix:** js/features/report.js:287-288 — replace with:

  ? '<p class="recomp-line">Waist down, hips up over the last month. That is the ' +
    'recomposition pattern — the shape changing while the scale does not — and it is exactly ' +
    'what a weigh-in cannot show you.</p>'

And js/features/shape.js:250-251:

  ? '<p class="recomp-line">Waist down, hips up. That is the recomposition pattern — the ' +
    'shape changing underneath a scale that will not move. Keep measuring.</p>' : ''

Mirror the same wording in the plain-text export at report.js:385-386.

#### 11. 🟡 minor — British idiom in an app for a Redondo Beach user

`js/features/shape.js:199`

The user is an American woman at Bay Club Redondo Beach and the app is in pounds and inches throughout, but the copy keeps slipping into British English. "Once a fortnight" at shape.js:199 and report.js:291 (shape.js:267 says "every two weeks" for the same cadence, so it is internally inconsistent too). "Physiotherapist" at me.js:153 and me.js:225 — in the US the profession and the referral she would ask for is a pelvic floor physical therapist. "Ten to twenty per cent" at pillars.js:23. "Next time it comes round" at shape.js:79, where report.js:297 says "next time it comes up".

**Fix:** shape.js:199 — 'Waist and hips, every two weeks. That is it.'
report.js:291-292 — 'No measurements logged yet. Waist and hips, every two weeks, tell you far more than daily weigh-ins ever will.'
me.js:153 — '...and a pelvic floor physical therapist can usually sort it out.'
me.js:225 — '...physical therapist can help.' (superseded by the About rewrite in the deliverable)
pillars.js:23 — 'ten to twenty percent'
shape.js:79 — 'Add a set or two next time it comes up.'

#### 12. 🟡 minor — "The club opens 5:30am on weekdays" is missing a preposition

`js/features/week.js:256`

`'The club opens ' + clockLabel(open) + ' on ' + (...)` renders as "The club opens 5:30am on weekdays." The same sentence is written correctly twenty lines away at week.js:296-297 — "The club opens at 7:00 on weekends" — which also shows a second inconsistency: that copy uses bare 24-hour-style times while the picker uses clockLabel's "5:30am".

**Fix:** js/features/week.js:256 — 'The club opens at ' + clockLabel(open) + ' on ' + ...

And for consistency, week.js:295-297:
  ? 'The club opens at 7am on weekends and classes start at 8am.'
  : 'The club opens at 5:30am on weekdays and classes run 6am–7am. You will lift before it.'

#### 13. 🟡 minor — "Last backed up 0 days ago"

`js/features/me.js:168`

Right after a successful export, backupDays is 0 and the Your data card reads "Last backed up 0 days ago." The branch already special-cases the singular at line 168 but not zero.

**Fix:** js/features/me.js:168 — replace the ternary with:

  ? (backupDays === 0
      ? 'Backed up today.'
      : 'Last backed up ' + backupDays + ' day' + (backupDays === 1 ? '' : 's') + ' ago.') +
    (backupOverdue ? ' Worth doing another — phones lose data.' : '')

#### 14. 🟡 minor — Protein guidance contradicts itself across screens

`js/features/me.js:134`

me.js:134-135 states a threshold: "Aim for about 30–40 g a meal. Under roughly 30 g at once, the muscle-building response barely fires." train.js:475 then tells her 25 g is enough at the moment it matters most: "Protein in the next hour — 25 to 30 grams. It matters more right after you train than at any other point in the day." today.js:245 and report.js:301 both use 30 g. One screen's floor is below another screen's floor.

**Fix:** js/features/train.js:475-476 — bring it in line with the stated threshold:

  '<p class="muted">Protein in the next hour — 30 to 40 grams. It matters more right after ' +
  'you train than at any other point in the day.</p>',

#### 15. 🟡 minor — "Nudge me on Sundays" implies a background notification the app cannot send

`js/features/shape.js:405`

The button reads "Nudge me on Sundays" and enableNudge() (report.js:505-511) requests the browser Notification permission — which shows the OS-level "Allow notifications?" prompt, the universal signal for push. But maybeNudge() (report.js:484-503) only fires from app.js:92 on boot, so nothing arrives unless she already opened the app. The toast at report.js:510 is honest about this; the button label she taps first is not, and the permission prompt actively contradicts it. report.js:7-9 and README.md:140-144 both document the limitation clearly, so this is a label problem, not a design one.

**Fix:** js/features/shape.js:405 — 'Remind me when I open it on Sunday'

And add the caveat before the tap rather than after, at shape.js:401-402:

  : '<p class="lede">A one-screen summary of the week — what moved, what is short, and ' +
    'the measurements that matter. Send it to yourself or anyone keeping you honest.</p>' +
    '<p class="muted">I can flag it on Sunday, but only when you open the app — a web app ' +
    'cannot reach your phone in the background.</p>',

#### 16. 🟡 minor — "Send it" / "Sent." describes a hand-off to the share sheet

`js/features/report.js:334`

The report footer's primary button is "Send it" (report.js:334), and shape.js:563 toasts 'Sent.' when shareReport resolves 'shared'. navigator.share resolving means the OS share sheet completed a hand-off — the mail app may still have it sitting in a draft, and the mailto: fallback at report.js:427 definitely does. Claiming "Sent" for a draft is the kind of small untruth that costs trust when she later finds it unsent. The README is already careful about this distinction (README.md:137-144); the buttons are not.

**Fix:** js/features/report.js:334 — btn({ label: 'Share it', ... })
js/features/shape.js:563 — if (result === 'shared') toast('Handed to the share sheet.', 'calm');

Leave 'Copy text' and 'Text it' as they are — both describe exactly what happens.

#### 17. 🟡 minor — Restore confirmation says nothing is lost; same-key records are overwritten

`js/features/me.js:414`

"Restore from this backup? Anything already on this phone stays, and the backup is merged on top." DB.importAll (db.js:446-448) calls putAll per store, and db.js:444's own docblock says "Existing records with the same key are overwritten." The profile is the clearest case — importAll forces `r.id = 'me'` at db.js:459, so restoring an old backup silently replaces her current life stage, goal, weight and protein target. "Anything already on this phone stays" is the one sentence a user reads before an irreversible merge.

**Fix:** js/features/me.js:414-415 — replace with:

    const ok = await confirmDialog('Restore from this backup? Your sessions are merged together, ' +
      'but anything the backup also has — your profile, a measurement on the same day — is ' +
      'replaced by the backup’s copy.', { confirmLabel: 'Restore' });

#### 18. 🟡 minor — "The fat-burning side of your metabolism"

`js/data/classes.js:40`

The HIIT class "i" panel: "Short, hard intervals do more for the fat-burning side of your metabolism through perimenopause than long steady cardio does." "Fat-burning" is the vocabulary of the exact fitness marketing this app positions itself against, and it is imprecise — the mechanism being gestured at is insulin sensitivity, post-exercise metabolic cost and preserved lean mass. Every other why: field in classes.js is mechanistically specific.

**Fix:** js/data/classes.js:40 — replace the opening clause with:

  why: 'This is your cardiovascular ceiling work. Short, hard intervals do more for body composition through perimenopause than long steady cardio does — they improve how you handle glucose without eating into the recovery your lifting needs — and they take far less time. The catch is that it is expensive: ...'

#### 19. 🟡 minor — Warm-up copy hard-codes 5:30 AM at any hour

`js/features/warmup.js:154`

The 'raise' step always prints: "This is the one that matters. At 5:30 AM your core temperature is at its lowest point of the day — everything after this is safer once you are actually warm." renderWarmup has no clock awareness, so a user starting a session at 6pm is told a fact about 5:30 AM that is not true of her session. today.js:38-42 already establishes a time-of-day helper pattern for exactly this.

**Fix:** Make the claim conditional on the hour. In js/features/warmup.js, inside paint() (line 135), replace the isRaise block at lines 153-157:

  const earlyMorning = new Date().getHours() < 9;
  ...
  (isRaise
    ? '<p class="warmup-flag">This is the one that matters. ' + (earlyMorning
        ? 'First thing in the morning your core temperature is at its lowest point of the day ' +
          'and your spine is at its stiffest — everything after this is safer once you are ' +
          'actually warm.'
        : 'Everything after this is safer once you are actually warm.') + '</p>'
    : '') +

#### 20. 🟡 minor — Two evidence claims stated more firmly than the evidence supports

`js/data/info.js:79`

info.js:79 (box jump): "a few sets a week measurably helps bone density." "Measurably" implies a detectable DXA change from a few sets weekly, which is stronger than the trial evidence supports — the impact-plus-heavy-lifting protocols that show BMD change ran supervised, for months, alongside heavy loading, and the impact component is not separable from it. pillars.js:23: "Through perimenopause you can lose ten to twenty per cent of your lean muscle." That is the high end of what is reported and is stated as a flat fact. Both appear in the "i" sheets, which are the app's most authoritative-feeling surface, and the memory note from the Station A review applies here: do not write unverified claims into user-facing text.

**Fix:** js/data/info.js:79 — '...Bone responds to landing forces in a way it does not respond to lifting alone, and a few sets a week alongside heavy lifting is how the studied protocols deliver it.'

js/data/pillars.js:23 — 'Through perimenopause lean muscle comes off faster than it did before, and muscle is what holds your metabolism, your strength and your bone density up.'

#### 21. ⚪ polish — "Lean out" in the goal picker

`js/features/onboarding.js:14`

GOALS[0] note: 'Lean out, keep the muscle you build'. "Lean out" is the one piece of diet-culture vocabulary in the onboarding flow, sitting under a label ('Lose fat') that already says the thing precisely. Minor, but it is the fourth screen a new user sees and the app's voice is otherwise deliberate about this.

**Fix:** js/features/onboarding.js:14 — { id: 'fat-loss', label: 'Lose fat', note: 'Lose the fat, keep every pound of muscle you build' },

#### 22. ⚪ polish — Leftover IronPulse / IronWomen references, and PROJECT_PLAN.md shipping unlinked

`css/tokens.css:17`

Branding in the user-visible surface is clean — "Daybreak" is consistent in index.html:15 (apple-mobile-web-app-title), :17 (<title>), :32 (wordmark), :86 (noscript), manifest.json:2-3 (name and short_name), install.js:49/66/110/123 (all three install prompts), report.js:308/348 (report header and text export), and me.js:212/218. The remaining references are non-user-facing: css/tokens.css:17 and js/data/standards.js:4 name IronPulse in comments; docs/BUILD_CONTRACT.md:6 and :124 do the same; PROJECT_PLAN.md is written throughout as a pre-rename document. Separately, PROJECT_PLAN.md and docs/ are published to the Pages site as a side effect of serving main from the repo root.

**Fix:** Comments can stay if they carry reasoning (tokens.css:17 is explaining a font choice against the predecessor, which is useful history). If you want them gone, change 'still differentiates from IronPulse' to 'still differentiates from the predecessor app' at css/tokens.css:17 and docs/BUILD_CONTRACT.md:124, and 'This file exists because IronPulse shipped' to 'This file exists because the predecessor app shipped' at js/data/standards.js:4. For the docs: decide deliberately whether PROJECT_PLAN.md should be public at sal-padilla.github.io/daybreak/PROJECT_PLAN.md. If not, move it and docs/ out of the served root or add an exclude.

#### 23. ⚪ polish — js/ui/voice.js is untracked, unimported, and not precached

`js/ui/voice.js:1`

The file exists on disk and is fully written (Web Speech API set logging), but `git status` shows it as untracked, nothing in js/ imports it, and it is the only file under js/ absent from the ASSETS array in sw.js (lines 9-54 — every other shipped asset is listed, verified by diffing the array against the tree). Its header comment says "the UI says so before the first use", implying a disclosure string that has no home yet. Flagging because it is unfinished work sitting where a reviewer will assume it ships. tools/serve.mjs and one Bay_Club_Classes screenshot are also untracked.

**Fix:** Either commit it with its wiring and add './js/ui/voice.js' to the ASSETS array in sw.js, or delete it. If it does land, the Google-routing disclosure its header promises needs writing and belongs next to the microphone button, not buried — and it would also make the me.js:164-165 privacy claim ("No account, no server, nothing uploaded") need a carve-out, since Chrome's speech recognition sends audio to Google.

#### 24. ⚪ polish — index.html and manifest.json descriptions differ by three words

`index.html:10`

index.html:10 meta description: "Strength, shape and early mornings — a training app built for women 30–55." manifest.json:4: "Strength, shape and early mornings — built for women 30–55." These are the two strings that appear in search results and in the install dialog respectively, so they are seen side by side by anyone she sends the link to.

**Fix:** Make them identical. manifest.json:4 — "description": "Strength, shape and early mornings — a training app built for women 30–55."

### Ready-to-paste deliverable

```
/* ============================================================================
 * 1. js/features/me.js:15 — version, made to agree with sw.js and README.md
 * ========================================================================== */

const VERSION = '0.6.1';   // keep in step with CACHE in sw.js and the heading in README.md


/* ============================================================================
 * 2. js/features/me.js:217-230 — the About card, rewritten
 *    Replaces the "project plan" dead end and the mis-scoped disclaimer.
 *    Uses the existing .safety and .muted classes (css/screens.css:570).
 * ========================================================================== */

      card({
        title: 'About Daybreak',
        subtitle: 'Version ' + VERSION,
        body:
          '<p class="safety">Daybreak gives general fitness guidance. It is not medical advice, ' +
          'and it does not diagnose or treat anything.</p>' +

          '<p class="safety">This app will ask you to lift heavy and to jump and land, because ' +
          'that is what the evidence supports at this stage. Get it cleared with a clinician ' +
          'first if any of these apply: a heart condition or high blood pressure; osteopenia, ' +
          'osteoporosis, or a bone broken in a fall that should not have broken it; a hernia or ' +
          'a prolapse; a joint injury; recent surgery; pregnancy or the first months after ' +
          'birth. Ask again before a big jump in load — not only on day one.</p>' +

          '<p class="safety">Stop the set and get seen if you have chest pain or pressure, feel ' +
          'faint, lose your breath far out of proportion to the effort, or feel a sudden sharp ' +
          'back pain or a new heaviness or bulge low in the pelvis.</p>' +

          '<p class="safety">Leaking urine when you lift, jump, cough or sneeze is common and ' +
          'usually very treatable. A pelvic floor physical therapist is the person to see, and ' +
          'it is not a reason to stop lifting.</p>' +

          '<p class="muted">Built around the evidence on training through perimenopause: heavier ' +
          'loads, more volume, impact work for bone, and enough protein to hold onto what you ' +
          'build. Tap the <strong>i</strong> next to any movement, class or pillar to see the ' +
          'reasoning behind it.</p>',
        footer: btn({ label: 'Start over', action: 'reset', variant: 'danger', size: 'md', full: true }),
      }) +


/* ============================================================================
 * 3. js/features/onboarding.js — q6(), line 197-207
 *    The boundary, seen once before the first program is assigned rather than
 *    nine cards down a settings screen she may never open.
 *    Append after the existing .ob-note paragraph.
 * ========================================================================== */

function q6() {
  return shell(
    '<h1 class="ob-title display">One private question.</h1>' +
    '<p class="ob-sub">Any leaking when you jump, cough, sneeze or lift heavy?</p>' +
    '<div class="option-list">' + optionRows(LEAK, draft.pelvicFloor === 'unknown' ? null : draft.pelvicFloor, 'leak') + '</div>' +
    '<p class="ob-note">I ask because it’s common — roughly four in ten women who lift ' +
    'report it — and because it changes which exercises I put in front of you. It stays on ' +
    'this phone, and it’s usually very treatable.</p>' +
    '<p class="ob-note">One more thing before we start. Daybreak will ask you to lift heavy ' +
    'and to jump and land. If you have a heart condition, thin bones, a hernia or a prolapse, ' +
    'or a joint you are unsure about, get it cleared first. The full note is in Me.</p>',
    { nextLabel: 'Finish', skip: 'Skip this' }
  );
}


/* ============================================================================
 * 4. js/data/info.js:188-190 — the pelvic-floor flag, made true
 * ========================================================================== */

  if (exercise.pelvicFloorRisk === 'high') {
    flags.push('Higher pressure on the pelvic floor. Exhale through the hard part rather than ' +
      'holding your breath, and drop the load before you drop the exhale. If this one leaks, ' +
      'swap it — tap Swap on the exercise card and pick from the alternatives.');
  }


/* ============================================================================
 * 5. js/features/me.js — sinceLabel(), next to heightLabel() at line 60,
 *    and its use at line 89
 * ========================================================================== */

function sinceLabel(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// line 89:
        '<p class="page-sub">Since ' + esc(sinceLabel(profile.startedOn)) + '</p>' +


/* ============================================================================
 * 6. One-line string replacements, file:line -> new text
 * ========================================================================== */

js/data/pillars.js:43     name: 'Shape work',
js/data/programs.js:419   description: 'Hip thrust leads. Glute max, hamstrings, and the side glute that fills out the top of the hip.',
js/features/shape.js:199  '<p class="lede">Waist and hips, every two weeks. That is it.</p>' +
js/features/shape.js:79   ' sets short. Add a set or two next time it comes up.</p>';
js/features/shape.js:405  btn({ label: 'Remind me when I open it on Sunday', action: 'enable-nudge', variant: 'ghost', size: 'md', full: true }),
js/features/shape.js:563  if (result === 'shared') toast('Handed to the share sheet.', 'calm');
js/features/report.js:334 btn({ label: 'Share it', action: 'share-report', variant: 'primary', size: 'lg', full: true }) +
js/features/week.js:256   'The club opens at ' + clockLabel(open) + ' on ' + (pickerDay === 0 || pickerDay === 6 ? 'weekends' : 'weekdays') + '.</p>' +
js/features/me.js:153     'trains like any other, and a pelvic floor physical therapist can usually sort it out.</p>' +
js/features/train.js:475  '<p class="muted">Protein in the next hour — 30 to 40 grams. It matters more right after ' +
js/features/onboarding.js:14  { id: 'fat-loss', label: 'Lose fat', note: 'Lose the fat, keep every pound of muscle you build' },
js/data/pillars.js:23     '...Through perimenopause lean muscle comes off faster than it did before, and muscle is what holds your metabolism, your strength and your bone density up. Heavy loading is the only signal that reliably reverses it — and heavy means genuinely heavy, not a light bar for sixty reps.'
manifest.json:4           "description": "Strength, shape and early mornings — a training app built for women 30–55.",
README.md:1               # Daybreak — v0.6.1
```


## 2. Sunday classes — four new Bay Club formats

### Summary

I read `js/data/classes.js` in full plus every consumer of the metadata (`js/engine/scheduler.js`, `js/engine/recommend.js`, `js/engine/shapemap.js`, `js/data/pillars.js`, `js/data/info.js`, `js/features/week.js`) and `docs/CAPABILITIES.md:927` "Adding a class format", then authored the four formats and five schedule rows and validated them against the real schema with a Node script (all 11 `SHAPE_TARGETS` keys, the 7 `SESSION_TYPES`, 0-1 ranges on `pillars`/`counts`, `pairWith`/`blocks` non-contradiction, 50-minute durations, 08:00+ starts, column alignment). Two voice constraints I matched that are easy to miss: the file contains **zero apostrophes/contractions** (verified by grep), and the medical vocabulary is US — `js/engine/lifestage.js:7` says "estrogen", `js/features/onboarding.js:23` says "hot flashes" — even though `js/data/pillars.js:23` uses British "per cent". On the science: Les Mills Strength Development gets `resistance: 0.75` (highest on the timetable, above BODYPUMP's 0.5) with `blocks` listing every lift type so nothing of hers can share the morning; both yogas get `resistance: 0` because neither builds muscle, and they differ only in the standing holds; Barre Strong gets `legFatigue: 'high'` / `recoveryHours: 24` and `resistance: 0.25`, matching the file's consistent rule that high leg cost always pairs with 24h. The one consequence worth a decision from you: Barre Strong and Strength Development at 24h will both trip `HEAVY_LOWER_TOO_SOON` against a Monday 05:30 lower day (19.2h and 20.7h gaps), and `collisionReason()` in recommend.js will not warn about it because it does not wrap the week.

### Findings (8)

#### 1. 🟠 MAJOR — Sunday leg-cost classes will trip HEAVY_LOWER_TOO_SOON against Monday, but the class picker will not warn

`js/engine/recommend.js:48`

Two independent code paths disagree once Sunday rows exist. `recoveryConflict()` at js/engine/scheduler.js:365-385 deliberately tests every class at `dayIndex - 7` so a recurring Sunday class is measured against the following Monday — the comment at :622 even names this case. With Barre Strong ending 10:20 and Strength Development ending 08:50, and her club opening 07:00 Sunday / 05:30 Monday, the gaps to a Monday 05:30 lower session are 19.2h and 20.7h against `recoveryHours: 24`, so buildWeek() will emit HEAVY_LOWER_TOO_SOON and move her lower day off Monday every week. That is correct coaching and I kept it. The problem is `collisionReason()` at js/engine/recommend.js:39-40: it finds `nextDay` by `d.dayIndex === day.dayIndex + 1`, and Sunday is dayIndex 6, so nextDay is dayIndex 7 and never resolves. Before this change the schedule stopped at Saturday and only Saturday hit that edge; now two leg-expensive Sunday slots do. The result is that the Add button shows a clean slot, she adds it, and the week then rebuilds with a warning she was given no chance to anticipate.

**Fix:** Not part of this data change — flagging so you can decide. Either wrap the lookup in recommend.js:39 (`const nextIdx = day ? (day.dayIndex + 1) % 7 : -99;` then match on that, which makes the Sunday→Monday case visible in the picker), or accept the divergence knowingly. If instead you want Monday to stay legal, the single-token alternative is `recoveryHours: 18` on `barre-strong` only: 19.2h then clears, same-morning lower work is still forbidden by `blocks`, and Strength Development at 20.7h clears 18 as well. I did not use 18 because every 'high' / 'very-high' format in the file currently uses 24 or 36 and I did not want to break that pattern silently.

#### 2. 🟡 minor — Appending to either array requires adding a trailing comma to the current last element

`js/data/classes.js:281`

`CLASS_FORMATS` ends with the zumba object closing `}` on line 281 followed by `];` on line 282, and `CLASS_SCHEDULE` ends with the zumba row on line 333 followed by `];` on line 334. Both are currently comma-free as final elements. Pasting the new entries after them without adding a comma is a syntax error.

**Fix:** Change line 281 from `  }` to `  },` and line 333 from `... instructor: 'Angella Blackhall' }` to `... instructor: 'Angella Blackhall' },` before pasting.

#### 3. 🟡 minor — The 30-character format id breaks the CLASS_SCHEDULE column alignment

`js/data/classes.js:311`

The existing rows align `dayOfWeek` at column 37, `studio:` at 81 and `instructor:` at 114 (verified by script), sized to the previous longest id `'battle-on-the-turf',` at 21 characters. `'les-mills-strength-development',` is 33 characters, so that row cannot meet column 37 without re-padding all 18 existing rows.

**Fix:** I kept the existing column for the four short rows (all four land exactly on 37/81/114) and let the Les Mills row overflow with a single space after its comma — a local break rather than an 18-line reflow. If you would rather keep the block perfectly rectangular, re-pad every row to `dayOfWeek` at column 49, `studio:` at 93, `instructor:` at 126.

#### 4. 🟡 minor — Barre Strong instructor was not legible; empty string would render a dangling separator

`js/features/week.js:237`

The slot row renders `esc(c.studio) + ' · ' + esc(c.instructor)` with no guard, so `instructor: ''` produces "Fitness Studio · " with a trailing middot. The transcription note says the 09:30 Barre Strong instructor was not legible.

**Fix:** I used `instructor: 'TBA'`, which renders "Fitness Studio · TBA" and is honest about the gap. If you prefer to leave it blank, week.js:237 needs a guard first, e.g. `[c.studio, c.instructor].filter(Boolean).join(' · ')`.

#### 5. 🟡 minor — Two documentation claims go stale the moment these rows land

`docs/CAPABILITIES.md:796`

Line 796-798 is a whole 'No Sunday classes' limitation paragraph: "The loaded schedule covers Monday to Saturday only, because the source screenshots did not include Sunday... a member with a Sunday class has to add it manually." The Sunday screenshot does exist at Bay_Club_Classes/Sunday_112737_Bay Club Connect.jpg. Line 790 in the same file also states "the 18 slots in classes.js", which becomes 23.

**Fix:** Delete the 'No Sunday classes' paragraph at docs/CAPABILITIES.md:796-798 and change "18 slots" to "23 slots" at :790. Also note that CAPABILITIES.md:652 has a table row `| Sunday | **none** |` that needs the five classes.

#### 6. 🟡 minor — The classes.js header comment understates the window and cites the wrong week

`js/data/classes.js:301`

The block comment says "Transcribed from the Bay Club Connect app, week of 14 Sep 2026" and "These are the EARLY sessions only — the club runs classes all day, but this app exists for the 5:30–9:00 window." The Sunday data is from Sunday 13 Sep 2026, and three of the five Sunday classes start at or after 09:00, with Barre Strong running to 10:20 — outside the stated 5:30–9:00 window.

**Fix:** Widen the stated window and date range, e.g. "...this app exists for the early window: 5:30–9:00 on weekdays, 7:00–10:30 at the weekend when the club opens later" and "week of 13–19 Sep 2026". The scheduler already models the later weekend open correctly (`OPEN_WEEKEND` at js/engine/scheduler.js:48 and `openTimeFor()` at js/engine/recommend.js:18 both treat dayOfWeek 0 as 07:00), so this is comment-only.

#### 7. ⚪ polish — Sunday Cycle at 09:15 is not offerable through the manual time picker

`js/features/week.js:280`

The weekend chip list is `['08:00', '08:30', '09:00', '09:30', '10:00']`. Four of the five Sunday slots land on it; the 09:15 Cycle does not. Tapping Add on the real schedule row is unaffected — it passes `data-time="09:15"` directly at week.js:243 — so this only bites if she removes it and re-adds it by hand.

**Fix:** Add '09:15' to the weekend slot list, or leave it: the schedule row is the primary path and every added class time is editable afterwards.

#### 8. ⚪ polish — pairWith: [] on Strength Development is the first empty pairWith in the file

`js/data/classes.js:23`

Every existing format lists at least one session type in `pairWith`. Strength Development is the first class where the honest answer is 'nothing' — it is the lift, so there is no complementary Stack block to put in front of it. `blocks` carries the actual enforcement (COST_BLOCKED = 1000 at js/engine/scheduler.js:409 dominates any layout), and `pairIndex()` at :206 returns -1 on an empty list, which costs COST_STACK_MISMATCH = 45 — both push lifts off that morning, so the empty array is safe rather than load-bearing. Worth noting that I deliberately left 'recovery' and 'conditioning' OUT of its `blocks`: the Sunday walk is assigned unconditionally at js/engine/scheduler.js:648 with `type: 'recovery'`, and a walk after a strength class is fine. Blocking 'recovery' would have made `collisionReason()` at recommend.js:42 flag the class against her own Sunday walk.

**Fix:** No change needed. If the empty array reads as an oversight six months from now, the alternative is `pairWith: ['recovery']`, which is a valid SESSION_TYPE and states the intent explicitly — but no program day carries type 'recovery', so it would never match and is arguably more misleading than the empty array.

### Ready-to-paste deliverable

```
// ============================================================================
// 1. FOUR NEW CLASS_FORMATS ENTRIES
//    Paste into js/data/classes.js after the zumba object (line 281).
//    First add a trailing comma to line 281 so the zumba object reads `  },`.
// ============================================================================

  // ---- Sunday formats ----

  {
    id: 'les-mills-strength-development',
    name: 'LES MILLS Strength Development',
    intensity: 'high',
    legFatigue: 'high',
    cnsCost: 'moderate',
    counts: { conditioning: 0, resistance: 0.75 },
    pairWith: [],
    blocks: ['lower', 'lower-heavy', 'glute', 'upper', 'full'],
    recoveryHours: 24,
    shapeContribution: {
      quads: 2, gluteMax: 1.5, hamstrings: 1, back: 1.5,
      chest: 1, delts: 1, core: 1, triceps: 0.5, biceps: 0.5
    },
    pillars: { resistive: 0.9, control: 0.4, cardio: 0.3, shape: 0.75 },
    typicalStart: '08:00',
    durationMin: 50,
    note: 'Barbell strength work with real load — the only class here that is genuinely lifting. Nothing of yours belongs on the same morning: let this be the lift and put your own session on another day. Keep heavy squats and hip thrusts a clear day after it.',
    what: 'A barbell class built around progressive overload rather than burn — squat, hinge, press, row and lunge, in low rep ranges with heavy plates and real rest between sets. You pick the load, and you are expected to add to it week on week.',
    why: 'The closest thing on this timetable to your own training, and the only class here that loads you the way bone actually responds to. Heavy compound work is the signal that keeps muscle and slows the density loss that comes off your hip and spine fastest in the years around your last period. It earns three-quarter credit toward your weekly sets, more than any other class here. Where it stops short is the top end: the class rack runs out of plates well below what you can hip thrust, so treat it as a strong supplement to your three heavy days rather than a fourth one. It is still a hard lower-body morning, so give your own heavy leg work a clear day afterwards.'
  },
  {
    id: 'hatha-yoga',
    name: 'Hatha Yoga',
    intensity: 'low',
    legFatigue: 'low',
    cnsCost: 'low',
    counts: { conditioning: 0, resistance: 0 },
    pairWith: ['lower-heavy', 'lower', 'upper', 'glute'],
    blocks: [],
    recoveryHours: 0,
    shapeContribution: { core: 1, gluteMed: 0.5, delts: 0.5 },
    pillars: { resistive: 0.15, control: 1, cardio: 0.1, shape: 0.15 },
    typicalStart: '08:00',
    durationMin: 50,
    note: 'Held postures rather than a flow. It recovers more than it costs and takes nothing out of your legs, so it will follow any lift you like — and the doors open a full hour before it if you want to lift first.',
    what: 'Yoga taught posture by posture instead of as a continuous flow. You set a shape up, hold it for several breaths, come out, and set the next one up. Slow, deliberate, with a lot of attention on the breathing.',
    why: 'Holding a standing posture while nothing moves is still balance and single-leg control training, and control is the pillar that decides whether you are still lifting in ten years. Be clear that it builds no muscle — it earns no set credit and it is not trying to. What it gives you is hip and thoracic range, which is what lets you squat deeper and press overhead without your ribs flaring, plus a real return on stress and sleep. The breathing is not decoration: slow breathing early in the morning is one of the cheapest things you have against hot flashes and broken nights.'
  },
  {
    id: 'gentle-yoga',
    name: 'Gentle Yoga',
    intensity: 'low',
    legFatigue: 'low',
    cnsCost: 'low',
    counts: { conditioning: 0, resistance: 0 },
    pairWith: ['lower-heavy', 'lower', 'upper', 'glute'],
    blocks: [],
    recoveryHours: 0,
    shapeContribution: {},
    pillars: { resistive: 0.05, control: 0.85, cardio: 0.05, shape: 0.05 },
    typicalStart: '09:00',
    durationMin: 50,
    note: 'The same teacher an hour later, and considerably easier — supported postures, more floor, nothing held at the edge of your range. Pure recovery: it costs nothing, and it is the right call on a morning when the week has flattened you.',
    what: 'Slower and softer than Hatha. Much of it happens on the floor, blocks and bolsters hold you up in the shapes, and the standing holds are largely gone.',
    why: 'The honest difference from Hatha is effort, not content. Gentle takes the standing holds out, so you lose most of the balance work and keep all of the mobility and the calm. It builds nothing, and it is not pretending to. What it does is open hips and upper back after a week of loading, and drop your nervous system into a gear a busy week never lets it find — which matters more than it sounds when sleep is usually the first thing perimenopause breaks. If you only have room for one yoga class, take the earlier Hatha. If the week has beaten you up, take this one instead and count it as training, because that morning it is.'
  },
  {
    id: 'barre-strong',
    name: 'Barre Strong',
    intensity: 'moderate',
    legFatigue: 'high',
    cnsCost: 'low',
    counts: { conditioning: 0.25, resistance: 0.25 },
    pairWith: ['upper'],
    blocks: ['lower', 'lower-heavy', 'glute'],
    recoveryHours: 24,
    shapeContribution: { quads: 2, gluteMax: 1, gluteMed: 1, core: 1, calves: 0.5, delts: 0.5 },
    pillars: { resistive: 0.3, control: 0.8, cardio: 0.4, shape: 0.4 },
    typicalStart: '09:30',
    durationMin: 50,
    note: 'Hundreds of small reps, nearly all of them quads and glutes. Light load, but a lot of leg fatigue for what it builds — lift upper body before it if you lift at all, and keep squats and hip thrusts a clear day away.',
    what: 'Ballet-derived work at the barre and on the mat: small pulses, long holds in a half squat, light hand weights and a band, very high reps throughout. The burn is local rather than breathless.',
    why: 'Do not let anyone tell you this is nothing. Three hundred reps in a shortened range is real work, and the side-glute, deep core and single-leg control it trains are what hold your hips level and your pelvic floor coordinated under load. But be clear about the load itself: endurance-range work with no weight on your back does not load bone, and bone is the part of this you cannot get back later. It earns quarter credit toward your weekly sets and it does not stand in for a heavy day. The price is the awkward bit — your quads will be cooked afterwards for something that built very little, so if you love this class, and plenty of women do, put it on a morning you were never going to squat on anyway.'
  }

// ============================================================================
// 2. FIVE CLASS_SCHEDULE ROWS (dayOfWeek 0)
//    Paste at the end of CLASS_SCHEDULE, after the Saturday zumba row (line 333).
//    First add a trailing comma to line 333.
//    Column alignment: the four short rows land exactly on the file's existing
//    columns (dayOfWeek 37, studio 81, instructor 114). The Les Mills id is 33
//    chars so that one row overflows by a single space — see findings.
// ============================================================================

  // Sunday
  { formatId: 'les-mills-strength-development', dayOfWeek: 0, start: '08:00', end: '08:50', studio: 'Fitness Studio',        instructor: 'Pamela Light' },
  { formatId: 'hatha-yoga',         dayOfWeek: 0, start: '08:00', end: '08:50', studio: 'Yoga Studio',           instructor: 'Lisa Schmahl' },
  { formatId: 'gentle-yoga',        dayOfWeek: 0, start: '09:00', end: '09:50', studio: 'Yoga Studio',           instructor: 'Lisa Schmahl' },
  { formatId: 'cycle',              dayOfWeek: 0, start: '09:15', end: '10:05', studio: 'Indoor Cycling Studio', instructor: 'Courtney Smith' },
  { formatId: 'barre-strong',       dayOfWeek: 0, start: '09:30', end: '10:20', studio: 'Fitness Studio',        instructor: 'TBA' }

// ============================================================================
// 3. WHAT THE NUMBERS PRODUCE AT RUNTIME (verified, not asserted)
//
// Shape Map credit = shapeContribution x counts.resistance:
//   les-mills-strength-development  quads 1.5, gluteMax 1.125, back 1.125,
//                                   hamstrings 0.75, chest 0.75, delts 0.75,
//                                   core 0.75, triceps 0.375, biceps 0.375
//   barre-strong                    quads 0.5, gluteMax 0.25, gluteMed 0.25,
//                                   core 0.25, calves 0.125, delts 0.125
//   hatha-yoga / gentle-yoga        nothing (resistance 0, as with cycle)
//   Both yogas still LIST their targets in the "i" sheet — classInfo() at
//   js/data/info.js:279 reads shapeContribution directly, unmultiplied — so
//   Hatha shows Core / Side glute / Shoulders while crediting zero. That is
//   the same pattern cycle already uses.
//
// Auto-flags fired by classInfo() (js/data/info.js:286-301):
//   les-mills  "Costs your legs real fatigue..." + "Counts toward your weekly
//              sets at 75% credit — real training, but not a replacement for
//              heavy lifting." (the `why` is written to agree with this, not
//              fight it: supplement to her three heavy days, not a fourth)
//   barre      "Costs your legs real fatigue..." + "25% credit..."
//   both yogas no flags — correct, they are intensity 'low' and cost nothing
//
// Lift window from the 07:00 Sunday open (OPEN_WEEKEND / openTimeFor(0)):
//   08:00 classes 60 min · 09:00 120 · 09:15 135 · 09:30 150. All >= 25, so
//   week.js shows "room to lift first" on every Sunday slot, never the
//   "no time to lift first" badge.
//
// R4 buffer: both yogas are intensity 'low', so scoreLayout() awards
// BONUS_BUFFER when they sit between two lift days — correct, they recover.
// ============================================================================
```


## 3. Verification verdict

**Refuted:** false

Every literal in the claim checks out against source. js/features/me.js:15 is `const VERSION = '0.1.0';`, rendered at js/features/me.js:219 as `subtitle: 'Version ' + VERSION` inside the "About Daybreak" card — the only user-visible version in the app. sw.js:5 is `const CACHE = 'daybreak-v0.6.1';`. README.md:1 is `# Daybreak — v0.4`. index.html has no version string (grep returns nothing) and manifest.json has none either. The git-history claims also hold: `git log -L15,15:js/features/me.js` shows the line has exactly one commit touching it, its creation in 4712594, so 9d58d31/22a56b9/ba32687 indeed leave it alone; and `git log -L5,5:sw.js` shows c24bedf bumping daybreak-v0.6.0 to v0.6.1 (the claim's `-S` -invisible edit). So the user-facing number is the most stale of the set. The fix is mechanically safe: VERSION is module-private (not exported; js/app.js:15 imports the module namespace but never reads it), used only at me.js:219 for display, so changing the string has zero behavioral coupling — no build step, no path, no cache key depends on it. README.md:1 and the sw.js comment are docs-only. Nothing here touches relative paths or the GitHub Pages subpath.

**Corrected:** The defect is real but the count is wrong, and the fix's rationale contradicts the file it edits.

(1) Not three version statements — five. The claim's "Every place a version is stated" is false. Two more disagree and the claim misses both:
  - PROJECT_PLAN.md:4 — `**Status:** v0.3 — live at ...`
  - docs/CAPABILITIES.md:1002 — tells a developer the `CACHE` constant is `(daybreak-v0.1.0)`, which is actively wrong instructions: anyone following that doc greps for a constant value that has not existed since d224df5.
  A sixth, docs/BUILD_CONTRACT.md:1 `# DAYBREAK v0.1 — BUILD CONTRACT`, should be left alone — it is the frozen title of the v0.1 contract document, not a claim about what ships today. So the fix must also update PROJECT_PLAN.md:4 and docs/CAPABILITIES.md:1002, and the proposed sw.js note must not say "Three places" — it should name js/features/me.js VERSION, the README heading, the PROJECT_PLAN status line, and the CAPABILITIES reference.

(2) The stated rationale is contradicted by sw.js:3-4, which the fix leaves in place: "Bump this on any change to the strategy below. Asset freshness no longer depends on it — stale-while-revalidate handles that — but a new name forces one clean sweep of old caches." By the file's own documentation CACHE is bumped on strategy changes, not "per deploy" as the fix asserts. In practice history goes the other way (c24bedf bumped it for a CSS fix, 9d58d31 for an install-prompt fix), so the choice of CACHE as source of truth is defensible — but the new comment would sit directly under a comment saying the opposite. Either reword the existing sw.js:3-4 comment in the same edit or anchor the source of truth elsewhere; do not stack two contradictory comments.

(3) One behavioral caveat the fix does not mention: because the service worker is stale-while-revalidate (README.md:52-55 — "expect to open the app twice before a change appears"), the About-screen number will still lag one open behind the code actually running right after a deploy. Syncing the three literals does not make the displayed number reliable at the moment it matters most; it only guarantees it is eventually right.

Minor: inserting the note above sw.js:5 shifts `const CACHE` to line 6, so the note's own "this line" phrasing is fine but any doc citing sw.js:5 goes stale.


## 4. Exercise diagrams — coverage and correctness across all 144 movements

### Summary

I enumerated all 144 exercises through `diagramKeyFor()` with node. 111 get a diagram, 33 get none. Judging each as a coach — "would a woman who has never done this movement perform the right thing after seeing this picture and the setup steps printed under it?" — only 48 of 111 pass. 63 mapped exercises (43.8% of the whole library, 56.8% of everything that shows a picture) would mislead her, including 4 of 17 tier-1 lifts and 21 tier-2 lifts. Of the 111 beginner-flagged On-Ramp exercises, 50 show a misleading picture, 24 show none, and only 37 are safe. The damage is worse than "wrong drawing": `infosheet.js:32-37` prints the diagram's own `name` and `setup` steps verbatim, so Leg Extension currently ships the caption "Squat" and the instruction "Stand with your feet a little wider than your hips. Hold the weight against your chest with both hands." Two of the task's suspicions land on different keys than expected — `upright row` routes to `seated-row` (not lateral-raise) and `curtsy` routes to `split-squat` (not hip-abduction) — both because of rule-ordering shadowing in the `byName` table. The single highest-value fix is free: reordering two lines in `info.js` moves three rear-delt PULLS off the bench-press (a horizontal PRESS) picture and onto the correct face-pull diagram. All 12 warm-up movements have no picture and no plumbing at all — `warmup.js` never imports `DIAGRAMS`, though the comment at `warmup.js:160-162` says vertical space was deliberately reserved "for the picture".

### Findings (17)

#### 1. 🔴 BLOCKER — 'squat' diagram covers a supine sled press, an open-chain knee extension, and a calf raise

`js/data/info.js:226`

The rule `[/squat|leg press|leg extension/, 'squat']` sweeps three non-squats into the standing goblet-squat picture. Leg Press (js/data/exercises.js:977, tier 1) is supine on a 45-degree sled with the torso fixed and zero balance demand. Leg Extension (js/data/exercises.js:1055) is seated open-chain knee extension — the hip never moves. Leg Press Calf Raise (js/data/exercises.js:2408) is a pure substring accident: the name contains 'leg press', so a CALF exercise (ankle joint, `primary: ['calves']`) is pictured as a squat. Wall Sit (js/data/exercises.js:1038, `track: 'time_hold'`) arrives via the `byPattern` fallback and is an isometric wall-supported hold, not a dynamic loaded rep. Drop Squat (js/data/exercises.js:2546) is an unloaded fast landing drill with `impact: true` — the picture shows a slow loaded rep, so she loses the exact bone-loading stimulus the exercise exists for. 5 of the 10 exercises on this diagram are wrong.

**Fix:** Drop `|leg press|leg extension` from the rule so those return null, and add a calf guard so 'Leg Press Calf Raise' cannot match. Better: replace name-regex routing with the explicit id->key map in the deliverable. Then draw three new shapes: `leg-press-sled` (covers leg-press + hack-squat, 1 tier-1), `leg-extension`, `wall-sit`, and put drop-squat on the proposed `jump-land` shape.

#### 2. 🔴 BLOCKER — 'romanian-deadlift' diagram covers four movements that are not a standing barbell hinge

`js/data/info.js:224`

`[/romanian deadlift|\brdl\b|good morning|pull-?through|back extension|deadlift/, 'romanian-deadlift']` puts a standing-tall, bar-on-the-thighs picture on: Back Extension (js/data/exercises.js:415, tier 2, machine, torso supported at the hips on a 45-degree pad, nothing in the hands); Good Morning (barbell across the UPPER BACK — she would hold it in her hands); Kettlebell Swing (js/data/exercises.js:453, tier 2, `pelvicFloorRisk: 'high'`, ballistic arc with a hip snap — the picture teaches a slow grind and hides the very thing that makes it a pelvic-floor risk); Glute-Ham Raise (GHD machine, knee flexion with the hips locked — its own cue at js/data/exercises.js:482 literally reads 'Hips stay extended — this is not a back extension' while the picture is a standing hinge). Cable Pull-Through also misses (rope between the legs, facing away from a low pulley). 8 of 12 exercises on this diagram are wrong.

**Fix:** Remove `|good morning|pull-?through|back extension|deadlift` from the rule. Draw a `hip-supported-hinge` shape (back-extension + glute-ham-raise + nordic-curl, all tier 2 = 3 exercises), a `kettlebell-swing` shape showing the arc and the float, a `good-morning` shape (bar on the back), and a `cable-pull-through` shape.

#### 3. 🔴 BLOCKER — All three tier-1 deadlifts show an RDL that never reaches the floor

`js/data/info.js:224`

Conventional Deadlift (js/data/exercises.js:335), Sumo Deadlift and Trap-Bar Deadlift are all tier-1 and all get the Romanian deadlift picture plus its setup text: 'Stand tall with the bar resting against the front of your thighs' (js/data/diagrams.js:26). A beginner following that never sets up over a loaded bar on the floor — she performs an RDL, which is a separate exercise in this same library with its own id. Trap-Bar is the worst of the three: its hand-written note at js/data/info.js:69 sells it as 'a deadlift with the load beside you instead of in front', and the picture shows a straight bar in front of her. Sumo's defining feature is a wide stance with the hands inside the knees, which a side-on frame cannot show at all.

**Fix:** Draw one `deadlift-from-floor` shape (bar on the floor at the start, side-on) and route conventional + trap-bar to it; give sumo a front-view frame or leave it null. This is the highest tier-weighted single shape in the roadmap: 3 exercises, all tier 1.

#### 4. 🔴 BLOCKER — 14 of 16 core exercises show a forearm plank, including three tier-2 lifts with hand-written coaching notes

`js/data/info.js:235`

`[/plank|dead bug|hollow|pallof|bird dog|ab wheel|crunch|sit-?up|knee raise/, 'plank']` plus the `byPattern` fallback `core: 'plank'` (js/data/info.js:249) mean every core movement gets the same picture. Only Plank and Weighted Plank are correct. Wrong: Pallof Press (js/data/exercises.js:1183, tier 2, standing at a cable, anti-rotation — it has a hand-written note at js/data/info.js:83) and Half-Kneeling Pallof Press; Dead Bug (js/data/exercises.js:1076, tier 2, SUPINE, hand-written note at js/data/info.js:82); Cable Crunch (js/data/exercises.js:1255, kneeling deliberate spinal FLEXION — and the plank diagram is a right/wrong comparison whose 'wrong' frame is a spine that is not held straight, so the picture teaches the opposite of the exercise); Standing Cable Woodchop (js/data/exercises.js:1360, standing rotation, the library's only rotational movement); Hanging Knee Raise (hanging from a bar); plus bird-dog, hollow-hold, side-plank, ab-wheel-rollout, stir-the-pot, lying-leg-raise, reverse-crunch, plank-shoulder-tap.

**Fix:** Narrow the rule to `/plank/` only and delete the `core: 'plank'` byPattern fallback. Draw `supine-core` (dead-bug + hollow-hold + lying-leg-raise + reverse-crunch = 4 exercises, and it also covers the Dead bug warm-up item that appears in all three warm-up families), `anti-rotation` (pallof x2 + woodchop = 3), `high-plank-rollout` (ab-wheel + stir-the-pot + plank-shoulder-tap = 3), `side-plank`, `cable-crunch`, and route hanging-knee-raise to the proposed `hang-from-bar` shape.

#### 5. 🔴 BLOCKER — Rule-ordering bug: three rear-delt PULLS are pictured as a chest PRESS, and the correct diagram already exists

`js/data/info.js:229`

`[/bench press|chest press|push-?up|\bfly\b|pec deck/, 'bench-press']` sits at index 7, three lines above `[/face pull|rear delt|reverse pec/, 'face-pull']` at line 232. So 'Rear Delt Fly' (js/data/exercises.js:1516, tier 2) matches `\bfly\b`, 'Cable Rear Delt Fly' matches the same, and 'Reverse Pec Deck' (js/data/exercises.js:1535, tier 2) matches `pec deck` — all three land on bench-press and never reach the face-pull rule that was clearly written for them. The force direction is exactly reversed: these are horizontal PULLS for the rear delts and mid-back, shown as a supine horizontal PRESS for the chest, with the setup text 'Lie on your back on the bench... push it straight back up'. This is the cheapest fix in the audit — the right artwork already exists.

**Fix:** Move the `face-pull` rule above the `bench-press` rule, or tighten to `/\bchest fly\b|\bpec deck\b/` with a `rear|reverse` negative guard. Zero new artwork, fixes 3 exercises (2 tier-2), and the same `face-pull` shape then also serves the 'Band pull-apart' warm-up item, which appears in 2 of 3 warm-up families and survives the short warm-up.

#### 6. 🔴 BLOCKER — Upright Row routes to 'seated-row', not 'lateral-raise' as suspected

`js/data/info.js:228`

`[/\brow\b/, 'seated-row']` at index 6 fires on 'Upright Row' before `[/lateral raise|side raise|upright row/, 'lateral-raise']` at line 231 is ever reached — I confirmed this by re-implementing the table and logging shadowed matches. So the exercise deliberately designed to be de-emphasised (js/data/exercises.js:1591, its first cue reads 'De-emphasised here on purpose — it loads the traps, and trap bulk shortens the neckline') is shown as a seated horizontal cable row, with setup text telling her to sit down and place both feet on a foot plate. The intended fallback, lateral-raise, would also be wrong — an upright row is an elbow-leading vertical pull with the bar tracking the body.

**Fix:** Move the lateral-raise rule above `\brow\b`, but route upright-row to null rather than to lateral-raise, per the file's own stated policy at js/data/diagrams.js:5-6 ('shows no picture at all rather than a misleading one'). Give it a dedicated shape later — it is a 1-exercise shape, bottom of the roadmap.

#### 7. 🟠 MAJOR — Dumbbell Pullover and Straight-Arm Pulldown show a seated lat pulldown

`js/data/info.js:227`

`[/pulldown|pull-?up|chin-?up|pullover/, 'lat-pulldown']`. Dumbbell Pullover (js/data/exercises.js:1782) is performed lying supine on a bench with the weight travelling in an arc over the head; the setup text she reads is 'Sit facing the machine with your feet flat on the floor' (js/data/diagrams.js:56). Straight-Arm Pulldown (js/data/exercises.js:1765) is standing shoulder extension with the elbows locked — its own cue says 'Arms nearly straight' — while the lat-pulldown picture and its 'pull with your elbows' framing teach elbow flexion, which is the one thing this exercise forbids.

**Fix:** Remove `|pullover` from the rule and exclude straight-arm-pulldown. Draw one `straight-arm-shoulder-extension` shape covering both (2 exercises). Pull-Up and Assisted Pull-Up can stay on lat-pulldown as an acceptable teaching proxy, but they are better served by the proposed `hang-from-bar` shape, which also covers Hanging Knee Raise and the 'Scap pull-ups' warm-up item.

#### 8. 🟠 MAJOR — Curtsy Lunge routes to 'split-squat', not 'hip-abduction'; frontal-plane lunges are undepictable side-on

`js/data/info.js:225`

`[/split squat|lunge|step-?up|step-?down/, 'split-squat']` at index 3 shadows the `curtsy` term in the hip-abduction rule at line 234 — so the task's suspicion was right that it is wrong, but about which diagram. Curtsy Lunge (js/data/exercises.js:649) crosses the rear leg behind and out to the side; Lateral Lunge (js/data/exercises.js:668) steps wide with the trailing leg straight. Both are frontal-plane and both get a sagittal rear-foot-elevated split squat. Every other diagram in the library is drawn side-on (js/data/diagrams.js:8), so these two cannot be served by any existing view — the one frontal-plane diagram that exists, hip-abduction, is explicitly labelled 'viewed from the front'.

**Fix:** Exclude both from the split-squat rule and draw one front-view `frontal-plane-lunge` shape (2 exercises), following the front-view convention already established by the hip-abduction diagram.

#### 9. 🟠 MAJOR — 7 of 8 hip-abduction exercises are side-lying, quadruped, seated or walking — all shown standing at a cable

`js/data/info.js:234`

`[/abduction|clamshell|monster walk|lateral walk|fire hydrant|curtsy/, 'hip-abduction']` funnels six distinct body positions into one standing single-leg cable kick. Side-Lying Hip Abduction and Clamshell (js/data/exercises.js:798) are performed lying on the side; Fire Hydrant (js/data/exercises.js:816) is quadruped on hands and knees; Banded Lateral Walk and Monster Walk are walking with a band; Hip Abduction Machine (tier 2, with a hand-written note at js/data/info.js:67 telling her to 'lean forward slightly') and Seated Band Abduction are seated with both legs pushing outward. Only cable-hip-abduction is correct. Seven of these eight are beginner-flagged, so they are all in the On-Ramp pool.

**Fix:** Split into four shapes: keep `hip-abduction` for the cable version, add `side-lying-abduction` (2), `seated-abduction` (2, one tier-2), and `banded-lateral-walk` (2 exercises plus the 'Banded lateral walk' warm-up item). Route Fire Hydrant to the proposed `quadruped` shape, which also covers Bird Dog and the Cat-cow warm-up item.

#### 10. 🟠 MAJOR — 9 of 14 exercises on 'bench-press' are not a supine barbell press

`js/data/info.js:229`

Beyond the three rear-delt cases above: Push-Up (js/data/exercises.js:2013, tier 2, beginner) and Incline Push-Up are prone with the body as the load, yet the printed setup reads 'Lie on your back on the bench with your feet flat on the floor' (js/data/diagrams.js:76) — a beginner reading that at 5:30am has been given instructions for a different exercise. Cable Chest Fly, Dumbbell Chest Fly and Pec Deck are arcs with near-straight arms, not presses. Bench Dip (js/data/exercises.js:2246) arrives via the `byPattern` fallback `push-h: 'bench-press'` (js/data/info.js:247) and is a vertical triceps movement with the hands behind her on the bench.

**Fix:** Draw `push-up` (2 exercises, one tier-2 beginner), `chest-fly` (3), and `bench-dip` (1), and remove `push-?up|\bfly\b|pec deck` from the rule. Also drop the `push-h` byPattern fallback — it routes only 2 exercises and gets one of them wrong.

#### 11. 🟠 MAJOR — 8 of 10 exercises on 'split-squat' are dynamic stepping movements or box work

`js/data/info.js:225`

The picture shows a static rear-foot-elevated Bulgarian split squat. Reverse Lunge, Deficit Reverse Lunge and Walking Lunge (all tier 2) step or travel each rep, and the setup text tells her to 'Rest the top of your back foot on the bench behind you' (js/data/diagrams.js:47) — she would perform a Bulgarian, which is a separate, markedly harder tier-1 entry. Box Step-Up (js/data/exercises.js:610, tier 2, hand-written note at js/data/info.js:77 coaching 'Step up and stand tall, then lower slowly') is shown as a descent onto a rear foot, the opposite direction. Lateral Step-Up and Step-Down (`impact: true`) are equally unserved.

**Fix:** Draw `dynamic-lunge` (reverse + deficit-reverse + walking, 3 tier-2 exercises) and `step-up-step-down` (box-step-up + lateral-step-up + step-down, 3). Keep only bulgarian-split-squat and dumbbell-split-squat on the existing shape.

#### 12. 🟠 MAJOR — Bent-over and inverted rows show a seated, fully-supported cable row

`js/data/info.js:228`

Barbell Row, T-Bar Row and Single-Arm Dumbbell Row (all tier 2) require a hinged-over torso held under load — the main coaching and low-back risk in each — and are shown as a seated row where the low back does nothing. Inverted Row is supine under a bar with the body as the load. This is not just a cosmetic mismatch: the picture removes the exact demand she needs to be warned about at 5:30am, when js/data/info.js:186 notes spinal loading is least welcome.

**Fix:** Draw one `bent-over-row` shape for the three hinged rows (3 tier-2 exercises) and one `inverted-row` shape. Seated Cable Row, Chest-Supported Row and Machine Row stay correctly on the existing diagram.

#### 13. 🟠 MAJOR — A wrong diagram also ships wrong written setup instructions, not just a wrong picture

`js/ui/infosheet.js:32`

`diagramBlock()` renders the DIAGRAM's own `name` as the figcaption and its `setup` array as a numbered list: `'<ol class="ex-setup">' + d.setup.map(...)`. So the mismatch compounds — tapping 'i' on Leg Extension shows the caption 'Squat' and the steps 'Stand with your feet a little wider than your hips / Hold the weight against your chest with both hands / Stand tall, look straight ahead, and keep your heels down' (js/data/diagrams.js:36-38). Glute Bridge is told to sit with her upper back against a bench; Push-Up is told to lie on her back. For 63 exercises the app is printing confident, specific, wrong instructions in her own reading voice. This raises the severity of every mapping finding above: it is not 'a slightly off drawing', it is incorrect coaching text.

**Fix:** Until the mappings are corrected, gate the `setup` list on an exact id match rather than a shape match — render `d.setup` only when the exercise is the canonical owner of that shape, and render the svg alone otherwise. Longer term, move `setup` to a per-exercise field, or keep it on the shape but only show it for the ids explicitly listed as owning that shape.

#### 14. 🟠 MAJOR — 33 exercises have no picture at all — every arm, calf, plyometric and cardio movement

`js/data/exercises.js:2408`

Exact breakdown of the 33 (all tier 2 or 3; 6 are tier 2, 24 are beginner-flagged): 7 triceps isolation (Rope Pushdown — tier 2 with a hand-written note at js/data/info.js:85 — Straight-Bar Pushdown, Overhead Tricep Extension (tier 2), Dumbbell Overhead Tricep Extension, Skull Crusher, Machine Tricep Extension, Tricep Kickback); 6 biceps (Dumbbell Curl, Cable Curl, Hammer Curl, Incline Dumbbell Curl, Machine Preacher Curl, EZ-Bar Curl); 3 calves (Standing, Seated, Single-Leg Calf Raise — a 4th, Leg Press Calf Raise, is mis-mapped to squat); 7 plyometrics (Box Jump and Broad Jump both tier 2, Pogo Hop, Skater Jump, Split Jump, Jump Rope, Heel Drop — this is the bone-density pillar, and Box Jump and Pogo Hop both carry hand-written notes at js/data/info.js:79-80); 10 cardio (Treadmill Walk / Incline Walk / Run, Outdoor Walk, Stationary Bike, Bike Sprint Intervals (tier 2), Rower, Rower Sprint Intervals (tier 2), Stair Climber, Elliptical). Triceps is a named Shape Map target with its own 'why' copy at js/data/info.js:33-36 and not one of its seven exercises has a picture.

**Fix:** Three shapes clear 17 of the 33: `tricep-extension` (one elbow-extension frame honestly covers all 7), `bicep-curl` (6), `calf-raise` (4, including the mis-mapped Leg Press Calf Raise). A fourth, `jump-land`, clears 7 more plus Drop Squat. The 10 cardio entries need no movement diagram — walking and cycling are self-evident — so exclude them from the coverage denominator rather than drawing them.

#### 15. 🟠 MAJOR — The warm-up has no pictures and no plumbing, though space was deliberately reserved for them

`js/features/warmup.js:150`

`warmup.js` imports only `btn` (line 9) — it never imports `DIAGRAMS` or `diagramKeyFor`, and `renderWarmup` paints the movement as bare text: `'<h1 class="warmup-name display">' + it.name + '</h1>'`. The comment at lines 160-162 says the Pause/Next row was collapsed onto one line specifically because it 'gives the movement above roughly 60px of vertical space back, which is the difference between seeing the picture and not' — the layout was built for a picture that was never wired up. There are 14 distinct warm-up items, 12 of them movements. By frequency across the three families (lower/upper/general): Cat-cow 3/3 and kept in the short warm-up; Dead bug 3/3; Glute bridge 2/3 + short; Band pull-apart 2/3 + short; 90/90 hip switches 2/3; Thoracic opener 2/3; then Ankle rocks, World's greatest stretch, Banded lateral walk, Shoulder CARs, Wall slides, Scap pull-ups at 1/3 each. This is the first 10-15 minutes of every session and the part js/features/warmup.js:1-7 argues matters most at 5:30am.

**Fix:** Six of the twelve need no dedicated artwork if the exercise-library shapes are drawn: Cat-cow -> `quadruped`, Dead bug -> `supine-core`, Glute bridge -> `glute-bridge`, Band pull-apart -> existing `face-pull`, Banded lateral walk -> `banded-lateral-walk`, Scap pull-ups -> `hang-from-bar`. Only six genuinely new mobility shapes remain: 90/90 hip switches, thoracic opener, ankle rocks, world's greatest stretch, shoulder CARs, wall slides. Then add a `WARMUP_DIAGRAM` name->key map and render it in `paint()` above the clock — the map is in the deliverable.

#### 16. 🟡 minor — Ten exercises need a one-off shape each; they are real but they are the tail

`js/data/exercises.js:237`

Each of these is genuinely mis-pictured but shares its shape with nothing else, so each costs one drawing for one exercise: Frog Pump (js/data/exercises.js:237 — soles together, knees splayed, on the floor; the hip-thrust picture shows feet flat under a bench, and 'frog' is not decodable from the name by a beginner), Front Rack Carry (kettlebells at the shoulders, shown hanging at the sides), Stability Ball Leg Curl (supine with hips bridged and heels on a ball, shown as a prone machine curl), Nordic Hamstring Curl (kneeling, hips locked, shown prone on a machine), Half-Kneeling Landmine Press (one arm at an angle, shown as a standing two-arm vertical press), Single-Leg RDL, Upright Row, Cable Crunch, Wall Sit, Bench Dip. Four of the ten are tier 2.

**Fix:** Route all ten to null now — an honest blank beats a confident wrong picture, which is the policy js/data/diagrams.js:5-6 already states. Schedule their shapes after the ranked multi-exercise shapes in the deliverable; Frog Pump and Single-Leg RDL come free if the `glute-bridge` shape is drawn with a second unilateral frame.

#### 17. ⚪ polish — The byPattern fallback routes only 9 exercises and gets 7 of them wrong

`js/data/info.js:240`

I instrumented the routing to separate name-matches from pattern-matches. Exactly 9 of the 111 mapped exercises reach `byPattern`: Kettlebell Swing, Glute-Ham Raise, Wall Sit, Stir the Pot, Lying Leg Raise, Standing Cable Woodchop, Half-Kneeling Landmine Press, Incline Dumbbell Press, Bench Dip. Only Incline Dumbbell Press and, arguably, Wall Sit's pattern assignment are defensible — the other 7 are misleading. The fallback is therefore a net negative: it contributes 2 good mappings and 7 bad ones, while its existence is what makes a missing name rule fail silently into a wrong picture instead of into no picture.

**Fix:** Delete the `byPattern` block entirely. Combined with the explicit id map in the deliverable, a movement with no drawn shape then falls to null by construction, which is the behaviour the comment at js/data/info.js:214-215 already promises.

### Ready-to-paste deliverable

```
================================================================================
1. EXACT COUNTS
================================================================================
Total exercises ...................... 144
  Mapped to a diagram ................ 111   (14 shapes in js/data/diagrams.js)
  No diagram at all ..................  33

Of the 111 mapped, judged as a coach ("would she do the right movement?"):
  SAFE — picture would not mislead ....  48   (33.3% of the library)
  WRONG — shows a different movement ..  63   (43.8% of the library,
                                               56.8% of everything pictured)

By tier          tier-1   tier-2   tier-3
  SAFE              13       29        6
  WRONG              4       21       38
  NO PICTURE         0        6       27
  (17 tier-1 lifts exist; 4 of them are mis-pictured)

Beginner-flagged (the On-Ramp pool) = 111 exercises
  SAFE 37  |  WRONG 50  |  NO PICTURE 24

Per-shape scorecard (mapped / safe / wrong):
  plank               16 /  2 / 14
  bench-press         14 /  5 /  9
  romanian-deadlift   12 /  4 /  8
  hip-thrust          10 /  9 /  1
  split-squat         10 /  2 /  8
  squat               10 /  5 /  5
  hip-abduction        8 /  1 /  7
  seated-row           8 /  3 /  5
  lat-pulldown         6 /  4 /  2
  leg-curl             5 /  3 /  2
  farmer-carry         4 /  3 /  1
  overhead-press       4 /  3 /  1
  lateral-raise        3 /  3 /  0   <- only clean shape
  face-pull            1 /  1 /  0   <- only clean shape

The 33 with NO picture: 16 iso (7 triceps, 6 biceps, 3 calves),
7 plyo, 10 cardio.

Two corrections to the task's stated suspicions (verified by re-running the
byName table and logging shadowed matches):
  "upright row" lands on 'seated-row', NOT 'lateral-raise'  (\brow\b wins)
  "curtsy"      lands on 'split-squat', NOT 'hip-abduction' (lunge wins)
Other shadowed rules: Rear Delt Fly / Cable Rear Delt Fly / Reverse Pec Deck
all match the correct face-pull rule but are caught first by bench-press.

================================================================================
2. DROP-IN REPLACEMENT for diagramKeyFor()  (js/data/info.js:217-252)
   Verified with node: 48 mapped, 0 misleading, 0 dangling ids.
   Delete the byName table AND the byPattern block; they are replaced entirely.
================================================================================

/**
 * Which movement diagram honestly represents this exercise.
 *
 * Explicit, not inferred. Name regexes cannot tell a Leg Press from a Squat or a
 * Rear Delt Fly from a Chest Fly, and a wrong picture is worse than none — the
 * info sheet prints the diagram's own setup steps underneath it, so a mismatch
 * ships wrong written instructions too. An exercise not listed here shows no
 * picture, which is the correct answer until its shape is drawn.
 */
const DIAGRAM_BY_ID = {
  'hip-thrust': ['barbell-hip-thrust', 'dumbbell-hip-thrust', 'machine-hip-thrust',
                 'smith-hip-thrust', 'single-leg-hip-thrust', 'b-stance-hip-thrust'],
  'romanian-deadlift': ['romanian-deadlift', 'dumbbell-romanian-deadlift',
                        'cable-romanian-deadlift', 'single-leg-romanian-deadlift'],
  'squat': ['back-squat', 'front-squat', 'goblet-squat', 'hack-squat', 'smith-machine-squat'],
  'split-squat': ['bulgarian-split-squat', 'dumbbell-split-squat'],
  'lat-pulldown': ['lat-pulldown', 'neutral-grip-lat-pulldown', 'pull-up', 'assisted-pull-up'],
  'seated-row': ['seated-cable-row', 'chest-supported-row', 'machine-row'],
  'bench-press': ['bench-press', 'dumbbell-bench-press', 'incline-dumbbell-press',
                  'machine-chest-press', 'close-grip-bench-press'],
  'overhead-press': ['overhead-press', 'seated-dumbbell-shoulder-press', 'machine-shoulder-press'],
  'lateral-raise': ['dumbbell-lateral-raise', 'cable-lateral-raise', 'machine-lateral-raise'],
  // rear-delt work belongs here, not on bench-press. Zero new artwork.
  'face-pull': ['face-pull', 'rear-delt-fly', 'reverse-pec-deck', 'cable-rear-delt-fly'],
  'leg-curl': ['seated-leg-curl', 'lying-leg-curl', 'standing-leg-curl'],
  'hip-abduction': ['cable-hip-abduction'],
  'plank': ['plank', 'weighted-plank'],
  'farmer-carry': ['farmer-carry', 'suitcase-carry', 'overhead-carry'],

  // --- keys below have no artwork yet; listing them now means each new shape
  // --- goes live the moment it is added to DIAGRAMS, with no code change.
  'glute-bridge': ['glute-bridge', 'barbell-glute-bridge', 'glute-bridge-march', 'frog-pump'],
  'deadlift-from-floor': ['conventional-deadlift', 'trap-bar-deadlift'],
  'tricep-extension': ['rope-pushdown', 'straight-bar-pushdown', 'machine-tricep-extension',
                       'overhead-tricep-extension', 'dumbbell-overhead-tricep-extension',
                       'skull-crusher', 'tricep-kickback'],
  'bicep-curl': ['dumbbell-curl', 'cable-curl', 'hammer-curl', 'ez-bar-curl',
                 'incline-dumbbell-curl', 'machine-preacher-curl'],
  'calf-raise': ['standing-calf-raise', 'seated-calf-raise', 'single-leg-calf-raise',
                 'leg-press-calf-raise'],
  'jump-land': ['box-jump', 'broad-jump', 'split-jump', 'pogo-hop', 'jump-rope',
                'heel-drop', 'drop-squat'],
  'supine-core': ['dead-bug', 'hollow-hold', 'lying-leg-raise', 'reverse-crunch'],
  'anti-rotation': ['pallof-press', 'half-kneeling-pallof-press', 'standing-cable-woodchop'],
  'high-plank': ['ab-wheel-rollout', 'stir-the-pot', 'plank-shoulder-tap'],
  'bent-over-row': ['barbell-row', 't-bar-row', 'single-arm-dumbbell-row'],
  'dynamic-lunge': ['reverse-lunge', 'deficit-reverse-lunge', 'walking-lunge'],
  'step-up': ['box-step-up', 'lateral-step-up', 'step-down'],
  'hip-supported-hinge': ['back-extension', 'glute-ham-raise', 'nordic-curl'],
  'chest-fly': ['cable-chest-fly', 'dumbbell-chest-fly', 'pec-deck'],
  'quadruped': ['bird-dog', 'fire-hydrant'],
  'hang-from-bar': ['hanging-knee-raise'],
  'push-up': ['push-up', 'incline-push-up'],
  'leg-press-sled': ['leg-press', 'hack-squat'],
  'side-lying-abduction': ['side-lying-hip-abduction', 'clamshell'],
  'seated-abduction': ['machine-hip-abduction', 'seated-band-abduction'],
  'banded-lateral-walk': ['banded-lateral-walk', 'monster-walk'],
  'frontal-lunge': ['curtsy-lunge', 'lateral-lunge'],
  'pullover': ['straight-arm-pulldown', 'dumbbell-pullover'],
  'kettlebell-swing': ['kettlebell-swing'],
  'good-morning': ['good-morning'],
  'cable-pull-through': ['cable-pull-through'],
  'sumo-deadlift': ['sumo-deadlift'],
  'leg-extension': ['leg-extension'],
  'wall-sit': ['wall-sit'],
  'side-plank': ['side-plank'],
  'bench-dip': ['bench-dip'],
  'cable-crunch': ['cable-crunch'],
  'upright-row': ['upright-row'],
  'inverted-row': ['inverted-row'],
  'stability-ball-leg-curl': ['stability-ball-leg-curl'],
  'landmine-press': ['landmine-press'],
  'front-rack-carry': ['front-rack-carry'],
};

const KEY_FOR_ID = Object.create(null);
for (const [key, ids] of Object.entries(DIAGRAM_BY_ID)) {
  for (const id of ids) KEY_FOR_ID[id] = key;
}

export function diagramKeyFor(exercise) {
  if (!exercise) return null;
  const key = KEY_FOR_ID[exercise.id] || null;
  // A key with no drawn shape yet resolves to no picture, never to a near-miss.
  return key && DIAGRAMS[key] ? key : null;
}

// requires, at the top of js/data/info.js:
//   import { DIAGRAMS } from './diagrams.js';

Suggested companion guard in js/ui/infosheet.js:32 — print d.setup only for the
exercise that owns the shape, so a proxy picture never ships proxy instructions:
  const OWNS_SETUP = new Set(Object.entries(DIAGRAM_BY_ID)
    .map(([key, ids]) => ids[0]));            // first id listed owns the shape
  const setup = OWNS_SETUP.has(exerciseId) && (d.setup || []).length ? ... : '';

================================================================================
3. NEW SHAPES RANKED BY COVERAGE GAIN
   "+N ex" = exercises moving from wrong-or-missing to correct.
   "cum" = running total of correctly-pictured exercises out of 144 (base 48).
================================================================================
 0. REORDER face-pull ABOVE bench-press  ... +3 ex +1 warm-up  FREE, NO ARTWORK
                                              (rear-delt-fly, reverse-pec-deck,
                                               cable-rear-delt-fly; 2 are tier-2)
                                              also serves the Band pull-apart
                                              warm-up (2/3 families + short)

 1. jump-land / soft landing ............ + 8 ex   cum  56   (2 tier-2; the whole
                                                   bone-density pillar)
 2. tricep-extension (elbow extension) .. + 7 ex   cum  63   (2 tier-2)
 3. bicep-curl .......................... + 6 ex   cum  69
 4. supine-core (dead bug/leg raise) .... + 4 ex + Dead bug warm-up (3/3)  cum 73
 5. calf-raise .......................... + 4 ex   cum  80
 6. deadlift-from-floor ................. + 3 ex   cum  83   (3 TIER-1 — highest
                                                   tier weight of any shape)
 7. bent-over-row ....................... + 3 ex   cum  86   (3 tier-2)
 8. dynamic lunge (reverse/walking) ..... + 3 ex   cum  89   (3 tier-2)
 9. hip-supported hinge (back ext/GHR) .. + 3 ex   cum  92   (3 tier-2)
10. step-up / step-down ................. + 3 ex   cum  95
11. anti-rotation (pallof/woodchop) ..... + 3 ex   cum  98
12. high-plank / rollout ................ + 3 ex   cum 101
13. chest-fly (arc) ..................... + 3 ex   cum 104
14. quadruped (cat-cow base) ............ + 2 ex + Cat-cow warm-up (3/3+short) 106
15. banded lateral walk ................. + 2 ex + warm-up (lower)  cum 108
16. hang from bar ....................... + 1 ex + Scap pull-ups warm-up  cum 109
                                           (also improves pull-up + assisted)
17. glute-bridge (floor) ................ + 1 ex + Glute bridge warm-up
                                           (2/3+short); also fixes the wrong
                                           setup text on 3 already-safe  cum 110
18. push-up (prone) ..................... + 2 ex   cum 112
19-23. seated-abduction, side-lying-abduction, frontal-lunge, pullover,
       leg-press-sled ................... + 2/+2/+2/+2/+1  cum 121
24-37. fourteen one-exercise shapes (kettlebell-swing, good-morning,
       cable-pull-through, inverted-row, leg-extension, side-plank, wall-sit,
       bench-dip, cable-crunch, upright-row, stability-ball-leg-curl,
       landmine-press, front-rack-carry, sumo front-view) ....... cum 134/144
       The remaining 10 are cardio and need no movement diagram.

RECOMMENDED FIRST SPRINT — the free reorder + shapes 1-6 (six drawings):
  48 -> 83 correctly pictured (33% -> 58%), all 17 tier-1 lifts correct,
  and every wrong picture retired to an honest blank in the same commit.

================================================================================
4. WARM-UP: 12 movements, 6 of them free once the above shapes exist
================================================================================
Frequency across the three families (lower / upper / general):
  Cat-cow                  3/3  + short warm-up   -> `quadruped`        FREE
  Dead bug                 3/3                    -> `supine-core`      FREE
  Glute bridge             2/3  + short warm-up   -> `glute-bridge`     FREE
  Band pull-apart          2/3  + short warm-up   -> `face-pull`        FREE TODAY
  Banded lateral walk      1/3                    -> `banded-lateral-walk` FREE
  Scap pull-ups            1/3                    -> `hang-from-bar`    FREE
  90/90 hip switches       2/3                    -> NEW shape needed
  Thoracic opener          2/3                    -> NEW shape needed
  Ankle rocks              1/3                    -> NEW shape needed
  World's greatest stretch 1/3                    -> NEW shape needed
  Shoulder CARs            1/3                    -> NEW shape needed
  Wall slides              1/3                    -> NEW shape needed

Plumbing (js/features/warmup.js imports only `btn` at line 9 today):

import { DIAGRAMS } from '../data/diagrams.js';

const WARMUP_DIAGRAM = {
  'Cat-cow': 'quadruped',
  'Dead bug': 'supine-core',
  'Glute bridge': 'glute-bridge',
  'Band pull-apart': 'face-pull',
  'Banded lateral walk': 'banded-lateral-walk',
  'Scap pull-ups': 'hang-from-bar',
  '90/90 hip switches': 'hip-switch-90-90',
  'Thoracic opener': 'thoracic-opener',
  'Ankle rocks': 'ankle-rock',
  'World’s greatest stretch': 'worlds-greatest-stretch',  // note: curly apostrophe
  'Shoulder CARs': 'shoulder-car',
  'Wall slides': 'wall-slide',
};

function warmupDiagram(name) {
  const d = DIAGRAMS[WARMUP_DIAGRAM[name]];
  return d && d.svg ? '<div class="warmup-figure">' + d.svg + '</div>' : '';
}

// in paint(), inside .warmup-stage, between the name and the clock:
'<h1 class="warmup-name display">' + it.name + '</h1>' +
warmupDiagram(it.name) +
'<div class="warmup-clock num...'

Watch the apostrophe: the MOBILITY entry at js/features/warmup.js:24 uses U+2019
("World’s greatest stretch"), so a plain ASCII key will silently miss.
```
