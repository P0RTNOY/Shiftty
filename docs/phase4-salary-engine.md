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

When no explicit shift- or day-scoped worked-minute multiplier rule exists, engines from `1.4.0` onward apply a visible, deterministic default overtime schedule: the first 480 net working minutes use the otherwise applicable rate, minutes 481–600 receive a stacking 25% premium (125% on a neutral shift type), and minutes 601–720 receive a stacking 50% premium (150% on a neutral shift type). The thresholds remain continuous across midnight because their scope is the shift, and unpaid breaks do not consume them. Any persisted shift- or day-scoped worked-minute multiplier rule—including a disabled rule—replaces or opts out of both defaults. A weekly rule complements rather than silently disables the per-shift defaults. This is an editable product default, not a claim that one schedule represents every employment agreement or legal circumstance.

An enabled salary-profile weekly configuration is synthesized in memory as a deterministic multiplier rule with a `workedMinutes` condition scoped to `week`. The profile supplies its local workweek-start weekday, regular-minute threshold, multiplier, and net or gross accumulation basis. The general pay-rule model also accepts persisted week-scoped thresholds. Matching shift-, day-, and week-scoped overtime rules do not add their premiums together: the strongest single overtime multiplier applies to a minute. Its premium above 100% then composes with the established shift-type and ordinary stacking-rule model. See [`workweek-aware-salary.md`](workweek-aware-salary.md) for the full contract and exact examples.

Engine `1.5.0` adds explicit `ordinary`, `overtime`, and `special_interval` premium families plus the generalized `specialInterval` condition. The strongest matching non-stacking special-interval multiplier competes with the ordinary non-stacking/shift-type baseline. Each explicitly stacking special rule contributes only its premium above 100%, and the strongest overtime candidate still contributes only once. Rule order cannot duplicate an interval premium. Legacy `holiday` and `weekend` conditions remain readable; a legacy holiday condition also recognizes new holiday evidence, while a legacy weekend window remains a rule-owned local window rather than being relabeled as confirmed weekly rest. See [`evidence-aware-holiday-rest.md`](evidence-aware-holiday-rest.md).

New schedules, manual completed shifts, manual payable ranges, and shift-type default ranges may be at most 720 elapsed minutes. Exactly 12 hours is accepted; one minute more is rejected. An already-running shift can always be clocked out with its truthful timestamp even after the limit so recovery and open-break closure cannot be blocked. Such an over-limit range is retained as history, receives an error issue, and has no payable gross total until corrected. Existing over-limit records remain readable and can receive unrelated edits or be shortened, but they cannot be lengthened.

### Predefined shift type multiplier

The existing shift-template entity is the canonical predefined shift type. A type stores a whole-shift multiplier in integer basis points, with `10000 = 100%` and a supported range of 100%–1000%. Selecting a type copies its identifier, name, and multiplier onto the shift. The copied values are calculation inputs; later rename, repricing, archive, or deletion of the type does not rewrite an already-created shift.

The type multiplier participates as a whole-shift non-stacking candidate. The stronger of the type multiplier and the winning configured non-stacking rule applies, then explicitly stacking rules add only their premium above 100%. For example:

```text
60.00 base hourly rate × 150% night type = 90.00 per hour
150% night type + stacking 125% overtime = 175% total
```

The same multiplier applies to all payable intervals on both sides of local midnight and to a configured minimum-duration adjustment. Bonuses and reimbursements remain fixed components and are not multiplied. Calculation result JSON records the snapshotted type name and multiplier in addition to segment multipliers and rule identifiers. Salary engine version `1.5.0` retains the shift-type semantics, two-tier default overtime, 12-hour validation policy, profile-local workweeks, week-scoped thresholds, and strongest-single-overtime resolution while adding evidence-aware special intervals.

## Time, breaks, and segmentation

- Completed shifts use the finalized payable range and payable break deduction.
- Scheduled shifts use the scheduled range and expected break. A profile can mark that expected break paid or unpaid.
- Active calculations use actual start through the supplied current or expected end and remain provisional.
- Paid break sessions are reported but not deducted. Unpaid sessions or the finalized payable-break override are deducted.

The engine builds boundaries rather than iterating minute by minute. Boundaries include the source endpoints, local midnight, time-window and legacy-weekend transitions, legacy holiday-provider intervals, confirmed holiday/weekly-rest/custom evidence starts and ends, unpaid breaks, and worked-minute thresholds. Fractional minutes caused by second-bearing timestamps are carried across boundaries so partitioning conserves the whole-range minute count. Cross-midnight and DST durations are calculated from absolute instants, while weekday/date/window conditions use the salary profile timezone. Evidence membership is half-open, and overlapping intervals are sorted deterministically by start, end, type, and stable ID.

Per-shift, per-local-day, and per-profile-local-workweek thresholds are supported with independently configurable gross or net accumulation. Cross-midnight ranges are split at local midnight and at any workweek boundary implied by the configured local weekday. Monthly orchestration sorts shifts chronologically and reallocates prior work intervals into the current calculation timezone. Daily accumulation retains the established chronological context. Weekly accumulation uses only compatible shifts with the same workplace and resolved salary-profile version; it can load earlier completed context across a calendar-month boundary without exposing context-only shifts in results, totals, breakdowns, or report rows. Worked intervals remain available even when an earlier shift has no resolvable rate, so missing salary configuration does not erase time from a later threshold.

