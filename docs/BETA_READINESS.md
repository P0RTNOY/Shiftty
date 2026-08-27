# Beta readiness

Status date: 2026-08-27

Branch: `codex/external-native-evidence-closure`

Milestone base: `c2730d7cda7e08fd99631d2e91438862468f9222`

Final product-bearing source candidate: `58ab0820cda2d8ff79eee886b87758d5000a8232`

Original full native-matrix candidate: `f89d798fb68769a0b5a819fbf0d8c3467134b9fc`

Final source SHA: recorded in the milestone handoff after exact-SHA hosted verification

## Product and legal boundary

Shiftty is a Hebrew-first, local-first shift and gross-pay estimation assistant with English support. Salary trust remains deterministic: `unavailable`, `basic_estimate`, or `configured_estimate`. Missing, incomplete, erroneous, and stale calculations remain nonnumeric; a legitimate finalized zero remains numeric zero. Historical snapshots and provenance remain frozen until explicit recalculation.

The estimator does not fully model statutory weekly overtime, automatic holiday or religious-calendar status, weekly-rest entitlement, employer permits or agreements, tax, National Insurance, pension, deductions, benefits, or net pay. It is not payroll, legal advice, or an Israeli labor-law compliance product. PDF and CSV use estimate/missing/stale terminology; ICS is strictly calendar-only.

Milestone 6 adds no salary concept, entitlement, premium, migration, backup-envelope version, automatic recalculation, or public identifier change. It fixes two reproduced Android local-notification defects and one hosted portability defect in the existing deterministic fall-back overlap rule, then adds verification automation/documentation.

## Evidence summary

| Evidence class | Result | Boundary |
| --- | --- | --- |
| Source automation before final docs | Passed | 138/138 suites, 693/693 tests; focused overlap tests pass under four host timezones; final exact-commit gate still required |
| iOS Simulator | Inherited passed evidence | Milestone 5 Release artifact readback, real document-picker restore, semantic backup comparison, and database checks |
| Android emulator | Passed | Isolated API 36 ARM64 Release build and full runtime/notification/export/restore matrix |
| Physical iPhone | Partial pass | Side-by-side QA Release lifecycle, RTL/LTR, share sheet, permission, scheduling/dedupe, and database health passed; required notification delivery/cancellation/timezone states remain unverified |
| Physical Android | Not tested | No physical Android device was supplied or required to substitute for the authorized emulator |
| Hosted GitHub Actions | Rerun pending | Run 33068224029 exposed the host-timezone overlap defect after earlier steps passed; exact final SHA must pass the existing non-deploying workflow |
| Production signing/distribution | Not tested | QA development signing is not production-bundle/archive/TestFlight/App Store/Google Play evidence |

## Android closure

An isolated user-local toolchain provided API 36, Build Tools 36.0.0, Platform Tools 37.0.1, Emulator 37.1.11, NDK 27.1.12297006, CMake 3.22.1, and the API 36 `google_apis` ARM64 image. A Release `com.shifty.app` APK built, installed, and passed all seven Android Maestro journeys using fresh driver processes.

Direct runtime coverage includes fresh Hebrew onboarding and English onboarding/persistence, offline cold launch, live shift/open-break process recovery, finalization and report surfaces, 150% shift type, effective-dated weekly threshold crossing without duplicate overtime, evidence neutrality/rule/recalculation/frozen history, finalized zero, Hebrew/English, RTL/LTR, light/dark, increased font, native pickers/keyboards, system Back, and permission UI.

Android notification delivery was directly observed foregrounded, backgrounded, and after a plain process kill. Scheduling, dedupe, cancellation, and force-stop/relaunch reconciliation were inspected natively and in SQLite. The two reproduced defects—stale native IDs after force-stop and suppressed foreground presentation—were fixed with focused tests.

Production UI generated PDF, CSV, calendar-only ICS, and backup artifacts through real Android native workflows. Independent parsing passed. DocumentsUI replace-restored the established complex V1 backup; cold relaunch restored the active shift/open break; completing it preserved seven historical snapshots and created exactly one new snapshot. SQLite integrity was `ok` with zero foreign-key violations. Full hashes and semantic results are in [`MILESTONE_6_EXTERNAL_NATIVE_EVIDENCE.md`](MILESTONE_6_EXTERNAL_NATIVE_EVIDENCE.md).

## Physical iPhone boundary

An exact-product Release built with the existing Apple Development identity and installed side-by-side on the iPhone 15 Pro Max, iOS 26.6, as `com.omerportnoy.shifty.m6qa`. The production dogfood bundle and database were never touched.

Direct QA passed onboarding/persistence, background and SIGKILL/cold active-break recovery, clock-out/finalization, Reports, a native CSV share sheet, English LTR, Hebrew RTL, permission grant, one-reminder scheduling, and relaunch dedupe. QA SQLite integrity remained `ok`, and no matching crash report was found.

The physical foreground banner was not captured, and background/terminated delivery, notification tap, pre-trigger cancellation, and timezone variation were not directly verified. Maestro could not enumerate physical iOS, while a temporary XCUITest runner was blocked by the free profile's three-app device limit. No dogfood or unrelated app was removed to bypass it. This is the remaining native blocker.

## Source, CI, dependencies, and rollback

The GitHub Actions workflow remains read-only, secret-free, non-deploying, time-bounded, and disables checkout credential persistence. It includes release configuration and asset assertions aligned with `release:preflight` without repeating the complete Jest suite. Run `33068224029` at `9dccc7b216f35d04df0f9f311ed13154855f56f7` passed install, release configuration, typecheck, and lint, then failed the ambiguous Jerusalem fall-back test under the hosted timezone. The reproduced correction selects the earlier valid target-zone instant independently of the host. After the final documentation commit, only this branch may be pushed, and the exact SHA must obtain one successful hosted run before handoff.

The Expo SDK 57 dependency graph is intentionally unchanged. The raw compatibility check reports 13 exact patch notices; release preflight and CI use a deterministic reviewed-pair wrapper that fails if the set changes. `npm audit --omit=dev` reports 16 transitive Expo/Metro developer-toolchain advisories: 12 moderate and 4 high. No compatible non-force repair exists; no forced downgrade is approved.

There is no OTA channel. Stop distributing a defective artifact and build a higher native version from the last verified commit. Never silently downgrade or rewrite a populated SQLite schema. Preserve the complete SQLite container before recovery and use only validated transactional restore.

## Verdict

Evidence-based verdict: `SOURCE_READY_NATIVE_BLOCKED`.

The Android runtime gap is closed, and the physical lifecycle/signing path is substantially proven without touching dogfood. Beta readiness is still blocked because the required physical-iPhone notification delivery/cancellation/timezone matrix is incomplete. Hosted CI is also pending until the exact final commit is pushed and observed. Production signing and store submission remain separate, unauthorized work.
