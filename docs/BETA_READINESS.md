# Beta readiness

Status date: 2026-08-28

Branch: `codex/ios-testflight-distribution-candidate`

Milestone 8 base: `ac3ed516d0c6309e817b0c3094cc9f2dc9485e49`

Milestone 8 product-bearing source: `75bd38268d83226f121421e2964d2c174b54d094`

Milestone 8 product hosted CI: [run 33186767702](https://github.com/P0RTNOY/Shiftty/actions/runs/33186767702), passed for the exact product SHA

The final documentation SHA and its exact-SHA hosted result are recorded in the milestone handoff.

## Milestone 8 source and distribution boundary

Milestone 8 removes the concluded M7 evidence route and helper from the production route graph, removes `expo-dev-client` and its native launcher/menu dependency subtree, and adds deterministic source/resolved-config/native-bundle gates. The tracked production Info.plist now exposes only the `shifty` URL scheme and no dev-launcher Bonjour/local-network metadata. The native marketing version is synchronized to `0.1.0`, Release no longer pins an Apple Development identity, the tracked AppIcon matches the configured Expo icon byte-for-byte, and the launch storyboard no longer references a missing asset. The production notification-response lifecycle and its M7 fixes remain unchanged.

The exact product SHA passed `npm ci`, type-check, lint, **140/140 suites and 701/701 tests**, empty and v1-v9 migration validation, web export, the deterministic 12-notice Expo compatibility wrapper, public-config resolution, a fresh native Hermes production-route/bundle audit, and patch-whitespace validation. The required raw Expo command returned the same 12 reviewed patch notices. `npm audit --omit=dev` still reports 16 transitive findings: 12 moderate, 4 high, and 0 critical. Hosted CI passed every step for the exact product SHA in run 33186767702.

After `npm ci` and a fresh production `pod install`, Xcode 26.6 built an exact-SHA unsigned generic-device Release for arm64 as `com.omerportnoy.shifty` version `0.1.0` build `1`. Its executable SHA-256 is `f3cff253b26516632bd3460aebca855c2d45c5fbf1d54b6effce77fed0fe65ab`; embedded JS SHA-256 is `6427e95acd10a58359e342d2dea508c2b10bf8a37594c48ecf94134fd4381f4a`; executable and application dSYM both report UUID `0F38E514-CBB0-3409-847C-614D4C628C19`. The diagnostic artifact contains no M7 route/control/environment strings, QA identifiers, dev-client/launcher/menu package strings, native dev-menu marker, or corresponding named resources. Expo core retains its generic `EXDevLauncher` native-module capability probe in JavaScript, but the module, pods, resources, URL scheme, and behavior are absent. This unsigned build is production-artifact preparation, not a signed archive or App Store validation.

Distribution remains blocked before signing. Read-only inspection found no local Apple Distribution identity, no matching App Store distribution profile, no EAS iOS build credentials, and no EAS/local/GitHub App Store Connect API key. The configured production App ID and Apple team are evidenced by an unexpired development profile, but App Store Connect application-record existence and uploaded-build history cannot be read without an official authenticated App Store Connect flow. EAS remote iOS version state is uninitialized, so source build `1` is not accepted as the final monotonic TestFlight build number. No certificate or profile was created; no App Store record or internal group was created; no signed archive, validation, upload, processing, tester assignment, TestFlight installation, backup export, or dogfood mutation occurred.

Milestone 8 therefore ends at **`SOURCE_READY_DISTRIBUTION_BLOCKED`**. Resume only after official authenticated read access establishes the App Store Connect record and highest build number. If the record is absent, obtain the required Platforms, Name, Primary Language, Bundle ID, SKU, and User Access values before creating it. If it exists, resolve a higher build number, inspect certificate capacity, create at most the one authorized Apple Distribution certificate only if necessary, and continue archive validation before any upload.

## Product and legal boundary

Shiftty is a Hebrew-first, local-first shift and gross-pay estimation assistant with English support. Salary trust remains deterministic: `unavailable`, `basic_estimate`, or `configured_estimate`. Missing, incomplete, erroneous, and stale calculations remain nonnumeric; a legitimate finalized zero remains numeric zero. Historical snapshots and provenance remain frozen until explicit recalculation.

The estimator does not fully model statutory weekly overtime, automatic holiday or religious-calendar status, weekly-rest entitlement, employer permits or agreements, tax, National Insurance, pension, deductions, benefits, or net pay. It is not payroll, legal advice, or an Israeli labor-law compliance product. PDF and CSV use estimate/missing/stale terminology; ICS is strictly calendar-only.

Milestone 7 adds no salary concept, entitlement, premium, migration, backup-envelope version, automatic recalculation, dependency upgrade, or public identifier change. It closes physical-iPhone evidence and fixes only defects reproduced in notification response routing and QA cleanup order.

The following sections preserve the inherited Milestone 7 physical-notification evidence and its original evidence boundaries.

## Evidence summary

| Evidence class | Result | Boundary |
| --- | --- | --- |
| Source automation before final docs | Passed | 140/140 suites, 707/707 tests; focused notifications 10/10 suites and 56/56 tests; exact final-documentation-HEAD gate still required |
| iOS Simulator | Inherited passed evidence | Milestone 5 Release artifact readback, document-picker restore, semantic backup comparison, and database checks remain valid |
| Android emulator | Inherited passed evidence | Milestone 6 isolated API 36 ARM64 Release matrix remains valid; the shared notification fixes have focused regression coverage |
| Physical iPhone | Passed | Corrected side-by-side QA Release passed lifecycle, permission, dedupe, foreground/background/terminated delivery, background and terminated tap routing, cancellation, stale-ID reconciliation, deterministic timezone behavior, database health, cleanup/restoration, and QA-only uninstall |
| Physical Android | Not tested | Not supplied or required to replace accepted emulator evidence |
| Hosted GitHub Actions | Pending | Run only after the documentation commit; require success for the exact final SHA |
| Production signing/distribution | Not tested | QA development signing does not prove archive, TestFlight, App Store, or distribution readiness |

## Physical iPhone closure

The final QA artifact was built from corrected source as a signed physical-arm64 Release and installed side by side as `com.omerportnoy.shifty.m7qa` on an iPhone 15 Pro Max running iOS 26.6. Deep/strict signature verification passed. The existing dogfood bundle and database were never touched.

Direct evidence now covers first permission grant/no reprompt, alert/sound/badge policy, one-reminder scheduling, repeated reconciliation and relaunch dedupe, foreground presentation, background delivery, delivery after SIGKILL, terminated cold-tap navigation, pre-trigger cancellation beyond the original trigger, and native-only invalidation followed by exactly-one recreation. The deterministic production timezone resolver demonstrated the earlier fall-back instant and forward-normalized spring gap without changing global phone settings.

The bounded live journey passed shift persistence, unpaid-break background/foreground continuity, SIGKILL/cold recovery with the break open, break completion, finalization, and deterministic finalized readback after another cold launch. QA SQLite integrity was `ok`, foreign-key checks returned zero rows, all nine application migrations remained present exactly once, and one expected new finalized snapshot was created without rewriting history.

Detailed privacy-safe evidence and timestamps are in [`MILESTONE_7_PHYSICAL_IOS_NOTIFICATIONS.md`](MILESTONE_7_PHYSICAL_IOS_NOTIFICATIONS.md).

## Defects and limitations

The physical matrix reproduced two application defects. Notification responses were consumed without leaving the QA harness route, so a root lifecycle and safe once-only router were added. The QA cleanup removed persisted metadata before native cancellation, so it now cancels through the production reconciler before deleting QA data. Both have focused tests and passed direct post-fix device reruns. Final review also hardened response dedupe so a later delivery reusing a request identifier is distinct from a true duplicate; the exact final artifact includes that source and the focused regression.

The foreground banner could not be captured through protected iPhone Mirroring, but presentation was directly observed and independently corroborated by native callbacks and exactly-one delivered-state change; this is a capture limitation, not a delivery failure. A global timezone change was unnecessary and intentionally avoided. Automatic-timezone state was not directly read or modified.

Direct taps on notifications delivered while the process was backgrounded and terminated both opened the intended Shift details once. A Mac continuity click was explicitly rejected as evidence. Production-repository cleanup reached zero native pending, delivered, and persisted counts; final SQLite remained healthy; Screen Sharing notifications were visibly restored to `Off`; and only the QA bundle was uninstalled.

## Source, dependencies, CI, and rollback

At the Milestone 7 boundary, the Expo SDK 57 dependency graph was unchanged and the raw compatibility command reported 13 reviewed patch notices. Milestone 8 subsequently removed only the development-client subtree, reducing the current reviewed set to 12; retained dependency versions did not change. `npm audit --omit=dev` remains at 16 transitive Expo/Metro developer-toolchain advisories: 12 moderate and 4 high. No forced downgrade or dependency-version update was performed.

The existing GitHub Actions workflow is non-deploying and must pass for the exact final SHA after this documentation is committed. No post-success commit is permitted. The workflow result belongs in the handoff because documentation must be committed before the run.

There is no OTA channel. Rollback means stop distributing a defective artifact and build a higher native version from the last verified commit. Never silently downgrade or rewrite a populated SQLite schema; preserve the complete container and use only validated transactional restore.

## Verdict

All required physical notification scenarios and device cleanup/restoration pass. If the final local gate passes and hosted CI succeeds for the exact final SHA, the handoff verdict becomes `BETA_READY`. That verdict means evidence supports a controlled beta candidate; it does not mean production signing, archiving, TestFlight, store review, or distribution occurred.
