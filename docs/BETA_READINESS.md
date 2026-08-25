# Beta readiness

Status date: 2026-08-25
Branch: `codex/beta-stabilization`

This document is the source-of-truth checklist for deciding whether Shiftty can enter an external beta. It separates repository evidence from native runtime evidence and external release-account requirements. A green source gate is necessary, but it is not by itself a beta-ready verdict.

## Intended beta audience and platform scope

The intended audience is hourly workers who want a Hebrew-first, local-first record of shifts and a transparent gross-pay estimate. English is also supported. Beta users must understand that Shiftty is an assistant for recording and estimating, not payroll, legal advice, or a determination of Israeli employment rights.

The repository declares iPhone and iPad support and contains Android configuration. The verified Milestone 4 native scope is **iOS Simulator only**: a fresh standalone arm64 Release built, installed, launched, and passed all six disposable journeys. Physical iPhone, iPad, and Android runtime coverage remain unverified. This evidence is insufficient for a beta-ready verdict because generated-file readback and document-picker restore are still incomplete.

## Product workflows in scope

The candidate includes:

- first-use onboarding, workplace creation, and a salary profile;
- planned, manual, and live shift recording, including paid and unpaid breaks and cold-relaunch restoration;
- predefined shift types with snapshotted names and pay multipliers;
- deterministic daily and opt-in weekly overtime estimation;
- user-confirmed holiday, weekly-rest, and custom calendar evidence, independently configured pay rules, frozen provenance, and explicit recalculation after staleness;
- Home, Calendar, Shift Details, and monthly Reports;
- localized PDF and formula-safe CSV salary reports;
- calendar-only ICS export; and
- local backup export plus validated replace or merge restore.

The six disposable native automation journeys under `.maestro/journeys` cover first use, active shift and open-break restoration, shift-type creation/archival and historical snapshots, effective-dated weekly-overtime controls, evidence followed by a separate pay rule plus selective recalculation, and finalized-zero report/export/backup actions. They exercise the iOS effective-date picker and real share sheets for PDF, CSV, ICS, and backup files. They do not read the generated files back, select and restore a backup through the OS document picker, verify notification delivery, switch locale/appearance programmatically, or confirm destructive restore behavior.

## Salary and legal boundary

Every salary figure is classified deterministically as `unavailable`, `basic_estimate`, or `configured_estimate`. Missing, incomplete, erroneous, and stale calculations remain non-numeric; a legitimate finalized zero remains numeric zero. Finalized snapshots retain their historical result and provenance until a user explicitly recalculates.

The estimate can include recorded payable time, configured hourly rates, breaks, shift-type premiums, the disclosed default daily overtime assumption, user-configured daily or weekly overtime, fixed additions, and contributing user-confirmed special-interval rules. It does not fully model or decide statutory weekly overtime, automatic holiday or religious-calendar status, weekly-rest entitlement, employer permits or agreements, taxes, National Insurance, pension, deductions, benefits, or net pay. The app therefore makes no legal-compliance claim.

PDF and CSV retain estimate and stale/missing terminology. ICS is strictly calendar-only and must never contain salary, trust state, evidence provenance, source URLs, rules, multipliers, or entitlement claims. See `docs/salary-trust-foundation.md`, `docs/workweek-aware-salary.md`, and `docs/evidence-aware-holiday-rest.md` for the exact contracts.

## Local-first data, privacy, and permissions

Operational data is stored in the on-device SQLite database. There is no account, synchronization backend, analytics SDK, advertising SDK, or required remote service in the current source. Salary, workplace, shift, break, and evidence data are not intentionally uploaded by the app.

The app uses notification permission only for local reminder scheduling; the current active-shift path can present the native permission prompt when scheduling is first invoked. Denial does not block shift recording. Export and backup flows invoke an OS share sheet or document picker at the user's request. A startup-database failure is contained by a localized recovery screen with retry and an optional diagnostic export. The diagnostic is intentionally limited to app/version/platform/build, expected schema version, capture time, and a sanitized error class; it excludes the database path, native error message, shifts, workplaces, salary figures, and other record content.

Users remain responsible for where they share exported PDF, CSV, ICS, backup, or diagnostic files. A backup can contain sensitive employment and compensation information and should be stored and transferred accordingly.

