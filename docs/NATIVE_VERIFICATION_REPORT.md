# Native verification report

Candidate date: 2026-08-25
Branch: `codex/beta-stabilization`
Candidate source: the final verified Milestone 4 working tree based on `b94ac6f3141cbec1c8fde5197a2cf5e2f2e8e97e`

## Evidence policy

This report keeps automated source evidence, iOS Simulator evidence, physical-iPhone evidence, and Android evidence separate. A source test is not reported as a native pass, share-sheet presentation is not reported as file-content readback, and a restore entry point is not reported as an OS document-picker restore.

## Candidate and environment

| Item | Recorded value |
| --- | --- |
| Public identity | Shiftty / שיפטי |
| Expo / React Native mode | Expo SDK 57; New Architecture enabled; standalone Release bundle, no Metro dependency |
| iOS build host | macOS host with Xcode 26.6 (`17F113`) and iOS 26.5 Simulator runtime |
| iOS Simulator | Disposable clone named `Shiftty Beta Verification Clone`; iPhone 17 Pro class; iOS 26.5 |
| Built application | arm64 `Release-iphonesimulator/Shifty.app`; `CFBundleDisplayName=Shiftty`; `CFBundleIdentifier=com.omerportnoy.shifty`; build `1` |
| Physical iPhone | Paired iPhone 15 Pro Max available; current candidate not installed |
| Android | No Android SDK, emulator, AVD tooling, or connected device available |

The fresh Release build command completed with `** BUILD SUCCEEDED **`, the app installed and launched on the disposable Simulator, and all six Maestro flows were then rerun against that exact binary. The physical iPhone installation was not cleared or replaced. During iterative verification, one unpinned Maestro invocation selected the separately booted `iPhone 17 Pro` Simulator and executed `clearState` for `com.omerportnoy.shifty` before the run was stopped. Subsequent native commands were pinned to clone UDID `73B7FFB2-1EC0-470C-B7E5-38D401BA4255`. No physical-device data was affected; any prior data in that Simulator app container was not recoverable from the test harness and is not represented as preserved.

## Verification summary

| Evidence class | Result | Evidence |
| --- | --- | --- |
| Automated repository gate | Passed | Typecheck, lint, 137 suites / 685 tests, migrations, Expo export, Expo dependency check, public config, and `git diff --check` |
| Release preflight | Passed at source level | Configuration/assets and the full source gate passed; the command separately listed account, signing, store, and device prerequisites |
| Maestro definitions | Passed | Six public production-UI flows; no fixture route, seeded product database, hidden clock, or production bypass |
| Maestro execution | Passed | `6/6 Flows Passed in 11m 50s` on the final standalone Release binary, pinned to the disposable clone UDID |
| iOS native build/install/launch | Passed | Fresh arm64 Release build, install, cold launch, repeated termination/relaunch, and standalone execution without Metro |
| iOS Simulator presentation | Passed for executed scope | English/light throughout automation plus a separate Hebrew/RTL/dark launch and visual inspection |
| Physical iPhone | Not tested | Safe side-by-side build stopped at missing provisioning profile; existing dogfood app/data were preserved |
| Android native build/runtime | Not tested | Runtime and SDK unavailable |
| GitHub Actions workflow | Local definition passed; hosted run not tested | Workflow YAML parsed locally and every declared command passed; no remote runner result is claimed |

## Native journey matrix

| Journey | iOS Simulator result | Native boundary |
| --- | --- | --- |
| A. First use | Passed | Fresh state, onboarding, workplace/hourly rate, Home, cold relaunch, persistence |
| B. Live shift | Passed | Clock in, unpaid break, cold relaunch, open-break restoration, end break, clock out, review and save |
| C. Shift type | Passed | Create a 150% type, select it on a scheduled shift, override copied break to 15 minutes, archive the type, and observe frozen identity in Calendar and details |
| D. Weekly overtime | Passed | Save an effective-dated profile with an eight-hour weekly threshold and 150% multiplier; prove the first shift is below threshold and the next shift is exactly eight weekly-overtime hours without a duplicate default segment |
| E. Evidence and rule | Passed | Confirm the dated preset, prove evidence alone has no pay effect, add an exact 150% rule, selectively mark/recalculate the affected shift, edit evidence, preserve the control shift, and retain frozen historical provenance |
| F. Reports and data safety | Passed for share-sheet boundary | Complete a legitimate finalized-zero shift; present and copy PDF, CSV, calendar-only ICS, and backup files through real iOS share sheets; verify the restore entry point |

The native flows open real iOS share sheets and invoke the stable Copy action. They stop before generated-file content readback and before selecting/restoring a file through the OS document picker. Automated export and backup tests remain authoritative for PDF/CSV/ICS content, formula safety, semantic restore, collision handling, and SQLite integrity; this distinction is the reason the verdict remains native-blocked.

## Presentation and state matrix

