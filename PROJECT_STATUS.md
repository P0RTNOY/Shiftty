# Shiftty Project Status

Last updated: 2026-08-27

## External Native Evidence Closure — 2026-08-27

Milestone 6 is based on `c2730d7cda7e08fd99631d2e91438862468f9222` on branch `codex/external-native-evidence-closure`. The complete product-bearing native commit is `f89d798fb68769a0b5a819fbf0d8c3467134b9fc`; later commits stabilize Maestro journeys and record evidence without changing the application binary. The final source SHA and hosted workflow run are recorded in the handoff after exact-SHA verification.

An isolated user-local Android toolchain now provides API 36, Build Tools 36.0.0, Platform Tools 37.0.1, Emulator 37.1.11, NDK 27.1.12297006, CMake 3.22.1, and an API 36 `google_apis` ARM64 system image. A clean arm64 Release built and installed as `com.shifty.app` on the pinned disposable emulator. The installed 45 MB APK has SHA-256 `8d9bfba9c341c2e5c0f7e54a69239cd016b5035ac17675ee060d7cedca89d143`.

All seven Android production-UI Maestro journeys passed using a fresh driver process per journey. They cover first use and cold persistence; active shift/open-break background and terminated-process recovery; finalization through Home, Calendar, Shift Details, and Reports; 150% shift types; effective-dated weekly threshold crossing with no duplicate default overtime; neutral evidence, explicit rule/recalculation, and frozen provenance; finalized zero; native share entry points; and the real notification permission/settings path. A separate clean-data run explicitly asserted Hebrew welcome/privacy copy, completed Hebrew workplace/rate onboarding, and cold-relaunched to Home. Manual checks also passed Hebrew RTL, English LTR, light/dark, font scale 1.3, system Back, native pickers, numeric salary keyboards, and offline cold launch. No Shiftty fatal JavaScript, native, or SQLite match was found in the final log audit.

Android native inspection directly proved one logical reminder, dedupe, cancellation, foreground delivery, background delivery, plain-process-kill receiver delivery, and force-stop/user-relaunch reconciliation. Two reproduced product defects were fixed: persisted native IDs could survive after Android removed their alarms on force-stop, and foreground notifications were not presented because no handler was registered. The reconciler now compares persisted/native state and recreates only missing desired reminders; root startup registers visible foreground presentation. Focused tests cover both behaviors.

Production Android UI generated PDF, CSV, calendar-only ICS, and backup artifacts through real share/document workflows. Independent parsers validated them, including a one-event ICS with no financial payload. Real DocumentsUI replace-restored the established complex Milestone 5 V1 backup; cold relaunch restored the active shift/open break; completing it preserved seven prior frozen snapshots deeply equal and created exactly one new finalized snapshot. The copied database returned `integrity_check = ok` and zero foreign-key rows.

The physical iPhone 15 Pro Max on iOS 26.6 received a side-by-side Release QA bundle, `com.omerportnoy.shifty.m6qa`, built with the existing Apple Development identity and team `9R9UQ6GTQW`. Deep/strict signing verification, install, launch, onboarding/persistence, open-break background and SIGKILL/cold recovery, finalization, Reports, a real CSV share sheet, Hebrew RTL, English LTR, permission grant, one-reminder scheduling, and relaunch dedupe passed. QA SQLite integrity remained `ok`, and no matching crash report was found. The existing production dogfood application and database were not installed over, launched, cleared, uninstalled, or modified.

The physical foreground banner was not captured; background/terminated delivery, notification tap, pre-trigger cancellation, and timezone variation were not directly completed. Maestro cannot enumerate physical iOS in this environment, and a temporary XCUITest runner could not install because the free development profile had reached its three-app device limit. No protected or unrelated app was removed to bypass it. The QA bundle is development-device evidence, not production-bundle/archive/TestFlight/App Store signing evidence.

The current implementation run passed **138/138 Jest suites and 692/692 tests**. Expected SQLite constraint and foreign-key messages were emitted by passing negative integration tests. The complete gate is rerun on the final documentation commit, after which only this branch is pushed and one exact-SHA hosted GitHub Actions result is inspected. The workflow is read-only, secret-free, non-deploying, time-bounded, disables checkout credential persistence, and includes release configuration/asset assertions without duplicating the full suite.

No migration, backup V1 format, salary total, calculation behavior, historical snapshot, or public identifier changed. The raw Expo check currently reports 13 exact SDK 57 patch notices; CI accepts only those reviewed pairs and fails on drift. The dependency boundary remains 16 transitive Expo/Metro developer-toolchain advisories (12 moderate, 4 high), with no compatible non-force repair; no forced dependency update was made.

Evidence-based verdict: **`SOURCE_READY_NATIVE_BLOCKED`**. Android emulator evidence is complete and the source has no known P0/P1 defect, but the required physical-iPhone notification delivery/cancellation/timezone matrix remains incomplete. Physical Android, production signing, and store distribution also remain separately unverified. Detailed evidence is in `docs/MILESTONE_6_EXTERNAL_NATIVE_EVIDENCE.md`.

