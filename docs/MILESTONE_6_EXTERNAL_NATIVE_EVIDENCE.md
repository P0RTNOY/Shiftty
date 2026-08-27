# Milestone 6 external native evidence

Status date: 2026-08-27

Branch: `codex/external-native-evidence-closure`

Base: `c2730d7cda7e08fd99631d2e91438862468f9222`

Product-bearing native candidate: `f89d798fb68769a0b5a819fbf0d8c3467134b9fc`

Final documentation/test-only commit: recorded in the milestone handoff

## Scope and evidence policy

Milestone 6 closes external evidence where the authorized environment permits it. It adds no salary concept, migration, backup-envelope version, identifier change, distribution credential, or historical recalculation. Native observations are separated from source automation, inherited iOS Simulator evidence, hosted CI, physical Android, production signing, and store distribution.

The native binaries were built from `f89d798`, which contains the complete product-code change. Later milestone commits change only Maestro automation and documentation; they do not change the application binary. The exact final source SHA must still pass the complete local gate and hosted GitHub Actions. This document intentionally does not predict that hosted result.

## Authorized external actions

- Installed an isolated Android SDK and disposable AVD under user-local Milestone 6 directories, without `sudo` and without altering the incomplete Unity SDK.
- Generated an ignored Android native project in a detached temporary worktree and built/installed a Release APK on only the pinned disposable emulator.
- Used the connected iPhone with a temporary side-by-side QA bundle, existing Apple Development certificate, existing authenticated team, and development provisioning. No certificate or distribution credential was created, downloaded, revoked, or replaced.
- Did not install over, launch, clear, uninstall, or modify the existing `com.omerportnoy.shifty` dogfood app or its data.
- Did not push while collecting native evidence. Only this milestone branch may be pushed later to trigger the existing non-deploying GitHub Actions workflow.

## Android environment and build

| Item | Observed value |
| --- | --- |
| SDK root | Isolated user-local `m6-external-native-evidence-sdk` |
| Java | ARM64 OpenJDK 21.0.12 |
| Platform / target / compile SDK | Android API 36 |
| Build Tools | 36.0.0; 35.0.0 also installed by the supported Gradle workflow |
| Platform Tools | 37.0.1 |
| Emulator | 37.1.11 |
| NDK | 27.1.12297006 |
| CMake | 3.22.1 |
| System image | API 36 `google_apis` ARM64 revision 7, extension 17 |
| AVD | `shiftty_m6_api36_arm64_disposable`, pinned as `emulator-5580` |
| Device fingerprint | `google/sdk_gphone64_arm64/emu64a:16/BE2A.250530.026.F3/13894323:userdebug/dev-keys` |
| Application | Release `com.shifty.app`, arm64-v8a, min SDK 24, target SDK 36 |

The clean Release build completed all 869 Gradle tasks in 2 hours 42 minutes. An incremental rebuild of the final product-bearing commit completed in 7 minutes 50 seconds. The installed APK was 45 MB with SHA-256 `8d9bfba9c341c2e5c0f7e54a69239cd016b5035ac17675ee060d7cedca89d143`. SDKs, the AVD, generated native sources, build products, artifacts, and device databases remain outside Git.

## Android runtime matrix

All seven Android Maestro production-UI journeys passed on the pinned API 36 Release installation. Each accepted journey used a fresh Maestro 2.8.0 driver process to avoid a reproduced long-lived driver timeout.

