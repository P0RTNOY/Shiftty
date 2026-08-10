# Phase 7 Release Hardening Implementation Plan

**Goal:** Make the current planned Shiftty MVP a defensible release candidate without adding speculative product scope.

**Architecture:** Preserve the existing domain/repository/UI boundaries. Harden backup semantics at the orchestrator and schema boundary, keep unexpected diagnostics internal while presenting localized safe UI errors, correct export formats at their pure generators, and add only evidence-driven regression coverage. Native verification uses the existing iOS development client because no native dependency changes are planned.

**Tech Stack:** React Native, Expo Router 57, TypeScript, SQLite, Zod, Jest, Testing Library React Native, existing i18n/theme/components.

## Constraints

- Use TDD for every behavior change.
- Do not add dependencies or speculative post-MVP features.
- Preserve backward compatibility with existing version-1 backup files.
- Never expose database, native-module, invalid-time, or stack-trace diagnostics in production UI.
- Preserve user data transactionally; failed restore operations must leave the original database intact.
- Run the complete repository gate set and native walkthrough before the release-candidate claim.
- Destructive native actions remain subject to at-action user approval.

## Task 1: Complete backup and restore semantics

**Files:**
- Modify: `src/domain/entities/backup.ts`
- Modify: `src/domain/services/backup-orchestrator.ts`
- Modify: backup integration tests under `src/domain/services/`

- [x] Add failing tests for zero-valued optional money/time fields, workplace notification overrides, merge inclusion of app settings/prediction feedback/scheduled notification records, and transaction rollback.
- [x] Add a failing merge test proving an imported active shift is preserved only when no local active shift exists and a local/imported active conflict fails without mutation.
- [x] Add a failing recurrence semantic-duplicate test proving dependent exceptions, breaks, and salary snapshots reference the retained occurrence.
- [x] Extend backup v1 additively with defaulted workplace notification overrides so older version-1 files remain valid.
- [x] Replace lossy `|| null` persistence mappings with nullish mappings for valid zero values.
- [x] Complete merge coverage for omitted entities, strip native notification IDs, preserve local app-setting values on key conflicts, and remap all dependent references.
- [x] Run foreign-key and integrity checks inside replace/merge transactions and keep failures atomic.
- [x] Fix unsupported-version diagnostics and run focused backup/clear/delete/recurrence/active tests.

## Task 2: Harden export formats

**Files:**
- Modify: `src/domain/services/csv-generator.ts`
- Modify: `src/domain/services/csv-generator.test.ts`
- Modify: `src/domain/services/ics-generator.ts`
- Modify: `src/domain/services/ics-generator.test.ts`
- Modify: `src/domain/services/pdf-html-generator.test.ts`

- [x] Add failing CSV tests for formula-control prefixes in user text while retaining Hebrew BOM and generated negative-number behavior.
- [x] Add failing ICS tests for stable event UIDs and RFC 5545 75-octet folding with Hebrew/non-BMP text.
- [x] Implement byte-aware ICS folding without splitting Unicode code points and keep UTC timestamp semantics.
- [x] Add a long-report PDF HTML regression proving RTL, repeated table headers, page-break-safe rows, and complete escaped output.
- [x] Run focused export tests.

## Task 3: Safe error UX and major screen states

**Files:**
- Add: `src/shared/utils/report-unexpected-error.ts`
- Add: `src/shared/utils/report-unexpected-error.test.ts`
- Modify: affected routes under `src/app/`
- Modify: `src/__tests__/route-tree-safety.test.ts`
- Modify: translations only if a missing safe message is discovered

- [x] Add failing tests that unexpected errors are developer-logged without converting diagnostic text into user copy and that route sources do not pass caught `.message` values into alerts/text.
- [x] Replace raw onboarding, export, backup/restore, Shift Details, and data-clear diagnostics with localized safe messages plus contextual developer logging.
- [x] Make Calendar and Reports expose reasonable loading and localized error states without hiding retained data.
- [x] Ensure disabled mutation actions retain accessibility state while work is in progress.
- [x] Run focused route/error/state tests.

## Task 4: Release audit evidence

**Files:**
- Modify: `scripts/validate-migrations.cjs`
- Add or modify focused tests only where the audit proves a gap

- [x] Validate empty, v1-v5, and already-current v6 databases to latest with foreign-key and integrity checks.
- [x] Re-audit notification permission, planning, reconciliation, restart behavior, global settings, workplace overrides, and restored native-ID behavior.
- [x] Audit Home/timer/report/calendar query and render paths; optimize only a measured or obvious issue.
- [x] Audit screen-reader roles/labels, 44-point targets, dynamic text behavior, RTL direction, and picker labels.
- [x] Verify theme token contrast and smoke major screens in light and dark appearance.
- [x] Verify empty/loading/error/disabled behavior on Home, Calendar, Reports, Settings, Shift Details, and data/export routes.

## Task 5: Final native and automated release matrix

**Files:**
- Modify: `PROJECT_STATUS.md`
- Modify: `README.md`

- [x] Run all non-destructive iOS matrix flows supported by the existing simulator database, including restart/background recovery, cross-midnight, recurrence, reports, export/share, backup validation/merge, and major light/dark screens.
- [ ] At the action boundary, request approval for permanent shift deletion, destructive active cancellation, restore-replace, and clear-all; execute only approved actions.
- [x] Detect Android tooling/emulators and either run the practical Android matrix or document the exact external runtime blocker and remaining device checklist.
- [x] Run `npm run typecheck`, `npm run lint`, `npm test -- --runInBand`, `npm run validate:migrations`, `npx expo install --check`, `npx expo config --type public`, `npm run validate:expo`, and `git diff --check`.
- [x] Update `PROJECT_STATUS.md` and stale `README.md` claims with exact evidence, remaining physical-device limitations, and release readiness.
- [x] Review the complete diff, commit only the green hardening milestone, push `codex/initial-shifty-foundation`, and verify a clean 0-ahead/0-behind branch.