Finalizing a completed shift includes earlier completed context required by its local day and, when configured, its local workweek. Existing daily staleness remains conservative. Migration 8 adds exact weekly dependency invalidation using engine-authored `workweekAllocations` and the later snapshot's frozen weekly-rule explanation: salary-sensitive edits, deletion, break changes, and creation of a new current completed snapshot can mark later finalized shifts stale only when they share the same workplace, frozen salary-profile ID, and local workweek key. This remains valid if the live weekly rule is later disabled or deleted. A moved shift's destination cohort is evaluated when explicit recalculation writes its new authoritative snapshot. Frozen result JSON is retained rather than recalculated. Older snapshots without weekly allocation provenance remain readable and are not assigned invented weekly dependencies.

The engine retains the injected `HolidayProvider` and neutral `NO_HOLIDAYS` adapter for backward compatibility. Migration 9 repositories additionally load exact persisted `CalendarEvidenceInterval` rows and expand an enabled, confirmed weekly-rest schedule only for the requested shift range. Both paths are offline; salary calculation performs no network request. A calendar interval alone never changes money—the user must configure a separate applicable pay rule. The single bundled date-only civic fixture requires review and confirmation and is not a mandatory or comprehensive holiday calendar.

Financial period queries use status-aware ranges: completed shifts use payable time, scheduled shifts use scheduled time, and active shifts use actual time. Hourly segments are allocated to the reporting period containing their local segment date. A per-shift bonus, reimbursement, or minimum-duration adjustment belongs to the local date on which the salary source range begins. This prevents cross-month shifts from being counted in full in both months. Active provisional results remain available by shift ID but are excluded from finalized dashboard/report aggregates.

Profile effective dates, segment dates, and fixed-component report dates all use the selected salary profile's calculation timezone. Migration 4 clones a legacy profile and its rules when Phase 1 data shared it across workplaces. Unattached legacy profiles remain preserved and readable, but cannot be selected until associated with a workplace.

## Snapshots and recalculation

Migration 4 uses a hybrid snapshot, extended compatibly by Migrations 7 and 8:

- Indexed summary columns support reports.
- Validated result JSON preserves segments, explanations, issues, rule IDs, calculation time, and engine version.
- One partial unique index permits one current snapshot per shift.
- Older versions remain as history.

Engine `1.4.0` added optional workweek allocations to result JSON. They record each profile-local workweek start with the shift's net and gross minutes, supporting explanation, later accumulation, and precise dependency invalidation. Engine `1.5.0` adds optional segment `specialIntervalIds` and bounded `specialIntervalEvaluations` containing frozen interval/schedule identity, name/type, exact range/timezone, source/preset/confirmation provenance, applied rule IDs, and contribution status. Both additions are optional, so existing snapshots and backup payloads remain valid. Historical explanation does not depend on a live evidence row or schedule.

Migration 7 also snapshots the selected type name and multiplier directly on the shift. Old shifts and old backup payloads resolve to a neutral 100% multiplier. Deleting a type clears only its live foreign-key/recurrence reference; existing shift and recurrence snapshots remain readable, and a finalized salary snapshot is not made stale solely by deletion. Changing the selected type or multiplier on a completed shift is salary-sensitive and produces the normal stale/recalculation flow while retaining the prior calculation version.

Completed snapshots are reused by dashboards even after profile changes. Hourly-rate and weekly-setting changes in the salary-settings flow create a new effective-dated profile version rather than mutating historical configuration. Salary-sensitive shift edits mark a finalized calculation `stale` through both the domain/UI flow and a database trigger; weekly dependency triggers also stale only later compatible finalized shifts whose recorded local-workweek allocation overlaps the changed predecessor. A stale shift continues to use its frozen result and is counted explicitly as stale in Home and Reports; it is never silently recomputed with a hybrid of old and current settings. Explicit recalculation previews old and new totals, ignores the old rate snapshot for the target shift, archives the old current snapshot, and saves a new version.

Salary trust remains presentation metadata derived from result provenance and calculation status, not a persisted authority claim. Complete results that explicitly record weekly configuration or a contributing configured special-interval rule can be presented as `configured_estimate`; an interval without a pay effect, default-only calculation, or unknown legacy provenance remains `basic_estimate`; missing, incomplete, erroneous, or stale results remain `unavailable`. All numeric amounts remain estimates based on user-entered settings.

Shift completion itself remains transaction-safe in the Phase 3 repository. Salary finalization follows immediately. If salary configuration is missing, an `incomplete` snapshot is stored without blocking completion. If snapshot persistence itself fails, the completed time record remains intact, its calculation status is durably marked incomplete when possible, and it can be recalculated from shift details.

## Persistence and future synchronization

React components do not execute SQL. Salary profiles, rules, evidence intervals, weekly-rest schedules, and calculation snapshots use repository contracts. The pure engine receives all shifts, breaks, rules, rates, holidays/evidence, and prior day/workweek minute maps as input and has no SQLite or React dependency. The coordinator alone loads compatible chronological context, persisted evidence, and bounded recurring occurrences. This keeps the calculation and snapshot formats usable by a future synchronization adapter without rewriting domain logic.

Migration 8 adds the workweek profile columns with neutral defaults: Sunday start, weekly overtime disabled, no threshold or multiplier, and net basis. Migration 9 adds nullable pay-rule premium families plus validated/indexed evidence and weekly-rest tables; it creates no default schedule or interval. Neither migration rewrites existing result JSON or totals. Backup envelope version 1 remains supported; current backups include the new fields and evidence records, while older version 1 backups restore through neutral empty/disabled defaults.
