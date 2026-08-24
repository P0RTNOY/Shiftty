# Shift types and pay multipliers

Implemented: 2026-08-24

## Product behavior

Shiftty presents the existing reusable shift-template capability as **Shift Types / סוגי משמרת**. Keeping the existing entity, route, repository, table, and `shiftTemplateId` preserves old data and avoids a second competing preset model.

From Settings, the local app owner can create, edit, archive, restore, duplicate, and permanently delete a type. Each type defines:

- a name;
- default local start and end times, including an end on the following day;
- a pay multiplier entered as a percentage;
- expected break minutes and paid/unpaid/default break behavior;
- optional weekdays and calendar color;
- existing optional workplace, role, and salary-profile defaults at the domain/repository boundary.

New types default to a zero-minute break and 100% pay. Morning, Afternoon, and Night are examples the user can configure, not assumptions made by the app. Type defaults and newly entered shifts are limited to 12 hours. Independently of shift types, the salary engine has an explicit default overtime policy: after eight net working hours, the first two overtime hours receive a stacking 25% premium and the next two receive a stacking 50% premium. An explicit configured or disabled worked-minute multiplier rule replaces or opts out of both default tiers.

The shift form shows active types as a normal choice. Selecting one copies its default hours and break; all individual time fields remain editable before saving. Fallback clock-in and recurring shifts preserve the same attribution and pay snapshot.

## Calculation contract

Percentages are stored as integer basis points (`10000 = 100%`, `15000 = 150%`). The accepted type range is 100%–1000%; this engine models premiums, not wage deductions.

```text
resolved hourly wage × shift type basis points ÷ 10000
60.00 × 15000 ÷ 10000 = 90.00 per hour
```

The type is a whole-shift, non-stacking multiplier candidate. A stronger configured non-stacking rule can supersede it. Rules explicitly marked stacking add only their premium over 100%, preserving the established salary-engine contract:

```text
150% type + stacking 125% overtime = 175%
```

At a 60.00 base rate, an 8-hour-30-minute neutral shift therefore produces 8 hours at 60.00 plus 30 minutes at 75.00, for a 517.50 gross estimate. A 12-hour neutral shift produces 8 hours at 60.00, 2 hours at 75.00, and 2 hours at 90.00, for 810.00 total. The default is per shift, uses net working time after unpaid breaks, and does not reset at midnight.

The multiplier applies to every payable interval, including intervals split at local midnight, and to minimum-paid-duration adjustments. Fixed bonuses and reimbursements are added once and are not multiplied. The deterministic engine remains the only authority; React components only display validated results.

The salary summary shows the type, payable working time, resolved base hourly rate, type multiplier, type-adjusted hourly rate, and calculated gross compensation. Detailed disclosure continues to show per-segment duration, combined multiplier, labels, and pay.

## Persistence and compatibility

Migration 7 is additive:

- `shift_templates.pay_multiplier_basis_points` is non-null with a neutral `10000` default;
- `shifts.shift_type_name_snapshot` preserves the label used when the shift was created;
- `shifts.shift_type_pay_multiplier_basis_points` is non-null with a neutral `10000` default;
- linked legacy shifts and recurrence JSON receive neutral snapshots;
- salary-staleness triggers include multiplier changes;
- salary engine version advances to `1.1.0` for shift types, `1.2.0` for the first default overtime tier, and `1.3.0` for the second tier and 12-hour policy.

Existing shifts therefore calculate exactly as before. Entity schemas accept absent new fields so older result JSON, test fixtures, and backup version 1 payloads remain readable; current SQLite writes normalize absent values to 100%.

The duration policy is deliberately not a database constraint: legacy records and overdue live clock-outs must remain readable and recoverable. Creation/manual-entry boundaries prevent new over-limit shifts; existing over-limit shifts can be shortened or edited without lengthening; and payroll returns an explicit error with no total for any unresolved range over 12 hours.

Editing a type never updates existing shifts. Permanent deletion uses `ON DELETE SET NULL` for the live shift reference and removes the live reference from recurrence JSON. Snapshotted name and multiplier values remain. A finalized salary snapshot is not invalidated merely because its source type was deleted. Selecting a different type or multiplier on a completed shift uses the existing stale/recalculate/version-history path.

Backup export, replace restore, and merge restore include the new type and shift fields. Old version 1 backups import with 100% defaults. Merge continues to remap type IDs in both shifts and recurrence JSON.

## Workplace isolation, permissions, and audit scope

Shiftty currently has no accounts, employees, organizations, server tenant, authentication, or RBAC administrator role. It is a single-user, local-first app whose data boundary is the device SQLite database. “Administrator” in this feature means the person controlling Settings on that device; the implementation does not claim multi-user administrative authorization.

Workplace integrity is still enforced at the available boundaries: shift forms reject archived or cross-workplace roles/types, template selection changes a scoped workplace atomically, salary coordination rejects cross-workplace wage sources, and backup validation rejects cross-workplace role/profile references. A future synchronized multi-user product must add authenticated tenant IDs and server-enforced authorization rather than treating workplace IDs as a security tenant.

There is no general actor-attributed audit-event table in the current product. Existing audit guarantees remain intact: entity creation/update timestamps, immutable shift type name/multiplier snapshots, and versioned salary-calculation snapshots with engine version, applied rules, segments, and totals. The UI and documentation do not overstate those records as a compliance audit log.

## RTL and accessibility

All new copy is available in Hebrew and English. Percentage and time values stay numeric and readable inside RTL layouts. Type, weekday, break-type, archive, restore, duplicate, and delete controls expose native accessibility roles/states; weekday labels use localized translation keys rather than hard-coded internal indices. Logical start-side borders and row direction support both RTL and LTR.

## Verification coverage

Automated coverage includes:

- migration upgrades from empty and versions 1–7;
- neutral legacy backfill and SQLite constraints;
- repository create/update/duplicate/delete and recurrence-reference cleanup;
- type selection, default-time application, individual time override, and snapshot persistence;
- fallback clock-in and recurrence propagation;
- exact 150% pay at a 60.00 hourly rate;
- additive stacking, stronger non-stacking rules, minimum duration, and cross-midnight segmentation;
- the exact 480/120/120-minute regular/125%/150% split at 60.00/hour, including cross-midnight and 150% shift-type stacking;
- exact-12-hour acceptance, over-limit rejection, legacy-edit compatibility, and overdue live clock-out recovery;
- salary-summary and shift-detail display;
- backup export/replace/merge compatibility;
- Hebrew translations, RTL direction, and existing salary snapshot history.