- Fresh first use, English onboarding, workplace/rate creation, termination, cold relaunch, and persisted settings passed. A separate clean-data run set Android's per-app locale to `[he-IL]`, asserted the Hebrew welcome, assistant, and privacy copy, completed workplace/rate onboarding, and passed a termination/cold relaunch to Home. Hebrew RTL, English LTR, light, dark, system font scale 1.3, native date picker, numeric salary keyboards, system Back, background restoration, and offline cold launch were also directly exercised.
- A live shift and unpaid break survived Home/backgrounding and process termination/cold relaunch. The break ended, clock-out finalized, and Home, Calendar, Shift Details, and Reports displayed the completed result.
- A configured 150% shift type, 15-minute expected break, archived type, and frozen saved type identity passed.
- An effective-dated profile produced an exact weekly threshold crossing: the first eight-hour shift had no overtime segment; the second showed `8 hours · 150%`; the default-overtime segment was absent; and the trust disclosure identified the configured weekly threshold.
- Confirmed evidence remained salary-neutral without a pay rule. Adding a matching special-interval rule left the frozen result stale until explicit recalculation. Recalculation added the contributing segment, and a later evidence-name edit did not rewrite the frozen original provenance.
- Finalized zero remained numeric zero through Reports and the native PDF, CSV, ICS, and backup share entry points. Missing and stale salary remained nonnumeric in the covered flows.
- The post-journey log audit found no Shiftty fatal JavaScript, native, or SQLite match. Repeated large disposable clock jumps used for notification delivery caused System UI instability on the emulator; Shiftty remained responsive and retained data. This is not classified as a product defect.

The first folder-wide run exposed a date-sensitive test assumption: on 2026-08-27, a newly versioned profile did not apply to the test's 2026-08-26 shift, correctly preventing that old-profile shift from contributing to the new profile's threshold. The accepted run used 2026-08-27 and 2026-08-28 in the same configured workweek. A later run exposed an Android numeric IME stray digit and a Settings-tab settle race; the journeys now over-delete/assert the exact multiplier value and wait for Settings navigation. Neither was a salary defect.

## Android notifications

The real Android `POST_NOTIFICATIONS` dialog was shown and granted. Direct native inspection established:

- exactly one logical scheduled-shift alarm and one persisted native identifier;
- no duplicate after reconciliation;
- force-stop removed the native alarm while SQLite metadata remained, and a user relaunch reconciled it to exactly one newly scheduled alarm;
- foreground delivery displayed one Shiftty banner/list notification after Android's inexact one-hour alarm window;
- background delivery posted one Shiftty notification while the launcher remained top-resumed;
- after a plain process kill, the retained alarm started the notification receiver and posted one notification without foregrounding Shiftty; and
- disabling scheduled reminders through production Settings removed the native alarm and all scheduled-notification metadata.

Two Android product defects were reproduced and fixed. The reconciler previously trusted a persisted native ID after Android had removed its alarm on force-stop; it now compares persisted IDs with the native scheduled set and recreates only missing desired reminders, while conservatively trusting persisted state if native inspection itself fails. Foreground notification delivery was previously suppressed because no Expo notification handler was registered; the root now registers visible banner/list presentation with sound and no badge. Focused adapter/reconciler regression tests cover both fixes.

## Android exports, restore, and database

Production Android UI reached the real share/document workflows and generated:

| Artifact | Size | SHA-256 | Independent result |
| --- | ---: | --- | --- |
| CSV | 365 B | `efbc6590132cda20ae8f35657bfc2b865b2bd75393865709c655204b651d2524` | UTF-8 BOM, valid header/one row, estimate terminology |
| PDF | 87,694 B | `2967ca107ef3f6a50528a21ce158b6952eff20af3f0e659b64780abc05b1716d` | One readable page; estimate note/status/total and finalized zero present; `qpdf --check` clean |
| ICS | 286 B | `72cf409927ecc36a5e4ad6506b4cae361ee9f0f0ba7e6567115b84bd1daaeef0` | One valid event, CRLF, max line 58 bytes, no salary/pay/net/gross payload |
| Backup | 5,330 B | `0988b37ee5d07aedb823f2906bd9d26be2f8a8113d287ef81e1a5576301103e1` | `shiftty_backup` envelope V1; declared counts matched |

Android rendering is compared semantically with the established Milestone 5 iOS artifacts; PDF bytes are not expected to match across native renderers.

The real Android DocumentsUI picker selected the established complex Milestone 5 backup. Replace restore succeeded through production confirmation, and a cold relaunch restored the active shift and open unpaid break. After ending the break and completing the restored shift, the re-exported backup had SHA-256 `fc2776c7ebabae1e3708addd1a6ae2ef0aa0f404c1d1d9b26329e6378b566a63`.

Semantic comparison retained all 33 original shifts; completed/finalized the restored active shift; closed its open break; kept seven pre-existing frozen salary snapshots deeply equal; added exactly one new finalized snapshot; and left 15 other collections unchanged. Expected notification metadata was reconciled, and a later weekly dependent became stale without rewriting its snapshot. The copied database returned `PRAGMA integrity_check = ok` and zero `PRAGMA foreign_key_check` rows.