## Native Artifact and Cross-Platform Verification — 2026-08-26

Milestone 5 is based on `0908c7b3214abc55efebfc6a70893c4168cc58cf` on branch `codex/native-artifact-cross-platform-verification`. Its only source correction is narrow PDF manual pagination plus regression tests; salary arithmetic, report semantics, persisted schemas, backup V1, and historical snapshots are unchanged. The exact final SHA is recorded in the milestone handoff.

The arm64 iOS Simulator Release ran standalone as `com.omerportnoy.shifty` on the pinned disposable iPhone 17 Pro clone, iOS 26.5, UDID `73B7FFB2-1EC0-470C-B7E5-38D401BA4255`. Production English and Hebrew flows generated PDF, CSV, calendar-only ICS, and backup files through real iOS share sheets. Independent `pypdf`, Quick Look, Python standard-library CSV, `icalendar`, and `qpdf` readback verified the outputs. The corrected PDF spans three pages with the table header repeated on every page, and Hebrew RTL was inspected visually in Quick Look. `qpdf` exits 3 on Quartz offset-0 object warnings even though the files open and parse; no clean `qpdf` result is claimed.

CSV readback found 29 data rows, UTF-8 BOM/CRLF, formula-protected user fields, one estimate note, numeric finalized zero, and empty missing/outdated salary. ICS contained 29 valid UTC events and no salary/payroll/rate/multiplier/evidence/rule/source/trust/entitlement content. Backup V1 for app 0.1.0 contained 33 shifts, two workplaces/profiles, rule/evidence and archived records, scheduled and active/open-unpaid-break states, zero/nonzero/stale/missing salary, and frozen history, with no credentials or secrets.

The real production document picker selected **On My iPhone → `m5-source-backup.json`**. Replace restore succeeded, and a cold relaunch showed the restored active shift and open unpaid break. SQLite integrity returned `ok`, foreign-key check returned no rows, and a native re-export matched source canonical data at recorded SHA-256 prefix `b15aad…`; only `exportedAt` differed. Bounded merge of the same file succeeded. Full end review then completed the restored active shift/open break, finalized a new nine-minute snapshot for 1,125 minor units, retained the prior historical result JSON at recorded SHA-256 prefix `f419…`, and correctly marked the later weekly-dependent shift stale.

The compact quick-review Save control was outside the automation viewport with a tall disclosure, but the scrollable full end-review production path succeeded; this is an automation limitation, not a validated defect. A fixed-date weekly-overtime expectation initially used 2026-08-25, which correctly resolved to the older salary profile. Continuing on 2026-08-27 under the intended effective profile passed with eight hours at 150%; the original date assumption is not a product failure.

Physical iPhone and Android verification remain blocked. The connected iPhone 15 Pro Max runs iOS 26.6 and already holds the same stable bundle; the project team beginning `9R9…` does not match the only signing identity, whose team begins `7R88…`, and no provisioning profiles are installed. No physical build, install, launch, notification, lifecycle, or data mutation was attempted. Android has no complete SDK, Android Studio, emulator, AVD, or device; `adb` 37 plus an incomplete Unity SDK is insufficient, so no Android build/runtime pass is claimed.

No hosted GitHub Actions workflow/run is registered remotely and the exact candidate is not remote; the branch was not pushed. The local workflow remains least-privilege and command-aligned, but it does not invoke the `release:preflight` wrapper's additional release-configuration/asset assertions. The committed candidate passed typecheck, lint, **137/137 suites and 685/685 tests**, migration and Expo/config validation, release preflight, and patch-whitespace checks. Expected SQLite rejection diagnostics came from negative integration tests. An independent review found only the PDF pagination correction, its regression assertions, and Milestone 5 documentation in the base-to-candidate diff.

Evidence-based verdict: **`SOURCE_READY_NATIVE_BLOCKED`**. Simulator artifact readback and OS document-picker restore are now complete. Safe physical-iPhone signing/install, Android build/runtime, hosted CI, TestFlight/App Store/Google Play credentials, and store metadata/privacy/support assets remain unresolved. Exact evidence is in `docs/NATIVE_VERIFICATION_REPORT.md`; release commands and boundaries are in `docs/RELEASE_BUILD.md`.

## Beta Stabilization and Release Readiness — 2026-08-25

Milestone 4 implementation is complete; release readiness remains evidence-scoped and blocked on native file readback/restore verification. The source candidate resolves Expo SDK 57's eight patch compatibility notices, exposes the public name **Shiftty / שיפטי** while preserving stable legacy bundle/package/project identifiers, defines credible EAS development/preview/production profiles, adds a deterministic release preflight and least-privilege CI, and provides six disposable Maestro production-UI journeys.