| Check | iOS Simulator | Physical iPhone | Android | Notes |
| --- | --- | --- | --- | --- |
| English LTR | Passed | Not tested | Not tested | Six final Maestro flows used English UI |
| Hebrew RTL | Passed for inspected Home surface | Not tested | Not tested | Device-language launch showed Hebrew copy, right-to-left tab order/alignment, and `שיפטי` |
| Light appearance | Passed | Not tested | Not tested | Final flow suite and relaunches |
| Dark appearance | Passed for inspected Home surface | Not tested | Not tested | Hebrew dark launch rendered legibly with correct contrast and RTL layout |
| Dynamic Type extremes | Automated/static only | Not tested | Not tested | Public-source audit rejects disabled font scaling; extreme sizes were not manually swept |
| Screen reader focus/order | Automated/component only | Not tested | Not tested | Maestro uses stable accessibility IDs; a VoiceOver sweep was not performed |
| Native picker | Passed where exercised | Not tested | Not tested | Journey D exercised the iOS effective-date picker; full picker/cancellation matrix was not repeated |
| Missing/stale/finalized zero | Passed where exercised | Not tested | Not tested | E exercised stale/non-numeric behavior; F exercised legitimate numeric zero; unit tests cover missing/incomplete |
| Startup recovery error | Passed | Not tested | Not tested | A test-only Migration 9 name mismatch produced the non-destructive recovery screen |
| iPad layout/orientation | Not tested | Not tested | Not applicable | Tablet support is declared, not runtime-verified |

## Persistence, migration, recovery, and privacy

Automated integration tests passed for empty and v1-v9 upgrades, interrupted Migration 9 rollback/retry, incomplete/future migration-history rejection, corrupt and semantically invalid backups, replace rollback, merge collisions, active/open-break constraints, legacy V1 data, evidence/workweek provenance, archived/deleted evidence behavior, and a 250-shift zero-rate semantic round-trip.

The final Simulator database reported:

- Migration 9 with the exact expected name `evidence_aware_holiday_rest`;
- `PRAGMA integrity_check` → `ok`; and
- `PRAGMA foreign_key_check` → no rows.

For the native recovery check, the app was terminated, the disposable database was copied, and only its Migration 9 name was changed to a test-only mismatch. On launch, the app refused normal startup, stated that local data remained on-device, and offered retry plus a safe diagnostic export. The expected migration name was then restored, the WAL was checkpointed, integrity/foreign keys were rechecked, and normal launch resumed. No user or dogfood database was involved. The OS diagnostic share sheet itself was not opened; unit/component tests verify that the diagnostic excludes paths, native error messages, workplace/shift content, salaries, and backup data.

## Stability findings

The earlier Milestone 3 symptom is best classified as Metro/dev-client connectivity, not a demonstrated application crash: retained logs showed 87 heartbeat timeouts alongside 92 successful bundles, without a matching fatal exception, Jetsam event, signal termination, SQLite termination, crash report, or failed Xcode build.

The Milestone 4 candidate was tested as a standalone Release without Metro. It completed six flows over 11 minutes 50 seconds, including repeated cold relaunches, active-shift restoration, and open-break restoration. A post-run log search found no application fatal, crash, or SQLite failure. One earlier `XCTAS Error` occurred while the Maestro accessibility harness was querying a terminating window; the app continued, so it is recorded as a harness transition rather than an app crash.

Notification reconciliation is now serialized and has a race regression test proving one logical reminder schedules once. Local-notification delivery, denial behavior, and background delivery were not reverified on a physical device.

## Performance findings

The 365-shift/250-unrelated-workplace regression scenario reduced role reads from 251 to 1, unrelated profile reads from 250 to 0, evidence reads from 365 to 1, and weekly-rest reads from 365 to 1. Evidence remains filtered back to each exact half-open shift range. The isolated test body took about 5.6 seconds and the Jest process reached about 163 MB maximum RSS on this host.

These are query-count and deterministic workload measurements, not a controlled native battery, frame-rate, or memory benchmark. Native flows exercised Home, Salary Settings, Shift Details, Calendar/Reports navigation, and report rows without a timeout attributable to application work, but no physical-device battery or long-session memory claim is made.

## Physical iPhone and Android boundaries

The paired iPhone 15 Pro Max already contains `com.omerportnoy.shifty` (`Shifty` 0.1.0 build 1) with existing dogfood data. It was not replaced or cleared. A command-line Release build using the side-by-side identifier `com.omerportnoy.shiftty.beta` stopped before compilation because no matching provisioning profile existed; Xcode required `-allowProvisioningUpdates`. This milestone did not create profiles or credentials, so no current-candidate physical install, notification delivery, or background/foreground pass is claimed.

Android remains outside the ready platform scope because no SDK/emulator/device was available. Android configuration and automated source checks pass, but there is no Android build or runtime evidence.

## Blockers and verdict

No known P0/P1 source or iOS Simulator core-flow defect remains. The report-row width and iOS picker accessibility defects found during native verification were fixed and regression-tested before the final Release build and the 6/6 rerun. A known P2 remains: the root recovery boundary can describe a later render exception as a database-startup failure; it is non-destructive but diagnostically imprecise.

The direct native blockers are generated PDF/CSV/ICS/backup file readback and a complete OS document-picker backup restore with post-restore verification. External blockers are Apple device/distribution provisioning, App Store Connect metadata and privacy/support assets, hosted CI evidence, physical notification/background checks, and the complete Android toolchain/runtime matrix.

Evidence-based verdict: `SOURCE_READY_NATIVE_BLOCKED`. The source, standalone iOS Release, and disposable Simulator journeys pass, including real share-sheet presentation, but the missing file-readback and document-picker restore evidence prevents an iOS beta-ready claim. It is not an Android, physical-device, TestFlight, App Store, or hosted-CI claim.
