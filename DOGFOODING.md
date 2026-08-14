# Shiftty Dogfooding

This guide is for the UX-consistency dogfooding candidate on branch `codex/initial-shifty-foundation`. Use the existing behavior and record findings; do not add features or begin another product phase during the freeze.

## How to start Shiftty locally

Prerequisites: repository dependencies are already installed, Xcode includes the iOS 26.5 runtime, and EAS CLI is authenticated for `@oportnoy/shifty` when using a cloud build.

The current application candidate is `f4f916a`, followed by documentation milestone `5dfa4ff` and this closeout. The iPhone 15 Pro Max now contains a standalone Release built from that application candidate, version `0.1.0` (`1`) with bundle identifier `com.oportnoy.shiftty.dogfood`. Launch it directly from the Shiftty Home Screen icon; it does not require Metro, a cable, or a Mac connection.

The replacement Release was signed and installed on 2026-08-13 after the login keychain was unlocked. Its Personal Team profile (`9R9UQ6GTQW`) expires on 2026-08-17, the signed-app CDHash is `eeb93d4d592a14c4f34325ecc1f43b4a1ff28af1`, and deep/strict signature verification passed before installation. Complete pre/post installation and DF-013 snapshots included the SQLite database, WAL, and SHM files; integrity and foreign-key checks passed, and the original data was restored byte-for-byte after the disposable notification test.

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
- [ ] **Native date/time controls:** Open New/Edit Shift, Expected End, Clock Out, Breaks, Templates, and Salary/Rule setup as applicable. Confirm wheel/calendar pickers, a true optional empty state, clear behavior, and that dismissing a picker preserves the old value.
- [ ] **Overnight manual break:** On a disposable cross-midnight shift, add a second-day break such as 01:00–01:15 and confirm it appears after midnight and reduces the shift by exactly 15 minutes.
- [ ] **Edit/delete:** Edit a disposable shift, verify the update everywhere, then delete it and confirm no stale copy remains on Home, Calendar, Reports, or Shift Details.
- [ ] **Reports:** Open the relevant month and confirm completed-shift count, hours, finalized salary totals, and missing/stale salary messages match the recorded shifts.
- [ ] **Exports:** From Reports, export PDF and CSV for the same month. Confirm the share sheet names the selected month, local dates/times match Reports, and missing/stale salary is not serialized as zero. Confirm ICS describes itself as calendar-only.
- [x] **DF-013 notification retest:** On the physical `f4f916a` Release, iOS delivered `המשמרת שלך מתחילה בעוד 0 דקות.`; the numeric offset is present and no brace token remains.
- [ ] **App restart:** Terminate and relaunch from the Shiftty icon; confirm persisted shifts remain, no deleted item returns, and any active/break state is coherent. The simulator uses `com.shifty.app`; the current Personal Team phone install uses `com.oportnoy.shiftty.dogfood`.

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

## Physical Personal Team build workflow

Use this only after the full repository gate and Simulator walkthrough pass. The free Personal Team profile is Xcode-managed, so automatic signing must use the profile's actual `TeamIdentifier` (`9R9UQ6GTQW`). The suffix displayed in the Apple Development identity label is not the signing team identifier.

1. Create the same clean temporary native copy described above and run Expo prebuild/CocoaPods by building the Simulator once.
2. In the disposable copy only, remove `aps-environment` from `ios/Shifty/Shifty.entitlements`. Shiftty schedules local notifications and does not request remote push tokens.
3. Confirm the login keychain is unlocked in Keychain Access. Do not enter or automate the password in shell history. A locked keychain produces `errSecInternalComponent` while signing nested frameworks.
4. Discover the connected phone UDID with `xcrun xctrace list devices`, then run:

```sh
SHIFTTY_NATIVE_DIR="/tmp/shiftty-native.<verified-suffix>"
SHIFTTY_DERIVED_DIR="$(mktemp -d /tmp/shiftty-physical-build.XXXXXX)"
SHIFTTY_PHONE_UDID="<connected-phone-udid>"

test -n "$SHIFTTY_NATIVE_DIR" && test -d "$SHIFTTY_NATIVE_DIR"
test -n "$SHIFTTY_DERIVED_DIR" && test -d "$SHIFTTY_DERIVED_DIR"
test -n "$SHIFTTY_PHONE_UDID"

xcodebuild -workspace "$SHIFTTY_NATIVE_DIR/ios/Shifty.xcworkspace" \
  -scheme Shifty \
  -configuration Release \
  -destination "id=$SHIFTTY_PHONE_UDID" \
  -derivedDataPath "$SHIFTTY_DERIVED_DIR" \
  DEVELOPMENT_TEAM=9R9UQ6GTQW \
  CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY='Apple Development' \
  PRODUCT_BUNDLE_IDENTIFIER=com.oportnoy.shiftty.dogfood \
  MARKETING_VERSION=0.1.0 \
  CURRENT_PROJECT_VERSION=1 \
  build
```

5. Inspect the app's signature, embedded profile expiry, version, and bundle identifier before installing. Use `xcrun devicectl device install app` only when those checks pass. Installing the same bundle identifier should preserve the container, but copy the complete `Documents/SQLite` directory before and after installation so WAL/SHM are included in integrity and count comparisons.

## Known limitations

- Android has not been verified because no emulator, AVD, or physical Android device is currently available. This is an external verification gap, not an iOS RC failure.
- The current physical-iPhone build is the locally signed `f4f916a` standalone Release, not an EAS Preview. The free Personal Team profile expires on 2026-08-17; there is no EAS build ID, install URL, or QR.
- Paid EAS Preview/internal distribution remains unavailable until an active paid Apple Developer Program team exists. Do not purchase membership as part of dogfooding automation.
- Physical local-notification permission, native scheduling, background delivery, and DF-013 interpolation passed on the current standalone build. iOS's delivered-notification store contained the numeric Hebrew body and no unresolved token.
- Remote push/APNs is not used by the current Shiftty notification flow and is not enabled in the Personal Team build. Focus-mode variations, prolonged power-management behavior, calendar import interoperability, native share targets, keyboard avoidance, and dynamic-text extremes remain unverified.
- Simulator development-client checks still require Metro on LAN port `8081`; the installed physical Release build does not.

When a paid Apple Developer Program team or valid internal-distribution `credentials.json` becomes available, the intended EAS build command remains:

```sh
cd /Users/portnoy/Documents/Shiftty
eas build --platform ios --profile preview
```

Do not use `development-simulator` for a physical iPhone.
