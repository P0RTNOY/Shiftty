# Shiftty Project Status

Last updated: 2026-08-10

## Current milestone

Shiftty is in the first dogfooding correction freeze on branch `codex/initial-shifty-foundation`. The product remains focused on the daily flow `כניסה → הפסקה → יציאה`; no new product phase or unrelated feature was started.

The seven physical-iPhone findings DF-001–DF-007 were investigated at their source, regression-covered, and corrected. A product-wide audit added DF-008–DF-011. Fresh native verification then exposed DF-012, a stale-render-clock crash immediately after starting a break; that defect is fixed, tested, pushed, and natively retested.

There are currently zero known iOS P0/P1 blockers in the corrected code. Android remains externally unverified because no emulator, AVD, or physical Android device is available. The corrected code is installed and dogfoodable on the physical iPhone as a locally signed standalone Release build. Paid Apple Developer Program membership is still unavailable, so this is a temporary Personal Team install rather than an EAS Preview/internal-distribution build.

## Git truth

- Branch: `codex/initial-shifty-foundation`
- Corrected implementation base: `49c5020b77aec35cabe86e4c7f96e5abe7b333ee`
- Expo SDK patch-alignment and physical-build source commit: `4e8e0b3ed9a82b81f7fcbe67c0f0b0bacead0752`
- Remote before publication: `origin/codex/initial-shifty-foundation` matched `49c5020`; the local branch contains the dependency and documentation commits that this handoff publishes.
- The exact final documentation/build HEAD is reported in the final dogfooding handoff because a commit cannot embed its own SHA.
- Working-tree changes after `4e8e0b3` are documentation-only.

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

Latest full pre-build results for the dependency-aligned source now recorded at `4e8e0b3`:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with zero errors/warnings |
| `npm test -- --runInBand` | Passed; 91 suites, 418 tests, 0 failures |
| `npm run validate:migrations` | Passed |
| `npm run validate:expo` | Passed |
| `npx expo install --check` | Passed; dependencies match the installed Expo SDK |
| `npx expo config --type public` | Passed |
| `git diff --check` | Passed |

Expo's current SDK 57 patch recommendations were applied without changing the SDK major/minor or product behavior: `expo` 57.0.12, `@expo/metro-runtime` 57.0.9, `expo-dev-client` 57.0.11, `expo-notifications` 57.0.10, `expo-router` 57.0.12, `expo-sharing` 57.0.11, and `jest-expo` 57.0.4. `npx expo install --check --json` reports `upToDate: true`. A fresh signed Release was then rebuilt, reinstalled, and put through the physical smoke cycle again.

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
- Paid EAS Preview/internal distribution remains unavailable because the Apple account has a free Personal Team but no active paid Apple Developer Program team. No purchase was made.
- The physical-iPhone Release profile expires on 2026-08-17 and must be rebuilt/reinstalled after expiry. This is an Apple Personal Team limitation, not a Shiftty data or runtime defect.
- Local notification permission, native scheduling, background delivery, and lock-screen delivery passed on the physical iPhone. DF-013 remains: the shift-reminder body displays the literal `{offsetMinutes}` token because the translation uses single braces while the renderer expects double braces.
- Remote push notifications are not used by the current Shiftty flow and were not enabled in the Personal Team build. Focus-mode variations, prolonged power-management behavior, calendar/share-target interoperability, keyboard avoidance, and dynamic-text extremes remain unverified.
- Naming remains intentionally unchanged in this sprint: product/UI copy uses **Shiftty / שיפטי**, while Expo's native `name` and `slug` remain **Shifty / shifty**. This P3 consistency item is documented rather than expanded into a global rename.

## Physical-iPhone build

The current corrected source was installed on 2026-08-10 through the no-cost Apple Personal Team fallback after EAS confirmed that no paid Apple Developer Program team was available.

- Source content built: dependency-aligned commit `4e8e0b3ed9a82b81f7fcbe67c0f0b0bacead0752` (the commit was recorded immediately after the successful build from the identical package manifests)
- App version/build: `0.1.0` (`1`)
- Build type: locally compiled iOS Release with an embedded Hermes JavaScript bundle
- Physical bundle identifier: `com.oportnoy.shiftty.dogfood`; the repository's EAS/production identifier remains `com.shifty.app`
- Signing: Xcode automatic signing with the user's free Personal Team
- Provisioning expiry: 2026-08-17
- EAS build ID/install URL/QR: none; this was not an EAS Preview/internal-distribution artifact
- Installation: a fresh dependency-aligned Release passed installation over the previous dogfood bundle; the application container remained available and the pre-install counts were preserved exactly
- Standalone behavior: passed after cable disconnect, force quit, and icon relaunch while port 8081 had no listener; Metro and a Mac connection are not required
- Physical UI: icon, Hebrew RTL, persisted Home/Calendar/Reports data, Settings, unified Add Shift, native date/time pickers, weekday, future classification, and zero implicit break passed on the rebuilt binary
- Live tracking: timer, break-state continuity, current-break timer, resume, 30-second background catch-up, clock-out, and cable-free restart persistence passed on the rebuilt binary
- Persistence: the latest completed shift stored a closed 12-second break, correctly summarized as zero whole break minutes, left zero active shifts, and produced a finalized salary snapshot; `PRAGMA integrity_check` returned `ok` and `PRAGMA foreign_key_check` returned zero violations before and after reinstall and after the live flow
- Reports: completed date/weekday, time range, duration, and salary rendering passed
- Notifications: permission, native scheduling, and background lock-screen delivery passed again on the rebuilt binary; DF-013's unresolved literal `{offsetMinutes}` body placeholder reproduced a second time

The unsupported APNs entitlement was removed only from the disposable native build copy because Shiftty currently schedules local notifications and does not request remote push tokens. No production source/configuration was modified for this fallback build.

The earlier EAS `preview` attempt at `829bd0b` remains historical evidence: it stopped before upload or build-record creation because Ad Hoc/internal distribution requires a paid Apple Developer Program team and credentials. The EAS project and account login are valid, but EAS device registration, distribution certificates, provisioning profiles, and internal installation remain unavailable under the free Personal Team.

## Android checklist

- Install and cold-start the Android development build.
- Verify onboarding/workplace/salary setup and restart persistence.
- Verify native date/time pickers, unified past/future/cross-midnight creation, edit, and deletion.
- Verify clock-in, active timer, break/resume, clock-out, active/break restoration, and discard.
- Verify Home, Calendar, Reports, Settings, RTL, light/dark, and empty/error states.
- Verify notifications, PDF/CSV/ICS sharing, backup/restore/clear-all, SQLite integrity, and foreign keys.
