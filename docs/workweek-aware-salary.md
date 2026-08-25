# Workweek-aware salary estimates

Implemented: 2026-08-24

## Purpose and product boundary

Salary engine `1.4.0` introduced opt-in weekly accumulation to Shiftty's deterministic gross-pay estimate, and engine `1.5.0` preserves that contract while adding evidence-aware special intervals. It does not install a statutory Israeli workweek, infer an employment agreement, or turn an estimate into payroll truth. The worker chooses the workweek start, threshold, multiplier, and whether the threshold accumulates net or gross minutes.

Weekly overtime is disabled for existing and new profiles until the user enables or configures it. When it is disabled and there is no generic week-scoped rule, calculations retain the established per-shift default overtime model and all earlier salary behavior.

## Profile configuration and rule model

A salary profile owns five workweek fields:

- `workweekStartWeekday`: a local weekday from Sunday (`0`) through Saturday (`6`), with Sunday as the neutral Hebrew-first default;
- `weeklyOvertimeEnabled`: the explicit opt-in;
- `weeklyRegularMinutes`: the accumulated threshold in whole minutes;
- `weeklyOvertimeMultiplierBasisPoints`: the multiplier after the threshold, where `10000 = 100%`;
- `weeklyOvertimeBasis`: `net` or `gross`.

An enabled profile configuration is converted in memory into one ordinary `PayRule`. Its stable ID is `system-weekly-overtime:<profile-id>`, its condition is `workedMinutes` with `scope: 'week'`, and its effect is the configured multiplier. The synthesized rule is not a second calculation path and is not inserted into the `pay_rules` table. It passes through the same effective-date filtering, deterministic boundary splitting, matching, multiplier resolution, segment recording, issues, and explanations as persisted rules.

The general rule schema also accepts `workedMinutes` conditions with `scope: 'week'`. Advanced Pay Rules can therefore express additional week-scoped thresholds using the same net/gross basis and multiplier machinery. All week-scoped rules use the owning salary profile's configured workweek start and calculation timezone.

Weekly opt-in complements the existing default per-shift schedule. A weekly rule by itself does not suppress the defaults of 480 net minutes with no overtime premium, the next 120 with a 25% premium, and the next 120 with a 50% premium. On a neutral shift these are 100%, 125%, and 150%; a shift type or ordinary rule may raise the combined multiplier. An explicit persisted shift- or day-scoped worked-minute multiplier, including a disabled one, continues to replace or opt out of those per-shift defaults.

## Local workweeks and accumulation

A workweek is keyed by the profile-local calendar date on which it begins. The engine converts each instant into the salary profile timezone, finds the configured local weekday boundary, and records a `YYYY-MM-DD` start key. It does not truncate an instant to a UTC week.

For example, with a Sunday start in `Asia/Jerusalem`, an overnight shift from Saturday 23:00 to Sunday 02:00 allocates 60 minutes to the week that began on the prior Sunday and 120 minutes to the newly started week. The equivalent absolute instants may have different UTC dates; the profile-local dates remain authoritative. DST duration still comes from absolute instants, while week membership comes from local calendar boundaries.

Every engine result from `1.4.0` onward records optional `workweekAllocations` containing the local workweek start plus net and gross minutes. These allocations are calculation provenance and are also used to identify exact downstream snapshot dependencies. The field is optional so result JSON from engines `1.0.0` through `1.3.0` remains readable.

The basis has the following meaning:

- `net` accumulates payable work intervals after unpaid breaks; paid breaks remain included;
- `gross` accumulates the complete salary source range, including breaks, while only payable work intervals receive pay.

## Chronological context and reporting boundaries

The coordinator loads earlier completed shifts from the beginning of each requested shift's local workweek through the requested source range when either the profile opt-in or an enabled generic week-scoped rule exists. Weekly accumulation is isolated to the same workplace and the same resolved salary-profile version. A shift from another workplace or another profile version does not contribute to that weekly threshold.

All relevant shifts are processed chronologically by salary-source start, with shift ID as a stable tie-breaker. A frozen finalized or incomplete snapshot remains the historical result for its shift and contributes its recorded work intervals to later thresholds. Consequently, even an earlier shift without a numeric salary can still contribute worked minutes when its time provenance is available.

Context can cross a calendar-month boundary. If a workweek starts in July and the requested August shift is later in that same local workweek, the July completed shift contributes minutes to the August calculation. It is context only: it is not added to `resultsByShiftId`, earned totals, breakdowns, or report rows unless it was itself requested. Reporting-range filters continue to include only requested segments in the selected range, and fixed components belong once to the local date on which their source range begins.