Stability and recovery work is evidence-driven. Notification mutations are serialized to prevent duplicate native scheduling under concurrent foreground/navigation/shift requests. Salary evidence and recurring-rest reads are batched by workplace/profile context and filtered back to exact shift ranges; in a 365-shift/250-unrelated-workplace scenario, role reads fell from 251 to 1, unrelated profile reads from 250 to 0, evidence reads from 365 to 1, and weekly-rest reads from 365 to 1. The isolated Jest body took approximately 5.6 seconds with approximately 163 MB maximum process RSS, which is query-bound evidence rather than a native benchmark. Database initialization validates the complete migration-history prefix. Disposable SQLite tests cover empty and v1-v9 upgrades, interrupted rollback/retry, missing and future history rejection, malformed/invalid backups, transactional replace rollback, merge collisions, active/open-break constraints, legacy data, and a 250-shift zero-rate round-trip. A localized startup recovery boundary offers retry and a privacy-minimal diagnostic that excludes database paths, messages, and user records.

The product copy and route modules have been audited for the public spelling, Hebrew/English translation coverage, RTL/LTR structure, logical weekdays, currency/percentage directionality, font scaling, and accessible action/state metadata. The CI workflow performs a locked install, typecheck, lint, full Jest suite, migration validation, Expo web export, Expo compatibility/public-config checks, and patch-whitespace validation with read-only permissions and no deploy step. Release configuration, rollback boundaries, privacy limits, exact build commands, and external prerequisites are documented in `docs/BETA_READINESS.md`, `docs/NATIVE_VERIFICATION_REPORT.md`, and `docs/RELEASE_BUILD.md`.

The complete post-review source gate passed with **137 suites / 685 tests**, plus typecheck, lint, empty and v1-v9 migration validation, Expo export of all 37 routes, clean Expo dependency compatibility, public-config resolution, and `git diff --check`. `npm run release:preflight` reran the same source checks successfully and listed external release prerequisites separately. A hosted GitHub Actions run is not claimed.

A fresh arm64 iOS Release built with Xcode 26.6, installed, and launched standalone on an iOS 26.5 disposable iPhone 17 Pro-class Simulator. Maestro then passed all six final flows in 11 minutes 50 seconds, including cold relaunch, active/open-break restoration, archived shift-type snapshots, effective-dated weekly overtime, evidence neutrality/selective staleness/recalculation, finalized zero, and PDF/CSV/ICS/backup share-sheet presentation. Hebrew RTL/dark and English LTR/light surfaces were inspected. The native SQLite database reached exact Migration 9, passed integrity and foreign-key checks, and a controlled migration-history mismatch showed the non-destructive recovery screen before clean restoration. Report-row width and iOS picker accessibility defects found during the walkthrough were fixed, regression-tested, rebuilt, and included in the 6/6 rerun.

The verdict is **`SOURCE_READY_NATIVE_BLOCKED`**. Real iOS share sheets were exercised, but the generated PDF/CSV/ICS/backup files were not read back and no backup was selected and restored through the OS document picker. It does not claim a physical-iPhone, iPad, Android, TestFlight, App Store, or hosted-CI pass. The connected iPhone 15 Pro Max retains an older dogfood app/database and was not overwritten; a safe side-by-side physical build stopped because no provisioning profile existed and profile creation was outside scope. No Android SDK/emulator/device was available. Exact evidence and external blockers are recorded in `docs/NATIVE_VERIFICATION_REPORT.md`.

## Evidence-Aware Holiday and Rest-Day Rules Foundation — 2026-08-25

Salary engine `1.5.0` now evaluates explicitly confirmed holiday, weekly-rest, and custom intervals offline while keeping calendar evidence independent from pay rules. An interval by itself records and explains a calendar assumption but does not change the gross estimate.

