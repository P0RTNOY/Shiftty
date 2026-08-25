# Shiftty Dogfooding

This guide now supports the Milestone 4 beta-stabilization candidate on branch `codex/beta-stabilization`. Use only disposable Simulator/emulator state for destructive journeys. Preserve real device data before installation or restore testing, record findings without rewriting evidence, and do not treat a green source gate as a native pass. The authoritative readiness and platform-result documents are [`docs/BETA_READINESS.md`](docs/BETA_READINESS.md) and [`docs/NATIVE_VERIFICATION_REPORT.md`](docs/NATIVE_VERIFICATION_REPORT.md).

## How to start Shiftty locally

Prerequisites: repository dependencies are already installed, Xcode includes the iOS 26.5 runtime, and EAS CLI is authenticated for `@oportnoy/shifty` when using a cloud build.

The Milestone 4 source and iOS Simulator candidate passed its final gate on 2026-08-25: 137 suites / 685 tests, a fresh standalone arm64 Release build, and 6/6 Maestro journeys in 11 minutes 50 seconds. The readiness verdict remains `SOURCE_READY_NATIVE_BLOCKED` until generated exports are read back and a backup is selected and restored through the OS document picker. Do not reuse the historical `f4f916a` physical build as evidence for this candidate: it predates the salary, Expo dependency, release-config, recovery, and stabilization changes. A previously installed iPhone build may be used only after its bundle ID, version, source commit, signing status, and data-preservation plan are recorded.

Historical context only: the replacement Release signed on 2026-08-13 used a Personal Team profile that expired on 2026-08-17. Its signature and DF-013 notification evidence remain valid only for that old artifact. Complete pre/post snapshots included the SQLite database, WAL, and SHM files, and the original data was restored after the disposable notification test; use the same preservation standard for any new physical-device run.

Use the named disposable clone for destructive journeys. If it is shut down, run:

```sh
xcrun simctl boot "Shiftty Beta Verification Clone"
open -a Simulator
xcrun simctl bootstatus "Shiftty Beta Verification Clone" -b
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

This development-client workflow uses LAN hosting on port `8081`. Expo prints the Mac LAN URL; the device and Mac must be able to reach that host. `localhost` is valid for the simulator on the same Mac, while a physical device must use the printed LAN address. The Milestone 4 beta verdict itself is based on a standalone Release that did not require Metro; development-client connectivity is not equivalent evidence.

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
xcrun simctl launch booted com.omerportnoy.shifty
```

## Daily dogfooding flows

For a repeatable disposable smoke run, install the current development build and execute the native flows in `.maestro/journeys` as described in `.maestro/README.md`, always passing the clone UDID with `--udid`. The iOS flows cross into share sheets and use Copy, but they do not read files back or select/restore a backup through the document picker, so they do not replace the manual matrix below.

