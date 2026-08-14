# Shiftty Project Status

Last updated: 2026-08-14

## Current milestone

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

## Physical-iPhone build status

The connected iPhone 15 Pro Max contains the `f4f916a` application candidate as `com.oportnoy.shiftty.dogfood` 0.1.0 (1). The standalone Release was built with automatic signing for Personal Team `9R9UQ6GTQW`, and deep/strict verification passed with CDHash `eeb93d4d592a14c4f34325ecc1f43b4a1ff28af1`. Its provisioning profile expires on 2026-08-17 and contains the one intended device; APNs is absent because the app uses local notifications.

Build, installation, launch, and persistence checks passed. The final restored physical snapshot contains four completed shifts, zero active shifts, and zero open breaks, with `PRAGMA integrity_check = ok` and zero foreign-key violations. Database, WAL, and SHM match the complete pre-test snapshot byte-for-byte.

DF-013 was retested with a disposable zero-minute reminder. The application stored a native notification identifier, iOS delivered the notification in the background, and `UNUserNotificationCenter` returned `המשמרת שלך מתחילה בעוד 0 דקות.` for that exact identifier. A temporary diagnostic build was used only to read the delivered system notification; the untouched signed Release was then reinstalled and the original data restored.

## Remaining manual/platform limitations

- Android execution is pending because no Android runtime/device exists locally.
- The installed Personal Team profile expires on 2026-08-17.
- The extended picker/report/export/share-target sweep was completed on Simulator; it was not repeated end-to-end on the physical phone during the focused DF-013 delivery retest.
- Paid EAS Preview/internal distribution remains unavailable without an active paid Apple Developer Program team; no purchase was made.
- Remote push/APNs is not used by the current local-notification flow. Focus-mode variations, prolonged power-management behavior, calendar import interoperability, native share targets on a physical phone, keyboard avoidance, and dynamic-text extremes remain unverified.
- Product/UI copy uses **Shiftty / שיפטי** while Expo's native `name`/`slug` remain **Shifty / shifty**. This remains a documented P3 naming task.

## Android checklist

- Install and cold-start the Android development build.
- Verify picker selection/dismissal/clearing across every editable temporal flow.
- Verify onboarding/workplace/salary setup and restart persistence.
- Verify past/future/cross-midnight creation, overnight manual breaks, edit, and deletion.
- Verify clock-in, active timer, break/resume, clock-out, active/break restoration, and discard.
- Verify authoritative Reports plus PDF/CSV/ICS output, RTL, light/dark, and empty/error states.
- Verify notifications, backup/restore/clear-all, SQLite integrity, and foreign keys.
