# Shiftty Dogfooding UX Consistency Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove ordinary raw date/time entry, simplify high-frequency screens, rebuild the monthly report/export around authoritative data, fix DF-013, and produce a natively verified physical-iPhone dogfooding candidate.

**Architecture:** Keep persisted timestamps and salary semantics unchanged. Native picker components edit local calendar strings; existing timezone resolvers convert those strings to persisted instants. A shared monthly-report model becomes the sole presentation input for Reports, CSV, and PDF, while salary values continue to come from finalized snapshots/current salary coordinator results.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, TypeScript, React Hook Form, `@react-native-community/datetimepicker`, SQLite, Jest, Expo Print/Sharing.

## Execution status — 2026-08-12

The checklists below preserve the original implementation plan. Tasks 1–8 and the PDF/Simulator portions of Task 9 are complete. Application milestones were published as `2e4728f`, `4876ccc`, and `f4f916a`; final documentation is a separate follow-up milestone. The physical Release compiled through its embedded Hermes bundle but could not be signed or installed because the macOS login keychain was locked. `DOGFOODING.md` records the exact external action and rerun command.

## Global Constraints

- Work only on `codex/initial-shifty-foundation`; never push to `main` or force-push.
- Keep `Asia/Jerusalem` authoritative and never parse ambiguous user-entered date/time strings.
- Preserve scheduled, actual, payable, recurrence, salary, backup, and recovery semantics.
- Write and observe a failing regression before each behavior fix.
- Keep all tests outside `src/app`.
- Use one final physical-device build only after the full suite and iOS Simulator walkthrough pass.
- Implement only clear low-risk simplifications; document larger product reductions.

---

### Task 1: Canonical local date/time picker API and formatters

**Files:**
- Modify: `src/shared/components/date-field.tsx`
- Modify: `src/shared/components/date-field.test.tsx`
- Create: `src/shared/utils/date-time-format.ts`
- Create: `src/shared/utils/date-time-format.test.ts`
- Modify: `src/shared/components/index.ts`
- Modify: `src/shared/i18n/translations-phase2.ts`

**Interfaces:**
- Produces: `DateField` accepting `YYYY-MM-DD | undefined` and `TimeField` accepting `HH:mm | undefined`, with optional clear behavior.
- Produces: `formatCompactDate`, `formatFullDate`, `formatTime`, `formatTimeRange`, and `formatMonth` using explicit locale/timezone arguments.

- [ ] Add failing picker tests for localized weekday/time display, Android dismiss-without-commit, optional empty/clear state, disabled semantics, and local calendar extraction.
- [ ] Run `npm test -- --runInBand src/shared/components/date-field.test.tsx` and verify the new assertions fail for the old Date-valued API.
- [ ] Implement string-valued native picker fields, explicit cancel/confirm handling, 24-hour locale, accessibility, disabled state, and optional clearing.
- [ ] Add failing formatter tests for compact/full Hebrew dates, seconds-free time, cross-midnight `למחרת`, and device-timezone-independent `Asia/Jerusalem` formatting.
- [ ] Implement the shared formatter module and export the new controls.
- [ ] Run both focused suites, typecheck, lint, and `git diff --check`.
- [ ] Commit the green picker/formatter milestone as `fix(ui): standardize date and time inputs`.

### Task 2: Migrate every ordinary editable date/time field

**Files:**
- Modify: `src/features/shifts/components/shift-form.tsx`
- Modify: `src/features/shifts/components/shift-form.test.tsx`
- Modify: `src/features/templates/components/template-form.tsx`
- Create: `src/features/templates/components/template-form.test.tsx`
- Modify: `src/app/shifts/start/unscheduled.tsx`
- Modify: `src/app/shifts/active/expected-end.tsx`
- Modify: `src/app/shifts/active/end.tsx`
- Modify: `src/app/shifts/[id]/breaks.tsx`
- Modify: `src/app/settings/salary/index.tsx`
- Modify: `src/app/settings/salary/rules.tsx`
- Create: `src/features/shifts/screens/date-time-route-controls.test.tsx`
- Modify: `src/features/pay-rules/screens/salary-profile-form.test.tsx`

