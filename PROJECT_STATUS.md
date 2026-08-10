# Shiftty Project Status

Last updated: 2026-08-10

## Current milestone

Development is at the **RC1.5D navigation and secondary-surface completion** milestone on branch `codex/initial-shifty-foundation`. The four-tab navigation, Calendar creation access, simple monthly Reports, and functional Settings hierarchy are implemented and have passed automated and native iOS simulator acceptance.

The product foundation through Phase 6 is present in source: onboarding; workplaces, roles, salary profiles, pay rules, and templates; planned, completed, and live shifts; break tracking; deterministic salary calculation; monthly forecasts and reports; notifications; exports; backup and restore; Hebrew localization and RTL UI. RC1 reliability fixes and RC1.5A/B shift-form simplification have also been implemented.

This is not yet a final release-candidate claim. RC1.5E progressive-disclosure work, final release hardening, irreversible confirmation checks, and practical Android verification remain outstanding.

## Git baseline

- Branch: `codex/initial-shifty-foundation`
- Committed baseline before RC1.5D: `21382c41f3befef6b5cc786220e430913564b61a`
- Remote baseline: `origin/codex/initial-shifty-foundation` at the same commit
- Relationship before the RC1.5D commit: 0 committed changes ahead and 0 behind
- Working tree: focused RC1.5D implementation, tests, plan, and evidence update
- Latest committed milestone: `21382c4` (`feat(rc1.5): simplify core clock-in and active-shift experience`)

## Implemented and source-verified

- Phase 1 application shell, domain boundaries, SQLite persistence, RTL/localization foundation, and automated-test setup.
- Workplace, role, salary-profile, pay-rule, shift-template, shift, break-session, and settings persistence.
- Shift scheduling, completed-shift entry, live clock-in/out, breaks, cancellation/recovery, deletion, and live timers.
- Salary calculation, calculation snapshots, invalidation/recalculation handling, forecasts, reports, and export adapters.
- Onboarding, notification scheduling, data management, and backup/restore flows.
- RC1 reliability work including legacy-report invalidation, timestamp handling, deletion-state recovery, live timer behavior, and form/timezone corrections.
- RC1.5A/B UI work: simplified shift forms and native date/time picker integration.
- RC1.5C UI work: one dominant Home clock-in action, safe nearby-scheduled selection, minimal workplace ambiguity picker, compact monthly summary, simplified active/break state, and inline quick clock-out review with advanced-edit fallback.
- Interaction timestamps use the live system clock rather than the 30-second display clock. Completion is schema-validated before any write transaction, and live break calculations tolerate a one-tick UI/persistence boundary without accepting genuinely future events.
- RC1.5D UI work: four actual primary tab screens with the `/add-shift` deep link preserved outside the tab group; contextual Calendar creation in month/week/agenda; localized simple Reports with warning-first progressive salary disclosure and tappable shift list; and a five-row Settings hierarchy with a functional Reports & Backup hub.

## Automated validation baseline

These are the fresh RC1.5D validation results:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero warnings |
| `npm test -- --runInBand` | Passed; 79 suites and 321 tests, process exit 0 |
| `npm run validate:migrations` | Passed |
| Expo web export | Passed; 36 routes exported |
| `npx expo config --type public` | Passed |
| `npx expo install --check` | Passed; dependencies are SDK-compatible |
| `git diff --check` | Passed |

Resolved dependency alignment:

- `expo`: `~57.0.11`
- `expo-file-system`: `~57.0.2`
- `expo-notifications`: `~57.0.9`
- `expo-router`: `~57.0.11`
- `expo-sharing`: `~57.0.10`

The Jest lifecycle failure was root-caused to two tests replacing the entire `react-native` module with a partial `Platform` mock. That removed `TurboModuleRegistry`, causing Expo's lazy fetch initialization to warn during teardown. Removing the destructive mocks preserved the Jest Expo runtime and fixed the process exit without suppressing console output. The lint backlog was also reduced from 53 current warnings to zero.

## Native/manual verification

Fresh simulator build evidence:

- EAS build ID: `f838aae8-3a43-422b-8ae4-1144e22bcc38`
- Source commit: `bf7597a029874fc0d8b6a4c2032e98eef13cc49f`
- Profile: `development-simulator`
- Result: finished successfully on 2026-08-09 at 19:44:24Z
- Installation: installed as `com.shifty.app` on iPhone 17 Pro, iOS 26.5
- Metro: development-client bundler running over LAN on port 8081
- Current JavaScript bundle: local Metro source at the RC1.5D working tree; no new native dependency was introduced, so the existing simulator binary remains valid

Passed on iPhone 17 Pro / iOS 26.5:

