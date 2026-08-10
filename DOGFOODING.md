# Shiftty Dogfooding

This guide is for the corrected dogfooding candidate on branch `codex/initial-shifty-foundation`. Use the existing behavior and record findings; do not add features or begin another product phase during the freeze.

## How to start Shiftty locally

Prerequisites: repository dependencies are already installed, Xcode includes the iOS 26.5 runtime, and EAS CLI is authenticated for `@oportnoy/shifty` when using a cloud build.

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

Start Metro from the repository in a terminal that remains open:

```sh
cd /Users/portnoy/Documents/Shiftty
npm run start -- --dev-client --lan --port 8081
```

The verified configuration is an Expo development client using LAN hosting on port `8081`. Expo prints the Mac LAN URL; the device and Mac must be able to reach that host. `localhost` is valid for the simulator on the same Mac, while a physical device must use the printed LAN address.

The previous EAS simulator development build remains usable for JavaScript-only checks, but it predates the corrected icon. Install it only when a quick existing-native-runtime check is sufficient:

```sh
cd /Users/portnoy/Documents/Shiftty
eas build:run --platform ios --id f838aae8-3a43-422b-8ae4-1144e22bcc38 --simulator "iPhone 17 Pro"
```

To install a fresh simulator binary containing the current icon and current native config, keep Metro running and use a clean temporary copy. The temporary copy avoids macOS File Provider metadata in `node_modules/expo-modules-jsi` that can make Xcode code signing reject the generated framework:

```sh
cd /Users/portnoy/Documents/Shiftty
SHIFTTY_NATIVE_DIR="$(mktemp -d /tmp/shiftty-native.XXXXXX)"
test -n "$SHIFTTY_NATIVE_DIR" && test -d "$SHIFTTY_NATIVE_DIR"
rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'dist-test' --exclude '.expo' ./ "$SHIFTTY_NATIVE_DIR/"
rsync -a node_modules/ "$SHIFTTY_NATIVE_DIR/node_modules/"
xattr -cr "$SHIFTTY_NATIVE_DIR/node_modules/expo-modules-jsi/apple"
cd "$SHIFTTY_NATIVE_DIR"
npx expo run:ios --device "iPhone 17 Pro" --no-bundler
```

The first clean native compilation can take several minutes. If Metro is already running and only the installed app needs relaunching, run:

```sh
xcrun simctl launch booted com.shifty.app
```

## Daily dogfooding flows

- [ ] **Clock in:** From Home, start a shift for the intended workplace and confirm exactly one active shift appears.
- [ ] **Active timer:** Leave the active screen open and confirm elapsed time advances and the expected workplace is shown.
- [ ] **Break:** Start a break and confirm the UI changes to the break state without creating another shift.
- [ ] **Break restart:** While the break is active, terminate and relaunch the app; confirm **בהפסקה**, total timer, break timer, workplace, resume, and clock-out all return.
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
- A corrected physical-iPhone Preview build is still required because the application icon and JavaScript behavior changed. Its build ID and install link belong in `PROJECT_STATUS.md` after the final EAS attempt.
- Physical-iPhone behavior still needs follow-up for notification delivery timing, calendar import interoperability, native share targets, keyboard avoidance, and dynamic-text extremes.
- Simulator notification permission, scheduling, metadata persistence, and reconciliation passed, but simulator delivery timing is not representative of physical-device behavior, including background execution, Focus modes, and power management.
- This is an internal Expo development-client build. It requires Metro to serve the current JavaScript bundle and is not evidence of App Store distribution behavior.