**Interfaces:**
- Consumes: string-valued `DateField` and `TimeField` from Task 1.
- Preserves: `resolveLocalDateTime` / `resolveLocalShiftRange` as the only persisted timestamp boundary.

- [ ] Add static/render regressions proving each audited field is exposed as a button/picker and no audited label is a text input.
- [ ] Run focused tests and verify failures identify expected-end, clock-out, break, template, salary-profile, and salary-rule raw fields.
- [ ] Replace raw date/time `FormField` usage with canonical pickers, including optional effective dates and manual payable times.
- [ ] Replace raw numeric weekend weekdays with localized weekday choices while preserving stored 0-6 values.
- [ ] Remove `HH:mm` / `YYYY-MM-DD` instructions from ordinary labels and keep validation at the domain boundary.
- [ ] Run focused suites, typecheck, lint, and `git diff --check`.

### Task 3: Consolidate read-only date/time presentation

**Files:**
- Modify: `src/features/shifts/components/shift-card.tsx`
- Modify: `src/features/shifts/components/shift-detail-view.tsx`
- Modify: `src/features/shifts/components/quick-clock-out-review.tsx`
- Modify: `src/features/shifts/components/active-shift-panel.tsx`
- Modify: `src/features/reports/report-shift-row.tsx`
- Modify: `src/app/shifts/[id]/breaks.tsx`
- Modify: existing focused component tests beside those files.

**Interfaces:**
- Consumes: shared formatters from Task 1.
- Produces: consistent compact/full/time/cross-midnight output with no seconds or ISO strings.

- [ ] Add failing assertions for the canonical compact/full/range output on Home, Details, Reports, and clock-out review.
- [ ] Replace route-local formatter combinations with shared formatter calls.
- [ ] Verify Hebrew weekdays, `למחרת`, and timezone-specific day preservation in focused tests.

### Task 4: Authoritative monthly report model

**Files:**
- Create: `src/features/reports/services/monthly-report.ts`
- Create: `src/features/reports/services/monthly-report.test.ts`
- Create: `src/features/reports/hooks/use-monthly-report.ts`
- Modify: `src/app/(tabs)/reports.tsx`
- Modify: `src/features/reports/financial-reports-screen.test.tsx`
- Modify: `src/features/reports/report-shift-row.tsx`

**Interfaces:**
- Produces: `MonthlyReport` with completed rows, workplace name, actual range, payable/worked minutes, break minutes, per-shift salary state, and totals.
- Consumes: persisted shifts plus `SalaryBatchResult.resultsByShiftId`; never recalculates salary.

- [ ] Write deterministic failing model tests for weekday, Saturday, cross-midnight, explicit/no break, multiple workplaces, valid zero salary, missing salary, and total parity.
- [ ] Implement the pure report builder using existing shift duration/range services.
- [ ] Add a hook that loads only the selected month and resolves salary through the existing coordinator.
- [ ] Simplify Reports to month, completed-shift count, worked hours, salary state, rows, and subordinate details; remove scheduled forecast and technical breakdown clutter from the default.
- [ ] Run focused report suites and verify totals remain identical to the report model.

### Task 5: Monthly PDF and CSV exports

**Files:**
- Create: `src/features/reports/services/monthly-report-export.ts`
- Create: `src/features/reports/services/monthly-report-export.test.ts`
- Modify: `src/domain/services/pdf-html-generator.ts`
- Modify: `src/domain/services/pdf-html-generator.test.ts`
- Modify: `src/app/settings/exports/index.tsx`
- Create: `src/features/reports/screens/monthly-report-export-screen.test.tsx`
- Modify: `src/shared/i18n/translations-phase4.ts`

**Interfaces:**
- Produces: `generateMonthlyReportCsv(report)` and `generateMonthlyReportHtml(report)` from the exact Task 4 model.
- Consumes: existing `generateCsv`, `processPdf`, and `shareFile` adapters.

