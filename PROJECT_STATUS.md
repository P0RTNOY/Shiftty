# Shiftty Project Status

Last updated: 2026-08-10

## Current milestone

Development is at the **Phase 7 release-hardening checkpoint** on branch `codex/initial-shifty-foundation`. RC1.5A-E is implemented, tested, natively walked through on iOS, committed, and pushed. The release-hardening implementation is published at `5ab90a7`.

The current planned MVP is source-complete and its automated gates are green. Non-destructive iOS release-candidate flows have also passed. A final release-candidate claim remains gated by explicit approval for four destructive simulator checks and by practical Android execution, for which no emulator/device runtime is available locally.

The product direction remains: **powerful engine, extremely simple interface**, with the everyday flow centered on `כניסה → הפסקה → יציאה` while scheduled/actual/payable ranges, salary snapshots and rules, recurrence, templates, predictions, notifications, exports, backup/restore, and recovery stay available underneath.

## Git baseline

- Branch: `codex/initial-shifty-foundation`
- Release-hardening implementation: `5ab90a7` (`fix(rc): harden data integrity and native recovery`)
- Progressive frontend simplification: `b407191` (`feat(rc1.5): complete progressive frontend simplification`)
- Both commits are published to `origin/codex/initial-shifty-foundation`.
- No dependency or native-module change was introduced during Phase 7.

## Implemented and source-verified

- Expo Router application shell, Hebrew-first RTL UI, automatic light/dark theme, SQLite migrations and repositories, Zod domain schemas, and deterministic service boundaries.
- Onboarding; workplaces, roles, salary profiles, pay rules, and shift templates.
- Planned, completed, recurring, and live shifts; deletion relationships; break tracking; expected-end and stale-shift recovery; process-restart restoration.
- Salary rate resolution, overtime/rules, payable-time calculation, immutable calculation snapshots, recalculation/invalidation, monthly summaries, forecasts, and reports.
- Four-tab navigation (`בית`, `לוח שנה`, `דוחות`, `הגדרות`) with contextual shift creation and progressive disclosure of technical details.
- One-tap clock-in when selection is unambiguous, a minimal workplace picker when it is not, live active/break state, and inline quick clock-out review.
- Native date/time pickers and simplified completed/future shift forms, including explicit cross-midnight and equal-time behavior.
- Templates, deterministic suggestions/prediction feedback, recurrence materialization and scoped occurrence edits.
- Local notification planning, persisted metadata, permissions, global preferences, workplace overrides, native reconciliation, and startup/navigation/foreground lifecycle reconciliation.
- PDF, CSV, ICS, JSON backup export, restore merge/replace, clear-all orchestration, and migration validation.

## Phase 7 hardening evidence

- Backup v1 remains backward-compatible while now including workplace notification overrides and exact entity counts.
- Backup validation checks duplicate keys, relational references—including embedded recurrence-template references—active/open-break invariants, foreign keys, integrity, and replace counts.
- Replace and merge run atomically. Merge covers app settings, prediction feedback, notification metadata, workplace overrides, recurrence children, collision remapping, and active-shift conflict preflight. Native notification IDs are deliberately stripped on export/restore.
- Zero-valued money and duration fields survive semantic round trips. The real-SQLite test adapter now proves rollback instead of simulating transaction success.
- CSV protects user text beginning with spreadsheet formula control characters while preserving the Hebrew BOM and generated negative numbers.
- ICS uses stable shift UIDs, UTC timestamps, escaped text, and UTF-8-aware RFC 5545 line folding. Long RTL PDF output is covered for multiple pages and repeated headers.
- Unexpected diagnostics are logged with operation context while production routes show safe localized messages. Calendar, Reports, notification settings, and workplace overrides expose loading/error/disabled states.
- Notification reconciliation retries metadata without native IDs, applies preferences per workplace, keeps missed-clock-in reminders independent, and runs on startup, navigation, and foreground. Native schedule/cancel failures are logged without corrupting shift data.
- Accessibility coverage includes roles, labels, switch/disabled state, 44-point targets, picker state, week-calendar navigation, and RTL ordering. Sixteen light/dark foreground pairs meet WCAG AA text contrast in automated tests.
- Migration validation covers empty, v1, v2, v3, v4, v5, and already-current v6 databases with foreign-key and integrity checks.
- Native testing exposed and regression-covered a recurrence SQL placeholder/schema drift defect, a just-started active-salary timestamp boundary, and stale Home month data after quick clock-out.

## Automated validation

Fresh results after the final pre-commit review fixes:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero warnings |
| `npm test -- --runInBand` | Passed; 83 suites, 378 tests, 0 skipped, process exit 0 |
| `npm run validate:migrations` | Passed for empty and v1-v6 databases |
| `npm run validate:expo` | Passed; 36 static routes exported |
| `npx expo config --type public --json` | Passed; iOS and Android identifiers resolve to `com.shifty.app` |
| `npx expo install --check` | Passed; dependencies are SDK-compatible |
| Expo Router test leak check | Passed; no test/spec files under `src/app` |
| `git diff --check` | Passed |