## Dependency, identity, and release configuration

Expo's official compatibility tool applied the eight SDK 57 patch updates previously reported by `expo install --check`. The manifest and lockfile now target the recommended patch line, and the compatibility check is clean at the current source checkpoint. No major dependency upgrade or forced audit rewrite is part of this milestone.

`npm audit --omit=dev` still reports 16 transitive Expo/Metro developer-toolchain advisories: 12 moderate and 4 high. The high group reaches `image-size` through Metro; the moderate group includes `uuid` through Expo's Xcode configuration tooling. A non-force audit dry run has no compatible repair, while the force proposal would downgrade to incompatible Expo-era packages. The candidate therefore retains the SDK-compatible graph, does not use developer tooling to process untrusted image inputs, and tracks an upstream-compatible resolution rather than forcing an unsafe dependency rewrite.

The public product identity is **Shiftty / שיפטי**. Stable technical identities intentionally remain unchanged for installation and project continuity:

| Surface | Value |
| --- | --- |
| Expo slug and URL scheme | `shifty` |
| iOS bundle identifier | `com.omerportnoy.shifty` |
| Android application ID | `com.shifty.app` |
| EAS project ID | `25182fca-22be-477f-ac1b-45638f64db2e` |
| Xcode project, target, workspace, scheme | legacy `Shifty` |

The tracked native display name is `Shiftty`; changing the stable identifiers is a separate migration project. Static tests enforce the public spelling, keep route modules free of embedded Hebrew copy, preserve the legacy identifiers, and reject font-scaling suppression.

`eas.json` pins the validated EAS CLI, requires committed builds, uses remote native version management, defines development, iOS-Simulator, internal-preview, and store-production profiles, auto-increments production native versions, and produces an Android App Bundle for production. `app.json` declares export-compliance status and required assets. There is intentionally no automatic submit step and no over-the-air update configuration. Exact commands and external prerequisites are in `docs/RELEASE_BUILD.md`.

## CI and source gate

`.github/workflows/ci.yml` installs the lockfile with a deterministic Node release and runs type checking, linting, the full Jest suite, migration validation, Expo web export, Expo dependency compatibility, public-config resolution, and `git diff --check`. The workflow has read-only repository permission, does not persist checkout credentials, uses no deployment secrets, cancels superseded runs, and performs no signing, publishing, deployment, or submission. Its YAML parsed locally and every declared command passed; no hosted-run result is claimed.

The final Milestone 4 source gate passed type checking, linting, migration validation, Expo export/configuration, Expo compatibility, and patch-whitespace validation, with **137 suites / 685 tests** passing. `npm run release:preflight` reran the full source gate successfully and separated external account, signing, store, and device prerequisites. This local result is not evidence that GitHub-hosted CI ran.

## Stability and performance findings

The Milestone 3 development-client disconnect is not supported as an app crash by the retained evidence. The audit found 87 historical Metro heartbeat timeouts alongside 92 successful bundles, no matching fatal exception, Jetsam event, signal termination, SQLite termination, or relevant crash report, and a native Xcode log ending in `BUILD SUCCEEDED` with an empty error log. The latest genuine live-break render exception predates its existing fix and no later recurrence was found. The best evidence-based classification is therefore predominantly Metro/dev-client connectivity. The final standalone Release required no Metro server and completed six flows in 11 minutes 50 seconds, including repeated cold relaunches, active-shift restoration, and open-break restoration, without an app fatal/crash/SQLite failure. The stabilization source changes address two independently reproducible risks:

- notification reconciliation is process-global native state, so concurrent reconciliation/cancellation requests are serialized; an automated race test proves one logical reminder schedules once; and
- initialization failures caused by incomplete or incompatible migration history now fail closed into a localized recovery boundary rather than trusting only the maximum recorded migration number.

The salary coordinator previously performed special-interval and weekly-rest reads per calculated shift and loaded roles/profiles for unrelated workplaces. It now batches evidence and recurring-rest reads by workplace/profile salary context, filters batched evidence back to each exact half-open shift range, and loads roles only for requested workplaces. In the automated 365-shift scenario with 250 unrelated workplaces, role reads fell from 251 to 1, unrelated profile reads from 250 to 0, evidence reads from 365 to 1, and weekly-rest reads from 365 to 1. The isolated Jest test body took approximately 5.6 seconds and the Jest process reached approximately 163 MB maximum RSS on this development host. This is a query-count regression scenario, not a controlled before/after native benchmark; machine load and Jest overhead limit timing and memory interpretation. No physical-device battery, frame-rate, or long-session memory claim is made.

