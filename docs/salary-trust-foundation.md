# Salary Trust Foundation

The Salary Trust Foundation makes the limits and provenance of Shiftty's salary figures visible. It does not change how salary totals are calculated. Shiftty continues to produce deterministic **gross estimates from user-entered settings**, not payslips and not statements of legal compliance.

## Trust states

Every salary presentation derives one of three states at read time:

| State | Hebrew presentation | English presentation | Meaning |
| --- | --- | --- | --- |
| `unavailable` | הערכת שכר לא זמינה | Estimated pay is unavailable | No trustworthy numeric estimate can be shown. |
| `basic_estimate` | הערכת שכר בסיסית | Basic pay estimate | A numeric gross estimate exists, but it uses the visible product default or lacks explicit configured-overtime provenance. |
| `configured_estimate` | הערכת שכר לפי ההגדרות שלך | Pay estimate using your settings | A numeric gross estimate exists and explicitly records configured-overtime provenance. |

`deriveSalaryTrustState` is a pure, deterministic classifier. It returns `unavailable` when the calculation result or gross total is missing, the result contains an error, or the shift status is `not_calculated`, `incomplete`, or `stale`. A usable result is `basic_estimate` when it records the default-overtime or no-pay-rules assumption, uses either built-in default-overtime rule identifier, or lacks the newer configured-overtime explanation. Only a usable result with explicit `salary.explanations.configured_overtime` provenance is `configured_estimate`.

This conservative fallback matters for historical results: older calculation JSON that predates the provenance explanation is never silently promoted to `configured_estimate`.

## Estimate terminology and disclosure

User-facing copy uses estimate terminology consistently in Hebrew and English. The UI says estimated pay or estimated gross pay; it does not relabel an estimate as a final salary, payslip, or net amount.

The reusable `SalaryTrustDisclosure` appears in salary settings and salary-bearing shift flows. It shows the applicable trust label, explains that the result is based on the user's pay settings, and exposes an accessible, expandable assumptions list. Its logical row direction and text alignment follow Hebrew RTL or English LTR layout.

The included list is driven by the calculation result where one is available. Depending on the result, it can describe:

- the resolved configured hourly rate;
- the actual, payable, scheduled, or provisional working range used by the calculation;
- paid and unpaid break handling;
- a snapshotted shift-type multiplier;
- configured overtime rules or the visible default overtime schedule; and
- fixed bonuses and reimbursements.

The disclosure also says what is **not fully modeled**:

- weekly overtime thresholds;
- automatic Israeli holiday determination;
- employer-specific agreements; and
- deductions, tax, pension, National Insurance, and other net-pay components.

Holiday intervals can be supplied to the pure engine and specific-date rules can be configured, but Shiftty does not automatically determine authoritative holidays. The current engine produces gross estimates only.

## Default overtime assumption

When a salary profile has no persisted worked-minute multiplier rule, salary engine `1.3.0` applies the existing visible product default: the first 8 net hours at the otherwise applicable rate, hours 9–10 with a stacking 25% premium, and hours 11–12 with a stacking 50% premium. The calculation records `default_overtime_applied`, and the disclosure calls out the assumption with a direct route to Salary Settings.

Any persisted worked-minute multiplier rule, including a disabled one, replaces or opts out of both default tiers. This default is an editable product assumption. It is not represented as a universal employment term or a legal rule.

## Screens, reports, and exports

Salary Settings, Shift Details, active tracking, quick clock-out review, Home, and Reports use the shared estimate terminology and trust handling. Numeric Home totals are hidden when the relevant completed-shift salary set contains a missing, incomplete, stale, or otherwise unavailable result.

The authoritative monthly report keeps its existing row and total semantics:

- an available salary remains numeric and is labeled as estimated;
- a missing calculation, incomplete calculation, or stale calculation remains explicit and non-numeric;
- if any included row has an unavailable salary, the aggregate salary total remains unavailable instead of presenting a partial amount as complete; and
- a legitimate available or finalized gross total of zero remains numeric zero, not missing.

PDF and CSV exports use localized estimated-gross headings and explicit status values. Each export includes the concise note that pay amounts are estimates based on configured pay settings. The PDF places it once as the report note; the CSV places it once in the first data row's dedicated estimate-note column.

ICS export is strictly calendar-only. It contains completed shift event data and no salary field, estimate, trust state, note, or other financial claim.

## Staleness, history, and compatibility

This milestone preserves the established snapshot guarantees. A finalized salary snapshot remains the authoritative historical calculation until an explicit recalculation creates a new version. Salary-sensitive edits can mark it stale, but stale data is surfaced as stale and unavailable for current numeric trust presentation; it is not silently recomputed. Older snapshot versions remain in history, and no historical result JSON or total is rewritten by the trust classifier.

Missing configuration produces no invented zero. Incomplete and missing results have no numeric gross total. By contrast, a valid finalized calculation whose gross amount is exactly zero remains a valid numeric estimate.

The Salary Trust Foundation adds no database migration, table, column, or trigger. Trust state is not persisted. It adds no backup field and does not change backup versioning, replace behavior, merge behavior, salary totals, rate resolution, or snapshot storage.

## Compliance boundary and next milestone

The feature does not claim Israeli labor-law compliance. Correct pay can depend on facts the application does not know, including the applicable legal classification, collective or personal agreement, workweek structure, holidays, deductions, benefits, pension arrangements, and employer payroll policy. The disclosure makes those boundaries visible instead of converting them into implied guarantees.

The recommended next milestone is an opt-in, workweek-aware salary engine: configurable workweek start and weekly regular-hour threshold, deterministic interaction with existing daily overtime, cross-month context, snapshot-aware staleness, additive migration and backup compatibility, and the same explicit estimate/compliance boundaries.
