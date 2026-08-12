# Frontend Reduction Audit

**Audit date:** 2026-08-12
**Branch:** `codex/initial-shifty-foundation`
**Scope:** Every Expo Router surface under `src/app/`, its primary actions, all editable date/time inputs, and the monthly reporting/export path.

## Executive summary

Shiftty's strongest product loop is already clear: start or record work, review the result, and understand the pay outcome. The largest consistency risks were not missing features; they were competing representations of the same concepts:

- editable dates and times were plain text in several flows;
- Reports and Exports calculated overlapping monthly results differently;
- some date displays depended on the device locale or timezone;
- advanced salary setup exposed numeric weekday codes;
- suggestion application could save the device timezone and a zero hourly-rate snapshot.

This sprint removed those inconsistencies without restructuring the navigation. Reports now has one authoritative completed-shift monthly model, every editable date/time value uses the shared native picker contract, display formatting is centralized, and the highest-confidence workflow defects have regression coverage.

No dead primary action was found by the static route/action audit. The remaining reduction opportunities are lower-risk information-architecture improvements that should be driven by another dogfooding round rather than folded into this consistency pass.

## Product principles used in the audit

1. A shift should have one understandable lifecycle: planned, active, completed, then paid or awaiting salary calculation.
2. The same date, time, duration, and money value should look the same wherever it appears.
3. A monthly report should answer one question: what completed work and finalized pay belong to this month?
4. Setup complexity belongs in Settings; daily work should stay in Home, Calendar, and the active-shift flow.
5. Missing or stale financial data must be explicit. It must never silently become zero.
6. Primary actions use task language (`Start shift`, `Save shift`, `Export report`) and remain visually distinct from recovery or destructive actions.

## Surface inventory

The table covers every user-visible route. Layout files and redirects are listed separately afterward because they do not introduce another screen.

| Area | Route | Job and data shown | Primary actions | Audit result |
| --- | --- | --- | --- | --- |
| Home | `/(tabs)` | Today state, active shift, suggestions, recent context | Start, end, recover, apply suggestion | Keep as the daily command center. Shared formatting is now used for suggestion dates and times. |
| Calendar | `/(tabs)/calendar` | Day/week/month shift history and scheduled work | Change mode/date, open shift | Keep the three modes for now; formatting is centralized. Reassess mode usage after instrumentation. |
| Reports | `/(tabs)/reports` | Selected month, completed shifts, hours, finalized salary | Change month, export | Simplified in this sprint to the authoritative monthly report. Forecast and competing breakdown controls were removed. |
| Settings | `/(tabs)/settings` | Links to setup, privacy, exports, and data tools | Open a settings task | Keep as a hub. Daily actions do not belong here. |
| Onboarding | `/onboarding` | Product introduction and privacy posture | Continue | Keep. One decision per step. |
| Onboarding workplace | `/onboarding/workplace` | Initial workplace name/rate/currency/timezone | Save and continue | Keep; this establishes pay context required by the core loop. |
| Onboarding finish | `/onboarding/finish` | Completion confirmation | Start using Shiftty | Keep. No secondary setup detours. |
| Privacy | `/settings/privacy` | Local-first data and permission explanation | Return/open OS settings where applicable | Keep as trust documentation. |
| Reports & backup | `/settings/reports-backup` | Entry points for export/backup tasks | Open exports or data management | Candidate to merge into Settings if dogfooding shows the intermediate page adds no value. |
| Data management | `/settings/data-management` | Backup, restore, and destructive data actions | Backup, restore, delete | Keep separate because destructive actions need context and distance from daily use. |
| Exports | `/settings/exports` | Selected month's export formats | Change month, export PDF/CSV/ICS | Simplified to reuse the Reports model. PDF/CSV contain authoritative salary state; ICS is calendar-only. |
| Notifications | `/settings/notifications` | Global notification preferences | Enable/disable reminders | Keep. DF-013 copy interpolation is fixed. |
| Roles | `/settings/roles` | Role labels used by shifts/templates | Add, edit, archive | Keep as advanced setup. Consider progressive disclosure if usage is low. |
| Salary profiles | `/settings/salary` | Pay profiles and effective periods | Add, edit, archive | Keep as advanced setup. Density remains high and is a future split candidate. |
| Pay rules | `/settings/salary/rules` | Rule type, schedule, priority, and effective period | Add, edit, reorder/archive | Keep as advanced setup. Numeric weekday entry was replaced with named day controls. |
| Templates | `/settings/templates` | Reusable shift definitions | Add, edit, archive, start | Keep; templates shorten the daily flow. |
| Template detail | `/settings/templates/[id]` | One template's workplace, role, times, and recurrence defaults | Save, archive, start | Keep. Start/end fields now use native time pickers. |
| Workplaces | `/settings/workplaces` | Workplace identity, rate, timezone, and status | Add, edit, archive | Keep as required setup. Secondary actions may move to a detail screen after usage evidence. |
| Workplace notifications | `/settings/workplaces/[id]/notifications` | Per-workplace reminder overrides | Save overrides | Keep separate; this is an infrequent advanced task. |
| New shift | `/shifts/new` | Planned or completed shift details | Save | Keep. All editable date/time fields share the native picker contract. |
| Shift detail | `/shifts/[id]` | Schedule, actual work, breaks, duration, pay state | Edit, manage breaks | Keep as the canonical record view. Missing/stale salary remains explicit. |
| Edit shift | `/shifts/[id]/edit` | Editable schedule, actual work, pay range, recurrence | Save | Keep. Same form and picker behavior as New shift. |
| Breaks | `/shifts/[id]/breaks` | Recorded and manual breaks | Start/end break, add/edit/delete manual break | Keep. Overnight manual ranges now resolve against the shift timeline. |
| Start shift | `/shifts/start` | Workplace/template choice and start context | Start selected shift | Keep as a guided start path. |
| Unscheduled start | `/shifts/start/unscheduled` | Immediate start plus optional expected end | Start shift | Keep. Expected end uses native date/time controls and supports a true empty state. |
| End active shift | `/shifts/active/end` | Actual end time, optional manual pay range | End shift | Keep. Native date/time controls reduce validation errors. |
| Cancel active shift | `/shifts/active/cancel` | Consequences of discarding the active session | Confirm cancellation | Keep as a separate destructive confirmation. |
| Expected end | `/shifts/active/expected-end` | Optional expected-end reminder target | Save or clear | Keep for now. It may become a Home sheet after task-based native testing. |
| Apply suggestion | `/shifts/apply-suggestion` | Suggested schedule plus chosen workplace | Apply | Keep. Saving now uses the app timezone and the selected workplace rate. |