Current SDK-aligned packages include Expo `~57.0.11`, Expo Router `~57.0.11`, Expo FileSystem `~57.0.2`, Expo Notifications `~57.0.9`, and Expo Sharing `~57.0.10`.

## Native iOS build and verification

Development-client evidence:

- EAS build ID: `f838aae8-3a43-422b-8ae4-1144e22bcc38`
- Build source commit: `bf7597a029874fc0d8b6a4c2032e98eef13cc49f`
- Profile: `development-simulator`
- Installed bundle: `com.shifty.app`
- Runtime: iPhone 17 Pro simulator, iOS 26.5
- Metro: development-client bundle over LAN
- The build predates later JavaScript commits but contains every current native dependency; no rebuild is required for Phase 7 JavaScript changes.

Passed natively on iOS:

- Fresh onboarding, workplace/salary creation, process relaunch, and persisted state.
- Completed `08:00–16:00`, future `16:00–00:00`, cross-midnight `22:00–06:00`, explicit equal-time rejection, Calendar placement, Reports totals, and restart persistence.
- Hebrew date picker, 24-hour time picker, cancel/confirm, RTL rendering, and no ISO text leakage.
- One-tap scheduled/single-workplace clock-in, ambiguous workplace selection, live timer, break/resume, background/foreground catch-up, active-shift and active-break relaunch restoration, stale-shift recovery, and quick clock-out.
- Four-tab navigation; Home, Calendar month/week/agenda, Reports disclosure, Settings hierarchy, Shift Details, Edit, New Shift, and Active Shift in major light/dark states.
- Recurrence creation produced two weekly occurrences; editing one occurrence persisted a modified exception without changing the other occurrence. Database foreign-key and integrity checks remained clean.
- Notification permission, persisted native IDs, restart reconciliation, global settings, and workplace override disable/restore behavior.
- PDF, CSV, ICS, and backup all opened native share sheets. Backup output contained shifts, recurrence state, notification metadata with native IDs stripped, and valid counts. Restore merge passed.

## Remaining native/manual verification

These actions are intentionally not executed without approval at their destructive confirmation boundary:

- Permanently delete disposable scheduled, completed, break-bearing, and cross-midnight shifts and verify all dependent views refresh.
- Destructively cancel/discard a disposable active shift and verify recovery semantics.
- Restore-replace from a validated backup, which overwrites the simulator database.
- Clear all simulator data, then restore the preserved fixture backup.

Lower-risk physical-device follow-up remains useful for notification delivery timing, calendar import interoperability, share targets, keyboard avoidance, and dynamic-text extremes.

## Android blocker

Android execution is externally blocked in the current environment:

- `adb` is installed, but `adb devices -l` reports no connected device.
- No Android `emulator` or `avdmanager` executable is available.
- No local Android Virtual Device is configured.

Remaining Android checklist: install/build the development client, onboarding, native date/time picker, clock-in/break/clock-out and restart recovery, completed/future/cross-midnight shifts, navigation, Calendar/Reports, notifications, export/share, backup/restore, and light/dark RTL smoke testing.

## Release readiness and next step

There is no known P0/P1 source or iOS non-destructive blocker. The current build is suitable for controlled iOS dogfooding and release-candidate testing, but final RC completion is not claimed yet.

The safest next step is to obtain one explicit batch approval for the four destructive iOS simulator checks above, execute them against disposable/preserved fixture data, restore the simulator to a usable state, and record the results. Android remains a separately documented external-runtime gate.

## Recent development history

- `5ab90a7` hardened backup/restore, exports, notifications, safe errors, accessibility, migrations, recurrence persistence, and active salary recovery
- `b407191` completed RC1.5E progressive frontend simplification
- `94c6d8b` simplified navigation, Calendar, Reports, and Settings
- `21382c4` simplified Home clock-in, active/break tracking, and quick clock-out
- `e217003` unblocked native CSV/ICS and backup/restore flows
- `8d5ec2d` removed native Metro notification-import cycles
- `35c3842` recorded the successful iOS simulator build
- `7f0dd0e` eliminated the lint-warning backlog
- `7e96589` fixed the Jest Expo lifecycle failure
- `9619017` aligned Expo SDK patch dependencies
- `ac03fa7`, `c3beaff`, `eac332b`, and `8f8bc39` completed RC1.5A/B reliability and form simplification
- `a93b59c`, `2e537c9`, `cba05ea`, `449212b`, `5539ec7`, and `82fab00` contain the principal RC1 report/onboarding/runtime fixes
