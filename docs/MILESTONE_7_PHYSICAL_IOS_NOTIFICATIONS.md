# Milestone 7 physical iPhone notification evidence

Verification date: 2026-08-28

Branch: `codex/physical-ios-notification-verification`

Milestone base: `8c33ee4de27bbb1d13e30d81261d903526488c74`

Initial notification-response fix: `2c69b0d6b56bb57d9906360a2557c70fea8bdf0d`

Final product-bearing and tested source: `cca7c2b17f84bdc437eb5a5b9ea63f13aa172a7d`

The final documentation commit and exact-SHA hosted result are recorded in the milestone handoff. Documentation-only changes after the tested QA-source commit do not alter product, configuration, dependency, native, or harness source.

## Candidate and isolation

| Item | Verified value |
| --- | --- |
| Device | iPhone 15 Pro Max (`iPhone16,2`) |
| OS | iOS 26.6 (23G71) |
| Xcode | 26.6 (17F113) |
| Configuration | Release, physical arm64 |
| QA identity | `com.omerportnoy.shifty.m7qa`, isolated `shifty-m7qa` scheme |
| Signing | Existing Apple Development identity/team; development provisioning for the connected device |
| App version | 0.1.0 (1) |
| Executable SHA-256 | `66e367e8ff3ee2782626c55e658170f7d193c0321347fe1b91178c6e744b9a24` |
| Embedded JS SHA-256 | `9682256a286fc18b951f643ff7ece8cedb1d072899f2e1aa5f193015c73b77f1` |

Deep/strict signature verification passed. The generated QA project, signing override, identifier overrides, scheme override, and CocoaPods build state were temporary and are absent from production/native source and configuration history; only the sanitized evidence documentation records the required QA identity. The retained route requires matching explicit non-production build inputs and cannot enable for the production iOS bundle; the temporary QA value is not tracked in source. This is development-signed side-by-side QA evidence, not production-bundle signing, archive, TestFlight, App Store, or distribution evidence.

The existing `com.omerportnoy.shifty` dogfood application remained installed and was never launched, overwritten, cleared, copied, queried, or uninstalled. Its database was not accessed. All test records were confined to the QA application container.

## Notification matrix

Times use Asia/Jerusalem (UTC+03:00). Counts came from the QA-only, fail-closed diagnostic route while scheduling, reconciliation, notification adaptation, response routing, repositories, and navigation remained the production implementations. The route exposes authorization flags, badge/owned-request/persisted counts, timezone resolver outputs, and bounded action status; it does not display or log identifiers, notification bodies, workplace data, notes, salary data, backups, or remote telemetry.