The authoritative `MonthlyReport` remains snapshot-based and continues to select completed shifts by the month containing their actual clock-out instant. Weekly context changes how a newly calculated snapshot is segmented; it does not silently recalculate a monthly report or import an out-of-month context shift as a report row.

## Multiplier composition

For any payable minute, all matching worked-minute multiplier rules across shift, day, and week scopes are treated as overtime candidates. Only the strongest single overtime multiplier contributes its premium. Priority, specificity, and stable rule ID remain deterministic tie-breakers; they do not cause two overtime premiums to be added together.

The selected overtime premium still composes with the established ordinary multiplier model:

1. choose the stronger of the snapshotted whole-shift type multiplier and the winning ordinary non-stacking rule;
2. add premiums from ordinary rules explicitly marked stacking;
3. add only the premium above 100% from the strongest matching shift/day/week overtime rule.

Thus a 150% shift type plus a 125% weekly overtime rule produces 175%, not 187.5% and not 275%. A simultaneously matching 150% daily overtime rule and 125% weekly overtime rule produces one 50% overtime premium, not 75%.

Fixed bonuses and reimbursements are evaluated and added once per shift. They are not multiplied and do not repeat when a threshold splits the shift into more segments. Minimum-duration adjustments also remain one adjustment and retain the shift-type multiplier behavior documented for engine `1.3.0`; weekly accumulation does not turn them into worked minutes.

## Exact worked examples

All examples use a base rate of ₪60.00 per hour (`6000` minor units), half-up rounding, no fixed components, and a Sunday-starting `Asia/Jerusalem` workweek.

### Example 1: crossing a 42-hour net weekly threshold

The profile has a 2,520-minute threshold and a 125% weekly multiplier. Earlier compatible shifts contributed 2,460 net minutes (41 hours). The next shift contains 120 payable minutes and no break.

- First 60 minutes: the week rises from 2,460 to 2,520 minutes, so they remain at 100%: `60 × ₪60 ÷ 60 = ₪60.00`.
- Next 60 minutes: they are beyond the threshold and use 125%: `60 × ₪60 × 125% ÷ 60 = ₪75.00`.
- Exact estimate: 120 base minutes produce ₪120.00 base pay, the weekly premium adds ₪15.00, and the total is **₪135.00** (`13500` minor units).

### Example 2: daily and weekly overtime overlap

Use the same 120-minute shift and 2,460 prior weekly minutes. Also configure a daily rule at 150% after the first 60 daily minutes. During the second hour, both the weekly 125% rule and daily 150% rule match.

- First 60 minutes at 100%: ₪60.00.
- Second 60 minutes use the strongest overtime candidate, 150%, rather than adding 25% and 50%: ₪90.00.
- Exact estimate: ₪120.00 base pay plus ₪30.00 premium equals **₪150.00** (`15000` minor units).

### Example 3: weekly overtime with a shift type

Assume the 42-hour weekly threshold has already been reached before a 60-minute Night shift. The shift has a snapshotted 150% type multiplier and the weekly rule is 125%.

- The ordinary whole-shift candidate contributes a 50% premium.
- The weekly overtime candidate contributes its 25% premium.
- Combined multiplier: `100% + 50% + 25% = 175%`.
- Exact estimate: `60 × ₪60 × 175% ÷ 60 =` **₪105.00** (`10500` minor units), consisting of ₪60.00 base pay and ₪45.00 premium.

### Example 4: net versus gross around an unpaid break

Earlier compatible shifts contributed 2,460 net and gross minutes. A two-hour 08:00–10:00 source range contains a 30-minute unpaid break from 08:30–09:00, leaving 90 payable minutes.

- With a net threshold, the break does not advance the counter. Sixty payable minutes remain regular and the final 30 payable minutes use 125%: ₪90.00 base + ₪7.50 premium = **₪97.50**.
- With a gross threshold, elapsed break time advances the counter even though the break is not paid. Thirty payable minutes remain regular and 60 payable minutes use 125%: ₪90.00 base + ₪15.00 premium = **₪105.00**.

## Snapshots, staleness, and recalculation

Completed calculations remain immutable, versioned snapshots. Enabling weekly overtime or changing the hourly rate, workweek start, weekly threshold, multiplier, or basis creates a new effective-dated salary-profile version in the salary settings flow. It does not rewrite or automatically recalculate a finalized snapshot. Explicit recalculation archives the previous current snapshot and writes a result using the current engine version.

