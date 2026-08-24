# Autonomous Product Dogfooding Audit

**Audit date:** 2026-08-14–15
**Branch:** `codex/initial-shifty-foundation`
**Simulator:** iPhone 17 Pro, iOS 26.5, bundle `com.shifty.app`
**Scope:** Product dogfooding, core-flow simplification, salary trust, reporting/export consistency, error/empty states, accessibility, and route-by-route review.

## Method

This audit is based on repeated use of the running iOS development client, not source review alone. The working loop was:

1. launch or deep-link the current running bundle;
2. perform the worker task;
3. capture the screen/accessibility state, Metro output, and SQLite state where relevant;
4. reproduce an inconsistency;
5. trace the authoritative domain/repository path;
6. add a failing regression;
7. implement the contained repair;
8. rerun focused validation and reopen the native screen.

Simulator data is disposable. Physical-iPhone data was not modified during this pass; the phone is reserved for the one final non-destructive signed-build retest after the branch is green and pushed.

## Baseline evidence

- Initial commit: `8bc21d01ae980e0a9449b14bab2d12d869b504d8`.
- Initial branch state: clean and synchronized (`0` ahead / `0` behind).
- Baseline checks passed: typecheck, ESLint, all 99 suites / 445 tests, migration validation, Expo install/config checks, and static route validation. The final source gate passed 105 suites / 469 tests plus the same type, lint, migration, dependency, config, lockfile, diff, and 36-route static-export checks.
- The iPhone 17 Pro Simulator was reset once at the beginning, the current development client was launched, and Metro remained attached for runtime warnings.
- The active SQLite database was inspected directly for shift, break, salary-snapshot, onboarding-setting, integrity, and foreign-key evidence.

## Dogfooding loop log

| Journey | What was exercised in the running app | Observed result | Change or disposition |
| --- | --- | --- | --- |
| A — New user | Fresh launch, welcome, workplace/rate setup, completion, Home; then restore populated data | Setup originally required a redundant finish screen. Stored onboarding formats were inconsistent across migration/launcher paths. | Completion is now atomic with workplace/profile creation; the required form routes directly to Home; parsed compatibility handles both stored forms. The final fresh walkthrough stored boolean `true`, reached Home directly, and the integrity-checked populated database was restored byte-for-byte. |
| B — Clock in | One-workplace Home → **כניסה**, timer advance, background/foreground, lock/reopen | One-tap start was obvious and active state persisted. The hero exposed the technical phrase **התחלה בפועל**. | Core copy is now **כניסה**. No extra start step added. |
| C — Break | Start, wait, background, cold terminate/relaunch, resume, start another break | Working/break state, both timers, and persistence remained coherent. Break and resume were one tap. | No lifecycle repair required in this pass. |
| D — Clock out | End tracked shift with two breaks, inspect review, save, Home, Reports, SQLite | Review displayed ₪1.00 while the authoritative finalized shift/Home/Reports displayed ₪2.00. | Preview now freezes on the exact captured clock-out instant and suppresses obsolete live results. In the native retest, a ₪1.00 review stayed unchanged across another wall-clock minute and finalized as ₪1.00; Home and Reports agreed. |
| E — Edit completed shift | Open Details/Edit, change visible break, open Advanced, inspect salary/details/SQLite | Actual break became zero, reporting break remained one, salary stayed stale at ₪2.00; raw engine version/ISO metadata was visible. | An advanced correction retired the old snapshot and finalized ₪3.00 from three payable minutes. A second edit changed only the visible break to one minute; the hidden reporting break followed and a new finalized two-minute/₪2.00 snapshot appeared. Home, Reports, Details, and SQLite agreed; explicit-override preservation and metadata removal also passed natively. |
| F — Add future shift | Created a scheduled 08:00–16:00 Saturday shift, opened Advanced, enabled weekly recurrence, limited it to two occurrences, saved, and inspected both dates | Recurrence stayed out of the normal form, defaulted to the chosen weekday, and materialized exactly 22 and 29 August. | Pass. The Calendar month, week, and list views all exposed the scheduled occurrences without adding them to completed totals. |
| G — Edit shift | Date, time, break, workplace, reporting override, salary recalculation paths reviewed | Shared native controls were visually clear, but their accessibility value was absent. | Shared controls now announce the displayed value. The native accessibility tree exposed the localized date and both displayed time values. |
| H — Calendar | Used month, week, and list modes with completed, cross-midnight, and recurring scheduled shifts | The selected-day list rendered `17:20–יום א׳ 5:20`; both recurring Saturdays appeared in month/list and the week grid placed the first at 08:00. The screen answered “when am I working?” without financial noise. | Keep all modes pending broader usage evidence; their information hierarchy was coherent in populated data. |
| I — Reports | Populated month with weekday/Saturday, cross-midnight, break, multiple workplaces, overtime, incomplete salary; PDF/CSV/ICS export | August loaded in 757 ms with 5 completed shifts, 27:33 paid hours, ₪525/₪780 finalized rows, and one explicit incomplete row. The representative cross-midnight export initially hid the end date. | Natural grammar implemented. PDF/CSV now include the next local date on cross-midnight exits; the final one-page RTL PDF rendered cleanly and CSV kept BOM, local values, explicit status, and an empty missing-salary cell. |
| J — Settings | Settings hub plus every destination opened through native deep links; primary/secondary surfaces inspected | Top-level grouping was clear. Salary/pay-rule and workplace action surfaces remain dense. Templates emitted a nested-list runtime error; Backup Restore exposed English implementation terms. | Templates scroll ownership fixed and natively retested. Backup copy localized. Larger settings reductions remain recommendations. |

