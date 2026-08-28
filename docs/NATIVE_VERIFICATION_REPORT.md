# Native verification report

Candidate date: 2026-08-28

Branch: `codex/physical-ios-notification-verification`

Milestone base: `8c33ee4de27bbb1d13e30d81261d903526488c74`

Initial notification-response fix: `2c69b0d6b56bb57d9906360a2557c70fea8bdf0d`

Final product-bearing and tested source: `cca7c2b17f84bdc437eb5a5b9ea63f13aa172a7d`

Detailed evidence: [`MILESTONE_7_PHYSICAL_IOS_NOTIFICATIONS.md`](MILESTONE_7_PHYSICAL_IOS_NOTIFICATIONS.md)

## Evidence policy

Source automation, inherited iOS Simulator evidence, inherited Android emulator evidence, physical-iPhone QA evidence, physical Android, hosted CI, production signing, and distribution are separate claims. Pending/persisted notification state is not delivery, a continuity click is not a physical notification tap, an ephemeral QA bundle is not production signing, and a green local gate is not hosted CI.

## Candidate and environment

| Item | Recorded value |
| --- | --- |
| Physical iPhone | iPhone 15 Pro Max (`iPhone16,2`), iOS 26.6 (23G71) |
| Xcode/build | Xcode 26.6 (17F113), Release, physical arm64 |
| QA identity | `com.omerportnoy.shifty.m7qa`, isolated `shifty-m7qa` scheme |
| Signing | Existing Apple Development identity/team; development provisioning for the connected device |
| QA executable SHA-256 | `66e367e8ff3ee2782626c55e658170f7d193c0321347fe1b91178c6e744b9a24` |
| Embedded JS SHA-256 | `9682256a286fc18b951f643ff7ece8cedb1d072899f2e1aa5f193015c73b77f1` |
| Android | Inherited Milestone 6 isolated API 36 ARM64 Release evidence |
| iOS Simulator | Inherited Milestone 5 disposable iPhone 17 Pro, iOS 26.5 Release evidence |

The artifact passed architecture, bundle/version, development-profile, and deep/strict code-signature checks before installation. The temporary native QA project, configuration overrides, and identifier constants are absent from production/native source and configuration commits; sanitized documentation retains only the identity evidence required by this report.

## Verification summary

| Evidence class | Result |
| --- | --- |
| Current source suite before final docs | Passed: 140/140 suites, 707/707 tests |
| Focused notifications | Passed: 10/10 suites, 56/56 tests |
| Response routing | Passed: 1/1 suite, 5/5 tests |
| Zoned time | Passed: 5/5 tests under each of Asia/Jerusalem, UTC, America/New_York, and Europe/London |
| Corrected physical Release build/install/launch | Passed |
| QA lifecycle and persistence | Passed, including open unpaid break across background and SIGKILL/cold recovery |
| Foreground notification | Passed with protected-capture limitation |
| Background notification delivery | Passed |
| Terminated notification delivery | Passed after SIGKILL |
| Terminated notification tap | Passed by direct physical tap; intended Shift details opened once |
| Background notification tap | Passed by direct physical tap; intended 15:32 Shift details opened once |
| Cancellation | Passed beyond original trigger plus cold relaunch/reconciliation |
| Native-only invalidation/recreation | Passed exactly once, with repeated reconciliation remaining singular |
| Deterministic timezone behavior | Passed current-zone persistence, earlier overlap, and forward-normalized gap without global device mutation |
| QA SQLite | Final `integrity_check = ok`; zero foreign-key rows; nine migrations once; zero notification-test shifts/records; no unexpected snapshot rewrite |
| Hosted CI exact final SHA | Pending until documentation commit is pushed |
| Production/archive/store signing | Not tested and not inferred from QA development signing |

## Physical iPhone results