Editing a persisted generic week-scoped Pay Rule likewise affects future calculations and explicit recalculations; it does not mutate a frozen result. The dependency triggers described below respond to changes in recorded shifts and breaks. They do not rewrite snapshot JSON merely because configuration was edited.

Migration 8 adds precise weekly dependency invalidation alongside the existing target-shift and daily invalidation rules. Dependency existence comes from the later snapshot's frozen weekly explanation plus both snapshots' recorded workweek allocations, not from the profile or rule's current enabled state:

- a salary-sensitive update to a completed shift marks that shift's finalized state stale through the existing trigger;
- updating or deleting an earlier completed shift can mark only later finalized shifts stale when they share the same workplace, frozen salary-profile ID, and an engine-recorded local workweek key;
- persisting a new current snapshot for an earlier completed shift applies the same exact test, covering a newly added historical shift, a scheduled shift that was completed, and the destination cohort after an edited shift is explicitly recalculated;
- inserting, updating, moving, or deleting a break applies the same downstream weekly dependency test;
- unrelated workplaces, profile versions, local workweeks, earlier shifts, and non-finalized dependants are not marked stale by the weekly triggers;
- the stored snapshot rows and `result_json` are retained unchanged when the shift status becomes stale.

When an edit moves a completed shift to another workplace, profile, or workweek, its old cohort is evaluated from the retained old snapshot at edit time. Its destination cohort is evaluated when explicit recalculation persists the shift's new authoritative snapshot; the edit does not invent destination workweek provenance before that calculation exists.

This precision depends on `workweekAllocations` written by engine `1.4.0`. Older snapshots do not acquire fabricated workweek provenance during migration, so Migration 8 does not claim exact weekly downstream invalidation for history that was never calculated with weekly context.

## Migration and backup compatibility

Migration 8 is additive. It adds the five profile columns with neutral values: Sunday start, weekly overtime disabled, no threshold, no multiplier, and net basis. The database requires a positive threshold and a multiplier of at least 100% whenever weekly overtime is enabled. Existing salary totals and snapshot JSON are not rewritten.

Backup format version 1 remains the supported envelope. Current exports include the new profile fields and optional `workweekAllocations`. Older version 1 backups omit them and are accepted through entity defaults, restoring weekly overtime as disabled with Sunday/net neutral settings. Replace and merge restore persist the new fields; replace restore reinstates each backed-up salary-calculation status after reconstructing snapshot relationships so payload order cannot create a new stale state. Old snapshots remain readable because `workweekAllocations` is optional. A new backup version and a destructive migration are unnecessary.

## Salary trust behavior

Weekly configuration is disclosed as an included assumption when its rule is evaluated. A complete calculation with explicit weekly provenance is a `configured_estimate`, even if the product's per-shift default overtime also remains available; missing rates, calculation errors, stale shifts, and incomplete snapshots remain `unavailable`. Historical results without sufficient provenance are classified conservatively as `basic_estimate`.

The trust label does not certify the chosen weekly values. Every numeric result remains estimated pay based on user-entered settings. Weekly configuration changes the transparency and coverage of the estimate, not its legal authority.

## Known limitations and non-compliance boundary

This milestone does not determine which weekly threshold or workweek applies to a worker. It does not infer statutory classifications, shortened weeks, employer-specific agreements, collective agreements, split employment, absence treatment, holiday entitlement, rest-day rules, or interactions that require facts outside the recorded shifts and settings. Automatic Israeli holiday determination remains unsupported, and deductions, tax, National Insurance, pension, benefits, and other net-pay components remain outside the gross engine.

Accordingly, Shiftty does not claim that engine `1.4.0` is legally accurate, verified, compliant, or a substitute for an employer payslip or professional advice. It provides a deterministic, inspectable estimate from the configuration and work records available on the device.

## Evidence-aware extension in engine 1.5.0

Milestone 3 adds a separate, optional weekly-rest schedule and `weekly_rest` evidence type. They do not alter the workweek boundary or weekly-overtime counter described in this document. The coordinator resolves a confirmed rest schedule only for the requested salary range and passes the resulting intervals to the same calculation; salary changes only if a separate `specialInterval` pay rule targets `weekly_rest`.

Daily/weekly overtime still contributes only its strongest single overtime premium. A matching holiday/rest/custom rule belongs to the separate special-interval family, so its documented stacking choice can compose without duplicating overtime. Workweek allocations, cross-month context, downstream weekly staleness, and frozen weekly snapshot provenance remain unchanged. See [`evidence-aware-holiday-rest.md`](evidence-aware-holiday-rest.md) for interval sources, DST occurrence semantics, premium-family interaction, and legal-safety limits.