## Route and interface-complexity review

Counts describe the normal visible state dogfooded on the phone-sized Simulator. Picker confirmations, tab-bar destinations, and calendar day cells are not counted as competing primary actions. Dynamic list-row counts are noted separately.

| Screen / route | Primary-looking actions | Secondary / row actions | Main visible information pieces | Technical/domain language exposed | Classification and result |
| --- | ---: | ---: | ---: | --- | --- |
| Home `/(tabs)` | 1 | 1 plus Settings shortcut | 5 | Previously “actual start” | **CORE.** One-tap clock in retained; empty copy now gives a concrete next step. |
| Calendar `/calendar` | 0 | 5 navigation/mode controls plus shift rows | 4 groups | None in normal state | **CORE/SECONDARY.** Keep modes pending usage evidence. |
| Reports `/reports` | 1 export | 2 month controls, shift rows, conditional salary-settings link | 4 summary/row groups | Salary state only when actionable | **CORE.** Headline now answers hours/pay first with natural grammar. |
| Settings `/settings` | 0 | 7 grouped rows | 2 groups | Advanced group explicitly separated | **SECONDARY hub.** Clear hierarchy. |
| Onboarding welcome `/onboarding` | 1 | 0 | 4 | None | **CORE one-time.** Copy is longer than necessary; recommendation only. |
| Onboarding workplace `/onboarding/workplace` | 1 | 0 | 4 | None | **CORE one-time.** Required name/rate only; direct-to-Home now. |
| Onboarding finish `/onboarding/finish` | 1 | 0 | 3 | None | **REMOVE from normal flow.** Compatibility fallback retained. |
| Workplaces `/settings/workplaces` | 1 save/create | Up to 4 per workplace | 6+ per row/form | Salary profile relationship remains implicit | **ADVANCED.** Move row actions to detail/overflow later. |
| Workplace notifications `/settings/workplaces/[id]/notifications` | 0 | 1 switch | 3 | “Override” is not shown | **ADVANCED.** Appropriately small. |
| Roles `/settings/roles` | 1 | Edit/archive per row | 4 | Alternate rate | **ADVANCED.** Empty state understandable. |
| Salary `/settings/salary` | 1 save | Workplace/profile selection and profile actions | 7+ | Profile, effective range, break/rounding policy | **ADVANCED and dense.** Preserve capability; simplify IA later. |
| Pay rules `/settings/salary/rules` | 1 save | 8 rule-kind choices plus conditional controls | 8+ | Priority, basis, threshold, multiplier | **ADVANCED and densest screen.** No broad rewrite in this sprint. |
| Templates `/settings/templates` | 1 add | Archive toggle and row actions | 3 plus rows | None | **SECONDARY/AUTO.** Nested scroll warning fixed; footer remains stable. |
| Template editor `/settings/templates/[id]` | 1 save | Back, weekday choices | 6 | None | **SECONDARY.** Reasonable for reusable setup. |
| Notifications `/settings/notifications` | 1 permission action when needed | Switches and offset choices | 6+ grouped | Expected-end concept in advanced settings | **ADVANCED.** 0/1/N copy fixed. The no-permission state exposed a clear explanation and one **אפשר התראות** action. |
| Reports & Backup `/settings/reports-backup` | 0 | 0 | 0 | None | **COMPATIBILITY REDIRECT.** Removed from normal navigation on 2026-08-23; Settings exposes Export and Backup/Restore directly. |
| Exports `/settings/exports` | 3 export actions | Back and 2 month controls | 4 format groups | CSV/ICS/PDF file types are appropriate | **SECONDARY.** Formats have distinct jobs; no merge. |
| Data Management `/settings/data-management` | 3 | Back; restore strategy confirmation | 3 groups | Previously Merge/Replace | **ADVANCED/destructive.** Plain Hebrew choices implemented. |
| Privacy `/settings/privacy` | 0 | Back | 4 text sections | None | **INFORMATION.** Clear but text-heavy. |
| Add Shift `/shifts/new` | 1 save | Back, Advanced | 5 normal fields | None in normal state | **CORE.** One inferred past/future form retained. |
| Shift Details `/shifts/[id]` | 1 edit | Details, duplicate, delete/status-dependent actions | 6 normal pieces | Reporting hours only when they differ | **CORE record.** Duplicate/delete are overflow candidates. |
| Edit Shift `/shifts/[id]/edit` | 1 save | Back, Advanced | 5 normal fields | Reporting/salary overrides only in Advanced | **CORE correction.** Hidden values now preserve intent and recalc money. |
| Breaks `/shifts/[id]/breaks` | 1 add/manual action | 2 actions per break | 3 summary/list groups | Paid/unpaid distinction | **ADVANCED.** Per-row actions are overflow candidates. |
| Start selector `/shifts/start` | 1 unscheduled start or scheduled rows | Back | 2 | None | **CORE fallback.** One-workplace normal case bypasses it. |
| Unscheduled start `/shifts/start/unscheduled` | 1 start | Back, Advanced | Workplace plus one disclosed optional group | None in normal state | **SECONDARY fallback.** Role/template/expected end/title/notes moved under Advanced on 2026-08-23. |
| Clock Out `/shifts/active/end` | 1 complete | Back plus reporting choices | 6+ | Reporting time when advanced route is chosen | **CORE/ADVANCED.** Normal Home quick review remains minimal. |
| Cancel Tracking `/shifts/active/cancel` | 0–1 recovery | Back plus destructive alternatives | 2 | Tracking consequences in user language | **RECOVERY.** Now inaccessible without an active shift. |
| Expected End `/shifts/active/expected-end` | 1 save | Back | 2 fields | Expected end | **ADVANCED.** Inline-sheet candidate; now guarded when stale. |
| Apply Suggestion `/shifts/apply-suggestion` | 1 apply when available | Cancel/reject | 3 | Confidence internals remain hidden | **AUTO/SECONDARY.** Empty state was clean. |