### Non-screen route files

`src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx`, and `src/app/onboarding/_layout.tsx` define navigation only. `src/app/index.tsx` routes to onboarding or Home after checking setup state, and `src/app/add-shift.tsx` redirects to New Shift. They add no duplicate user action. `src/app/(tabs)/index.tsx` is the Home screen counted above.

## Editable date/time inventory

The persisted field contract remains deterministic: dates use `YYYY-MM-DD`, times use `HH:mm`, and timestamps remain ISO values at repository boundaries. The UI no longer asks users to type those storage formats.

| Flow | Editable values | Current control | Empty-state behavior |
| --- | --- | --- | --- |
| New/edit shift | date; scheduled, actual, and payable start/end; recurrence end | Shared native date/time picker | Optional values remain empty until chosen and can be cleared. |
| Template detail | start and end time | Shared native time picker | Required values always show the saved/default time. |
| Active expected end | date and time | Shared native date/time picker | Optional target can be cleared without inventing a time. |
| End active shift | actual end; manual payable start/end | Shared native date/time picker | Manual range stays absent unless explicitly enabled/chosen. |
| Break management | manual break start and end | Shared native date/time picker | Existing value is preserved when Android picker dismissal occurs. |
| Unscheduled start | expected-end date and time | Shared native date/time picker | Optional expected end can remain absent. |
| Salary profiles | effective start/end dates | Shared native date picker | Open-ended profiles preserve a real empty end date. |
| Pay rules | time windows, specific dates, effective dates | Shared native date/time picker | Rule-type-specific optional values remain absent. |

Static regression coverage rejects raw editable fields with date/time semantics in the audited feature files. Android dismissal, iOS confirmation, clearing, error styling, accessibility labels, and locale-independent serialization are covered by focused component tests.

## Display-format consistency

| Concept | Canonical presentation | Applied to |
| --- | --- | --- |
| Compact date | Centralized locale-aware day/month formatter | Calendar, suggestions, report rows |
| Full date | Centralized locale-aware full-date formatter | Shift forms and detail context |
| Time | Centralized app-timezone formatter | Calendar, suggestions, reports, exports |
| Time range | One formatter and one separator convention | Calendar cards, report rows, PDF/CSV |
| Month | Centralized month/year formatter | Reports and Exports selectors |
| Missing salary | Empty/non-numeric value plus explicit state | Reports, CSV, PDF |
| Finalized zero salary | Numeric zero | Reports, CSV, PDF |