- `CalendarEvidenceInterval` stores exact half-open instants, IANA timezone, workplace/optional effective-profile scope, localized or user-defined name, `manual`/`confirmed_preset`/`imported` provenance, optional source title/URL and preset ID/version, confirmation time, and archive history. Validation bounds metadata, rejects invalid or zero-length ranges and unsafe URLs, and enforces workplace/profile isolation.
- A salary profile can own one disabled-by-default recurring weekly-rest schedule with user-selected weekday/time boundaries. Enabling requires confirmation. Occurrences are resolved only for a bounded requested range in the profile timezone; spring-forward gaps and fall-back ambiguity have fixed deterministic behavior, and no future occurrence rows are materialized.
- The advanced **חגים ומנוחה שבועית / Holidays & weekly rest** flow provides exact previews, source inspection, a single versioned date-only Independence Day 2026 fixture, manual profile/workplace intervals, rule-effect status, direct rule configuration, archive/restore, and confirmed deletion. It does not infer religion, a rest weekday, entitlement, permission, or a multiplier.
- New rules use `specialInterval` with selected `holiday`, `weekly_rest`, and/or `custom` types. Legacy `holiday` and `weekend` conditions remain readable; legacy holiday rules also recognize new holiday evidence, while legacy weekend windows are not relabeled as user-confirmed weekly rest.
- Explicit `ordinary`, `overtime`, and `special_interval` premium families make composition deterministic. The strongest non-stacking special rule wins, stacking special rules add only their premium above 100%, and the Milestone 2 strongest-single-overtime contract remains unchanged. Shift-type composition remains additive by premium; fixed bonuses, reimbursements, and minimum-duration adjustments remain single-application.
- Engine boundaries include every evidence start/end, including partial, midnight-crossing, and overlapping intervals. Results freeze interval/schedule identity, name/type, exact range/timezone, bounded source provenance, confirmation and preset metadata, applied rule IDs, contribution status, segment interval IDs, and the combined multiplier needed for later explanation.
- Salary Trust promotes a complete result on this path only when a configured special-interval rule actually contributed. Confirmed evidence with no matching rule stays an explained input with no pay effect. Missing, incomplete, erroneous, and stale salary remains non-numeric; a finalized legitimate zero remains zero.
- Migration 9 adds nullable pay-rule premium families plus indexed evidence/schedule tables, integrity constraints, workplace/profile guards, and targeted staleness triggers. It inserts no default evidence or schedule, changes no existing total, and rewrites no historical snapshot.
- Evidence insert/update/archive/delete, schedule changes, special-rule changes, and normal salary-sensitive shift edits mark compatible overlapping or frozen-provenance calculations stale without deleting their prior result. Explicit recalculation creates the next snapshot version.
- Backup envelope V1 remains readable. Current export/replace/merge includes active and archived evidence, recurring schedules, premium-family fields, and frozen provenance; legacy V1 restores empty/disabled neutral defaults. Merge remaps evidence, schedule, rule, and snapshot IDs and fails invalid or conflicting evidence instead of silently discarding it.
- `MonthlyReport`, PDF, and CSV show concise labels only for contributing frozen intervals and keep one estimate/provenance note. Full source URLs stay in detailed disclosure. Evidence never becomes a fake shift, CSV remains formula-safe, and ICS remains free of salary, source, rule, multiplier, and entitlement data.

Primary-source provenance and the complete behavior/limitation contract are recorded in `docs/evidence-aware-holiday-rest.md`. The representative preset uses Civil Service Commission circular 26/2025 only for the named civil date and explicitly discloses its midnight-boundary assumption and public-service/shift-worker scope limitation. The Ministry of Labor source is used for terminology and safety rationale, not for an inferred rest day or entitlement.

Fresh repository verification:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero errors/warnings |
| `npm test -- --runInBand` | Passed; 131 suites, 652 tests, 0 failures |
| `npm run validate:migrations` | Passed for empty and every supported v1–v9 database, including SQLite integrity and foreign-key checks |
| `npm run validate:expo` | Passed; web export produced 37 static routes |
| `npx expo install --check` | Reports the accepted baseline of eight SDK 57 patch-level dependency notices; dependencies were intentionally left unchanged |
| `npx expo config --type public` | Passed; public SDK 57 configuration generated for iOS, Android, and web |
| `git diff --check` | Passed after the Milestone 3 documentation update |

Native verification used the booted iPhone 17 Pro simulator on iOS 26.5. A fresh Debug development client for `com.omerportnoy.shifty` built with 0 errors and 2 existing non-blocking Xcode warnings, installed, launched, migrated a representative profile database to Migration 9, and rendered the new Holidays & weekly rest route in Hebrew and English. The Hebrew RTL settings, disabled recurring-rest state, no-entitlement copy, and progressive-disclosure cards were visually inspected; English localized copy was also inspected. The dev-client session became unstable during deeper interaction, so manual interval creation, configured-rule results, Shift Details, Reports, Dynamic Type extremes, and the accessibility tree are not claimed as native passes. No Android runtime or physical-device verification was performed. Automated coverage includes those interaction states plus the neutral migration, domain validation, manual/preset evidence, recurring rest and alternative weekdays, both DST transitions, exact segmentation, no-rule neutrality, premium-family money math, rule-order independence, overtime and shift-type interaction, scope isolation, targeted staleness, explicit snapshot versioning, deleted-row historical provenance, backup V1 replace/merge/remapping, Hebrew/English RTL/LTR and accessibility states, MonthlyReport/PDF/CSV behavior, calendar-only ICS, unavailable/stale salary, and finalized zero.

This remains a configurable gross-pay estimator. It does not determine holiday or weekly-rest entitlement, employer permits, religious identity, agreement coverage, statutory boundaries, mandatory multipliers, tax, National Insurance, pension, deductions, benefits, or net pay. A recommended follow-up is a user-driven evidence review/import workflow with conflict visibility and source-version reconciliation—not automatic legal or religious classification.

## Workweek-Aware Salary Engine — 2026-08-24

Salary engine `1.4.0` adds deterministic, opt-in weekly overtime while preserving existing behavior until a user explicitly enables or creates a weekly rule.