Navigation-only layouts do not add screens. `/add-shift` is a compatibility redirect to `/shifts/new`; it displayed the unified form. The route sweep also verified a no-suggestion state and stale active-route behavior. All 29 user-visible destinations above were rendered/reviewed in the current Simulator build; active-state variants remain part of the final tap walkthrough.

## Button/action classification

### Core

- **כניסה**, **הפסקה**, **חזרה לעבודה**, **יציאה**.
- Add/save shift.
- Month report export.
- Save required setup changes.

### Secondary

- Add Shift from Home, Advanced disclosure, calendar modes/month navigation, report row opening, and Settings task rows.

### Overflow candidates

- Duplicate/Delete on Shift Details.
- Edit/archive/roles/notifications on each Workplace row.
- Change type/Delete on every historical break.

### Automatic

- Workplace selection when exactly one workplace exists.
- Past/future classification from date/time.
- Reporting-time mirroring only while actual/reporting values have not intentionally diverged.
- Salary finalization after completed-shift edits.
- 0/1/N reminder-copy selection.

### Merged/removed in this sprint

- Removed the onboarding finish screen from the normal flow (route retained for compatibility).
- Removed raw engine version and ISO timestamp from salary details.
- Prevented invalid active-route actions by returning stale routes to Home.
- Removed English Merge/Replace labels from the Hebrew restore flow.
- Delegated Templates scrolling to its list instead of stacking two vertical scroll containers.

## Tap-count findings

Counts include navigation/action taps but exclude typing text. Picker open/confirm taps are counted during the final Add Shift walkthrough.

| Flow | Before | Current | Result |
| --- | ---: | ---: | --- |
| Fresh onboarding after text entry | 2 action taps | 1 | Finish confirmation removed; the required form action goes directly to Home. |
| One-workplace clock in | 1 | 1 | Target met. |
| Start break | 1 | 1 | Target met. |
| Resume work | 1 | 1 | Target met. |
| Quick clock out | 2 | 2 | **יציאה** then **שמירה**; advanced reporting remains optional. |
| Add past/future shift from a selected Calendar date | Separate mode selection was previously a candidate | 3 normal actions: Add, workplace, Save | The unified form infers completed versus scheduled from the range. |
| Add cross-midnight shift | Separate mode selection was previously a candidate | 7 actions plus wheel gestures: Add; open/confirm each time; workplace; Save | The next-day hint appears as soon as end precedes start. |
| Add a two-occurrence weekly shift | Recurrence was a possible competing normal action | 6 actions after selecting the date: Add, workplace, Advanced, recurrence, occurrence-limit field, Save | Recurrence remains available but subordinate. |

