# Beta readiness

Status date: 2026-08-28

Branch: `codex/physical-ios-notification-verification`

Milestone base: `8c33ee4de27bbb1d13e30d81261d903526488c74`

Initial notification-response fix: `2c69b0d6b56bb57d9906360a2557c70fea8bdf0d`

Final product-bearing and tested source: `cca7c2b17f84bdc437eb5a5b9ea63f13aa172a7d`

The final documentation SHA and exact-SHA hosted result are recorded in the milestone handoff.

## Product and legal boundary

Shiftty is a Hebrew-first, local-first shift and gross-pay estimation assistant with English support. Salary trust remains deterministic: `unavailable`, `basic_estimate`, or `configured_estimate`. Missing, incomplete, erroneous, and stale calculations remain nonnumeric; a legitimate finalized zero remains numeric zero. Historical snapshots and provenance remain frozen until explicit recalculation.

The estimator does not fully model statutory weekly overtime, automatic holiday or religious-calendar status, weekly-rest entitlement, employer permits or agreements, tax, National Insurance, pension, deductions, benefits, or net pay. It is not payroll, legal advice, or an Israeli labor-law compliance product. PDF and CSV use estimate/missing/stale terminology; ICS is strictly calendar-only.

Milestone 7 adds no salary concept, entitlement, premium, migration, backup-envelope version, automatic recalculation, dependency upgrade, or public identifier change. It closes physical-iPhone evidence and fixes only defects reproduced in notification response routing and QA cleanup order.

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

The Expo SDK 57 dependency graph is intentionally unchanged. The raw compatibility command reports the reviewed 13 patch notices, while the repository wrapper accepts only that exact set and fails on drift. `npm audit --omit=dev` retains 16 transitive Expo/Metro developer-toolchain advisories: 12 moderate and 4 high. No forced downgrade or dependency update was performed.

The existing GitHub Actions workflow is non-deploying and must pass for the exact final SHA after this documentation is committed. No post-success commit is permitted. The workflow result belongs in the handoff because documentation must be committed before the run.

There is no OTA channel. Rollback means stop distributing a defective artifact and build a higher native version from the last verified commit. Never silently downgrade or rewrite a populated SQLite schema; preserve the complete container and use only validated transactional restore.

## Verdict

All required physical notification scenarios and device cleanup/restoration pass. If the final local gate passes and hosted CI succeeds for the exact final SHA, the handoff verdict becomes `BETA_READY`. That verdict means evidence supports a controlled beta candidate; it does not mean production signing, archiving, TestFlight, store review, or distribution occurred.
