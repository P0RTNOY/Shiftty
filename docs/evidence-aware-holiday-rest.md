# Evidence-aware holiday and weekly-rest estimates

Implemented: 2026-08-25

## Purpose and safety boundary

Salary engine `1.5.0` can evaluate user-confirmed holiday, weekly-rest, and custom intervals entirely offline. The feature keeps two independent facts separate:

1. **Calendar evidence** records a named, bounded interval, its calculation timezone, where it came from, and when the user confirmed it.
2. **A pay rule** decides whether a matching interval changes the gross estimate, which multiplier applies, whether its premium stacks, and the salary-profile/effective-date scope.

Saving or confirming calendar evidence alone never changes salary. An interval without a matching enabled pay rule still splits the calculation at its exact boundaries and is recorded in the explanation, but every affected minute remains at the otherwise applicable multiplier. This lets a user preserve a calendar fact before deciding how, or whether, it belongs in their employment arrangement.

Shiftty does not infer legal entitlement, lawful permission to work, an employer permit, a collective or personal agreement, religious identity, a weekly-rest choice, or a mandatory multiplier. The output remains a configurable gross-pay estimate, not payroll, legal advice, or Israeli labor-law compliance software.

## Existing rule compatibility

Before this milestone, two related conditions already existed:

- `holiday` matched an interval supplied by the injected `HolidayProvider`.
- `weekend` evaluated a rule-owned recurring weekday/time window directly in the salary-profile timezone.

Both serialized forms remain readable and retain their established behavior. `NO_HOLIDAYS` is still the neutral legacy provider and performs no network request. For compatibility, a legacy `holiday` condition also matches a new confirmed evidence interval whose type is `holiday`. A legacy `weekend` condition is not silently rewritten as personal weekly rest, because a generic weekend window has no user-confirmed evidence or source provenance.

New evidence-aware rules use the generalized condition:

```ts
{
  type: 'specialInterval',
  intervalTypes: ['holiday', 'weekly_rest', 'custom'],
}
```

This is the canonical route for new holiday/rest/custom rules. It targets interval types rather than hard-coded weekdays. The optional `premiumFamily` field makes multiplier interaction explicit; Migration 9 leaves it `NULL` for legacy rules so their previous ordinary behavior is not reclassified during upgrade.

## Calendar evidence model

`CalendarEvidenceInterval` contains:

- a stable, bounded ID;
- a required workplace and optional salary-profile scope;
- `holiday`, `weekly_rest`, or `custom` type;
- a user-facing name of at most 120 characters;
- exact, half-open start/end instants and an IANA calculation timezone;
- `manual`, `confirmed_preset`, or `imported` source kind;
- optional bounded source title and HTTP/HTTPS URL;
- optional preset ID and version, required for `confirmed_preset` records;
- a required confirmation timestamp;
- created/updated timestamps; and
- explicit archive state and archive timestamp.

The schema and database reject an invalid timezone, a zero-length or reversed range, unsafe URL protocols, overlong names/source metadata, inconsistent archive state, and a confirmed preset without both ID and version. Database triggers reject a salary-profile reference that belongs to another workplace. Repository range queries use half-open overlap (`interval.start < shift.end` and `interval.end > shift.start`) and exclude archived evidence unless history is requested.

Workplace-scoped evidence can apply to compatible profile calculations at that workplace. Profile-scoped evidence applies only to that exact effective-dated profile ID. Evidence from another workplace or profile is ignored. Duplicate interval IDs are rejected by the pure engine; valid inputs are sorted by start, end, type, and stable ID so repository order cannot affect the result.

Archiving removes evidence from new calculations while retaining the row. Permanent deletion is available behind confirmation. Neither operation removes the evidence copy already frozen in an older salary snapshot.

## Weekly-rest schedule and occurrence semantics

A salary profile can own at most one `WeeklyRestSchedule`. It stores an editable label, local start weekday/time, local end weekday/time, enabled state, confirmation timestamp, optional source provenance, and archive state. The timezone is inherited from the salary profile when occurrences are resolved; it is not duplicated as an independently editable schedule timezone.