## Migration, restore, and recovery evidence

Automated SQLite integration coverage upgrades empty and v1-v9 databases to the current schema, then checks integrity and foreign keys. A simulated interrupted Migration 9 rolls back its schema and migration record and succeeds on retry. A missing migration-history row and a database from a newer incompatible app version are rejected instead of being silently skipped.

Backup validation rejects malformed JSON, count mismatches, unsupported versions, missing embedded references, orphaned foreign keys, multiple active shifts, and an open break not attached to the single active shift. Replace restore is transactional and rolls back injected write failures. Merge coverage includes semantic ID collisions, active-shift conflicts, recurrence remapping, current snapshots regardless of payload order, workweek configuration, evidence/schedule provenance, archived records, and legacy V1 neutral defaults. A disposable 250-shift zero-rate dataset round-trips through export and replace restore with zero values preserved and clean SQLite integrity/foreign-key checks.

These tests do not mutate a user's real database. On the disposable iOS Simulator, the migrated database reached the exact Migration 9 name, `PRAGMA integrity_check` returned `ok`, and `PRAGMA foreign_key_check` returned no rows. A controlled migration-history mismatch produced the non-destructive recovery screen; restoring the expected record and checkpointing the WAL returned the app to a clean launch. Native backup share-sheet presentation passed. OS document selection, replace/merge confirmation, restored-data readback, and generated export readback remain manual dogfood checks and are not claimed as performed.

The recovery boundary currently wraps the application root. It safely prevents destructive startup retries, but a later render exception can therefore be presented with database-startup wording even when SQLite was not the cause. This is a known non-destructive P2 diagnostic limitation, not a database-integrity or data-loss finding.

## Go/no-go rules

Do not declare a beta platform ready when any of the following is true:

- a known P0 or P1 source or native defect remains open;
- the full final source gate, migration matrix, or backup round-trip fails;
- missing, stale, or incomplete salary can silently appear as numeric zero;
- an active shift or open break does not survive a cold relaunch;
- the platform has not built, installed, launched, and completed its required native journeys;
- source-level release configuration is materially incomplete; or
- a source defect is being mislabeled as an external credential/device blocker.

External blockers such as Apple/Google credentials, signing membership, store metadata, a connected physical device, or an Android SDK/device must be listed separately. They do not make a failing source tree ready.

## Rollback and incident handling

There is no OTA update channel. Stop distribution of a bad artifact and rebuild a new native version from the last verified commit; do not rewrite database history or silently downgrade a populated database. Before any risky recovery test, export a backup and preserve the entire SQLite directory, including WAL and SHM files where direct container copying is used.

If startup fails, use the recovery screen to retry and export the privacy-minimal diagnostic. Do not delete, replace, or edit the user's database merely to make the app launch. Preserve the original files, record the app/schema/build versions and reproduction steps, and investigate a disposable copy. Restore is user-confirmed and transactional; invalid input must leave the current database unchanged.

## Verdict and remaining external work

The evidence-based verdict is `SOURCE_READY_NATIVE_BLOCKED`. There is no known P0/P1 source or iOS Simulator core-workflow defect, the source and recovery gates pass, the iOS Release built and launched, and Maestro completed `6/6 Flows Passed in 11m 50s` against that final binary. However, source and share-sheet evidence do not substitute for reading the generated files back and restoring a selected backup through the OS document picker.

This does not authorize external beta or Android distribution and does not claim a physical-device, TestFlight, App Store, or hosted-CI pass. Before external distribution, read back the PDF/CSV/ICS/backup artifacts, perform and verify an OS document-picker backup restore on disposable data, complete Apple provisioning and account checks, store metadata/privacy/support URLs/screenshots/declarations, a current physical-iPhone notification/background check, and a hosted CI run. Android requires its own SDK/device build and complete runtime matrix before the verdict can expand.
