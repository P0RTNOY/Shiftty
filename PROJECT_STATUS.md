# Shiftty Project Status

Last updated: 2026-08-10

## Current milestone

Shiftty is in the first dogfooding correction freeze on branch `codex/initial-shifty-foundation`. The product remains focused on the daily flow `כניסה → הפסקה → יציאה`; no new product phase or unrelated feature was started.

The seven physical-iPhone findings DF-001–DF-007 were investigated at their source, regression-covered, and corrected. A product-wide audit added DF-008–DF-011. Fresh native verification then exposed DF-012, a stale-render-clock crash immediately after starting a break; that defect is fixed, tested, pushed, and natively retested.

There are currently zero known iOS P0/P1 blockers in the corrected code. Android remains externally unverified because no emulator, AVD, or physical Android device is available. Distribution of the corrected physical-iPhone Preview is externally blocked by unavailable Apple Developer internal-distribution credentials, as recorded below.

## Git truth

- Branch: `codex/initial-shifty-foundation`
- Corrected implementation HEAD before this documentation commit: `5aa364308c18444d48d385094b019b4b5aa72ffa`
- Remote at documentation preparation: `origin/codex/initial-shifty-foundation` matched `5aa3643`; ahead/behind `0/0`.
- The exact final documentation/build HEAD is reported in the final dogfooding handoff because a commit cannot embed its own SHA.
- Working-tree changes at documentation preparation are documentation-only.

Published sprint commits:

- `8afd418` — `feat(branding): add original Shiftty app icon`
- `eaa1fc0` — `fix(shifts): stop implicit breaks and preserve active context`
- `df66f22` — `fix(ui): show weekdays in shift date fields`
- `ae72f65` — `fix(reports): show authoritative salary and rule state`
- `c89c67b` — `style(reports): clean report row formatting`
- `2a9a08a` — `feat(shifts): unify manual shift creation`
- `b4fcc98` — `fix(calendar): use status-aware shift ranges`
- `539313d` — `fix(persistence): synchronize restored state and recurrences`
- `1442752` — `fix(settings): harden template editing flow`
- `5aa3643` — `fix(shifts): keep new breaks render-safe`

## Dogfooding corrections

### DF-001 — App icon

An original opaque 1024×1024 Shiftty clock/check icon is wired through Expo for iOS, Android adaptive assets, and favicon use. Static config validation covers the references. A fresh native simulator build displayed the icon correctly at Home Screen size.

### DF-002 — No automatic actual break

New workplace/form defaults are zero. Expected future/template breaks no longer become actual or payable deductions. Completed shifts deduct only explicitly persisted payable breaks or tracked/manual break sessions. Historical rows are preserved.

Native evidence: a manual 08:00–16:00 shift saved as eight hours with zero break. A live tracked break persisted four actual/payable minutes and reduced the five-minute gross shift to one payable minute.

### DF-003 and DF-012 — Active break continuity

The active experience now remains visible during a break with total-shift and current-break timers, workplace, resume, and clock-out actions. Active and open-break state restore from SQLite after process termination.

The first native pass exposed a residual crash: Home's 30-second presentation clock could be older than a newly persisted break start. Live validation threw `Break end must be after break start`, and iOS terminated the process with SIGSEGV. `5aa3643` treats the newest persisted event as authoritative for live metrics. The regression failed on the old behavior, passes now, and the same persisted break subsequently restored and completed natively.

### DF-004 — Weekdays

Shared Hebrew/timezone-aware formatting now supplies weekdays to Add/Edit Shift, Details, cards, Calendar selection, Reports, and clock-out review. Native evidence included `יום שבת, 8 באוגוסט 2026`, `יום שני, 10 באוגוסט 2026`, and a Sunday next-day marker for the cross-midnight salary fixture.

### DF-005 — Salary rules

The reported ₪720 was not an arithmetic-engine failure. The physical dogfooding profile had a base hourly rate but no overtime or special-rate rules, and the old presentation failed to make that limitation clear. Salary surfaces now state when only base rate is configured.

Deterministic configured fixture:

- Shift: Saturday 2026-08-08 17:20 → Sunday 2026-08-09 05:20
- Base rate: ₪60/hour
- Weekend: Saturday 00:00 → Sunday 06:00 at 150%, non-stacking
- Overtime tier 1: after 480 and before 600 net minutes at 125%, stacking
- Overtime tier 2: after 600 net minutes at 150%, stacking
- Segments: 400 minutes at 150%, 80 at 150%, 120 at 175%, 120 at 200%
- Regular minutes: 0; special-rate minutes: 720
- Base pay: ₪720; premium pay: ₪450; total: ₪1,170

The exact fixture passed automated tests and the native Reports/Details UI. Its finalized SQLite snapshot contains 720 payable minutes, 0 regular minutes, 720 special minutes, `base_pay_minor=72000`, `premium_pay_minor=45000`, and `total_gross_pay_minor=117000`.

### DF-006 — One Add Shift flow

Home and Calendar now expose one **הוספת משמרת** flow. Past ranges become completed actual/payable work, future ranges become scheduled work, overlap-now requires an explicit live-tracking choice, and recurrence appears only for future planning. Legacy routes redirect safely.

### DF-007 — Reports

The default month view now answers completed shift count, worked hours, and salary first. Each row shows weekday/date, range, duration, and salary; unknown, incomplete, stale, base-only, and legitimate-zero states remain distinct. Rule/segment metadata is behind **פירוט שכר**.