- [ ] Write failing export tests for stable Hebrew columns, BOM, injection protection, no internal IDs/ISO strings, missing-salary wording, totals, and 120-row multipage HTML.
- [ ] Implement professional RTL HTML with repeated table header, sensible A4 margins, clear summary, numeric LTR cells, page numbering, and no mandatory signature block.
- [ ] Replace direct SQLite `SELECT *` export code with the shared monthly-report hook/model and add a clear month selector.
- [ ] Add a single subordinate monthly-export entry from Reports while keeping ICS as an advanced separate export.
- [ ] Prove Reports, PDF, and CSV use the same deterministic totals fixture.
- [ ] Commit the green report milestone as `fix(reports): rebuild monthly hours report presentation`.

### Task 6: DF-013 and contained dogfooding fixes

**Files:**
- Modify: `src/shared/i18n/translations-phase5.ts`
- Modify: `src/shared/i18n/translations.test.ts`
- Modify: `src/domain/services/notification-planner.test.ts`
- Modify additional files only for reproducible P0/P1 or contained P2 findings discovered during the sprint.

**Interfaces:**
- Preserves: `t(key, params)` double-brace interpolation contract.

- [ ] Add a failing translation regression showing the physical reminder body must contain `60` and no brace token.
- [ ] Correct both Hebrew and English templates to use the established double-brace syntax.
- [ ] Run translation and notification planner/reconciler suites.
- [ ] Commit as `fix(notifications): interpolate reminder offset correctly`.

### Task 7: Safe UI reduction and evidence matrix

**Files:**
- Modify: `src/features/shifts/components/shift-detail-view.tsx`
- Modify: `src/app/(tabs)/index.tsx`
- Modify: `src/app/(tabs)/calendar.tsx`
- Modify: `src/app/(tabs)/settings.tsx`
- Modify: `src/app/settings/workplaces.tsx`
- Modify focused screen/component tests.
- Create: `docs/frontend-reduction-audit.md`

**Interfaces:**
- Preserves: all recovery and domain capabilities.
- Changes: hierarchy only—one primary action, advanced/overflow placement, and removal of duplicated technical metadata from default views.

- [ ] Inventory every route, visible action, and repeated data element as CORE/AUTO/SECONDARY/ADVANCED/MERGE/REMOVE_FROM_DEFAULT/REMOVE.
- [ ] Add failing UI tests for each chosen safe simplification.
- [ ] Demote duplicate/edit/recovery/technical actions without deleting the underlying operations.
- [ ] Record implemented changes, deferred recommendations, rationale, frequency, risk, and the ranked top ten reductions.
- [ ] Commit as `refactor(ui): reduce redundant actions and information` and `docs: record UX reduction audit` as appropriate.

### Task 8: Status documentation and complete automated verification

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `DOGFOODING.md`
- Modify: `DOGFOODING_ISSUES.md`

- [ ] Record the field inventory, migrations, report architecture, UX reductions, DF-013 resolution, further findings, and remaining P2/P3 work.
- [ ] Run `find src/app \( -name "*.test.*" -o -name "*.spec.*" \) -print` and require no output.
- [ ] Run the complete requested validation suite and capture exact suite/test counts.
- [ ] Inspect `git status`, the complete diff, and `git diff --check`; stop before publishing if a required gate fails.

### Task 9: PDF and iOS native acceptance, publication, and physical build

**Files:**
- Modify documentation from Task 8 with final native/build evidence only.

- [ ] Generate a deterministic 120-row monthly PDF, render every page to PNG, inspect a contact sheet plus full-resolution pages, and verify Hebrew/RTL/table/totals/multipage layout.
- [ ] Build/install the current source on the iPhone 17 Pro simulator and walk through Home idle/active/break, Add/Edit Shift, Calendar, Details, Reports, Settings, and actual PDF preview.
- [ ] Verify every audited editable date/time field as Picker/Automatic/Read-only and capture screenshots/evidence.
- [ ] Commit and push the final green source/docs milestone to `origin/codex/initial-shifty-foundation`.
- [ ] Build one standalone signed physical-iPhone Release with the established Personal Team workflow; install only after every prior gate passes.
- [ ] Record Git SHA, app version/build, bundle ID, signing expiry, artifact identifier, remote ahead/behind, and clean-tree state.