- [ ] **Clock in:** From Home, start a shift for the intended workplace and confirm exactly one active shift appears.
- [ ] **Active timer:** Leave the active screen open and confirm elapsed time advances and the expected workplace is shown.
- [ ] **Break:** Start a break and confirm the UI changes to the break state without creating another shift.
- [ ] **Break restart:** While the break is active, terminate and relaunch the app; confirm **בהפסקה**, total timer, break timer, workplace, resume, and clock-out all return.
- [ ] **Resume:** End the break and confirm the active timer resumes on the same shift.
- [ ] **Clock out:** Finish the active shift, review the times, and confirm Home no longer shows an active shift.
- [ ] **Manual completed shift:** Add a past shift and confirm it appears on Home/Calendar and contributes to Reports.
- [ ] **Future shift:** Add a scheduled future shift and confirm it appears on the correct Calendar date without affecting completed totals.
- [ ] **Shift type setup:** In Settings → Shift Types, create Morning (05:30–14:00) at 100%, Afternoon (13:30–22:00) at 100%, and a disposable Night type at 150%. Confirm invalid percentages below 100% are rejected.
- [ ] **Shift type selection and override:** Select Night while adding a shift, confirm its times prefill, change the individual end time, save, and confirm the type, changed working hours, base hourly rate, 150% multiplier, effective hourly rate, and compensation appear in Shift Details.
- [ ] **Shift type pay:** With a 60.00 hourly rate, confirm a one-hour 150% type displays 90.00 compensation. If a 125% rule is explicitly stacking, confirm the combined segment is 175%, not 187.5%.
- [ ] **Shift type history:** Rename and reprice the Night type, then confirm the earlier shift retains its snapshotted name/multiplier and finalized salary. Delete the disposable type and confirm the historical shift remains readable while the type disappears from new choices.
- [ ] **Default overtime:** Record 8 hours 30 minutes with no unpaid break and a neutral 100% type. Confirm 8:00 regular, 0:30 special/overtime, ₪510.00 base, ₪7.50 premium, and ₪517.50 total at ₪60/hour. Then preview exactly 12 hours and confirm 8:00 at 100%, 2:00 at 125%, 2:00 at 150%, and ₪810.00 total. Confirm the tiers are labeled **שעות נוספות 125% (שעות 9–10)** and **שעות נוספות 150% (שעות 11–12)**.
- [ ] **12-hour maximum:** Confirm exactly 12 hours saves, 12:01 is rejected in new/manual and Shift Type forms, and an accidentally overdue live shift can still be clocked out without truncating its real timestamp.
- [ ] **Overtime override:** Add or disable a worked-minute multiplier in Pay Rules and confirm it replaces or opts out of the default rather than stacking with it accidentally.
- [ ] **Cross-midnight shift:** Add or complete a shift whose end is on the following day and confirm its dates, duration, Calendar placement, and Reports total.
- [ ] **Native date/time controls:** Open New/Edit Shift, Expected End, Clock Out, Breaks, Templates, and Salary/Rule setup as applicable. Confirm wheel/calendar pickers, a true optional empty state, clear behavior, and that dismissing a picker preserves the old value.
- [ ] **Overnight manual break:** On a disposable cross-midnight shift, add a second-day break such as 01:00–01:15 and confirm it appears after midnight and reduces the shift by exactly 15 minutes.
- [ ] **Edit/delete:** Edit a disposable shift, verify the update everywhere, then delete it and confirm no stale copy remains on Home, Calendar, Reports, or Shift Details.
- [ ] **Reports:** Open the relevant month and confirm completed-shift count, hours, finalized salary totals, and missing/stale salary messages match the recorded shifts.
- [ ] **Weekly overtime:** Create a new effective-dated salary profile version, explicitly enable weekly overtime, cross the configured workweek threshold with deterministic completed shifts, and verify no minute receives duplicate daily/weekly overtime premium.
- [ ] **Calendar evidence and pay rule:** Confirm a reviewable evidence interval and verify it has no pay effect by itself. Add a matching special-interval rule, explicitly recalculate the affected stale shift, and confirm the new snapshot explains the contributing interval while the older snapshot remains frozen.
- [ ] **Salary trust states:** Verify unavailable, basic estimate, configured estimate, stale, incomplete, missing, and finalized-zero presentation. Confirm no missing or stale result appears as numeric zero.
- [ ] **Exports:** From Reports, export PDF and CSV for the same month. Confirm the share sheet names the selected month, local dates/times match Reports, and missing/stale salary is not serialized as zero. Confirm ICS describes itself as calendar-only.
- [ ] **Backup recovery:** Export a backup from disposable state, inspect the confirmation for replace and merge, restore through the OS picker, relaunch, and verify active/open-break state, zero values, archived records, and frozen salary provenance. Confirm malformed input leaves the current database unchanged.
- [ ] **Startup recovery:** Against a disposable database only, verify an incompatible migration history shows localized non-destructive recovery guidance, retry remains available, and the exported diagnostic contains no paths, error message, workplaces, shifts, salary, or database content.
- [x] **DF-013 notification retest:** On the physical `f4f916a` Release, iOS delivered `המשמרת שלך מתחילה בעוד 0 דקות.`; the numeric offset is present and no brace token remains.
- [ ] **App restart:** Terminate and relaunch from the Shiftty icon; confirm persisted shifts remain, no deleted item returns, and any active/break state is coherent. The iOS candidate uses `com.omerportnoy.shifty`; Android uses `com.shifty.app`. Record any separately signed dogfood bundle explicitly.

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

## Historical physical Personal Team build workflow

The following records the 2026-08-13 process for reproducibility; its profile has expired and its identifiers do not authorize a current build. For Milestone 4, use this only as a preservation checklist after the full repository gate and Simulator walkthrough pass. Discover the currently eligible signing team without printing credentials, and do not copy the historical team or bundle overrides into a new release merely to make signing pass.

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

- Android has not been verified for Milestone 4 because no SDK/emulator/device was available. This is an external verification gap, not an Android pass; the current verdict is `SOURCE_READY_NATIVE_BLOCKED`.
- No physical-iPhone build is claimed for Milestone 4. The paired iPhone 15 Pro Max already contains the legacy dogfood bundle and database, so it was preserved. A side-by-side `com.omerportnoy.shiftty.beta` build stopped before compilation because no provisioning profile existed and Xcode required explicit profile creation. The old locally signed `f4f916a` standalone Release is not an EAS Preview and its Personal Team profile expired on 2026-08-17.
- EAS Preview/internal-distribution eligibility has not been reverified for Milestone 4. Treat Apple account membership, signing, and distribution access as external prerequisites; do not purchase membership as part of dogfooding automation.
- Physical local-notification permission, native scheduling, background delivery, and DF-013 interpolation passed only on the historical standalone build. Reverify the current candidate before using that result for beta readiness.
- Remote push/APNs is not used by the current Shiftty notification flow and is not enabled in the Personal Team build. Focus-mode variations, prolonged power-management behavior, calendar import interoperability, native share targets, keyboard avoidance, and dynamic-text extremes remain unverified.
- Simulator development-client checks still require Metro on LAN port `8081`; the verified Milestone 4 Simulator Release did not.

When eligible Apple signing and internal-distribution access are confirmed, the intended EAS build command is:

```sh
cd /Users/portnoy/Documents/Shiftty
npx eas-cli@22.4.0 build --platform ios --profile preview
```

Do not use `development-simulator` for a physical iPhone.