Native fixture output showed 6 completed shifts, 28:03 worked hours, ₪1,972.50 total, and the Saturday fixture row as 12:00 / ₪1,170.

## Additional audit fixes

- **DF-008 / Calendar P1:** status-aware ranges prevent open-active crashes and stale planned placement for completed work; SQL list/overlap logic follows the same policy.
- **DF-009 / data state P1:** successful clear/restore operations synchronize the Zustand active-shift state with authoritative SQLite.
- **DF-010 / recurrence P1:** startup materialization loads exceptions, uses local date keys, relies on the stored series template, and persists atomically/idempotently.
- **DF-011 / templates P2:** explicit back navigation, safe missing-template state, localized failures, and edit-specific labels replace the prototype dead path.

No additional high-confidence P0/P1 issue remains after DF-012. Lower-priority device-specific polish should be recorded during dogfooding rather than expanding this sprint.

## Automated validation

Latest full results after DF-012:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero errors/warnings |
| `npm test -- --runInBand` | Passed; 91 suites, 418 tests, 0 failures |
| `git diff --check` | Passed |

The final pre-build gate will repeat the checks above and also run migration validation, Expo validation, Expo dependency checking, public Expo config, and the Expo Router test-leak check.

## Latest iOS Simulator verification

- Runtime: iPhone 17 Pro simulator, iOS 26.5
- Bundle: `com.shifty.app`
- Native build: fresh Debug development client compiled from the corrected repository in an isolated `/tmp` copy; build succeeded with zero errors and two non-blocking Xcode script/link warnings.
- Metro: current repository bundle on port 8081 over LAN.
- App icon: passed.
- Unified Add Shift: passed for the native form and past completed creation; automated inference covers past/future/today/cross-midnight/overlap/equal-time/DST. Scheduled future rendering remains verified.
- No implicit break: passed.
- Explicit tracked break: passed.
- Clock in, active timer, break, break timer, active-break restoration, resume, quick clock-out, and persistence: passed after DF-012 repair.
- Weekdays and cross-midnight labels: passed.
- Saturday configured salary, overtime, special rate, per-shift salary, monthly total, detailed segments, and finalized snapshot: passed.
- Missing-rule/base-only communication: passed before disposable rules were added.
- Edit: passed; the edited break appeared immediately and salary staleness remained explicit.
- Delete: the native permanent-delete confirmation and warning were reached; the destructive RC pass had already verified actual completed/break/cross-midnight cascades and SQLite integrity. This correction pass did not reconfirm the irreversible final button.
- Home, Calendar, Reports, Details, and cold restart: passed.

Simulator database checks after the corrected live flow and after the salary fixture both returned `PRAGMA integrity_check = ok` and zero rows from `PRAGMA foreign_key_check`. The pre-fixture simulator database was preserved at `/tmp/shiftty-sim-pre-salary-20260810172441.db` for this verification session.

## Existing destructive RC evidence

The prior iOS Simulator RC completed permanent deletion, active cancel/discard, restore-replace, clear-all, final restore, restart, and Home/Calendar/Reports checks against disposable data. Restore/replace and clear-all passed atomicity, count/reference, integrity, and foreign-key verification. The preserved external backup was not deleted. These checks remain relevant because this sprint did not change backup, clear-all, or deletion persistence code.

## Remaining manual/platform limitations

- Android execution is pending: no local emulator, AVD, or physical Android device exists.
- The corrected code still requires a new physical-iPhone Preview/Internal build because the app icon changed.
- Physical-device follow-up remains necessary for real notification timing, Focus/power-management behavior, calendar/share-target interoperability, keyboard avoidance, and dynamic-text extremes.
- Simulator notification delivery timing is not representative of a physical iPhone.
- Naming remains intentionally unchanged in this sprint: product/UI copy uses **Shiftty / שיפטי**, while Expo's native `name` and `slug` remain **Shifty / shifty**. This P3 consistency item is documented rather than expanded into a global rename.

## Physical-iPhone build

One EAS attempt was made on 2026-08-10 at approximately 17:34 Asia/Jerusalem with `eas build --platform ios --profile preview` from clean, pushed Git SHA `829bd0b6e5498dc324020b14862801496660fef4`.

- App version: `0.1.0`
- Profile: `preview` / internal distribution
- EAS build ID: none; submission stopped before a build record/upload was created
- Build number: not assigned/displayed before the blocker
- Install URL/QR: none
- Exact blocker: EAS reported that internal-distribution credentials must be generated by logging in to the Apple Developer account or supplied through `credentials.json`. The process reached the Apple ID/password/2FA handoff and was terminated without entering credentials.
- Prior portal evidence: device registration previously reported that the Apple account was not registered as an Apple Developer. A free Personal Team Xcode install does not provide EAS internal-distribution credentials.

The EAS prompt recorded `ITSAppUsesNonExemptEncryption=false` in Expo iOS configuration; duplicated locale entries introduced by the prompt were removed. This declaration is config-only and does not change application behavior. No second EAS build was attempted.

## Android checklist

- Install and cold-start the Android development build.
- Verify onboarding/workplace/salary setup and restart persistence.
- Verify native date/time pickers, unified past/future/cross-midnight creation, edit, and deletion.
- Verify clock-in, active timer, break/resume, clock-out, active/break restoration, and discard.
- Verify Home, Calendar, Reports, Settings, RTL, light/dark, and empty/error states.
- Verify notifications, PDF/CSV/ICS sharing, backup/restore/clear-all, SQLite integrity, and foreign keys.