- Salary profiles now support a local workweek start, optional weekly regular-minute threshold, post-threshold multiplier, and net/gross basis. The Hebrew-first display defaults are Sunday, 42 hours, 125%, and net minutes, but Migration 8 leaves weekly overtime disabled for all existing data.
- Advanced Salary Settings keeps the hourly rate first and places the weekly controls behind an accessible disclosure. Weekdays are localized names, and Hebrew RTL/English LTR copy explains configuration, estimate, compliance, and frozen-history boundaries.
- The pure rule schema supports `workedMinutes.scope = 'week'`. Profile configuration becomes a deterministic in-memory rule; persisted generic weekly rules use the same engine path.
- Weekly accumulation uses the salary profile timezone and configured local weekday boundary. Context is chronological and isolated to the same workplace and resolved salary-profile version, including when the workweek begins in the previous report month.
- A payable minute receives only the strongest matching shift/day/week overtime premium. Shift-type and ordinary stacking premiums retain their documented behavior; fixed bonuses, reimbursements, and minimum adjustments remain single-application components.
- Engine results record applied weekly rule IDs, localized labels, exact threshold/multiplier explanations, and optional local `workweekAllocations` for dependency tracking. Explicit weekly provenance contributes to `configured_estimate`; absence of weekly configuration does not make an estimate unavailable.
- Context-only predecessor shifts affect accumulation but are excluded from requested results, aggregates, monthly report rows, PDF, and CSV. The authoritative `MonthlyReport` model and missing/stale/finalized-zero semantics are unchanged; ICS remains calendar-only.
- Migration 8 adds only salary-profile configuration and weekly dependency triggers. Frozen weekly provenance—not mutable live rule state—drives invalidation. Editing, deleting, changing breaks, or persisting a newly completed historical snapshot can mark only later compatible same-workweek finalized calculations stale. If an edit changes cohort, the destination is evaluated when explicit recalculation writes its new snapshot. Snapshot rows and result JSON are retained; recalculation remains explicit and creates a new version.
- Backup envelope version 1 remains supported. New fields round-trip through export, replace, and merge; older version 1 backups restore with Sunday/net defaults and weekly overtime disabled.

Implementation details, exact money examples, compatibility guarantees, and limitations are documented in `docs/workweek-aware-salary.md` and `docs/phase4-salary-engine.md`.

Fresh repository verification:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero errors/warnings |
| `npm test -- --runInBand` | Passed; 116 suites, 566 tests, 0 failures |
| `npm run validate:migrations` | Passed for empty and every supported v1–v8 database |
| `npm run validate:expo` | Passed; web export produced 36 static routes |
| `npx expo install --check` | Reports the accepted baseline of eight SDK 57 patch-level dependency updates; dependencies were intentionally left unchanged |
| `npx expo config --type public` | Passed; SDK 57.0.0 with iOS, Android, and web targets |
| `git diff --check` | Passed |

No native Simulator or physical-device verification was performed for this milestone. Automated coverage includes exact money, Sunday and alternate boundaries, month crossings, overnight allocation, multiple shifts, net/gross breaks, daily/weekly non-duplication, shift-type stacking, workplace/profile/timezone isolation, snapshot versioning and staleness, migration, backup, report/export, calendar-only ICS, Hebrew/English layout, and accessibility.

This is not an Israeli labor-law compliance engine. It does not infer the applicable threshold or agreement and does not add automatic holidays, weekly-rest/Sabbath classification, night-work legal presets, deductions, tax, pension, or net pay. The recommended Milestone 3 is an evidence-aware holiday and rest-day rules foundation with offline user-confirmed calendar inputs, agreement-specific presets, and explicit provenance—without automatic entitlement or compliance claims.

## Salary Trust Foundation — 2026-08-24

Salary-bearing screens and exports now identify Shiftty's figures as transparent gross estimates without changing the underlying salary arithmetic.

- A pure read-time classifier derives `unavailable`, `basic_estimate`, or `configured_estimate` from the existing result, issue provenance, and calculation status. Trust state is not persisted.
- Hebrew and English UI copy consistently uses estimate terminology. A reusable, accessible RTL/LTR disclosure explains the assumptions included in each calculation and the limits that are not fully modeled.
- The default 8-hour/125%/150% overtime schedule now records its own visible provenance and points users to Salary Settings. The default remains a product assumption, not a legal rule.
- Salary Settings, Shift Details, active tracking, quick clock-out, Home, and Reports share the same trust presentation. Missing, incomplete, and stale results remain explicit and non-numeric; a valid finalized zero remains numeric zero.
- Monthly reports, PDF, and CSV use localized estimated-gross terminology and include the estimate note once. ICS export is strictly calendar-only and contains no financial claims.
- Finalized salary snapshots remain authoritative historical records. The milestone does not rewrite historical result JSON, recalculate saved totals, add a migration, persist trust state, or change the version 1 backup format or its merge/replace behavior.
- Weekly overtime, automatic Israeli holiday determination, employer-specific agreements, deductions, tax, pension, National Insurance, and net pay are not fully modeled. The feature therefore makes no Israeli labor-law compliance claim.

