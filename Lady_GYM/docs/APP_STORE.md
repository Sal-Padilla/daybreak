# Getting Lady_GYM onto iPhones: three routes

"It wasn't available on my Apple phone" has three possible fixes, in order of effort.

## Route 1: Install from Safari (works today, free)

Lady_GYM is a web app built to install like a real one. From the Home Screen it opens full
screen with its own icon and launch screen, works with no signal, and keeps its data on the
phone.

**What to send people:** the short invite link, not the bare app link. The message to send
is in [INVITE.md](INVITE.md).

```
https://sal-padilla.github.io/daybreak/ladygym
```

It forwards to the install page (`Lady_GYM/get.html`). The link is all lower case on purpose:
GitHub Pages links are case-sensitive, and "Lady_GYM" is easy to mistype on a phone.

That page:
- says **"No App Store needed"** in the first lines;
- recognises when it is open inside Instagram, Facebook, Gmail or another in-app browser, and
  shows how to open it in Safari first, with a **Copy the Link** button;
- draws the three Safari steps on phone mockups (Share → Add to Home Screen → Add), including
  the iOS 26 change where Share sits inside the ⋯ menu;
- shows a QR code when opened on a computer, so she can scan it with her phone camera;
- shows a picture preview when the link is pasted into Messages or WhatsApp.

Inside the app, **Profile → Invite a friend** shares this link through the iPhone share sheet.

> The site goes live when this branch is merged into `main`, because GitHub Pages serves `main`.
> Until then the paths above return 404.

## Route 2: TestFlight (a real iPhone app, for up to 10,000 invited testers)

Use this when you want people to install it the way they install any app.

**What you need:**
- a Mac with Xcode;
- an Apple Developer Program membership ($99 a year, at developer.apple.com);
- Node.js on the Mac.

**Steps:**

```bash
cd Lady_GYM/native
```

```bash
npm install
```

```bash
npm run sync
```

```bash
npm run open
```

`npm run sync` copies the web app into the native shell. `npm run open` opens it in Xcode. Then:

1. In Xcode, select the **App** target → **Signing & Capabilities** → choose your Team.
   Change the bundle identifier if `com.salpadilla.ladygym` is taken.
2. Plug in an iPhone and press ▶ to try it on the device.
3. **Product → Archive**, then **Distribute App → App Store Connect → Upload**.
4. In App Store Connect → TestFlight, add testers by email, or turn on a public link. External
   testers need a quick Beta App Review first, usually within a day.

The Xcode project in `native/ios` already has the Lady_GYM icon, launch screen and display
name. It was generated with Capacitor 8.5.3, which uses Swift Package Manager, so no CocoaPods
install is needed. The project generation step was tested; building and signing it needs the Mac.

## Route 3: The App Store (public listing)

Same build as TestFlight, then submit it for App Review with screenshots, a description, a
privacy policy URL and an age rating.

**Be ready for one risk.** Apple's App Review Guideline 4.2, "Minimum Functionality", is often
used to reject apps that are "just a website in a wrapper". Lady_GYM's case is stronger than
most: it works fully offline, stores everything on the device, and has native-feeling
navigation and haptics. Adding one or two features that only a native app can do would make it
safer to submit:

- **Apple Health** (HealthKit): save each finished workout to the Health app.
- **Workout reminders** at her usual time (local notifications).
- **Lock Screen rest timer** (Live Activity).

Each of those is a Capacitor plugin plus a little Swift. They are worth scoping once Route 1
or 2 shows the women are actually using it.

## Which to choose

Start with **Route 1** now. It costs nothing and fixes the reasons people actually gave: they
couldn't find it, and the install steps were unclear. Move to **Route 2** if people still say
"it's not a real app" after seeing the picture guide. That is a fair reaction, and TestFlight
answers it for a $99 yearly fee.