A static display audit now rejects the previously used device-locale and ISO-string-splitting shortcuts in the Calendar and suggestion surfaces.

## Monthly reporting source of truth

Reports, CSV, and PDF now load the same `MonthlyReport` model:

- selected-month boundaries are calculated in the app timezone;
- only completed shifts whose actual end belongs to that month are included;
- hours are derived from the completed shift timeline;
- finalized salary snapshots are authoritative;
- missing, incomplete, or stale salary snapshots remain non-numeric and carry an explicit state;
- a finalized salary of zero stays zero;
- CSV cells are formula-safe;
- PDF layout supports Hebrew RTL, English LTR, repeated table headers, multi-page output, and an early summary.

ICS intentionally exports calendar facts only. It does not claim to be a financial report.

## Action and density audit

### Keep prominent

- Start shift, end shift, save shift, add/edit break, change report month, and export report.
- These actions advance or complete the user's current task and use specific verbs.

### Keep but classify as advanced

- Salary profiles, pay rules, role management, per-workplace notification overrides, restore, and destructive data controls.
- They remain reachable from Settings and are not mixed into daily Home or Calendar tasks.

### Automate or derive

- Report totals, salary-state labels, month inclusion, shift duration, and timezone conversion.
- Users should never reconcile these by hand or select competing calculation modes.

### Merge or remove completed in this sprint

- Removed the competing forecast/filter/breakdown controls from Reports.
- Merged Reports and financial Exports onto one monthly domain service.
- Replaced numeric weekday entry with named weekday selection.
- Removed raw typed date/time storage formats from editable UI.
- Removed device-timezone and zero-rate assumptions from suggestion application.

### Remaining candidates, requiring dogfooding evidence

| Priority | Candidate | Why | Constraint before change |
| --- | --- | --- | --- |
| P2 | Split salary profile and pay-rule list/edit states | These are the densest forms and expose many actions at once. | Preserve reorder/effective-date behavior and verify the common edit path on a phone. |
| P2 | Fold expected-end editing into the active Home card | It could remove a navigation transition during an active shift. | Confirm that clearing and reminder explanation remain understandable. |
| P2 | Remove the Reports & backup intermediate page | Settings already links to closely related export/data tasks. | Verify that users still distinguish portable reports from backup/restore. |
| P2 | Move workplace secondary actions to a detail surface | The workplace list carries setup and lifecycle actions together. | Avoid slowing the common edit-rate/timezone task. |
| P3 | Reassess Calendar's day/week/month mode count | Three modes increase control density. | Collect dogfooding or analytics evidence; do not remove a useful planning view speculatively. |
| P3 | Normalize product naming to `Shiftty` | Existing docs/build traces also contain `Shifty`. | Coordinate bundle/display-name and release communication. |

There are no open P0/P1 frontend-reduction recommendations after this pass.

## Defects found while simplifying

| Finding | Impact | Resolution |
| --- | --- | --- |
| Notification warning rendered literal `{offsetMinutes}` | User-facing dogfooding defect DF-013 | Corrected both locale templates to the interpolation syntax used by the translation layer; regression tested. |
| Manual breaks after midnight were anchored to the shift's first calendar date | Overnight duration could be wrong | Resolve start/end on the shift timeline and roll forward across midnight; regression tested. |
| Suggestion application used device timezone and a zero rate snapshot | Saved shift context could disagree with the chosen workplace | Use the app timezone and selected workplace rate; regression tested. |
| Pay rules required numeric weekday codes | Advanced setup was error-prone and inaccessible | Replaced with localized named weekday controls; interaction tested. |
| Export queried raw shifts independently of Reports | Month, time, and salary output could disagree | Replaced with the authoritative monthly report service; unit, integration, CSV, and PDF tests added. |

## Validation evidence

- Full automated gate after the consistency fixes: 99 suites, 445 tests.
- TypeScript typecheck, ESLint, migration verification, Expo config/install checks, and static web export passed.
- Representative RTL PDF: 120 rows over four A4 pages, visually inspected on pages 1, 2, and 4 after rendering with Chromium and Poppler. Headers repeated, totals appeared early, Hebrew/currency rendered, and time ranges remained left-to-right.
- iOS Simulator and physical-device results are recorded in `DOGFOODING.md`; they are intentionally not inferred from automated tests.

## Recommended next dogfooding focus

Run the native task loop in this order: start an unscheduled shift, set/clear an expected end, add a break that crosses midnight, end the shift with a manual pay range, inspect it in Calendar, and export that month from Reports. This crosses the shared picker, timeline, formatting, salary-state, and export boundaries with one coherent scenario.