The implementation and boundaries are documented in `docs/salary-trust-foundation.md`. The recommended next milestone is an opt-in, workweek-aware salary engine with configurable weekly thresholds and deterministic daily/weekly interaction.

Fresh repository verification:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero errors/warnings |
| `npm test -- --runInBand` | Passed; 112 suites, 520 tests, 0 failures |
| `npm run validate:migrations` | Passed for empty, v1–v6, and current v7 databases |
| `npm run validate:expo` | Passed; web export produced 36 static routes |
| `npx expo install --check` | Reports the accepted baseline of eight SDK 57 patch-level dependency updates; dependencies were intentionally left unchanged |
| `npx expo config --type public` | Passed; SDK 57.0.0 with iOS, Android, and web targets |
| `git diff --check` | Passed |

No native Simulator or physical-device verification was performed for this documentation completion pass. The Salary Trust changes are covered by domain, component, report/export, localization, accessibility, RTL/LTR, and static terminology tests.

## Predefined shift types and pay multipliers — 2026-08-24

The existing Shift Templates architecture now provides the user-facing **Shift Types / סוגי משמרת** feature without creating a parallel scheduling model.

- Settings supports create, edit, archive, restore, duplicate, and confirmed permanent deletion of shift types.
- A type defines default start/end times, break behavior, weekdays/color, and a validated 100%–1000% pay multiplier.
- Selecting a type prefills shift hours and break while leaving each shift editable. Scheduled, completed, live fallback, duplicate, suggestion, and recurrence paths carry immutable type name/multiplier snapshots.
- Salary engine `1.3.0` applies the type across the whole payable interval and adds a transparent default overtime policy when no worked-minute multiplier is configured: 480 net minutes at the ordinary applicable rate, 120 minutes with a stacking 25% premium, then 120 minutes with a stacking 50% premium. An explicit or disabled threshold replaces or opts out of both tiers.
- New schedules, shift-type defaults, manual completed shifts, and manual payable ranges are capped at 12 hours. Overdue live shifts can still be clocked out truthfully; their salary remains explicitly invalid until corrected, and legacy over-limit records remain readable without allowing lengthening.
- Shift Details and the salary summary show the type, working time, resolved base hourly rate, type multiplier, type-adjusted hourly rate, and gross compensation.
- Migration 7 gives legacy types/shifts a neutral 100% default, backfills readable names, updates recurrence snapshots and salary-staleness triggers, and preserves finalized history if a type is deleted.
- Backup export/replace/merge includes the new fields while old version 1 backups remain importable at 100%.
- Hebrew/English copy, logical RTL layout, localized weekdays, accessibility states, workplace/role integrity checks, and versioned salary history remain covered.

Verification:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero errors/warnings |
| `npm test -- --runInBand` | Passed; 109 suites, 506 tests, 0 failures |
| `npm run validate:migrations` | Passed from empty and v1–v7 databases |
| `npx expo install --check` | Reports eight available SDK 57 patch-level dependency updates; current native development build remains operational |
| `npx expo config --type public` | Passed; SDK 57.0.0, iOS/Android/web |
| `npm run validate:expo` | Passed; 36 static routes |
| `git diff --check` | Passed |

The updated development client bundled and launched on the booted iPhone 17 Pro Simulator, Migration 7 completed without a startup error, and the empty Hebrew RTL Shift Types list was visually inspected. Creating disposable native salary data was intentionally left to the documented dogfooding flow; exact create/select/pay/delete behavior is covered by component, service, repository, real-SQLite integration, backup, and cross-midnight tests.

The app remains single-user and local-first: there are no accounts, employees, server tenants, authentication, or RBAC administrator roles. “Administrator” means the device owner using Settings. Existing audit guarantees are timestamps, immutable shift type snapshots, and versioned salary calculation snapshots—not an actor-attributed compliance log. These boundaries and future synchronization requirements are documented in `docs/shift-types-and-pay-multipliers.md`.

## Development continuation — 2026-08-23

Development resumed from clean base `38bdc57` using the current simplification and dogfooding documents as the roadmap.

- Settings now links directly to **Report Exports** and **Backup/Restore**. The removed intermediate route remains a compatibility redirect.
- The fallback unscheduled clock-in screen now keeps workplace and Start prominent; role, template, expected end, title, and notes are progressively disclosed.
- Monthly reports now enforce the documented month rule at the model boundary: a completed shift belongs to the month containing its actual clock-out instant.
- Calendar's initial selected day and Home's reporting month now use the configured `Asia/Jerusalem` application timezone instead of UTC/device-local date shortcuts.
- Expo SDK 57 patch dependencies were realigned with `expo install --fix`; `expo install --check` is green.
- The updated web bundle returned HTTP 200, and the development client bundled and rendered successfully on the iPhone 17 Pro Simulator. Settings and the simplified fallback clock-in screen were visually inspected.

