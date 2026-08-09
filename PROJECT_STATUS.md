# Shiftty Project Status

Last updated: 2026-08-09

## Current milestone

Development is at the **native iOS simulator RC1/RC1.5A-B acceptance and blocker-remediation** milestone on branch `codex/initial-shifty-foundation`. The automated hardening phase is complete; RC1.5C implementation has not begun.

The product foundation through Phase 6 is present in source: onboarding; workplaces, roles, salary profiles, pay rules, and templates; planned, completed, and live shifts; break tracking; deterministic salary calculation; monthly forecasts and reports; notifications; exports; backup and restore; Hebrew localization and RTL UI. RC1 reliability fixes and RC1.5A/B shift-form simplification have also been implemented.

This is not yet a release-candidate claim. The non-destructive iOS simulator acceptance matrix is substantially complete and the native defects it exposed have been remediated and re-verified. Irreversible delete/replace checks still require at-action approval, and practical Android verification remains outstanding.

## Git baseline

- Branch: `codex/initial-shifty-foundation`
- Current committed HEAD before the native-remediation milestone: `8d5ec2d5093838a7d4346b55d1e7747068a6d899`
- Remote baseline before the native-remediation milestone: `origin/codex/initial-shifty-foundation` at the same commit
- Relationship before the native-remediation milestone: 0 commits ahead and 0 behind
- Working tree before native acceptance: clean
- Latest source-validation milestone: `8d5ec2d` (`fix: remove native Metro require cycles`)

## Implemented and source-verified

- Phase 1 application shell, domain boundaries, SQLite persistence, RTL/localization foundation, and automated-test setup.
- Workplace, role, salary-profile, pay-rule, shift-template, shift, break-session, and settings persistence.
- Shift scheduling, completed-shift entry, live clock-in/out, breaks, cancellation/recovery, deletion, and live timers.
- Salary calculation, calculation snapshots, invalidation/recalculation handling, forecasts, reports, and export adapters.
- Onboarding, notification scheduling, data management, and backup/restore flows.
- RC1 reliability work including legacy-report invalidation, timestamp handling, deletion-state recovery, live timer behavior, and form/timezone corrections.
- RC1.5A/B UI work: simplified shift forms and native date/time picker integration.

## Automated validation baseline

These are the fresh native-remediation validation results:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero warnings |
| `npm test -- --runInBand` | Passed; 75 suites and 300 tests, process exit 0 |
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
- Current JavaScript bundle: local Metro source at the native-remediation working tree; no new native dependency was introduced, so the existing simulator binary remains valid

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

Still requiring native/manual verification:

- Confirm the irreversible actions for scheduled, completed, break-bearing, and cross-midnight shift deletion; each flow has reached the app's permanent-delete confirmation but was not executed without at-action approval.
- Confirm restore-replace and clear-all at their destructive confirmation boundaries; restore validation and merge already pass.
- Complete active-shift cancellation/recovery confirmation paths.
- Inspect keyboard avoidance and less common empty/error states on native iOS.
- Run practical Android validation where available after iOS reaches a stable candidate.

## Partial or not started

- RC1.5C: unified Home and active-shift experience is not started.
- RC1.5D: Calendar, Reports, Settings, and navigation simplification is not started.
- RC1.5E: progressive disclosure is only partial; some advanced concepts remain exposed in legacy screens.
- Release hardening and the final evidence matrix are not started.

## Safest next development step

Commit and push the focused native-remediation milestone after reviewing the complete diff. Preserve the simulator backup and acceptance data, then either execute the pending irreversible confirmations with at-action approval or continue the independent RC1.5C Home/active-shift redesign while keeping those acceptance rows explicitly open.

## Recent development history

The latest committed milestones are:

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