The default is disabled. The UI may display editable Friday/Saturday example values before activation, but it does not enable them, treat them as the user's choice, or infer religion. Enabling requires an explicit confirmation after the exact preview is shown. A schedule whose start and end boundaries are identical is rejected.

Occurrences are generated only for the requested half-open calculation range. Future rows are not materialized. Resolution is bounded to at most 370 days and creates stable occurrence IDs in the form `weekly-rest:<schedule-id>:<local-start-date>`. Same-weekday end times later than the start form a same-day interval; an earlier or equal end time resolves to the following occurrence of that weekday. Different weekdays use the forward weekday distance, so overnight and multi-day intervals are explicit.

Local wall-clock boundaries are resolved in the salary profile's IANA timezone, while paid duration uses absolute elapsed time. At a spring-forward transition, a nonexistent local boundary moves deterministically to the corresponding later time. At a fall-back transition, an ambiguous wall time selects the earlier absolute occurrence. A nominal recurring interval can therefore contain fewer or more elapsed minutes during a DST transition; tests fix both behaviors.

The weekly-rest schedule and the workweek used for weekly-overtime accumulation are intentionally separate. Choosing a rest interval does not change the workweek start or weekly threshold, and configuring a workweek does not create weekly-rest evidence.

The settings flow keeps the schedule and its pay effect as two explicit save stages on the same card. First, the user selects and confirms the recurring local window. After that persisted window is active, the card exposes an optional total-rate percentage backed by a normal profile-scoped `specialInterval: weekly_rest` pay rule. For example, `150%` means a total 1.5-times base rate, not an additional 150% premium. The simple control owns only the enabled deterministic `weekly-rest-pay:<profile-id>` rule and never rewrites an incompatible, disabled, effective-dated, stacking, or otherwise advanced rule. Other matching rules remain visible by name/state and can be reviewed in the advanced editor. Effective-dated salary-profile versioning remaps the managed ID to the new profile so lowering a rate cannot leave a stronger cloned duplicate behind.

This same-screen workflow does not couple the underlying records or imply an atomic combined save. A window can remain active with no pay effect, and the UI states that explicitly. Editing the window requires a new confirmation before its simple pay rule can be changed. Disabling the recurring window does not delete pay rules because they may also apply to separately confirmed manual `weekly_rest` intervals.

## Preset and source provenance

This foundation intentionally includes one small, reviewable fixture instead of a broad national calendar:

| Field | Value |
| --- | --- |
| Preset ID | `il-csc-independence-day-2026-date-only` |
| Preset version | `1` |
| Name | `יום העצמאות — 2026` / `Independence Day — 2026` |
| Type | `holiday` |
| Timezone | `Asia/Jerusalem` |
| Preview interval | `2026-04-22T00:00:00+03:00` to `2026-04-23T00:00:00+03:00` |
| Source | [Civil Service Commission, “ימי מועד, ימי בחירה וימי עבודה מקוצרים לשנת 2026”](https://www.gov.il/BlobFolder/policy/calendar_2026/he/calendar_2026.pdf), circular 26/2025 |
| Retrieved | 2026-08-24 |

The official circular identifies the civil date as Wednesday, 22 April 2026; it does not supply hourly boundaries. Midnight-to-midnight is therefore an editable Shiftty preview assumption, not a sourced sunset, religious, employment, or statutory boundary. The preview displays the exact local instants, source title, URL, retrieval date, preset version, and assumption. The user must explicitly confirm before application. Acceptance clones the values into an editable, user-owned profile-scoped interval; a later built-in preset revision cannot silently update the accepted record.

The circular is scoped to Civil Service planning and expressly says its provisions do not apply to shift workers. Shiftty copies only the named civil date. It does not copy the circular's workforce availability classification or treat it as evidence that a Shiftty user is entitled to time off or premium pay. The English name is a product localization, not a claimed official translation.

The official Ministry of Labor service [“בקשה להיתר העסקה בשעות נוספות ובמנוחה השבועית”](https://www.gov.il/he/service/request-for-employment-during-weekend-or-extra-hours), retrieved 2026-08-24, was consulted for the term `מנוחה שבועית`. Its discussion of different possible rest days, employee choice, and employer permits reinforces why the app asks the user to configure a relevant interval directly. It is not used to select a weekday, store religion, decide permission, or assign pay.

The government “Holidays in Israel” open-data resource was reviewed but not bundled. On the retrieval date, its live rows conflicted with the Civil Service calendar for representative 2026 dates. The package can be inspected through the [official data.gov.il API](https://data.gov.il/api/3/action/package_show?id=405e5b54-5445-48aa-9120-06c9c4764a84). Excluding that broad dataset avoids presenting inconsistent date data as authoritative evidence.

## Calculation and overlap behavior

The coordinator loads persisted overlapping evidence for the shift's workplace/profile and expands a compatible enabled weekly-rest schedule for that shift's source range. It combines them deterministically. A persisted user interval wins the improbable case of an ID collision with a generated occurrence.

The engine adds every evidence start/end to its boundary set, so partial overlaps and intervals crossing midnight split salary segments exactly. Membership is half-open: the start instant is included and the end instant is excluded. Overlapping evidence intervals remain separately visible in provenance, but an applicable rule ID is applied only once to a segment even if two matching intervals caused the same condition to be true.

Multiplier rules are resolved by explicit families:

- shift/day/week `workedMinutes` rules remain the overtime family, with only the strongest applicable overtime multiplier contributing;
- new `specialInterval` multiplier rules default to the special-interval family;
- the strongest non-stacking special-interval multiplier wins by basis points, with existing deterministic rule comparison as a tie-breaker;
- the selected non-stacking special rule competes with the ordinary non-stacking/shift-type baseline rather than duplicating the base 100%;
- a stacking special rule contributes only its premium above 100%;
- an explicitly stacking overtime winner contributes only its premium above 100%; and
- rule ordering cannot change the result.

For example, a 175% non-stacking holiday rule, a 150% snapshotted shift type, and a stacking 125% overtime rule resolve to `100% + 75% + 25% = 200%`. A 150% holiday rule and an explicitly stacking 125% weekly-rest rule resolve to 175%, not 275%. Two overlapping custom intervals that match the same 125% rule still apply that rule once.

Fixed bonuses, reimbursements, and minimum-duration adjustments remain once-per-rule, once-per-shift components. Evidence segmentation does not duplicate them. The established workweek accumulation, break, rounding, and fixed-component policies remain unchanged. Engine `1.6.0` retains the 12-hour new/manual input guard while allowing a truthful overdue live shift to keep a numeric estimate for every recorded minute.

## Frozen salary provenance and Salary Trust

Engine `1.5.0` added optional `specialIntervalIds` to pay segments and optional `specialIntervalEvaluations` to the result; engine `1.6.0` preserves that snapshot shape. Each frozen evaluation contains only the bounded information needed for later explanation:

- interval and optional schedule ID;
- name, type, exact start/end, and timezone;
- source kind and optional source title/URL;
- optional preset ID/version;
- confirmation timestamp;
- applied pay-rule IDs; and
- whether the interval contributed to the estimate.

Arbitrary imported source content is not copied into the snapshot. Snapshot readability does not depend on the live evidence or schedule row: editing, archiving, deleting, restoring a backup, or changing a built-in preset cannot rewrite the frozen explanation.

The reusable Salary Trust disclosure shows the localized interval type/name, exact boundaries, timezone, confirmation/source provenance, preset identity where present, frozen applied-rule IDs, combined segment multiplier, and whether the interval contributed. It also explicitly states when no pay rule exists. Source URLs are kept left-to-right and selectable inside Hebrew UI. Contribution is derived by a deterministic counterfactual money/component comparison, so a rule that matched but lost to a stronger multiplier or otherwise changed no amount does not promote trust.

Trust states remain `unavailable`, `basic_estimate`, and `configured_estimate`. A complete result is promoted by special-interval evidence only when an applicable configured rule actually contributed. Confirmed evidence with no pay effect does not by itself promote trust. Missing, incomplete, erroneous, and stale results remain unavailable; a legitimate finalized gross total of zero remains numeric zero. No trust state or legal-verification flag is persisted.

## Staleness and historical guarantees

Finalized snapshots remain immutable and authoritative until explicit recalculation creates a new version. Migration 9 and the repositories mark only affected finalized calculations stale:

- inserting an active interval targets completed shifts whose salary range overlaps the exact half-open interval, workplace, and optional frozen profile scope;
- editing boundaries, type, scope, name, source, confirmation, or archive state evaluates both the old and new ranges and any frozen interval-ID reference;
- deleting evidence evaluates the old range and frozen references before removing the live row;
- saving, disabling, archiving, or deleting a weekly-rest schedule evaluates its old/new generated occurrences for compatible finalized shifts and also follows frozen `scheduleId` references;
- saving or deleting a special-interval pay rule evaluates its old/new applicable types, effective dates, simple static scope, current evidence/schedule overlaps, and frozen applied-rule references; and
- moving or editing a completed shift uses the established target-shift salary-sensitive invalidation.

Unrelated workplaces, effective-dated salary-profile IDs, non-overlapping ranges, and non-finalized calculations are not invalidated by evidence changes. Recalculation is never automatic: the stale status is visible and non-numeric, the old result JSON stays readable, and explicit recalculation writes a new snapshot version.

## Migration 9 and persistence

Migration 9 is additive. It:

- adds nullable `pay_rules.premium_family`;
- creates `calendar_evidence_intervals` and `weekly_rest_schedules` with foreign keys and validation checks, including an optional schedule link for bounded persisted weekly-rest evidence;
- adds bounded workplace/profile range indexes;
- enforces workplace/profile isolation;
- adds targeted interval and frozen-provenance staleness triggers; and
- inserts no evidence or schedule rows.

Existing pay rules, salary totals, snapshot JSON, and workweek configuration are not rewritten. Weekly rest remains disabled because no schedule is created automatically. The migration validator upgrades an empty database and every supported v1–v9 database and runs SQLite integrity and foreign-key checks.

## Backup compatibility

Backup envelope version 1 remains supported. Current exports add `calendarEvidenceIntervals`, `weeklyRestSchedules`, pay-rule `premiumFamily`, and the optional frozen result provenance. Older V1 backups omit the new arrays and restore them as empty neutral defaults.

Replace restore writes active and archived evidence/schedules, including optional schedule links, and preserves snapshot content. Merge restore validates workplace/profile references, compares colliding rules and snapshots semantically rather than trusting timestamps, remaps interval, synthetic recurring-interval, schedule, pay-rule, and snapshot provenance IDs, and does not depend on snapshot array order when choosing a current snapshot. A conflicting second weekly-rest schedule for one profile or a non-identical snapshot-version collision fails explicitly instead of being silently discarded. Invalid evidence, broken references, duplicate IDs, and count mismatches fail validation; archived/deleted live evidence does not erase an already frozen snapshot explanation. Restore completes with SQLite foreign-key and integrity checks.

## Settings, reports, and exports

Advanced Salary Settings exposes **חגים ומנוחה שבועית / Holidays & weekly rest** without changing the hourly-rate-first setup. The flow supports a disabled-by-default recurring schedule, an exact occurrence preview, explicit two-stage weekly-rest window/rate configuration, manual profile- or workplace-scoped intervals, source metadata, the reviewed representative preset, rule-effect status, direct navigation to the advanced type-scoped pay-rule editor, edit, archive/restore, and confirmed deletion.

All copy is translated. Disclosure controls announce expanded/collapsed state, choices expose radio/checkbox/switch state, touch controls retain native roles, and logical layout follows RTL/LTR. Dates, times, percentages, and URLs use directionally isolated, wrapping text; evidence type/effect is stated in words and not represented by color alone.

`MonthlyReport` remains the single report model. It obtains concise interval labels from the immutable salary snapshot and never queries live evidence for historical rows. Only intervals that contributed are shown in compact report/PDF/CSV labels; full source URLs remain in detailed Salary Trust disclosure. No evidence occurrence becomes a fake shift or report row. PDF and CSV keep one localized estimate/provenance note, missing/stale/incomplete salary remains non-numeric, finalized zero remains zero, CSV user text remains formula-safe, and PDF retains RTL pagination/repeated-header behavior.

ICS remains calendar-only. It exports no salary amount, evidence provenance, source URL, interval label, pay-rule ID, multiplier, trust state, or entitlement claim.

## Known limitations

This foundation does not provide automatic calendar synchronization, a comprehensive Israeli or worldwide holiday dataset, religious-calendar calculations, sunset boundaries, employee or employer entitlement decisions, permit verification, agreement interpretation, night-work presets, taxes, National Insurance, pension, deductions, benefits, or net pay. Imported sources are user-confirmed inputs, not independently authenticated legal evidence.

The included fixture demonstrates a safe versioned preset workflow; it is not a complete calendar. Users must review exact boundaries and explicitly save a separate pay rule—using the same weekly-rest card or the advanced editor—that reflects their own verified arrangement. Professional payroll or legal review remains necessary where correctness or entitlement matters.

## Verification recorded for this milestone

The 2026-08-25 repository gate passed type checking and linting; 131 Jest suites containing 652 tests passed; Migration 9 validation passed for empty and v1–v9 databases; the Expo web export produced 37 static routes; public Expo configuration generation passed; and `git diff --check` passed after the documentation update. `expo install --check` continues to report the accepted baseline of eight SDK 57 patch-level notices, and dependencies were not updated.

The current Debug development client built, installed, and launched on the booted iPhone 17 Pro simulator running iOS 26.5. A representative profile database upgraded to Migration 9, and the Holidays & weekly rest settings route was visually inspected in Hebrew and with English localized copy, including the disabled recurring-rest state and legal-safety disclosure. The dev-client connection did not remain stable enough to claim the complete manual interaction matrix. Manual interval creation, configured-rule results, Shift Details, Reports, Dynamic Type extremes, and the native accessibility tree remain automated-only for this milestone. Android and physical-device verification were not performed.

## Dynamic weekly-rest configuration follow-up — 2026-08-29

The profile-scoped weekly-rest card now makes the existing evidence/rule separation actionable in one place. After the user saves and confirms an arbitrary recurring weekday/time window, a second explicit control can create or update a dedicated total-rate rule for `weekly_rest`. It starts empty rather than assuming 150%. Advanced matching rules are listed separately, incompatible managed-ID collisions are never overwritten, and changing an unsaved window blocks the simple rule update.

Shift Details now exposes grouped effective rate tiers and premium pay before the expandable component list. Automated coverage fixes the reported workplace example: Friday 18:00 through Sunday 18:00 at a user-entered 150% total rate. The real completed Saturday 17:23 through Sunday 05:24 shift at ₪60/hour resolves to 480 minutes at 150%, 120 minutes at 175%, and 121 minutes at 200%, totaling ₪1,172. Without the explicit weekly-rest rule, the product-default overtime resolves to 480 minutes at 100%, 120 minutes at 125%, and 121 minutes at 150%, totaling ₪811.50. A disabled/unconfirmed weekly-rest schedule or a missing pay rule remains neutral rather than silently assuming Saturday entitlement.

The complete source gate passed type checking, zero-warning lint, 141 Jest suites containing 718 tests, empty and v1–v9 migration validation, Expo export of 37 static routes, the accepted exact 12-notice SDK 57 compatibility baseline, public configuration, production iOS configuration/surface audits, and patch-whitespace validation. No migration, dependency, backup format, stored snapshot, or historical total changed.