The side-by-side QA Release directly exercised Hebrew onboarding, disposable workplace/rate persistence, English relaunch, native permission, alert/sound/badge policy, scheduling, reconciliation, lifecycle, and finalization without touching dogfood. No fatal JavaScript, native, notification, or SQLite error was observed.

One logical reminder remained one native and one persisted record across repeated reconciliation, backgrounding, and relaunch. Foreground presentation occurred once with the configured sound behavior and zero app badge. Distinct reminders delivered once with the app backgrounded and after SIGKILL. A direct tap on the terminated-process notification cold-opened the intended Shift details screen, and a later normal launch did not replay it.

Cancellation removed native and persisted state before trigger. More than two minutes after the original trigger, delivered count remained zero; cold relaunch and reconciliation did not recreate it. Native-only invalidation retained trusted metadata, and reconciliation recreated exactly one desired request; another reconciliation did not duplicate it. Cleanup then removed the request and metadata.

A direct physical tap on the background-delivered notification foregrounded the app on the intended 15:32 Shift details screen once. A Mac continuity click that only focused Mirroring was rejected as evidence. Source tests cover valid, duplicate, foreign, and missing/stale response data; no separate destructive physical stale-data tap was performed.

## Defect closure

The physical journey reproduced response navigation that was consumed without routing from the QA harness. A root notification-response lifecycle and safe once-only router now validate ownership and shift existence, navigate valid responses, fall back safely for missing data, and report unexpected failures. Post-fix terminated tapping passed.

The final D7 attempt also exposed QA cleanup ordering: shift deletion removed trusted metadata before native cancellation. Cleanup and same-scenario replacement now call production `cancelForShift` first. A focused order test passes, the final artifact includes the fix, and the physical cancellation and stale-native-ID scenarios were rerun successfully. Final router review also prevented a later rescheduled delivery from being suppressed merely because it reused a native request identifier; the dedupe key now includes delivery date and action identifier, with focused coverage for both true duplicates and identifier reuse.

These changes do not modify salary rules, totals, migrations, Backup V1, frozen historical snapshots, public production identities, or dependencies. Inherited Android and Simulator evidence is not invalidated.

## Lifecycle, timezone, and database

A live shift survived background/foreground and process termination. Its unpaid break survived background/foreground and a separate SIGKILL/cold launch, then ended normally. The shift finalized, and a second cold launch showed the same completed duration and finalized estimate.

The device remained in Asia/Jerusalem. The production resolver selected `+03:00` for the 2026 fall-back overlap's earlier valid instant and normalized the 2026 spring gap forward to 03:30. Reconciliation remained singular across relaunch. No global timezone or automatic-time setting was changed. The baseline locale was English; Hebrew was exercised inside QA, and final launch returned to English.

Read-only QA database inspection passed integrity and foreign-key checks. `schema_migrations` held versions 1–9 exactly once; `PRAGMA user_version` correctly remained zero under the repository's migration design. The final journey left one completed QA shift, one closed break, zero open breaks, one expected current snapshot, and no duplicate current snapshot. The earlier copy had zero snapshots, so the new snapshot is expected rather than a historical rewrite.

## Inherited evidence and external boundary

Milestone 6 remains authoritative for the isolated Android Release/runtime/notification/export/restore matrix. Milestone 5 remains authoritative for iOS Simulator Release artifact readback and document-picker restore. No change here requires those accepted full matrices to be repeated.

Dependencies remain unchanged. The raw Expo command retains 13 reviewed patch notices; the wrapper must accept exactly those. `npm audit --omit=dev` retains 16 transitive Expo/Metro developer-toolchain advisories (12 moderate, 4 high), with no compatible non-force repair and no authorized forced downgrade.

All required physical notification scenarios, QA cleanup, setting restoration, final SQLite checks, and QA-only uninstall pass. The complete local gate and exact-final-SHA hosted CI remain before the handoff verdict. Production signing, archive, TestFlight, App Store, and distribution remain unverified and unauthorized.
