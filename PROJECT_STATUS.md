# Shiftty Project Status

Last updated: 2026-08-10

## Current milestone

Development is in a **dogfooding freeze** on branch `codex/initial-shifty-foundation`. RC1.5A-E and Phase 7 are implemented, tested, committed, and pushed. The four approved destructive iOS Simulator checks have been completed against disposable data, including a regression repair discovered by the native deletion pass. No new product phase or feature work is active.

The planned MVP is source-complete, all automated gates are green, and the iOS Simulator RC is approved for controlled dogfooding. Practical Android execution remains externally blocked because no emulator, AVD, or physical device is available locally; this is an environment limitation, not a repository failure.

The product direction remains: **powerful engine, extremely simple interface**, with the everyday flow centered on `כניסה → הפסקה → יציאה` while scheduled/actual/payable ranges, salary snapshots and rules, recurrence, templates, predictions, notifications, exports, backup/restore, and recovery stay available underneath.

## Git baseline

- Branch: `codex/initial-shifty-foundation`
- Freeze-entry HEAD: `29ea3743f015df1c2020fa4757423bceb6433d6c` (`docs: record destructive iOS RC verification`)
- Remote state at freeze entry: `origin/codex/initial-shifty-foundation` pointed to the same commit; ahead/behind was `0/0` after fetch.
- Published dogfooding HEAD: the documentation-only commit containing this status (`docs: prepare Shiftty for dogfooding`), directly on top of the freeze-entry HEAD; its exact SHA is reported in the dogfooding handoff.
- Published remote state: the local branch and `origin/codex/initial-shifty-foundation` are aligned at ahead/behind `0/0` after the dogfooding documentation push.
- Completed-shift deletion repair: `9bf6c0c` (`fix(shifts): delete completed shifts without scheduled times`)
- Release-hardening implementation: `5ab90a7` (`fix(rc): harden data integrity and native recovery`)
- Progressive frontend simplification: `b407191` (`feat(rc1.5): complete progressive frontend simplification`)
- These commits are published to `origin/codex/initial-shifty-foundation`.
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

Fresh results after the destructive native pass and completed-shift deletion repair:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero warnings |
| `npm test -- --runInBand` | Passed; 84 suites, 379 tests, 0 skipped, process exit 0 |
| `npm run validate:migrations` | Passed for empty and v1-v6 databases |
| `npm run validate:expo` | Passed; 36 static routes exported |
| `npx expo config --type public` | Passed; iOS and Android identifiers resolve to `com.shifty.app` |
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

Latest successful simulator verification: 2026-08-10 on iPhone 17 Pro with iOS 26.5. The complete non-destructive matrix, all four destructive checks, final backup restore, database integrity/foreign-key checks, Home/Calendar/Reports rendering, and cold-restart persistence passed.

### Destructive iOS Simulator release-candidate checks

Scope was limited to disposable Shiftty data on the iPhone 17 Pro simulator running iOS 26.5. The preserved external backup remained at `shiftty_backup_2026-08-09.json`; its SHA-256 stayed `706c356953843a4dbdb20fc156028f3e314b7db9c23dee012cc0ca348ed4c941` throughout.

Permanent deletion:

- A standalone scheduled shift deleted successfully; its row and scheduled-notification metadata were absent afterward.
- The first completed, break-bearing, and completed cross-midnight deletion attempts reproduced `RangeError: Invalid time value`. SQLite rolled each attempt back cleanly with `PRAGMA integrity_check = ok` and no foreign-key violations.
- Root cause: Shift Details formatted a recurrence local date unconditionally, although actual-only completed shifts have no scheduled timestamp. Commit `9bf6c0c` limits that calculation to recurring shifts and adds a screen-level regression test.
- Native retest passed for an actual-only completed shift, a completed shift with a persisted break, and a cross-midnight scheduled shift. Shift rows and dependent salary snapshots, break sessions, and notification records were removed. Home, Calendar, and Reports refreshed without stale entities.

Active cancel/discard:

- Pre-state had no active shift. A disposable unscheduled active shift was created for the secondary workplace and then removed through **Delete the new shift** plus destructive confirmation.
- The active row and all dependent break, snapshot, and notification rows were absent afterward; the active count returned to zero. Home, Calendar, and Reports remained render-safe.
- The development client briefly surfaced a caught salary-dashboard diagnostic during the deletion transition, but no stale entity or persisted corruption remained; the final cold restart was clean.

Restore-replace:

- Pre-state contained 2 workplaces, 1 salary profile, 12 shifts, 3 breaks, 1 recurrence series, 1 recurrence exception, 10 salary snapshots, and 6 notification records.
- Replace restored the preserved backup to exactly 1 workplace, 1 salary profile, 4 shifts (3 completed, 1 scheduled), 1 break, 3 salary snapshots, 3 notification records, 1 app-setting record, and no recurrence or active-shift records. Backup/live entity ID sets and notification logical keys matched exactly.
- The disposable secondary workplace, recurrence series, previously deleted scheduled shift, and discarded active shift were absent, proving replacement rather than merge.
- Restore is enclosed in one SQLite transaction, validates integrity and declared counts before commit, and has integration coverage for rollback after an injected mid-replacement write failure. Native execution produced a complete backup state with no hybrid rows.
- Workplace/salary-profile, shift/workplace, break/shift, snapshot/shift, and notification/shift reference checks all returned zero invalid references. `PRAGMA integrity_check` returned `ok`; `PRAGMA foreign_key_check` returned no rows.

Clear-all and final restore:

- Clear-all reduced every intended application table to zero rows while preserving all six schema migrations. SQLite integrity remained `ok` and foreign-key violations remained zero.
- The app returned to the welcome/onboarding flow with no active-shift or old-data UI. The preserved backup remained externally accessible with the same hash.
- A temporary onboarding workplace/profile was created only to regain the in-app restore screen; restore-replace then removed both temporary IDs and restored the preserved backup exactly.
- The final simulator database again contains 1 workplace, 1 salary profile, 4 shifts, 1 break, 3 salary snapshots, and 3 notification records, with no active shift. A terminate/launch cycle reopened the populated Home screen; Calendar and Reports rendered the restored data.

## Remaining native/manual verification

All planned iOS Simulator destructive and non-destructive RC checks are complete. Lower-risk physical-device follow-up remains useful for notification delivery timing, calendar import interoperability, share targets, keyboard avoidance, and dynamic-text extremes, but none is a P0/P1 blocker for controlled simulator-based iOS dogfooding.

## Android blocker

Android execution is externally blocked in the current environment:

- `adb` is installed, but `adb devices -l` reports no connected device.
- No Android `emulator` or `avdmanager` executable is available.
- No local Android Virtual Device is configured.

Remaining Android checklist:

- Install/build the development client and confirm cold-start persistence.
- Complete onboarding and workplace/salary-profile creation.
- Verify native date/time pickers, completed/future/equal-time/cross-midnight shifts, and permanent deletion cascades.
- Verify clock-in, active timer, break/resume, clock-out, active discard, stale recovery, and process-restart restoration.
- Exercise Home, Calendar month/week/agenda, Reports, Settings, and major light/dark RTL states.
- Verify notification permission, scheduling, preferences, workplace overrides, and foreground/startup reconciliation.
- Verify PDF/CSV/ICS share flows, backup export, restore merge/replace, clear-all, final restore, SQLite integrity, and foreign keys.

## Release readiness and freeze rule

There are zero known iOS P0/P1 blockers. The iOS Simulator RC is approved for controlled dogfooding; the simulator is left populated from the preserved backup and passes restart, integrity, foreign-key, Home, Calendar, and Reports checks.

During the dogfooding freeze, use the existing candidate and record findings in `DOGFOODING_ISSUES.md`; do not start another product phase. When an Android runtime becomes available, execute the checklist above and record platform-specific findings; Android remains a separately documented external-runtime gate rather than an iOS RC failure.

## Recent development history

- `29ea374` recorded the completed destructive iOS Simulator verification and RC approval
- `9bf6c0c` fixed actual-only completed-shift deletion and added screen-level regression coverage
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
