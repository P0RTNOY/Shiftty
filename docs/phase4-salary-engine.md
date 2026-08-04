# Phase 4 salary engine

This document fixes the calculation policies implemented in Phase 4. The engine produces gross estimates from user configuration; it does not calculate tax, National Insurance, pension, or net salary.

## Money and rate resolution

All stored monetary values are integer minor units. Multipliers are integer basis points (`10000 = 100%`). Segment pay is calculated as:

```text
hourly rate minor × minutes × multiplier basis points ÷ (60 × 10000)
```

The profile selects one centralized fractional-minor-unit rounding mode: half-up, floor, or ceiling. The engine accumulates exact rational base and premium amounts, then assigns each segment the delta of the rounded cumulative amount. Therefore adding an equivalent-rate boundary cannot change the shift total. Base pay and premium pay are rounded as separate additive components.

The hourly rate hierarchy is deterministic:

1. Explicit shift hourly-rate override.
2. A completed shift's resolved historical rate snapshot, after the first salary calculation has frozen the winning rate, unless the user explicitly requests recalculation with current settings.
3. A matching date-specific rate rule.
4. Role rate override.
5. Effective workplace salary profile rate.
6. Workplace fallback rate.

Zero is not treated as a valid resolved rate. A missing rate produces an error issue and no gross total; it never produces a finalized zero-paid shift.

Changing an existing profile's hourly rate requires a new effective-from date. The repository closes the prior version, inserts the new version, copies its pay rules with deterministic version IDs, and advances the workplace default reference in one SQLite transaction; it does not overwrite the historical rate row or silently drop configured rules.

## Rules, priority, and stacking

Enabled, effective rules are sorted by descending priority, descending condition specificity, then ascending stable rule ID. Database row order cannot affect the result.

For matching non-stacking multiplier rules, the first sorted rule wins. Equal-priority, equal-specificity matches also produce a conflict warning. Stacking rules add only their premium over 100%:

```text
150% non-stacking winner + 125% stacking rule = 100% + 50% + 25% = 175%
```

Fixed bonuses and reimbursements apply once per rule per shift. Explicit shift values replace profile defaults and configured rules for that component; an explicit zero therefore excludes the component. Minimum-duration rules add a labeled monetary adjustment and never alter recorded timestamps or worked minutes.

Salary-profile bonus and travel defaults take precedence while a profile exists. Workplace defaults are the fallback when there is no applicable profile. Multipliers below 100% are rejected because Phase 4 models premiums, not deductions.

## Time, breaks, and segmentation

- Completed shifts use the finalized payable range and payable break deduction.
- Scheduled shifts use the scheduled range and expected break. A profile can mark that expected break paid or unpaid.
- Active calculations use actual start through the supplied current or expected end and remain provisional.
- Paid break sessions are reported but not deducted. Unpaid sessions or the finalized payable-break override are deducted.

The engine builds boundaries rather than iterating minute by minute. Boundaries include the source endpoints, local midnight, time-window and weekend transitions, holiday intervals, unpaid breaks, and worked-minute thresholds. Fractional minutes caused by second-bearing timestamps are carried across boundaries so partitioning conserves the whole-range minute count. Cross-midnight and DST durations are calculated from absolute instants, while weekday/date/window conditions use the salary profile timezone.

Per-shift and per-local-day thresholds are supported with independently configurable gross or net accumulation. Cross-midnight ranges are split at local midnight. Monthly orchestration sorts shifts chronologically and reallocates every prior work interval into the current calculation timezone before applying a daily threshold. Worked intervals remain available even when an earlier shift has no resolvable rate, so missing salary configuration does not erase time from a later overtime threshold. Finalizing a completed shift includes earlier completed shifts from that calculation-local day. When an earlier completed shift or its break sessions change, Migration 4 conservatively marks its finalized snapshot and later completed shifts in the possible affected daily window stale so frozen overtime results cannot remain silently obsolete. Weekly accumulated thresholds are intentionally deferred; the condition model can be extended with another accumulation scope later.

The engine accepts holiday intervals through an injected `HolidayProvider` and never performs network access. The Phase 4 forms support user-defined full local dates, while an offline provider can supply named intervals. No mandatory Israeli legal rule or bundled authoritative holiday calendar is applied automatically.

Financial period queries use status-aware ranges: completed shifts use payable time, scheduled shifts use scheduled time, and active shifts use actual time. Hourly segments are allocated to the reporting period containing their local segment date. A per-shift bonus, reimbursement, or minimum-duration adjustment belongs to the local date on which the salary source range begins. This prevents cross-month shifts from being counted in full in both months. Active provisional results remain available by shift ID but are excluded from finalized dashboard/report aggregates.

Profile effective dates, segment dates, and fixed-component report dates all use the selected salary profile's calculation timezone. Migration 4 clones a legacy profile and its rules when Phase 1 data shared it across workplaces. Unattached legacy profiles remain preserved and readable, but cannot be selected until associated with a workplace.

## Snapshots and recalculation

Migration 4 uses a hybrid snapshot:

- Indexed summary columns support reports.
- Validated result JSON preserves segments, explanations, issues, rule IDs, calculation time, and engine version.
- One partial unique index permits one current snapshot per shift.
- Older versions remain as history.

Completed snapshots are reused by dashboards even after profile changes. Salary-sensitive shift edits mark a finalized calculation `stale` through both the domain/UI flow and a database trigger. A stale shift continues to use its frozen result and is counted explicitly as stale in Home and Reports; it is never silently recomputed with a hybrid of old and current settings. Explicit recalculation previews old and new totals, ignores the old rate snapshot for the target shift, archives the old current snapshot, and saves a new version.

Shift completion itself remains transaction-safe in the Phase 3 repository. Salary finalization follows immediately. If salary configuration is missing, an `incomplete` snapshot is stored without blocking completion. If snapshot persistence itself fails, the completed time record remains intact, its calculation status is durably marked incomplete when possible, and it can be recalculated from shift details.

## Persistence and future synchronization

React components do not execute SQL. Salary profiles, rules, and calculation snapshots use repository contracts. The pure engine receives all shifts, breaks, rules, rates, and holidays as input and has no SQLite or React dependency. This keeps the calculation and snapshot formats usable by a future synchronization adapter without rewriting domain logic.