| Scenario | Expected | Directly observed behavior | Evidence | Result |
| --- | --- | --- | --- | --- |
| D1 permission | One native request, grant persists, no repeated prompt | First QA launch displayed the native prompt; permission was granted; iOS settings and native readback showed alerts, sounds, and badges allowed; app badge stayed zero; relaunch did not ask again | Physical UI plus native authorization readback | Pass |
| D2 schedule/dedupe | One logical reminder remains one native and one persisted record | Production reconciliation was run three times, then after background and relaunch; counts remained `1 native / 1 persisted` with no duplicate | Physical count readback and QA SQLite | Pass |
| D3 foreground | Exactly one visible foreground presentation with sound policy and no badge | With QA visibly foregrounded, iOS accepted and presented one local alert; native delivery count incremented once, persisted metadata was reconciled away, badge stayed zero, and the app did not navigate or crash | Direct observation plus application/OS notification callbacks; banner capture was unavailable through protected Mirroring | Pass with capture limitation |
| D4 background | Exactly one notification while process remains alive | Trigger 14:30:58; QA was on the Home Screen before trigger; one new phone notification was directly observed; return to QA showed delivery increment by one, zero pending, zero stale metadata, and zero badge | Physical UI, notification observation, count readback | Pass |
| D5 terminated | Previously scheduled notification survives ordinary SIGKILL | QA had `1 native / 1 persisted`, was terminated with SIGKILL before the 14:38:04 trigger, remained absent through trigger, and exactly one new notification was directly observed | Physical UI, process-state check, count readback | Pass |
| D6 terminated tap | Cold launch reaches intended Shift details once | A distinct notification triggered at 14:41:19 while the process was absent. A direct physical tap around 14:43 cold-launched the intended Shift details screen. A later ordinary launch did not replay the response or loop | Direct physical tap and user-supplied privacy-safe screen evidence | Pass |
| D6 background tap | Foreground existing process and reach intended Shift details once | Trigger 15:32:02 after QA was backgrounded on the Home Screen. A direct physical Notification Center tap at about 17:02 foregrounded QA on the intended `M7 QA notification check` Shift details screen for the 15:32–16:32 shift, with no loop or duplicate route | Direct physical tap and user-supplied privacy-safe screen evidence | Pass |
| D6 stale/missing data | No crash, loop, or internal identifier in visible errors | Response-router regression coverage resolves an owned response only once, routes an existing shift, and safely falls back when the referenced shift is absent | Focused automated response-routing tests | Pass in source; no separate destructive physical stale-data tap |
| D7 cancellation | Remove pending before trigger; no later delivery or recreation | Cancellation scenario scheduled for 15:20:15 and removed at about 15:18. Counts immediately became `0 / 0 / 0`. At 15:22:38—more than two minutes after the trigger—delivery was still zero; cold relaunch and reconciliation kept all counts zero | Physical count readback, bounded timestamps, cold relaunch | Pass |
| D8 stale native ID | Recreate desired request exactly once; do not recreate undesired state | Desired state began `1 native / 1 persisted`; native-only invalidation produced `0 / 1`; first reconciliation restored `1 / 1`; a second remained `1 / 1`; production cleanup returned all counts to zero | Physical count readback and production reconciliation | Pass |

No result is inferred solely from pending metadata. The missing foreground screenshot is classified as an automation/capture limitation because presentation was directly observed and independently corroborated. A Mac continuity-notification click that merely focused iPhone Mirroring was rejected as tap-routing evidence.

## Defects reproduced and fixed

1. A real notification response reached the QA process but did not navigate from the harness route. The application now registers one root response lifecycle, validates Shiftty ownership and shift existence, routes valid responses to Shift details, handles stale data safely, reports failures through the existing unexpected-error boundary, and consumes a response once. Focused router tests cover ownership and bounded references, cold-response clearing, duplicate suppression, identifier reuse, valid targets, missing targets, and error reporting; the terminated physical tap directly covers cold lifecycle entry.
2. The QA cleanup originally deleted shift metadata before native cancellation, leaving an orphan request that later delivered. Cleanup and same-scenario replacement now cancel through `NotificationReconciler.cancelForShift` before deleting QA shifts. A regression test locks the cancellation/delete/reconcile order. The final binary was rebuilt and D7/D8 were rerun successfully.
3. Final diff inspection found the temporary QA bundle identifier hard-coded in the retained evidence gate. The gate now requires matching externally supplied build inputs, rejects the production iOS bundle even if flags are set, and contains no tracked temporary identifier. Focused tests cover missing, disabled, empty, mismatched, and production-bundle inputs. A final Release was rebuilt from that source.
4. Final response-router review found that identifier-only in-memory suppression could ignore a later rescheduled delivery that reused the same native request identifier. The response key now includes request identifier, delivery date, and action identifier. A focused regression proves a true duplicate remains suppressed while a later delivery with the same request identifier routes once.

These corrections are narrow notification/lifecycle and QA-evidence changes. They add no salary, payroll, entitlement, migration, backup, public-identifier, or dependency behavior. The Android and iOS Simulator evidence remains valid because notification semantics are preserved and the shared response/cleanup paths have focused coverage.

## Application lifecycle and persistence

- Side-by-side install, first launch, Hebrew onboarding, disposable workplace/rate setup, English relaunch, and settings persistence passed.
- A live unscheduled shift was started, backgrounded, foregrounded, and recovered after process termination.
- An unpaid break remained open across background/foreground and a separate SIGKILL/cold launch.
- The break ended normally, the shift finalized, and a second cold launch showed the same completed duration and finalized estimate.
- There was no fatal JavaScript, native, notification, or SQLite error and no matching QA crash report in the inspected interval.

