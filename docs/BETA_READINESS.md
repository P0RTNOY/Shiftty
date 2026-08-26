# Beta readiness

Status date: 2026-08-26
Branch: `codex/native-artifact-cross-platform-verification`
Milestone base: `0908c7b3214abc55efebfc6a70893c4168cc58cf`
Final candidate: the committed HEAD containing this report; the exact SHA is recorded in the milestone handoff

This is the go/no-go record for external beta distribution. It separates source evidence, iOS Simulator evidence, physical-device evidence, Android evidence, hosted CI, and store/account prerequisites. A green local source gate or Simulator run is necessary but cannot substitute for the missing platform/distribution evidence.

## Audience, scope, and legal boundary

Shiftty is a Hebrew-first, local-first shift and gross-pay estimation assistant for hourly workers, with English support. The candidate covers onboarding, workplaces, planned/manual/live shifts and breaks, cold-relaunch restoration, shift types, daily and opt-in weekly overtime, user-confirmed calendar evidence and separate pay rules, frozen salary provenance, Reports, localized PDF/CSV, calendar-only ICS, and backup/restore.

Every salary result is deterministically classified as `unavailable`, `basic_estimate`, or `configured_estimate`. Missing, incomplete, erroneous, and stale calculations remain non-numeric; a legitimate finalized zero remains numeric zero. Finalized snapshots and their provenance remain frozen until explicit recalculation.

The estimate does not determine statutory overtime, automatic holiday or religious-calendar status, weekly-rest entitlement, employer permits or agreements, taxes, National Insurance, pension, deductions, benefits, or net pay. Shiftty is not payroll, legal advice, or an Israeli labor-law compliance product. PDF and CSV retain estimate and missing/stale terminology; ICS contains calendar data only.

## Local-first privacy and recovery

Operational records are stored in on-device SQLite. The source has no user account, synchronization backend, analytics SDK, advertising SDK, or required runtime service. Local notification denial does not block shift recording. Export, backup, restore, and diagnostic sharing occur only through user-invoked native UI.

The startup diagnostic is allowlisted to app/version/platform/build, expected schema version, capture time, and a sanitized error class. It excludes database paths, native error messages, shifts, workplaces, salaries, and other user records. Exported reports and backups can contain sensitive employment information; users remain responsible for where they share them.

Automated recovery coverage includes empty and v1-v9 upgrades, interrupted migration rollback/retry, incomplete or future migration-history rejection, corrupt and semantically invalid backups, transactional replace rollback, merge collisions, active/open-break constraints, legacy V1 data, evidence/workweek provenance, and a 250-shift zero-rate round-trip.

## Identity, release configuration, and dependencies

The public identity is **Shiftty / שיפטי**. Stable continuity identifiers remain:

| Surface | Value |
| --- | --- |
| Expo slug and URL scheme | `shifty` |
| iOS bundle identifier | `com.omerportnoy.shifty` |
| Android application ID | `com.shifty.app` |
| EAS project ID | `25182fca-22be-477f-ac1b-45638f64db2e` |
| Xcode project, target, workspace, scheme | legacy `Shifty` |

`eas.json` defines committed development, Simulator, preview, and production builds, remote native version management, production auto-increment, and Android App Bundle output. There is no automatic submit step or OTA update channel. Exact commands, rollback boundaries, and external prerequisites are in `docs/RELEASE_BUILD.md`.

Expo SDK 57's eight compatibility notices remain resolved. `npm audit --omit=dev` still reports 16 transitive Expo/Metro developer-toolchain advisories: 12 moderate and 4 high. A non-force repair is unavailable and the force proposal is incompatible, so no forced downgrade is approved.

## Milestone 5 iOS Simulator evidence

A fresh arm64 Simulator Release installed and ran standalone as `com.omerportnoy.shifty` on the pinned disposable iPhone 17 Pro clone, UDID `73B7FFB2-1EC0-470C-B7E5-38D401BA4255`, running iOS 26.5.

The production UI generated localized PDF, CSV, calendar-only ICS, and a backup through real iOS share sheets. Independent readback used `pypdf`, Quick Look, Python's standard `csv` module, `icalendar`, and `qpdf`:

- the corrected three-page PDF repeats its table header on every page; English and Hebrew content opens and parses, with Hebrew RTL visually verified in Quick Look;
- `qpdf` exits 3 on Quartz offset-0 object warnings, although the same files open in Quick Look and parse with `pypdf`; this is not claimed as a clean `qpdf` result;
- the CSV contains 29 data rows, UTF-8 BOM, CRLF records, protected user text, one note, numeric finalized zero, and empty missing/outdated salary;
- the ICS contains 29 valid UTC events and no salary, payroll, rate, multiplier, evidence, rule, source, trust, or entitlement payload; and
- the backup is V1 for app 0.1.0, contains 33 shifts and representative active, open-break, archived, evidence, rule, zero/nonzero/stale/missing, and frozen-history states, and contains no credentials or secrets.

The real iOS document picker selected **On My iPhone → `m5-source-backup.json`**. Replace restore succeeded through the production confirmation UI. After a cold relaunch, the active shift and open unpaid break were visible. The restored database passed integrity and foreign-key checks. Re-exported canonical data matched the source at recorded SHA-256 prefix `b15aad…`; only `exportedAt` changed. Merging the same backup also completed within the bounded semantic-merge rules.

Verification continued through the full end-review path: the restored active shift/open break completed, a new finalized nine-minute/1,125-minor-unit snapshot was written, the previous historical result JSON retained recorded SHA-256 prefix `f419…`, and the later weekly-dependent shift became stale as expected. The compact quick-review Save control was outside the automation viewport with a tall disclosure, while the scrollable full end-review production path succeeded; this is an automation limitation, not a validated product defect.

The fixed-date weekly-overtime check initially used 2026-08-25, which correctly resolved to an older salary profile and therefore did not cross the new threshold. The check was continued under the intended effective profile on 2026-08-27 and produced eight hours at 150%. The initial date assumption is not reported as a product failure.

The only Milestone 5 source correction is narrow PDF manual pagination plus regression tests. Salary totals, report semantics, persisted schemas, backup format, and historical snapshots were not changed.

## Platform and CI blockers

The connected iPhone 15 Pro Max runs iOS 26.6 and already contains the stable `com.omerportnoy.shifty` bundle with existing data, so this candidate cannot be installed safely side-by-side. The Xcode project team beginning `9R9…` does not match the only available signing identity, whose team begins `7R88…`, and no matching provisioning profiles are installed. No physical build, install, launch, notification, lifecycle, or data mutation was attempted.

Android is blocked because the host has no Android Studio, complete SDK, emulator, AVD, or physical device. `adb` 37 and an incomplete Unity SDK do not constitute a reproducible build environment. No Android compile or runtime pass is claimed.

No GitHub Actions workflow/run is registered remotely for the exact candidate, and the commit is not remote. The branch was not pushed. The local workflow is least-privilege and its declared commands match the source gate, but it does not invoke `npm run release:preflight` itself, so its extra release configuration/asset assertions are not represented by a hosted run.

## Source gate status

The complete Milestone 5 post-fix gate passed on the committed candidate: typecheck, lint, **137/137 Jest suites and 685/685 tests**, empty and v1-v9 migration validation, Expo web export/config validation, Expo dependency compatibility, public-config resolution, release preflight, and `git diff --check`. The SQLite constraint and foreign-key messages emitted by negative integration tests were expected rejection diagnostics; Jest completed with zero failures. An independent base-to-candidate diff review found only the PDF pagination fix, its regression assertions, and this milestone documentation.

## Go/no-go and rollback

Do not declare a platform beta-ready if a P0/P1 remains, the source/migration/backup gate fails, missing salary can appear as zero, active/open-break restoration fails, or that platform has not built, installed, launched, and completed its required native matrix.

There is no OTA channel. Stop distributing a defective artifact and rebuild a higher native version from the last verified commit. Never silently downgrade or rewrite a populated database. Preserve the complete SQLite container, including WAL/SHM when copying files, before device recovery work; use only validated transactional restore.

## Verdict

Evidence-based verdict: `SOURCE_READY_NATIVE_BLOCKED`.

Milestone 5 closes the earlier Simulator artifact-readback and OS document-picker restore gaps. It does not close physical-iPhone signing/install, Android build/runtime, hosted CI, TestFlight/App Store/Google Play credentials, store metadata, privacy/support URLs, screenshots, or reviewer declarations. No external distribution is authorized by this evidence.
