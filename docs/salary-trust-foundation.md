# Salary Trust Foundation

The Salary Trust Foundation makes the limits and provenance of Shiftty's salary figures visible. It does not change how salary totals are calculated. Shiftty continues to produce deterministic **gross estimates from user-entered settings**, not payslips and not statements of legal compliance.

## Trust states

Every salary presentation derives one of three states at read time:

| State | Hebrew presentation | English presentation | Meaning |
| --- | --- | --- | --- |
| `unavailable` | הערכת שכר לא זמינה | Estimated pay is unavailable | No trustworthy numeric estimate can be shown. |
| `basic_estimate` | הערכת שכר בסיסית | Basic pay estimate | A numeric gross estimate exists, but it uses the visible product default or lacks explicit configured-overtime provenance. |
| `configured_estimate` | הערכת שכר לפי ההגדרות שלך | Pay estimate using your settings | A numeric gross estimate exists and explicitly records configured-overtime provenance. |

`deriveSalaryTrustState` is a pure, deterministic classifier. It returns `unavailable` when the calculation result or gross total is missing, the result contains an error, or the calculation status presented to it is `not_calculated`, `incomplete`, or `stale`. Scheduled and active Shift Details use a complete live calculation as an `estimated` presentation without persisting or finalizing that status; this lets a usable forecast derive `basic_estimate` or `configured_estimate` while a missing or erroneous live result remains unavailable. Completed shifts and reports retain their persisted status semantics. A usable result is `basic_estimate` when it records the default-overtime or no-pay-rules assumption, uses either built-in default-overtime rule identifier, or lacks newer configured-rule provenance. A usable result with explicit configured daily overtime, evaluated weekly-overtime provenance, or a frozen contributing special-interval rule is `configured_estimate`.

Engine `1.5.0` treats a special-interval evaluation as configured provenance only when it identifies at least one applied rule and `contributedToEstimate` is true. Confirming a calendar interval without a matching pay rule does not promote the result; the disclosure explains that the interval was evaluated but had no pay effect.

This conservative fallback matters for historical results: older calculation JSON that predates the provenance explanation is never silently promoted to `configured_estimate`.

## Estimate terminology and disclosure

User-facing copy uses estimate terminology consistently in Hebrew and English. The UI says estimated pay or estimated gross pay; it does not relabel an estimate as a final salary, payslip, or net amount.

The reusable `SalaryTrustDisclosure` appears in salary settings and salary-bearing shift flows. It shows the applicable trust label, explains that the result is based on the user's pay settings, and exposes an accessible, expandable assumptions list. Its logical row direction and text alignment follow Hebrew RTL or English LTR layout.

The included list is driven by the calculation result where one is available. Depending on the result, it can describe:

- the resolved configured hourly rate;
- the actual, payable, scheduled, or provisional working range used by the calculation;
- paid and unpaid break handling;
- a snapshotted shift-type multiplier;
- configured overtime rules or the visible default overtime schedule;
- fixed bonuses and reimbursements;
- a user-confirmed holiday, weekly-rest, or custom interval with exact boundaries and source provenance; and
- the configured estimation rule, combined multiplier, and whether that interval contributed.

The disclosure also says what is **not fully modeled**:

- weekly overtime thresholds when no workweek-aware rule is explicitly configured;
- automatic legal holiday/weekly-rest classification or entitlement determination;
- employer-specific agreements; and
- deductions, tax, pension, National Insurance, and other net-pay components.

Confirmed evidence intervals and recurring weekly-rest occurrences can be supplied to the pure engine entirely offline, but Shiftty does not automatically determine which dates, rest choices, agreements, permits, or entitlements apply. Calendar evidence has no salary effect without a separate applicable pay rule. The current engine produces gross estimates only.

## Default overtime assumption

When a salary profile has no persisted shift- or day-scoped worked-minute multiplier rule, salary engines from `1.4.0` onward apply the existing visible product default: the first 8 net hours at the otherwise applicable rate, hours 9–10 with a stacking 25% premium, and hours 11–12 with a stacking 50% premium. The calculation records `default_overtime_applied`, and the disclosure calls out the assumption with a direct route to Salary Settings. An explicitly configured weekly rule complements these per-shift defaults and records its own provenance.

Any persisted shift- or day-scoped worked-minute multiplier rule, including a disabled one, replaces or opts out of both default tiers. This default is an editable product assumption. It is not represented as a universal employment term or a legal rule.

## Screens, reports, and exports

Salary Settings, Shift Details, active tracking, quick clock-out review, Home, and Reports use the shared estimate terminology and trust handling. Numeric Home totals are hidden when the relevant completed-shift salary set contains a missing, incomplete, stale, or otherwise unavailable result.

The authoritative monthly report keeps its existing row and total semantics:

- an available salary remains numeric and is labeled as estimated;
- a missing calculation, incomplete calculation, or stale calculation remains explicit and non-numeric;
- if any included row has an unavailable salary, the aggregate salary total remains unavailable instead of presenting a partial amount as complete; and
- a legitimate available or finalized gross total of zero remains numeric zero, not missing.

PDF and CSV exports use localized estimated-gross headings and explicit status values. Each export includes the concise note that pay amounts are estimates based on configured pay settings. The PDF places it once as the report note; the CSV places it once in the first data row's dedicated estimate-note column. A contributing special interval can add a concise localized type/name label sourced from frozen snapshot provenance; full source URLs remain in the detailed disclosure rather than compact rows.

ICS export is strictly calendar-only. It contains completed shift event data and no salary field, evidence provenance, source claim, rule, multiplier, estimate, trust state, note, or other financial claim.

## Staleness, history, and compatibility

This milestone preserves the established snapshot guarantees. A finalized salary snapshot remains the authoritative historical calculation until an explicit recalculation creates a new version. Salary-sensitive edits can mark it stale, but stale data is surfaced as stale and unavailable for current numeric trust presentation; it is not silently recomputed. Older snapshot versions remain in history, and no historical result JSON or total is rewritten by the trust classifier.

Missing configuration produces no invented zero. Incomplete and missing results have no numeric gross total. By contrast, a valid finalized calculation whose gross amount is exactly zero remains a valid numeric estimate.

The original Salary Trust Foundation added no database migration, table, column, or trigger. Milestone 3 adds Migration 9 evidence storage and optional frozen result provenance, but trust state itself is still derived at read time and is not persisted. Migration 9 does not rewrite earlier result JSON or totals. Backup envelope version 1 remains readable while carrying the new evidence records and optional snapshot fields.

## Compliance boundary and next milestone

The feature does not claim Israeli labor-law compliance. Correct pay can depend on facts the application does not know, including the applicable legal classification, collective or personal agreement, workweek structure, holidays, deductions, benefits, pension arrangements, and employer payroll policy. The disclosure makes those boundaries visible instead of converting them into implied guarantees.

Milestones 2 and 3 implement the previously recommended opt-in workweek-aware and evidence-aware holiday/rest foundations. The evidence model is deliberately small: one reviewed date-only civic preset, user-confirmed manual/imported intervals, and a disabled-by-default weekly-rest schedule. A future evidence review/import workflow should focus on visible source conflicts and user-controlled version reconciliation, not automatic legal or religious classification. The full current contract is in [`evidence-aware-holiday-rest.md`](evidence-aware-holiday-rest.md).