This was a bounded regression journey. It did not repeat the full salary matrix or modify historical fixtures.

## Timezone behavior

The device reported `Asia/Jerusalem`. The QA harness called the production timezone resolver and showed:

- fall-back overlap `2026-10-25 01:30` -> `2026-10-25T01:30:00.000+03:00`, the earlier valid instant;
- spring-forward gap `2026-03-27 02:30` -> `2026-03-27T03:30:00.000+03:00`, the documented forward normalization.

Current-zone scheduling survived relaunch and repeated reconciliation without duplication. The same timezone tests passed under Asia/Jerusalem, UTC, America/New_York, and Europe/London host environments. The device's global timezone and automatic-timezone control were not changed: the deterministic production-code harness supplied the required overlap/gap evidence without risking user state. The original device timezone therefore remained in place; the automatic-toggle value was not directly inspected or modified and is not claimed.

The baseline device locale was English. Hebrew was exercised within the isolated QA app for onboarding, and the final ordinary launch was again English. No global device locale change remained. The temporary Screen Sharing notification permission used for observation was restored to its recorded `Notifications Off` baseline and visually verified in iPhone Settings at 17:07.

## QA database sanity

Read-only inspection of the copied QA container after the lifecycle journey showed:

- `PRAGMA integrity_check = ok`;
- `PRAGMA foreign_key_check` returned zero rows;
- application migration table contained all nine migrations exactly once (`PRAGMA user_version` remains the repository's expected zero because Shiftty tracks versions in `schema_migrations`);
- one completed QA shift, one closed break, and zero open breaks;
- one current version-1 salary snapshot and zero shifts with multiple current snapshots;
- no migration replay or database reset.

The pre-journey QA copy had zero salary snapshots. The one new finalized snapshot is the expected result of the new completed QA shift; no existing historical snapshot was rewritten. After production-repository cleanup, the harness showed zero native pending, zero native delivered, zero persisted metadata, and zero badge. Final read-only SQLite inspection again returned `integrity_check = ok`, zero foreign-key rows, all nine migrations once, zero `m7qa-notification-*` shifts, zero scheduled-notification records, zero open breaks, one current snapshot, and no duplicate current snapshot. Only the QA bundle was then uninstalled; the production dogfood bundle remained installed.

## Source verification boundary

The current source gate passed 140 suites and 707 tests. Focused notifications passed 10 suites and 56 tests, response routing passed 5 tests, and zoned-time passed 5 tests under each of Asia/Jerusalem, UTC, America/New_York, and Europe/London. Migration validation covered empty plus v1 through current v9 databases; Expo validation/configuration, release preflight, and patch-whitespace checks also passed. The final exact documentation commit receives the same complete gate, final SQLite checks, and independent base-to-final review before push.

The raw Expo compatibility command exits nonzero with the reviewed SDK 57 baseline of 13 patch notices. Expo's live metadata advanced two expected patch targets during verification; only those exact allowlist expectations were refreshed, the deterministic wrapper passed, and installed dependencies remained locked. `npm audit --omit=dev` retains 16 transitive Expo/Metro developer-toolchain findings (12 moderate, 4 high); no force remediation or dependency update is authorized here.

## Limitations and release boundary

- The deterministic harness replaced a real global timezone mutation; automatic-timezone state was neither read nor changed.
- Protected iPhone Mirroring prevented a privacy-safe foreground banner screenshot. Direct observation and independent callbacks/counts support the result.
- Physical Android was not required to substitute for the inherited accepted Android emulator evidence.
- Production bundle signing, archive validation, TestFlight processing, App Store metadata/review, and public distribution were not performed.

All required physical notification scenarios, QA cleanup, temporary-setting restoration, final SQLite checks, and QA-only uninstall pass. The exact documentation-HEAD local gate and exact-SHA hosted CI remain required before the handoff can select `BETA_READY`.