Post-change validation is green:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero errors/warnings |
| `npm test` | Passed; 107 suites, 476 tests, 0 failures |
| `npm run validate:migrations` | Passed from empty, v1–v5, and current v6 databases |
| `npx expo install --check` | Passed |
| `npx expo config --type public` | Passed; SDK 57.0.0, iOS/Android/web |
| `npx expo export --platform web` | Passed; 36 static routes |
| `git diff --check` | Passed |

`npm audit --omit=dev` still reports transitive Metro/Expo toolchain advisories (4 high through `image-size`, 12 moderate including `uuid`). The non-force audit repair did not remove them; the proposed forced repair would install an incompatible `expo-sharing` major and was intentionally not applied. Track these with Expo/Metro patch releases rather than breaking SDK compatibility.

Android and renewed physical-iPhone signing remain external platform work.

## Previous signed-candidate milestone (2026-08-14)

The dogfooding UX consistency and simplification sprint is implemented on `codex/initial-shifty-foundation`. The product remains centered on the daily loop `כניסה → הפסקה → יציאה`, with Calendar for review and one authoritative monthly Reports/Export model for completed work and finalized pay.

There are no known source-level iOS P0/P1 blockers after DF-014–DF-018. The automated gate and a fresh iPhone 17 Pro Simulator walkthrough pass. Android remains externally unverified because no emulator, AVD, or physical Android device is available.

The replacement physical-iPhone Release is signed, installed, and launch-verified, and the DF-013 reminder passed physical background delivery with a numeric offset and no brace token. The complete pre-test SQLite directory was restored byte-for-byte after the disposable test.

## Git truth

- Branch: `codex/initial-shifty-foundation`
- Remote application milestone: `f4f916a`
- Remote matched local application HEAD after each published milestone.
- The final documentation commit is recorded by the handoff after publication because a commit cannot embed its own SHA.

Published sprint commits:

- `2e4728f` — `fix(ui): standardize date and time inputs`
- `4876ccc` — `feat(reports): unify monthly report exports`
- `f4f916a` — `fix: resolve dogfooding consistency defects`
- `5dfa4ff` — `docs: record UX consistency dogfooding handoff`

The earlier dogfooding corrections DF-001–DF-012 remain in branch history and regression coverage. This sprint did not rewrite historical data, destructive-data flows, backup/restore, or recurrence storage.

## What changed

### Native editable date/time controls

Every audited editable date/time value now uses one shared iOS/Android picker boundary while preserving deterministic repository values (`YYYY-MM-DD`, `HH:mm`, and ISO timestamps at persistence boundaries). Covered flows include:

- New/Edit Shift, including scheduled, actual, payable, and recurrence values;
- template start/end times;
- active expected end and clock-out review/manual pay ranges;
- tracked/manual break editing;
- unscheduled expected end;
- salary profile effective dates;
- pay-rule windows, specific dates, and effective dates.

Optional fields keep a real empty state and can be cleared. Android dismissal preserves the previous value. Error styling, accessibility labels, iOS/Android behavior, and locale-independent serialization have focused tests. A static audit rejects raw editable date/time text fields in the affected feature modules.

### Centralized display formatting

Shared helpers now format compact/full dates, weekdays, times, time ranges, and months. Calendar, Smart Suggestions, Reports, and Exports no longer depend on device-locale shortcuts or split ISO strings. A static regression audit covers the previously divergent modules.

### Authoritative monthly reporting and exports

Reports, CSV, and PDF now consume one `MonthlyReport` domain model:

- month boundaries are calculated in the app timezone;
- only completed shifts whose actual end belongs to the selected month are included;
- finalized salary snapshots are authoritative;
- missing, incomplete, and stale salary remain explicit and non-numeric;
- legitimate finalized zero salary remains numeric zero;
- CSV output is formula-safe;
- PDF supports Hebrew RTL, English LTR, repeated table headers, multi-page output, and an early totals summary.

Reports was reduced to the completed monthly answer: month, completed count, worked hours, finalized salary state, shift rows, and one export action. Forecast/filter/breakdown controls that competed with that answer were removed. ICS is explicitly calendar-only and contains no financial claims.

### Dogfooding and audit corrections

- **DF-013:** reminder copy uses `{{offsetMinutes}}`; automated output and the physical iPhone delivery contain the number and no brace token.
- **DF-014:** Reports/Exports now share financial truth and timezone/month selection.
- **DF-015:** raw editable temporal text fields were replaced by native controls.
- **DF-016:** manual breaks after midnight resolve on the shift timeline rather than the first calendar date.
- **DF-017:** applying a suggestion uses the app timezone and selected workplace rate instead of the device timezone and zero rate.
- **DF-018:** pay-rule weekdays use localized named controls rather than numeric codes.

The complete screen/action inventory and remaining reduction candidates are in `docs/frontend-reduction-audit.md`. No open P0/P1 frontend-reduction recommendation remains; P2/P3 candidates require another native dogfooding round rather than speculative restructuring.

