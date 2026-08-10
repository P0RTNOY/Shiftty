# Shiftty Dogfooding

This guide is for the frozen iOS Simulator release candidate on branch `codex/initial-shifty-foundation`. Use the existing behavior and record findings; do not add features or begin another product phase during the freeze.

## How to start Shiftty locally

Prerequisites: the repository dependencies are already installed, Xcode includes the iOS 26.5 runtime, and EAS CLI is authenticated for `@oportnoy/shifty`.

If the iPhone 17 Pro simulator is shut down, run:

```sh
xcrun simctl boot "iPhone 17 Pro"
open -a Simulator
xcrun simctl bootstatus "iPhone 17 Pro" -b
```

If it is already booted, only `open -a Simulator` is needed. Confirm its state with:

```sh
xcrun simctl list devices booted
```

The verified development build is EAS build `f838aae8-3a43-422b-8ae4-1144e22bcc38`, profile `development-simulator`, bundle ID `com.shifty.app`. It contains every native dependency used by the current JavaScript source. Install and run that exact build only when it is not already installed:

```sh
cd /Users/portnoy/Documents/Shiftty
eas build:run --platform ios --id f838aae8-3a43-422b-8ae4-1144e22bcc38 --simulator "iPhone 17 Pro"
```

Start Metro from the repository in a terminal that remains open:

```sh
cd /Users/portnoy/Documents/Shiftty
npm run start -- --dev-client --lan --port 8081 --ios
```

The verified configuration is an Expo development client using LAN hosting on port `8081`. Expo prints the Mac LAN URL when Metro starts and launches `com.shifty.app` in the booted simulator. If Metro is already running and only the installed app needs relaunching, run:

```sh
xcrun simctl launch booted com.shifty.app
```

## Daily dogfooding flows

- [ ] **Clock in:** From Home, start a shift for the intended workplace and confirm exactly one active shift appears.
- [ ] **Active timer:** Leave the active screen open and confirm elapsed time advances and the expected workplace is shown.
- [ ] **Break:** Start a break and confirm the UI changes to the break state without creating another shift.
- [ ] **Resume:** End the break and confirm the active timer resumes on the same shift.
- [ ] **Clock out:** Finish the active shift, review the times, and confirm Home no longer shows an active shift.
- [ ] **Manual completed shift:** Add a past shift and confirm it appears on Home/Calendar and contributes to Reports.
- [ ] **Future shift:** Add a scheduled future shift and confirm it appears on the correct Calendar date without affecting completed totals.
- [ ] **Cross-midnight shift:** Add or complete a shift whose end is on the following day and confirm its dates, duration, Calendar placement, and Reports total.
- [ ] **Edit/delete:** Edit a disposable shift, verify the update everywhere, then delete it and confirm no stale copy remains on Home, Calendar, Reports, or Shift Details.
- [ ] **Reports:** Open the relevant month and confirm completed-shift count, hours, and salary totals match the recorded shifts.
- [ ] **App restart:** Terminate and relaunch `com.shifty.app`; confirm persisted shifts remain, no deleted item returns, and any active/break state is coherent.

## What to record when something fails

Create an entry in `DOGFOODING_ISSUES.md` and include:

- The exact user action and the screen where it occurred.
- A screenshot showing the failure.
- The local date and time, including time zone.
- The shift ID when it is visible or can be obtained safely.
- The complete console error from the Metro or simulator log, without secrets or unrelated personal data.
- Whether terminating and restarting the app fixes the symptom.
- Whether the underlying shift and related data remained intact.

Do not repair or rewrite affected data merely to make the report look clean. Preserve the evidence and record whether the issue is reproducible.

## Known limitations

- Android has not been verified because no emulator, AVD, or physical Android device is currently available. This is an external verification gap, not an iOS RC failure.
- Physical-iPhone behavior has not yet been verified for notification delivery timing, calendar import interoperability, native share targets, keyboard avoidance, or dynamic-text extremes.
- Simulator notification permission, scheduling, metadata persistence, and reconciliation passed, but simulator delivery timing is not representative of physical-device behavior, including background execution, Focus modes, and power management.
- This is an internal Expo development-client build. It requires Metro to serve the current JavaScript bundle and is not evidence of App Store distribution behavior.
