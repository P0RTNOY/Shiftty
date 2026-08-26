# Native verification report

Candidate date: 2026-08-26
Branch: `codex/native-artifact-cross-platform-verification`
Milestone base: `0908c7b3214abc55efebfc6a70893c4168cc58cf`
Final candidate: the committed HEAD containing this report; the exact SHA is recorded in the milestone handoff

## Evidence policy

This report keeps automated source evidence, iOS Simulator evidence, physical-iPhone evidence, Android evidence, and hosted-CI evidence separate. Native share-sheet presentation is not treated as artifact readback; an in-app restore entry point is not treated as an OS document-picker restore; Simulator evidence is not treated as a signed-device or store artifact.

## Candidate and environment

| Item | Recorded value |
| --- | --- |
| Public identity | Shiftty / שיפטי |
| Expo / React Native mode | Expo SDK 57; New Architecture enabled; standalone Release bundle without Metro |
| iOS Simulator | Disposable iPhone 17 Pro clone, iOS 26.5, UDID `73B7FFB2-1EC0-470C-B7E5-38D401BA4255` |
| Built application | arm64 Simulator Release; `com.omerportnoy.shifty` |
| Physical iPhone | Connected iPhone 15 Pro Max, iOS 26.6; current candidate not built or installed |
| Android | No complete Android SDK, Android Studio, emulator, AVD, or device; only `adb` 37 and an incomplete Unity SDK were present |
| Source base | `0908c7b3214abc55efebfc6a70893c4168cc58cf` |
| Source delta | PDF pagination implementation and regression tests only |

The iOS artifact was generated through the production application UI and real iOS share sheets. English and Hebrew report/export paths were exercised. Independent readers were used after export rather than trusting only the application preview.

## Verification summary

| Evidence class | Result | Evidence |
| --- | --- | --- |
| Milestone 5 final repository gate | Passed | Typecheck, lint, 137/137 suites and 685/685 tests, migration/Expo/config checks, release preflight, and patch-whitespace validation passed |
| iOS native build/install/launch | Passed | Fresh arm64 Simulator Release installed and ran standalone on the pinned disposable clone |
| PDF/CSV/ICS generation | Passed | Generated through production report/export UI and real share sheets in English and Hebrew |
| Independent artifact readback | Passed with documented PDF parser warning | `pypdf`, Quick Look, Python `csv`, `icalendar`, and `qpdf` read the generated files |
| OS document-picker replace restore | Passed | Browse → On My iPhone → `m5-source-backup.json`; production confirmation and success UI; cold-relaunch verification |
| Backup semantic readback | Passed | Source and restored canonical data matched; only `exportedAt` changed on re-export |
| Bounded merge restore | Passed | Merging the same backup completed without unbounded duplication |
| Physical iPhone | Blocked / not tested | Same installed bundle, signing-team mismatch, and no provisioning profiles prevented a safe build/install |
| Android native build/runtime | Blocked / not tested | Complete Android build and runtime toolchain unavailable |
| Hosted GitHub Actions | Not tested | No remote workflow/run was registered and the exact candidate commit was not remote |

## Native artifact readback

### PDF

The native monthly report produced a three-page PDF after a narrow pagination correction in the PDF generator. Independent `pypdf` extraction and Quick Look inspection confirmed that:

- the document opens and parses;
- the selected report content spans three pages;
- the report table header repeats on all three pages;
- page breaks do not hide the repeated header; and
- Hebrew output is visually right-to-left and readable in Quick Look.

`qpdf --check` exited with status 3 because Apple's Quartz PDF writer emits offset-0 object warnings. The same files opened in Quick Look and parsed with `pypdf`; no unreadable page or missing report content was found. This is recorded as a non-blocking producer warning, not as a clean `qpdf` pass. Hebrew text extraction can appear in reverse visual order because bidirectional layout information is not reconstructed by the parser; visual RTL was therefore verified in Quick Look.

The only Milestone 5 source correction is the narrow manual-pagination behavior and its regression tests. No salary arithmetic, report model, persisted schema, backup format, or historical snapshot was changed.

### CSV

The native CSV read back through Python's standard `csv` module with:

- 29 data rows;
- a UTF-8 BOM and CRLF record endings;
- formula protection on user-controlled workplace, role, and title fields;
- exactly one estimate/provenance note;
- a legitimate finalized zero serialized as numeric zero; and
- missing and outdated salary values left empty rather than serialized as zero.

### ICS

The native ICS parsed with `icalendar` as 29 valid UTC events. A content audit found no payroll or salary payload: no salary/payroll/rate terminology, amount, multiplier, trust state, evidence provenance, source URL, rule ID, or entitlement data was present. ICS remains calendar-only.

## Backup contents and native restore