## Automated validation

Latest full application gate for `f4f916a`:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero errors/warnings |
| `npm test -- --runInBand` | Passed; 99 suites, 445 tests, 0 failures |
| `npm run validate:migrations` | Passed |
| `npx expo export --platform web` | Passed; 36 static routes |
| `npx expo install --check` | Passed |
| `npx expo config --type public` | Passed |
| `git diff --check` | Passed |

The final documentation-only gate is reported in the handoff after it runs.

## PDF verification

A representative Hebrew RTL report with 120 completed rows rendered across four A4 pages using the production generator. Pages 1, 2, and 4 were rasterized and visually inspected:

- summary totals appeared before the table;
- Hebrew, currency, and mixed-direction time ranges rendered correctly;
- headers repeated on later pages;
- no clipping or unexpected whitespace was observed.

The native Simulator then generated a real 27 KB monthly PDF and 698-byte CSV and opened the iOS share sheet for both.

## Latest iOS Simulator verification

- Runtime: iPhone 17 Pro simulator, iOS 26.5
- Bundle: `com.shifty.app`
- Native build: fresh Debug development client from the clean `/tmp` workflow; build succeeded with 0 errors and 2 known non-blocking Xcode warnings.
- Native picker UI: date and time wheel pickers appeared from New Shift; optional overnight break fields showed a true `not set` state.
- Reports: August 2026 showed six completed shifts, 28:03 hours, two finalized salaries, and four explicit unavailable/stale salary states before the disposable live flow.
- Cross-midnight formatting: the Saturday 17:20 → Sunday 05:20 fixture rendered consistently in Calendar, Shift Details, and Reports.
- Export: PDF and CSV generated and presented native share sheets with the selected month in the filename.
- Live lifecycle: clock-in, active timer, break, cold termination/relaunch while on break, restored break timer, resume, clock-out review, save, and return to inactive Home all passed.
- Persistence after the live flow: seven completed shifts, zero active shifts, zero open breaks, `PRAGMA integrity_check = ok`, and zero foreign-key violations.

The overnight 01:00 manual-break instant resolution is regression-tested at the service boundary. The native screen and empty picker fields were inspected, but the historical salary fixture was not mutated merely to repeat the automated assertion.

## Historical physical-iPhone build status

On 2026-08-13, the iPhone 15 Pro Max contained the `f4f916a` application candidate as `com.oportnoy.shiftty.dogfood` 0.1.0 (1). That historical standalone Release was built with automatic signing for Personal Team `9R9UQ6GTQW`, and deep/strict verification passed with CDHash `eeb93d4d592a14c4f34325ecc1f43b4a1ff28af1`. Its provisioning profile expired on 2026-08-17 and contained the one intended device; APNs was absent because the app used local notifications. This section is historical evidence and does not verify Milestone 4.

Build, installation, launch, and persistence checks passed. The final restored physical snapshot contains four completed shifts, zero active shifts, and zero open breaks, with `PRAGMA integrity_check = ok` and zero foreign-key violations. Database, WAL, and SHM match the complete pre-test snapshot byte-for-byte.

DF-013 was retested with a disposable zero-minute reminder. The application stored a native notification identifier, iOS delivered the notification in the background, and `UNUserNotificationCenter` returned `המשמרת שלך מתחילה בעוד 0 דקות.` for that exact identifier. A temporary diagnostic build was used only to read the delivered system notification; the untouched signed Release was then reinstalled and the original data restored.

## Remaining manual/platform limitations

- Android execution remains unverified because no Android SDK/runtime/device exists locally.
- The historical Personal Team profile expired on 2026-08-17.
- The extended picker/report/export/share-target sweep was completed on Simulator; it was not repeated end-to-end on the physical phone during the focused DF-013 delivery retest.
- Paid EAS Preview/internal distribution remains unavailable without an active paid Apple Developer Program team; no purchase was made.
- Remote push/APNs is not used by the current local-notification flow. Focus-mode variations, prolonged power-management behavior, calendar import interoperability, native share targets on a physical phone, keyboard avoidance, and dynamic-text extremes remain unverified.
- Product/UI/native display copy now uses **Shiftty / שיפטי**. The Expo slug/scheme, bundle/package identifiers, EAS project, and Xcode target names intentionally retain legacy `shifty`/`Shifty` values for upgrade and data continuity.

## Android checklist

- Install and cold-start the Android development build.
- Verify picker selection/dismissal/clearing across every editable temporal flow.
- Verify onboarding/workplace/salary setup and restart persistence.
- Verify past/future/cross-midnight creation, overnight manual breaks, edit, and deletion.
- Verify clock-in, active timer, break/resume, clock-out, active/break restoration, and discard.
- Verify authoritative Reports plus PDF/CSV/ICS output, RTL, light/dark, and empty/error states.
- Verify notifications, backup/restore/clear-all, SQLite integrity, and foreign keys.