## Salary trust evidence

- The salary engine/repository snapshot is the authority; no UI-specific salary arithmetic was added.
- The reproduced short shift finalized with two payable minutes and `total_gross_pay_minor = 200`; Home, Reports, PDF, and CSV all showed ₪2.00 after save.
- The pre-save review divergence was isolated to its timestamp input and fixed at that boundary.
- Historical edits now create a new current finalized snapshot, and forced recalculation cannot reuse the snapshot it is replacing.
- The two-step native repair proof passed: zero reporting break → three payable minutes → ₪3.00, then a visible one-minute break mirrored to reporting time → two payable minutes → ₪2.00. Each save retired the prior current snapshot, finalized a new one, and agreed across Home, Reports, Details, and SQLite.
- A 12-hour cross-midnight shift was recalculated after adding an eight-hour threshold rule: base pay remained ₪720, the premium became ₪60, and the finalized total became ₪780.
- A zero-rate workplace exposed a dashboard defect where a persisted incomplete snapshot reappeared as ₪480 from an old rate snapshot. Completed incomplete states now remain nonnumeric with or without the snapshot; the native retest shows only `חישוב שכר חסר`.

## Report/export evidence

- PDF: one-page Hebrew RTL monthly report for five completed shifts, with multiple workplaces, 30-minute and one-minute breaks, ₪780 overtime total, explicit unavailable salary, and an unambiguous `17:20-2026-08-09 5:20` cross-midnight range. Visual rendering showed no clipping or broken RTL.
- CSV: UTF-8 BOM, CRLF rows, local dates/times, `2026-08-09 5:20` on the overnight exit, explicit final/incomplete states, and an empty salary cell for the incomplete row.
- ICS: valid calendar-only completed-shift event and no financial claim.
- The production HTML generator's existing 120-row regression remains multipage-safe; the native representative month fit on one clean page.

## Empty and error states

| State | Observed behavior | Result |
| --- | --- | --- |
| No nearby shift | Home says a planned shift can be added and will appear there | Improved. |
| No completed Reports rows | Explains that hours/pay appear after completing a shift | Improved. |
| No templates | Explains templates add repeat shifts quickly; one add action | Pass. |
| No suggestion | “אין הצעות זמינות” with Cancel | Pass. |
| No active shift on active-only route | Previously endless/invalid/destructive states | Fixed; all redirect to Home. |
| Missing/stale salary | Never serialized as numeric zero; points to salary setup | Pass in populated Reports, PDF, and CSV. A newly found incomplete-dashboard numeric leak was fixed and retested natively. |
| Notification permission not granted | The screen explains why notifications help and exposes one **אפשר התראות** action while keeping the configured reminder state visible | Pass. System-prompt acceptance and delivery remain in the final notification journey. |
| Known repository/form errors | Localized generic user copy; no raw SQLite/RangeError/stack text on audited screens | Pass in exercised paths. |

## Accessibility and ergonomics

- Primary buttons are 56 points high; secondary buttons are 48 points; chip/radio controls use at least 44-point height.
- Date/time buttons now expose the current displayed value in the accessibility tree.
- Destructive actions use destructive styling and confirmation where data changes.
- The app remained correctly RTL in the captured Home, Calendar, Reports, forms, Settings, and PDF output.
- No visible text clipping was found on the phone-sized screenshots; active-only stale routes previously produced a clipped loading title and are now removed from that state.
- Dynamic Type extremes and Android picker execution remain unverified.

## Defects and fixes

Detailed reproduction and integrity notes are in [`DOGFOODING_ISSUES.md`](../DOGFOODING_ISSUES.md), DF-019 through DF-033. The money-critical cluster is DF-019–DF-022 and DF-031. The P1 route/setup/export cluster is DF-023, DF-029, and DF-033. Contained P2 repairs cover notification/report grammar, accessibility values, technical metadata, Templates scroll ownership, and Backup Restore language.

## Remaining acceptance work

- Commit logical milestones, push, and verify clean `0` ahead / `0` behind.
- Build/install one final signed physical-iPhone Release without replacing its real SQLite data; complete DF-013 0/1/N delivery retest.
