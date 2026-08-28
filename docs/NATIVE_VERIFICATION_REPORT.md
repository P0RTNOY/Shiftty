# Native verification report

Candidate date: 2026-08-28

Branch: `codex/ios-testflight-distribution-candidate`

Milestone 8 base: `ac3ed516d0c6309e817b0c3094cc9f2dc9485e49`

Milestone 8 product-bearing source: `75bd38268d83226f121421e2964d2c174b54d094`

Hosted product verification: [run 33186767702](https://github.com/P0RTNOY/Shiftty/actions/runs/33186767702), passed

Detailed evidence: [`MILESTONE_7_PHYSICAL_IOS_NOTIFICATIONS.md`](MILESTONE_7_PHYSICAL_IOS_NOTIFICATIONS.md)

## Milestone 8 production-artifact preparation

| Evidence class | Result |
| --- | --- |
| Exact product source | Passed: 140 suites, 701 tests, migrations, web export, resolved config, production route/bundle audit, and whitespace |
| Hosted CI | Passed: run 33186767702 for exact SHA `75bd38268d83226f121421e2964d2c174b54d094` |
| Unsigned arm64 Release | Passed after `npm ci` followed by fresh `pod install`; identity `com.omerportnoy.shifty` `0.1.0 (1)` |
| QA/dev-client artifact audit | Passed for the unsigned artifact: no M7 route/control/flag identifiers, QA resource, dev-client/launcher/menu package marker, native dev-menu marker, or dev-client resource |
| dSYM | Passed: application executable and dSYM UUID both `0F38E514-CBB0-3409-847C-614D4C628C19` |
| Production signing | Blocked: zero local Apple Distribution identities and zero matching App Store profiles; none created |
| App Store Connect record/build inventory | Blocked: no authenticated API/CLI visibility; public-store absence does not prove record absence |
| Archive validation/upload/processing | Not performed |
| Internal TestFlight assignment/install | Not performed |
| Dogfood backup/upgrade/smoke | Not performed; installed dogfood application remains untouched |

The exact unsigned executable SHA-256 is `f3cff253b26516632bd3460aebca855c2d45c5fbf1d54b6effce77fed0fe65ab`; embedded JS SHA-256 is `6427e95acd10a58359e342d2dea508c2b10bf8a37594c48ecf94134fd4381f4a`. It is arm64, resolves version `0.1.0 (1)`, uses only the production `shifty` URL scheme, has no dev-launcher local-network metadata, and has synchronized icon/launch assets. Repeated dependency warnings from Expo/React Native headers and script phases were non-blocking for this unsigned compile; no archive/App Store warning classification is claimed.

Two attempted builds after `npm ci` failed because the previously generated CocoaPods/module-link state predated the reinstalled `node_modules`, leaving Expo SQLite C symbols unavailable to Swift. Running `pod install` after `npm ci`—the native dependency order used by EAS—left Git clean and produced the successful clean build above. This is recorded as build-environment ordering, not a product runtime defect.

The source audit removed the M7 filesystem route, helper, synthetic notification creation, pending/delivered inspection, invalidation and QA cleanup controls from the production graph. `expo-dev-client`, launcher/menu pods and resources, `exp+shifty`, and Bonjour/local-network dev metadata are absent. Expo itself contains a generic JavaScript capability probe for `NativeModules.EXDevLauncher`; no corresponding native module or behavior is linked. The production notification response lifecycle/router and all M7 delivery fixes are unchanged.

The available local credential state has one valid Apple Development identity and no Apple Distribution identity. One unexpired development profile matches the production App ID and configured team; no App Store profile is present. EAS reports no iOS build credentials and no App Store Connect API keys. App Store Connect application identity and build history therefore remain unknown rather than absent. No certificate/profile/key was created or revoked, and source build `1` is not treated as monotonic until App Store Connect history is inspected.

Verdict: **`SOURCE_READY_DISTRIBUTION_BLOCKED`**. No signed archive, IPA, App Store validation, upload, processing, export-compliance interaction, internal group, tester, TestFlight installation, dogfood backup, database read, data comparison, or production smoke claim is made.

The remaining sections preserve the inherited Milestone 7 physical-notification evidence and its original evidence boundaries.

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

At the Milestone 7 boundary, dependencies were unchanged and the raw Expo command retained 13 reviewed patch notices. Milestone 8 subsequently removed only the development-client subtree; the current wrapper accepts exactly 12 notices. `npm audit --omit=dev` remains at 16 transitive Expo/Metro developer-toolchain advisories (12 moderate, 4 high), with no compatible non-force repair and no authorized forced downgrade.

All required physical notification scenarios, QA cleanup, setting restoration, final SQLite checks, and QA-only uninstall pass. The complete local gate and exact-final-SHA hosted CI remain before the handoff verdict. Production signing, archive, TestFlight, App Store, and distribution remain unverified and unauthorized.