- Fresh Hebrew/RTL onboarding created a workplace and salary profile; relaunch persistence passed without crypto, SQLite, foreign-key, raw database, or invalid-time errors.
- Completed-shift form remained collapsed by default, saved `08:00–16:00`, calculated 8 hours / ₪400, and persisted across process relaunch.
- Future cross-midnight shift saved with an explicit next-day message, persisted end greater than start, appeared on the start date in Calendar, and calculated 7 hours 30 minutes / ₪375 after the configured break.
- Equal start/end time was rejected explicitly.
- Native Hebrew date and 24-hour time pickers opened; cancel and confirm both worked; no ISO timestamp leaked into the UI.
- Home and Reports reconciled the completed and scheduled shifts to 15 hours 30 minutes and ₪775 without corruption warnings.
- Live timer advanced from the persisted `actualStart`, survived process termination/relaunch, and retained correct elapsed time.
- Unpaid break timing survived process termination/relaunch, caught up correctly, resumed work, and persisted its end.
- A separate sub-minute completed shift saved as 0 minutes / ₪0 and left Home and Reports valid.
- PDF generation opened an 18 KB native share sheet.
- CSV and ICS originally failed because Expo SDK 57 throws for deprecated `writeAsStringAsync`; the adapter now uses `File.write`, and native re-verification opened share sheets for both CSV and a 1 KB ICS file.
- JSON backup originally failed because SQLite `datetime('now')` app-setting timestamps were not ISO; timestamps are now normalized at the backup boundary, and native re-verification produced a 13 KB JSON backup.
- Restore originally failed because `readAsStringAsync` also throws under Expo SDK 57; the reader now uses `File.text`, and restore-merge completed successfully from the saved backup.
- Notification permission produced the native iOS prompt and was granted.
- Settings data/privacy rows are localized, and Settings subroutes now expose a working in-app Back action.
- Home presents one dominant `כניסה` action, secondary future/completed actions, and only compact completed-hours/earned metrics by default; prediction cards and technical salary breakdown fields are absent from the daily surface.
- Single-workplace clock-in started an unscheduled shift immediately with the correct workplace.
- With two active workplaces, clock-in opened `איפה עובדים עכשיו?`; selecting the second workplace started that workplace's active shift.
- A nearby scheduled fixture started directly from Home without opening the legacy start flow.
- The simplified active state showed workplace, status, live timer, clock-in time, subtle pay/expected end, `הפסקה`, and `יציאה` only.
- Active tracking survived a real process terminate/relaunch.
- Break start and resume both passed after native testing exposed and regression-covered the one-render-tick timestamp boundary.
- Quick clock-out showed in/out/total/pay, advanced edit opened the full editor and returned safely, and quick save completed both unscheduled and scheduled native test shifts.
- Native testing exposed the stale-display-clock completion defect for very short shifts; mutation timestamps now use the interaction clock, repository prevalidation prevents invalid writes, and the native retry passed.
- Stale-shift recovery appeared after relaunching a fixture made more than 16 hours old; `להמשיך מעקב` restored the active panel, and quick save completed it and returned to inactive Home.
- The tab bar visibly and accessibly exposes exactly four tabs—`בית`, `לוח שנה`, `דוחות`, `הגדרות`—announced by iOS as positions 1–4 of 4. Native inspection caught the initial hidden-tab implementation still announcing 5 positions; moving `/add-shift` outside the tab route group fixed it while preserving the URL.
- Calendar month, week, and agenda modes rendered existing fixtures and exposed `הוספת משמרת עתידית`; the action opened the scheduled form with the selected date, and tapping a shift opened its detail route.
- Reports opened on a localized `אוגוסט 2026` summary with 7 shifts, `33:53 שעות`, expected pay, and the incomplete-salary warning visible. Technical salary/filter breakdowns were absent until `פירוט שכר` was opened, then appeared and could be hidden again.
- Settings showed the five primary rows and `הגדרות מתקדמות` without the dead language/timezone affordance. `דוחות וגיבוי` opened the new hub, and both export and data-management routes opened with working Back navigation.

Still requiring native/manual verification:

- Confirm the irreversible actions for scheduled, completed, break-bearing, and cross-midnight shift deletion; each flow has reached the app's permanent-delete confirmation but was not executed without at-action approval.
- Confirm restore-replace and clear-all at their destructive confirmation boundaries; restore validation and merge already pass.
- Complete the destructive active-shift cancellation/recovery confirmation paths.
- Inspect keyboard avoidance and less common empty/error states on native iOS.
- Run practical Android validation where available after iOS reaches a stable candidate.

## Partial or not started

- RC1.5C: complete and published at `21382c4`.
- RC1.5D: complete with automated and native iOS acceptance recorded above.
- RC1.5E: progressive disclosure is only partial; some advanced concepts remain exposed in legacy screens.
- Release hardening and the final evidence matrix are not started.

## Safest next development step

Begin RC1.5E from the clean RC1.5D milestone with a route-by-route audit of Shift Details and Edit Shift, moving scheduled/actual/reporting comparisons and technical calculation metadata behind `פרטים נוספים` while preserving edit, recovery, and deep-link behavior.

## Recent development history

The latest committed milestones are:

- `21382c4` simplified Home clock-in, active/break tracking, and quick clock-out
- `e217003` unblocked native CSV/ICS export and JSON backup/restore and localized Settings navigation
- `8d5ec2d` removed native Metro require cycles from the notification imports
- `35c3842` recorded the simulator build checkpoint
- `bf7597a` completed the Phase 1 status documentation
- `7f0dd0e` eliminated the lint-warning backlog and modernized static adapter imports
- `7e96589` fixed the Jest Expo lifecycle mocks
- `9619017` aligned the five Expo SDK patch dependencies
- `a1abaa9` recorded the frontend audit and simplification plan
- `ac03fa7` final timezone and form UX corrections
- `c3beaff` simplified shift forms
- `eac332b` native date/time picker integration
- `8f8bc39` deletion recovery and live timers
- `a93b59c` invalid legacy report handling
- `2e537c9` timestamp corrections
- `cba05ea` onboarding integration
- `449212b` service-layer work
- `5539ec7` salary-column work
- `82fab00` crypto/router work
