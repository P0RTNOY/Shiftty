# Native verification report

Candidate date: 2026-08-27

Branch: `codex/external-native-evidence-closure`

Milestone base: `c2730d7cda7e08fd99631d2e91438862468f9222`

Final product-bearing source candidate: `58ab0820cda2d8ff79eee886b87758d5000a8232`

Original full native-matrix candidate: `f89d798fb68769a0b5a819fbf0d8c3467134b9fc`

Detailed evidence: [`MILESTONE_6_EXTERNAL_NATIVE_EVIDENCE.md`](MILESTONE_6_EXTERNAL_NATIVE_EVIDENCE.md)

## Evidence policy

Source automation, inherited iOS Simulator evidence, Android emulator evidence, physical-iPhone QA evidence, physical Android, hosted CI, production signing, and distribution are separate claims. A share sheet is not artifact readback; persisted notification metadata is not delivery; an ephemeral QA bundle is not production signing; and a green local gate is not hosted CI.

## Candidate and environment

| Item | Recorded value |
| --- | --- |
| Original full native-matrix commit | `f89d798fb68769a0b5a819fbf0d8c3467134b9fc` |
| Final product-bearing source commit | `58ab0820cda2d8ff79eee886b87758d5000a8232` |
| Android | Release `com.shifty.app`; isolated API 36 ARM64 emulator `emulator-5580` |
| Original Android matrix APK SHA-256 | `8d9bfba9c341c2e5c0f7e54a69239cd016b5035ac17675ee060d7cedca89d143` |
| Corrected Android APK SHA-256 | `1cbbc1b9ce02edae7d11bf6a4f091a294022aa9097e053fbab5e6eae2578d37a` |
| Physical iPhone | iPhone 15 Pro Max (`iPhone16,2`), iOS 26.6 (23G71) |
| Physical QA bundle | Release `com.omerportnoy.shifty.m6qa`; existing team `9R9UQ6GTQW` |
| QA executable SHA-256 | `f1c938b302e93c5ffb8f3182fa1498e18af38db2866f94cf5dc0998452ee553f` |
| iOS Simulator | Inherited Milestone 5 Release evidence on disposable iPhone 17 Pro clone, iOS 26.5 |
| Native/source boundary | Android was rebuilt from `58ab082`; physical-iPhone evidence remains at `f89d798` because the device later became unavailable |

## Verification summary

| Evidence class | Result |
| --- | --- |
| Current source suite before final docs | Passed: 138/138 suites, 693/693 tests |
| Android Release build/install/launch | Passed |
| Android seven-journey production UI matrix | Passed with fresh driver process per journey |
| Android notifications | Passed, including direct foreground/background/plain-kill delivery and force-stop reconciliation |
| Android artifact readback | Passed for PDF, CSV, calendar-only ICS, and backup |
| Android DocumentsUI replace restore | Passed, including cold recovery and restored shift completion |
| Android SQLite | `integrity_check = ok`; zero foreign-key rows |
| Physical iPhone lifecycle/share/RTL | Passed in side-by-side QA bundle |
| Physical iPhone notifications | Partial: permission, scheduling, and dedupe passed; delivery/cancellation states not directly complete |
| Physical Android | Not tested |
| Hosted CI exact final SHA | Rerun pending; run 33068224029 exposed and reproduced one host-timezone portability defect |
| Production/archive/store signing | Not tested and not inferred from QA development signing |

## Android results

The clean arm64 Release build used API/target/compile 36, Build Tools 36.0.0, NDK 27.1.12297006, and the supported Expo/Gradle workflow. All seven accepted Maestro flows passed in separate fresh driver processes. Coverage includes lifecycle, cold persistence, offline launch, active/open-break termination recovery, finalization, Home/Calendar/Details/Reports, configured multiplier, effective profile, weekly crossing/no duplicate overtime, evidence neutrality and explicit recalculation, frozen provenance, finalized zero, missing/stale nonnumeric behavior, native sharing, and notification controls.

Manual platform checks passed Hebrew RTL, English LTR, light/dark, font scale 1.3, Back, picker and numeric keyboard behavior, backgrounding, and the real permission dialog. The log audit found no Shiftty fatal JavaScript, native, or SQLite match.

The notification reconciler now repairs persisted/native divergence after Android force-stop, and root startup registers foreground notification presentation. Direct native inspection observed one logical alarm, dedupe, cancellation, foreground delivery, background delivery, receiver delivery after a plain process kill, and exactly-one rescheduling after force-stop plus user relaunch.

Independent readback validated the Android PDF, CSV, ICS, and backup. ICS contained one event and no financial payload. Real DocumentsUI replace restore recovered the complex 33-shift V1 backup, active shift, and open break. Completing the restored shift preserved seven frozen snapshots deeply equal and created one new finalized snapshot. The database passed integrity and foreign-key checks.

## Physical iPhone results and blocker

The side-by-side Release QA bundle was signed with the existing Apple Development identity, installed, and launched without changing committed production identifiers. Deep/strict signing verification passed. No certificate was created or changed.

Direct observations passed onboarding, persistence, active/open-break background recovery, SIGKILL/cold recovery, clock-out/finalization, Reports, export UI, a real CSV share sheet, Hebrew RTL, English LTR, permission grant, one logical shift reminder, and relaunch dedupe. QA SQLite integrity was `ok` initially and finally, and matching crash-log queries found zero reports.

The foreground delivery banner was not captured. Background delivery, terminated delivery, notification tap, pre-trigger cancellation, and timezone variation were not directly verified. Database disappearance after trigger/reconciliation is not promoted to delivery evidence. Maestro could not enumerate physical iOS, and a temporary XCUITest runner could not install because the free development profile had reached its three-app limit. The protected dogfood app and unrelated apps were not removed.

The existing `com.omerportnoy.shifty` dogfood app was not installed over, launched, cleared, uninstalled, or modified. The QA app remains a separate container. This development-signed QA evidence does not prove production-bundle signing, an archive, TestFlight, App Store, or distribution readiness.

## Inherited iOS Simulator evidence

Milestone 5 remains authoritative for the disposable iOS Simulator Release artifact/readback and restore work. It independently parsed localized multi-page PDF, CSV, calendar-only ICS, and backup artifacts; exercised the real iOS document picker; replace-restored and cold-recovered an active shift/open break; completed the restored shift; preserved frozen history; and passed SQLite integrity/foreign-key checks. That work was not repeated because no iOS product-specific fix required it.

## Hosted CI, compatibility, and verdict

The workflow is least-privilege, non-deploying, secret-free, time-bounded, and credential persistence is disabled. It now includes release configuration and asset assertions. Documentation is committed before push and does not predict the run. The milestone handoff records the final SHA, workflow URL/run ID, and conclusion after the exact-SHA run.

No migrations, backup-envelope changes, salary-total changes, automatic historical recalculation, or persisted trust state were introduced. Existing public identifiers and frozen snapshots remain unchanged. The current 13 exact Expo SDK 57 patch notices and 16 transitive audit advisories remain dependency boundaries; no upgrade or forced audit fix was performed. A deterministic wrapper accepts only the reviewed Expo notice set and fails on drift.

Evidence-based verdict: `SOURCE_READY_NATIVE_BLOCKED`.

Android emulator evidence is complete. Required physical-iPhone notification delivery/cancellation/timezone evidence remains unavailable, so `BETA_READY` is not supportable. Physical Android, production signing, and store distribution also remain separate unverified surfaces.