The source backup is envelope version 1 for app version `0.1.0`. It contains 33 shifts, two workplaces, two salary profiles, a pay rule and calendar evidence, archived role/template records, a scheduled shift, one active shift with an open unpaid break, finalized zero and nonzero snapshots, stale and missing salary states, and frozen historical provenance. Inspection found no credentials, API keys, native notification identifiers, or other secrets.

The real iOS document picker was exercised from the production restore UI on disposable Simulator data:

1. Browse was opened.
2. **On My iPhone** was selected.
3. `m5-source-backup.json` was selected.
4. Replace restore was confirmed and reported success.
5. The app was cold-terminated and relaunched.
6. The restored active shift and its open unpaid break were visible and coherent.

The restored database returned `PRAGMA integrity_check = ok` and an empty `PRAGMA foreign_key_check`. A native re-export of the restored database matched the source backup's canonical data SHA-256 prefix `b15aad…`; only the intentionally regenerated `exportedAt` timestamp differed. A bounded merge of the same file also succeeded.

## Post-restore salary and history verification

Verification continued through the full end-review production path:

- the restored active shift and open break were completed safely;
- a new finalized nine-minute snapshot was written for 1,125 minor units;
- the previously current historical result JSON retained its recorded SHA-256 prefix `f419…` unchanged; and
- the later weekly-dependent shift became stale, as expected from dependency invalidation.

The compact quick-review screen placed Save below the visible automation viewport when the tall Salary Trust disclosure was present. The full end-review production path scrolled and saved successfully. This is recorded as an automation/viewport limitation, not as a validated product defect.

## Date-sensitive weekly-overtime evidence

The first fixed-date weekly-overtime assertion used 2026-08-25 and did not cross the configured threshold because that date resolved to the older effective salary profile. That result was correct and exposed a date-sensitive test assumption. Verification then continued explicitly on 2026-08-27 under the intended effective profile and produced eight hours at the configured 150% weekly-overtime rate. The initial expectation is not reported as a product failure, and only the successful date-corrected result is reported as threshold-crossing evidence.

## Physical iPhone boundary

The connected iPhone 15 Pro Max runs iOS 26.6 and already contains `com.omerportnoy.shifty` with existing data. Because the candidate uses that same stable bundle identifier, it could not be installed safely side-by-side. The Xcode project selected a team whose identifier begins `9R9…`, while the only available signing identity belonged to a different team beginning `7R88…`; no matching provisioning profiles were installed. No profile creation, credential change, same-bundle replacement, build, installation, launch, notification, background/foreground, or device-data mutation was attempted.

Physical iPhone status is therefore **blocked / not tested**, not failed and not passed. A future run needs an authorized signing team and profile plus a recoverable preservation plan for the existing app container.

## Android boundary

Android Studio, an emulator, an AVD, a complete Android SDK, and a physical Android device were unavailable. The host contained only `adb` 37 and an incomplete Unity-provided SDK, which is insufficient for a reproducible Expo/Gradle build. No Android compile, install, launch, SQLite, export, restore, notification, locale, or lifecycle pass is claimed.

## Hosted CI boundary

No workflow or run was registered for the remote repository, and the exact candidate commit was not present remotely. The branch was not pushed. The checked-in workflow remains least-privilege and its individual commands match the local source gate, but it does not invoke the `npm run release:preflight` wrapper itself. Consequently, a future hosted run should either add the wrapper's release-configuration/asset assertions or retain and explicitly validate equivalent steps. Local workflow parsing and command parity are not reported as hosted-CI evidence.

## Source gate and dependency boundary

The complete Milestone 5 post-fix gate passed on the committed candidate: typecheck, lint, **137/137 Jest suites and 685/685 tests**, empty and v1-v9 migration validation, Expo web export/config validation, `expo install --check`, public Expo configuration, release preflight, and `git diff --check`. Expected SQLite constraint and foreign-key rejection diagnostics appeared in negative integration tests; they were not test failures. An independent base-to-candidate diff review found only the PDF pagination correction, its regression assertions, and Milestone 5 documentation.

The known dependency boundary is unchanged: `npm audit --omit=dev` reports 16 transitive Expo/Metro developer-toolchain advisories, with no compatible non-force repair and an incompatible force proposal. No forced dependency rewrite is part of this milestone.

## Verdict

Evidence-based verdict: `SOURCE_READY_NATIVE_BLOCKED`.

The earlier native artifact-readback and document-picker restore blockers are closed on the iOS Simulator. The remaining blockers are the unavailable safe physical-iPhone signing/install path, absent Android build/runtime environment, absent hosted-CI execution, and external distribution/store prerequisites. This report does not authorize TestFlight, App Store, Google Play, physical-device, Android, or hosted-CI claims.
