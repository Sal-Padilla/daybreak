# Why women turned Daybreak down, and what Lady_GYM changes

**Date:** 2026-11-04
**Reviewed:** Daybreak v0.9.2 (this repository's root app), on an iPhone 14-sized screen, with
its own 14 weeks of demo data loaded.

---

## What they said

Every woman who was sent Daybreak declined to use it. The reasons they gave:

1. It wasn't friendly.
2. It wasn't colourful.
3. It was hard to navigate.
4. It wasn't available on their Apple phones.
5. It should be more picture-friendly and feel more like an Apple app.

## What they meant

People rarely describe a design problem precisely. They describe how it felt. So each reason is
read here against what is actually on the screen.

### 1. "Not friendly" means it read like homework and asked personal questions too soon

- **Too many words.** Today had 252 words across 4.2 screens of scrolling. Shape had 554 words
  across 8.9 screens. Me had 615 words across 8.0 screens. Most of it was explanation: why
  heavy lifting is safe, why the scale lies, what cortisol does at 5 AM. The science is right.
  The trouble is that it was all on the page at once, so the app felt like reading a textbook.
- **Clinical, coach-only wording.** "Resistive training", "Control training", "Lady
  improvements", "Transition — 3 Day", "Shape Map: 0 of 7 on target", "leave 5 in the tank".
  Each label is accurate, but someone new to lifting would not know what most of them mean.
- **Intimate questions in the first minute.** Sign-up question 2 asked about periods and
  menopause. Question 6 asked about bladder leakage. Both matter to the program. Asked by an
  app she has not decided to trust yet, they read as invasive.
- **No warmth or celebration.** The greeting was "Evening, Rocio." with a full stop. Finishing
  a workout showed "Done." A rest day opened with a paragraph about muscle protein synthesis.
  Nothing rewarded showing up: no streaks, no rings closing, no confetti, no personal-best
  trophies.

### 2. "Not colourful" means beige, brown and serif

The palette ("Harbor Dawn") was cream, terracotta and plum, and every heading was set in a serif
font. The project plan chose this deliberately, on the theory that a women's app should not be
"pink and cute". The women who tried it told us the theory was wrong. Every screen was the same
warm brown, so nothing stood out and nothing looked inviting. The four training areas had
colours, but muted ones (clay, plum, teal, gold) at low saturation.

### 3. "Hard to navigate" means five vague tabs, no way back, and buttons hidden

- **Five tabs that overlap.** Today, Train, Week, Shape and Me. "Today" and "Train" both start
  the workout. "Shape" is a word only the plan's author uses. On a rest day, Train showed only
  "Start an empty session".
- **Everything opened as a pop-up sheet**, including sheets on top of sheets. There was no
  page history and no "‹ Back", so the only way out was to close things.
- **Very long pages.** Across the five tabs, a user had to scroll through 24 screens' worth of
  content to see everything.
- **Answer choices hidden during sign-up.** On the life-stage and leak questions, the pinned
  "Continue" footer sat over the answer list, covering one or two of the choices. See
  `screens/1-sign-up.jpg`: the "Things are changing" choice is under the button.
- **Important help one tap too deep.** Every exercise and class had an "i" button, and the
  useful information sat behind it.

### 4. "Not available on my Apple phone" means a website with no App Store page and unclear install steps

Daybreak is a web app at a GitHub Pages link. On an iPhone, that runs into three problems:

- **They looked in the App Store**, which is where iPhone apps live. It isn't there, and
  nothing in the invite said so.
- **The link usually opens inside another app.** Tapped in Messages previews, Instagram,
  Facebook, Gmail or WhatsApp, it opens in that app's built-in browser, which cannot add
  anything to the Home Screen.
- **Even in Safari, the steps are hidden.** "Add to Home Screen" is near the bottom of the Share
  sheet, below the fold. On iOS 26, Share itself moved inside the ⋯ menu. Daybreak's guide was
  a numbered text list with small icons.

Two smaller issues added to this. The README told people that Chrome on iPhone cannot install
web apps, which has not been true since iOS 16.4. And the launch screen was blank white.

### 5. "More picture-friendly, more like an Apple app"

- **Pictures:** the exercise drawings were accurate but read as engineering diagrams: grey
  stick figures with no face, hair or clothes. Classes had no pictures at all, and neither did
  sign-up, Today, the week view or the reports.
- **Apple feel:** a serif display font, beige grounds, a custom header instead of an iOS
  navigation bar, no large titles, no grouped Settings-style lists, no iOS sheets, alerts or
  action sheets, no swipe-back gesture, no switches, and no blurred bars. Each one on its own
  is small. Together they made it look like a website instead of an iPhone app.

### What was not the problem

The training engine. The life-stage logic, progression, the dawn warm-up, class-aware
scheduling, the pelvic-floor safety rules and the real Bay Club timetable are all sound and
well tested, and none of the complaints are about them. Lady_GYM keeps them unchanged.

---

## What Lady_GYM changes

| What they said | What Lady_GYM does |
|---|---|
| Not friendly | Short, warm copy ("Good morning, Rocio", "You did it! 🎉"). The science is still there, one tap away under "Why it's in your plan". Plain names: Strength, Cardio, Balance & Core, Tone & Shape. Sign-up asks four picture questions, and life stage offers "I'd rather not say". The leak question moved to Profile → Comfort & privacy, where she can answer it when she wants to. Celebrations: confetti, a completion screen, personal-best trophies, a week streak and rings that close. |
| Not colourful | A bright palette: raspberry, violet, coral, teal, sky, sunshine and mint, one colour per kind of training. Gradient hero cards. Every text colour passes WCAG AA in light and dark themes, and `tools/check.mjs` enforces it. |
| Hard to navigate | Four tabs (Today, Workouts, Classes, Progress). Profile sits behind your photo at the top right, as in Apple's own apps. Pages slide in with a "‹ Back" button, you can swipe from the left edge to go back, and tapping the current tab returns to its top. One main button per screen. The workout opens full screen. |
| Not on my iPhone | A picture guide that recognises the browser she is in (Safari, Chrome, or an in-app browser) and draws each step on a phone mockup. It says "No App Store needed" plainly. A shareable page (`get.html`) has a link preview, a QR code for computers, and an "Open in Safari" path for Instagram and Facebook. Branded launch screens and app icon. For a real App Store listing, an Xcode project is ready in `native/`; see `APP_STORE.md`. |
| More pictures | All 144 exercises are redrawn as illustrated women with a range of skin tones, hair and outfits, built from Daybreak's own poses. In the workout, the picture moves between the start and finish positions. All 18 club class formats have their own scene. Sign-up and Today use pictures, the body map is in colour, rings replace bars, and she can add her own progress photos and profile photo. |
| Feel like an Apple app | The iPhone's system fonts (SF Pro, plus SF Pro Rounded for headings and numbers). iOS grouped backgrounds, large titles that collapse into the navigation bar, translucent blurred bars, grouped lists with coloured icon tiles, iOS-style sheets with a grab handle, alerts, action sheets and switches. A light haptic tap on supported phones. Text follows the phone's Text Size setting. Dark mode follows the phone. |

### Measured, before and after

Both apps were measured on the same iPhone 14-sized screen with the same 14 weeks of demo data.

| Screen | Daybreak | Lady_GYM |
|---|---|---|
| Today | 252 words · 4.2 screens of scrolling · 1 picture | 138 words · 2.6 screens · 4 pictures |
| Train → Workouts | 24 words · 0 pictures (rest day: "Start an empty session") | 118 words · 12 pictures |
| Week → Classes | 113 words · 2.2 screens · 0 pictures | 77 words · 1.3 screens · a picture on every class |
| Shape → Progress | 554 words · 8.9 screens | 206 words · 3.6 screens · 9 pictures |
| Me → Profile | 615 words · 8.0 screens, as a tab | one grouped settings page behind your photo |
| Exercises with an illustrated woman | 0 of 144 (stick figures) | 144 of 144 |
| Class formats with a picture | 0 of 18 | 18 of 18 |
| Sign-up questions before the app | 6, including periods and bladder leaks | 4 picture taps, plus name. Life stage is optional and the leak question has moved to Profile |

Before/after screenshots are in [`screens/`](screens/).

---

## The honest limits

- **It is still a web app until someone publishes it to the App Store.** That takes a Mac with
  Xcode and an Apple Developer account ($99/year), and Apple may reject a wrapped web app under
  its "minimum functionality" rule. The full path is in [APP_STORE.md](APP_STORE.md).
  Installing from Safari is free, takes about 15 seconds, and gives the same full-screen app.
- **Apple gives websites no way to install themselves.** Someone has to tap Add. Lady_GYM
  draws exactly where to tap, but it cannot tap for her.
- **Data stays on each phone.** That keeps it private, but a phone's storage can be cleared, so
  Profile keeps prompting for a backup, which goes to the Files app through the share sheet.
- **The illustrations are generated, not commissioned.** They are consistent and cover every
  movement, but they are flat vector figures, not photographs. A commissioned photo set would
  go further and could drop into the same slots.
- **This review rests on the reasons they gave, not on watching them use it.** The next step
  is to hand Lady_GYM to two or three of the same women, watch them install it and start a
  workout without help, and note where they hesitate.
