# Milestone 9: Simple Salary UX

Implemented: 2026-09-05

## Outcome

This milestone reduces the number of decisions and equally weighted controls on Shiftty's salary, Shift Details, and Settings surfaces while preserving the existing calculation engine, effective-dated profiles, advanced rules, reports, exports, backups, and historical snapshots.

The product boundary is unchanged: Shiftty provides deterministic gross-pay estimates based on user-confirmed settings. It does not determine legal entitlement, interpret an employer agreement, calculate deductions, tax, pension, National Insurance, benefits, or net pay, and it does not claim Israeli labor-law compliance.

## Phase 1 — one weekly-rest decision

Weekly-rest setup now collects the exact recurring local window and one explicit pay choice:

- pay at a user-entered total rate; or
- track the interval without a basic premium.

One confirmation saves the schedule and compatible managed rule in a single SQLite transaction. Constraint errors and advanced managed-ID collisions roll the transaction back. The simple flow never overwrites an incompatible, disabled, effective-dated, stacking, or otherwise advanced rule. No weekday, sunset boundary, religion, entitlement, or 150% rate is inferred.

## Phase 2 — salary overview before the editor

Salary & premiums resolves the current effective profile for each workplace and shows a compact overview: profile, base hourly rate, overtime readiness, weekly-rest readiness, and holiday/special-date readiness. A single workplace does not need a redundant selector. Editing, effective-dated profile creation, history, and raw rules remain available through explicit edit and advanced-profile actions.

## Phase 3 — one special date, one exact rate

The common holiday/custom flow asks for name, type, exact start/end, and total rate, then saves the evidence interval and its managed pay rule atomically. Optional workplace/profile scope and source provenance remain under advanced options. A user can reuse the configured weekly-rest rate.

The managed rule uses `{ type: 'specialIntervalId', intervalId }`, so a rate for one holiday cannot affect a second holiday merely because their types match. Existing `holiday`, `weekend`, and generalized `specialInterval` rule JSON remains readable. Effective-dated profile versioning remaps managed exact-interval rule IDs without rewriting the interval identity.

## Phase 4 — Shift Details reads as a record

Shift Details presents information first. Salary starts collapsed with its trust/status label, estimated gross total, grouped effective tiers, premium, and warnings. One disclosure reveals the complete component and provenance explanation.

Only state-appropriate primary actions remain visible. Duplicate, cancellation/recovery, break repair, and permanent deletion live in one accessible More actions sheet; deletion still requires confirmation. Active shifts never expose permanent deletion.

## Phase 5 — four Settings destinations

The Settings root now contains exactly four plain-language destinations:

1. Workplaces
2. Salary & premiums
3. Notifications
4. Data & backup

Shift types remain reachable from Workplaces. Report exports, backup/restore, privacy, and suggestion-history clearing are grouped under Data & backup. Existing route paths remain usable; the former reports/backup hub redirects to the new data hub.

## Phase 6 — bilingual and RTL continuity

All new copy is available in Hebrew and English. Interaction tests exercise both locales for the salary overview, special-date form, Shift Details actions, and Settings hierarchy. Time values keep explicit left-to-right direction inside Hebrew UI, while labels, layout, and disclosure state follow the active locale.

## Compatibility and historical guarantees

- No database migration, dependency update, or Backup V1 envelope change is introduced.
- Existing pay-rule conditions remain readable; the exact-interval condition is additive JSON data.
- Salary arithmetic changes only when a user saves a new or changed rule.
- Finalized salary snapshots remain authoritative until explicit recalculation creates a new version.
- Existing result JSON, totals, and historical snapshots are not rewritten.
- Missing, incomplete, erroneous, and stale salary stays non-numeric; a valid finalized zero stays numeric zero.
- Reports, PDF, and CSV retain estimate terminology and unavailable-state behavior.
- ICS remains strictly calendar-only and contains no salary or trust data.

## Verification

The phase-by-phase focused gates and the final repository gate are recorded in `PROJECT_STATUS.md`. This milestone includes automated source verification only unless a separate native evidence record explicitly says otherwise.

## Recommended next milestone

Run a focused native usability and accessibility pass on the simplified paths, covering small screens, keyboard avoidance, Dynamic Type, VoiceOver, TalkBack, Hebrew RTL, English LTR, and destructive-action discoverability. Use the results to decide whether any remaining advanced surface should move deeper; do not remove calculation capability based on source tests alone.