## Physical iPhone

The exact product-bearing commit was built from a clean detached worktree as a Release arm64 application and installed side-by-side:

| Item | Observed value |
| --- | --- |
| Device | iPhone 15 Pro Max (`iPhone16,2`) |
| OS | iOS 26.6 (23G71) |
| QA bundle | `com.omerportnoy.shifty.m6qa` |
| Display/version | Shiftty M6 QA, 0.1.0 (1) |
| Build | Release, SDK 26.5, minimum iOS 16.4 |
| Existing signing team | `9R9UQ6GTQW` |
| Executable SHA-256 | `f1c938b302e93c5ffb8f3182fa1498e18af38db2866f94cf5dc0998452ee553f` |

Deep/strict code-sign verification passed with the existing Apple Development identity and a development profile. No new certificate or distribution credential was created. This QA bundle proves only side-by-side development-device runtime; it does not prove production-bundle signing, archive, TestFlight, App Store, or distribution readiness.

Direct iPhone Mirroring observations passed English/LTR first launch and onboarding, workplace/rate persistence after force termination/cold relaunch, active shift/open-break background and foreground recovery, SIGKILL/cold recovery, break completion, clock-out/finalization, Home/Reports, the export screen, a real native CSV share sheet, Hebrew/RTL after changing only the QA per-app language, and restoration to English/LTR. QA-only SQLite integrity was `ok` initially and finally, no fatal/SQLite error was observed, and matching crash-log queries returned zero files.

The notification permission prompt was directly observed and allowed. One at-shift-start reminder was configured. The QA database contained one logical shift reminder with one distinct native ID, plus the separately enabled missed-clock-in safeguard. Force termination/cold relaunch preserved exactly one of each without duplicates. The record disappeared after its trigger/reconciliation, but the brief foreground banner was not captured; therefore foreground, background, notification-tap, and terminated-process delivery are **not** claimed as directly observed on this physical candidate. A post-trigger shift cancellation left zero records but did not prove pre-trigger native cancellation. Timezone variation was not forced.

Maestro 2.8.0 could not enumerate physical iOS. A temporary XCUITest runner could not install because the free development profile had reached the three-app device limit. No dogfood or unrelated app was removed to bypass that limit. This leaves required physical notification delivery/cancellation and timezone evidence unavailable.

## CI, source compatibility, and verdict

The workflow is read-only, non-deploying, secret-free, time-bounded, uses checkout with credential persistence disabled, and runs the release configuration/asset checks without needlessly executing the full Jest suite twice. After documentation is committed, the branch must be pushed and a successful hosted run obtained for the exact final SHA. No pull request, merge, tag, signing/distribution action, or store submission is part of this milestone.

The current implementation run passed 138/138 Jest suites and 692/692 tests before the final documentation commit. The complete required gate is rerun on the exact final committed candidate and reported in the handoff. Expected SQLite constraint/foreign-key diagnostics are negative-test evidence, not failures. The raw Expo compatibility command currently exits nonzero with 13 exact SDK 57 patch notices; dependencies remain locked, while a deterministic wrapper used by release preflight and hosted CI accepts only those reviewed installed/expected pairs and fails on drift.

No migration or backup V1 format changed. Salary totals, calculation behavior, frozen snapshots, public bundle/package/scheme/project identifiers, and existing data were not rewritten. `npm audit --omit=dev` remains at 16 transitive Expo/Metro developer-toolchain advisories (12 moderate, 4 high); no compatible non-force repair is available and no forced dependency change was made.

Evidence-based verdict: `SOURCE_READY_NATIVE_BLOCKED`.

Android emulator evidence is complete and the source has no known P0/P1 defect, but the required physical-iPhone delivery/cancellation/timezone states remain unavailable. Android physical-device, production-signing, and store-distribution evidence are also not claimed. The recommended next milestone is a narrowly authorized physical-iPhone notification matrix using an available UI-test slot or manual timed delivery harness, followed by production-signing/archive and store-readiness work only under separate distribution authority.
