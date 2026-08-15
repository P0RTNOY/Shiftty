# Shiftty Dogfooding Issues

This file records verified dogfooding findings. Simulator evidence uses disposable Shiftty test data only.

## DF-001 — No recognizable application icon

- **Date:** 2026-08-10
- **Severity:** P2
- **Screen:** iOS Home Screen / native application metadata
- **Reproduction:** The previous physical-iPhone build used a blank/default-looking icon.
- **Root cause:** Expo referenced generic placeholder artwork instead of a production-ready Shiftty asset.
- **Fix:** Added an original opaque 1024×1024 clock/check icon, Android adaptive configuration, favicon consistency, and a static config test.
- **Fix commit:** `8afd418` (`feat(branding): add original Shiftty app icon`)
- **Verification:** Resolved. The fresh iPhone 17 Pro simulator binary displayed the new Shiftty icon at Home Screen size; config validation passes.
- **Data integrity affected?:** No

## DF-002 — New shifts receive an unrecorded 30-minute break deduction

- **Date:** 2026-08-10
- **Severity:** P0
- **Screen:** Add/Edit Shift, Shift Details, salary/reporting
- **Reproduction:** Create 05:30–14:00 with no break and inspect worked/payable duration.
- **Root cause:** Workplace/onboarding and form defaults seeded 30 expected minutes, while salary fallback semantics could treat expected unpaid time as a real deduction without an explicit actual/payable break.
- **Fix:** New workplaces/forms default to zero; completed work deducts only persisted payable breaks or explicit break sessions. Expected future breaks remain planning data.
- **Fix commit:** `eaa1fc0` (`fix(shifts): stop implicit breaks and preserve active context`)
- **Verification:** Resolved. Automated no-break, explicit-break, live-break, template, and future-shift regressions pass. Native 08:00–16:00 saved as eight hours with zero break; a tracked four-minute break produced four actual/payable break minutes and one net work minute.
- **Data integrity affected?:** Yes; historical rows were deliberately not rewritten.

## DF-003 — Starting a break exits the active-shift experience

- **Date:** 2026-08-10
- **Severity:** P1
- **Screen:** Home / active shift
- **Reproduction:** Clock in and tap **הפסקה**.
- **Root cause:** The first UI repair kept the active panel visible, but native verification found a second defect: Home's 30-second calculation clock could predate the newly persisted break timestamp. Live validation threw `Break end must be after break start`, terminating the native process with SIGSEGV.
- **Fix:** Active break state renders inside the active panel with total/break timers and resume/clock-out actions. Live metrics now treat the newest persisted break event as authoritative over a stale render clock.
- **Fix commits:** `eaa1fc0` and `5aa3643` (`fix(shifts): keep new breaks render-safe`)
- **Verification:** Resolved. The regression failed before the final fix and now passes. Native break, advancing timers, cold restart on break, resume, and clock-out all passed without navigation loss or stale state.
- **Data integrity affected?:** The crash did not corrupt SQLite; the open break survived and restored correctly.

## DF-004 — Shift dates omit the weekday

- **Date:** 2026-08-10
- **Severity:** P2
- **Screen:** Add/Edit Shift, Shift Details, Calendar, Reports, Home, clock-out summary
- **Root cause:** Several surfaces formatted compact numeric dates directly instead of using the shared Hebrew locale/timezone abstraction.
- **Fix:** Added shared weekday-aware formatting and applied it to shift inputs, cards, details, reports, Calendar selection, and clock-out review.
- **Fix commit:** `df66f22` (`fix(ui): show weekdays in shift date fields`)
- **Verification:** Resolved. Automated dates include 2026-08-08 → שבת. Native Add Shift, Details, Calendar, Reports, and clock-out showed correct Hebrew weekdays and cross-midnight next-day labels.
- **Data integrity affected?:** No

## DF-005 — Configured overtime and special rates are not reflected

- **Date:** 2026-08-10
- **Severity:** P0
- **Screen:** Shift Details, Home summary, clock-out summary, Reports
- **Reproduction:** Saturday 17:20 → Sunday 05:20 showed ₪720 on the physical dogfooding build.
- **Root cause:** The salary engine was functioning; onboarding had created a base salary profile but no overtime or special-rate rules. The UI presented the base-only result without making the missing rule configuration clear.
- **Fix:** Salary surfaces explicitly say when only base rate is configured. Added deterministic cross-midnight, weekend, overtime, stacking, and break regression fixtures; no salary math was duplicated in UI.
- **Fix commit:** `ae72f65` (`fix(reports): show authoritative salary and rule state`)
- **Verification:** Resolved for configured-rule behavior. Native disposable fixture at ₪60/hour produced 0 regular minutes, 720 special minutes, ₪720 base, ₪450 premium, and ₪1,170 total. Segments were 400 + 80 minutes at 150%, 120 at 175%, and 120 at 200%. The finalized SQLite snapshot matches and passes integrity/FK checks.
- **Data integrity affected?:** Money presentation was misleading; no engine corruption was found.

## DF-006 — Completed and future shifts use separate add concepts

- **Date:** 2026-08-10
- **Severity:** P2
- **Screen:** Home / Calendar add actions and shift forms
- **Root cause:** Ordinary navigation exposed two domain-specific routes before collecting the actual date/time range.
- **Fix:** Home and Calendar now open one **הוספת משמרת** form. Past ranges become completed actual/payable work, future ranges become scheduled work, overlap-now prompts for live tracking, and recurrence appears only for future scheduling. Legacy routes redirect safely.
- **Fix commit:** `2a9a08a` (`feat(shifts): unify manual shift creation`)
- **Verification:** Resolved. Automated past/future/today/cross-midnight/overlap/equal-time/DST/recurrence cases pass. Native unified form showed one action, weekday date, minimal fields, and zero break; a past 08:00–16:00 shift saved as completed. Future classification and persistence are covered automatically; scheduled rendering remains verified in Calendar/Home.
- **Data integrity affected?:** No

## DF-007 — Reports obscure or misrepresent salary

- **Date:** 2026-08-10
- **Severity:** P1
- **Screen:** Reports / monthly report
- **Root cause:** The default screen mixed low-level calculation details with summary data and did not consistently distinguish final, estimated, stale, missing, and legitimate-zero salary states.
- **Fix:** Reports now lead with completed-shift count, worked hours, and salary, then show weekday/date, range, duration, and authoritative per-shift pay. Breakdown details are progressive; missing/stale states remain explicit.
- **Fix commits:** `ae72f65` and `c89c67b` (`style(reports): clean report row formatting`)
- **Verification:** Resolved. Automated multi-workplace, overtime, special-rate, missing/stale/invalid/zero cases pass. Native Reports showed 6 shifts, 28:03 hours, ₪1,972.50 total, and the Saturday fixture as 12:00 / ₪1,170 with the detailed segment breakdown.
- **Data integrity affected?:** No new calculation source; Reports uses the existing coordinator/snapshot pipeline.

## DF-008 — Calendar range selection can crash or show stale planned times

- **Date:** 2026-08-10
- **Severity:** P1
- **Root cause:** A schedule-first range fallback was reused for display, grouping, overlap, and recurrence behavior, including open unscheduled active shifts.
- **Fix:** Calendar, shared cards, SQL range queries, and overlap checks now use status-aware ranges; recurrence identity remains tied to its original scheduled occurrence.
- **Fix commit:** `b4fcc98` (`fix(calendar): use status-aware shift ranges`)
- **Verification:** Resolved. Automated open-active, completed, overlap, recurrence, week, and quick-clock-out cases pass. Native Calendar rendered completed actual ranges and Hebrew selected-day rows without crashing.
- **Data integrity affected?:** No

## DF-009 — Destructive data management can leave stale active-shift UI state

- **Date:** 2026-08-10
- **Severity:** P1
- **Root cause:** Clear/restore mutated SQLite without synchronizing the one-shot bootstrap/Zustand active-shift state.
- **Fix:** A data-management state service clears or reloads authoritative active state only after successful operations.
- **Fix commit:** `539313d` (`fix(persistence): synchronize restored state and recurrences`)
- **Verification:** Resolved. State-service tests pass; the prior destructive RC pass verified clear, restore-replace, Home/Calendar/Reports refresh, and restart with integrity/FK checks.
- **Data integrity affected?:** UI could contradict SQLite; persisted data remained intact.

## DF-010 — Recurrence rolling-window bootstrap can silently stop extending series

- **Date:** 2026-08-10
- **Severity:** P1
- **Root cause:** Startup materialization ignored exceptions, derived local occurrence dates by splitting UTC text, and depended on an unrelated template lookup instead of the recurrence-series template.
- **Fix:** Bootstrap loads exceptions, uses local date keys, materializes atomically from the stored series template, and preserves `recurrenceOriginalStart`.
- **Fix commit:** `539313d` (`fix(persistence): synchronize restored state and recurrences`)
- **Verification:** Resolved. Store/recurrence tests cover exceptions, no external template, timezone keys, atomic persistence, and idempotence.
- **Data integrity affected?:** Missing/reappearing future occurrences were possible; no historical rewrite was performed.

## DF-011 — Template editing has a dead/misleading error path

- **Date:** 2026-08-10
- **Severity:** P2
- **Root cause:** The headerless prototype route lacked an explicit back action, safe not-found handling, localized error handling, and an edit-specific submit label.
- **Fix:** Added the shared Settings back control, safe missing-template empty state, localized generic errors, and create/edit labels.
- **Fix commit:** `1442752` (`fix(settings): harden template editing flow`)
- **Verification:** Resolved by route-safety/static regression coverage and the green full suite. No native-only defect was observed in the current Settings shell.
- **Data integrity affected?:** No confirmed corruption; false success was possible before the fix.

## DF-012 — A newly started break can crash the native app

- **Date:** 2026-08-10
- **Severity:** P1
- **Screen:** Home / active shift
- **Steps:** Cold-restore an active shift, then start a break before Home's 30-second calculation clock refreshes.
- **Expected:** The same active shift immediately shows **בהפסקה** and a zero/advancing break timer.
- **Actual:** Native app logged `Break end must be after break start` and exited with SIGSEGV; the open break itself remained safely persisted.
- **Root cause:** Live validation compared the current break start to stale presentation time rather than the newer persisted event time.
- **Fix commit:** `5aa3643` (`fix(shifts): keep new breaks render-safe`)
- **Verification:** Resolved. New regression passes; native relaunch restored **בהפסקה**, timers advanced, resume and clock-out succeeded, and SQLite remained valid.
- **Data integrity affected?:** No; process stability and core flow were affected.

## DF-013 — Physical shift reminder exposes its interpolation token

- **Date:** 2026-08-10
- **Severity:** P2
- **Screen:** Physical-iPhone lock-screen notification
- **Steps:** Grant notification permission, enable only the shift-start reminder, schedule a disposable future shift, and background/lock the iPhone.
- **Expected:** One local reminder is delivered with the configured offset rendered as a number.
- **Actual:** Delivery succeeded, but the body displayed the literal `{offsetMinutes}` token.
- **Root cause:** `notification.shiftReminderBody` uses `{offsetMinutes}`, while the shared translation renderer replaces only `{{offsetMinutes}}` placeholders.
- **Fix:** Both locale templates now use `{{offsetMinutes}}`, matching the shared interpolation contract.
- **Fix commit:** `f4f916a` (`fix: resolve dogfooding consistency defects`)
- **Automated verification:** The translation regression asserts that a concrete offset is rendered and no brace token remains.
- **Native verification:** Resolved on 2026-08-14. A signed `f4f916a` Release on the physical iPhone scheduled the disposable reminder with a native identifier. iOS's delivered-notification store returned title `תזכורת: משמרת מתקרבת` and body `המשמרת שלך מתחילה בעוד 0 דקות.` for that exact identifier; the body contains numeric `0` and no brace token.
- **Screenshot:** The transient banner was forwarded to macOS by iPhone Mirroring and was not captured. Delivery content was read back from `UNUserNotificationCenter` for the exact native identifier.
- **Reproducible?:** The defect was confirmed on the two pre-fix standalone builds and is not present in the current physical build.
- **Data integrity affected?:** No. The disposable shift and notification record were removed by restoring the complete pre-test SQLite directory. Database, WAL, and SHM were byte-identical after relaunch; integrity was `ok` and foreign-key verification returned zero violations.
- **Status:** Resolved in source, automated regression coverage, and physical notification delivery.

## DF-014 — Reports and exports disagree about monthly financial truth

- **Date:** 2026-08-12
- **Severity:** P1
- **Screen:** Reports / Settings → Exports
- **Steps:** Select a month containing completed shifts with finalized, missing, incomplete, stale, and legitimate-zero salary snapshots; compare Reports with CSV/PDF output.
- **Expected:** The same completed shifts, local dates/times, hours, salary values, and salary states appear in every financial surface.
- **Actual:** The export path independently queried raw shifts, was not constrained by the same authoritative month model, serialized raw timestamp fields, and could present missing salary as numeric zero.
- **Root cause:** Reports and Exports had separate data-selection and formatting pipelines.
- **Fix:** A shared monthly report service now defines month boundaries in the app timezone, includes completed shifts only, and treats finalized salary snapshots as authoritative. Reports, CSV, and PDF consume that model; ICS remains calendar-only.
- **Fix commit:** `4876ccc` (`feat(reports): unify monthly report exports`)
- **Verification:** Unit/integration/export tests pass. A representative 120-row Hebrew RTL PDF rendered across four A4 pages and was visually inspected on pages 1, 2, and 4.
- **Data integrity affected?:** No persistence corruption; exported interpretation and communication could be wrong.
- **Status:** Resolved.

## DF-015 — Editable date/time values expose storage-format text fields

- **Date:** 2026-08-12
- **Severity:** P2
- **Screen:** Shift forms, active-shift flows, breaks, templates, salary profiles, and pay rules
- **Steps:** Edit a date or time on any affected screen, especially on Android where a picker can be dismissed.
- **Expected:** A platform-native picker with consistent formatting, a real optional empty state, and dismissal that preserves the prior value.
- **Actual:** Several flows exposed raw `YYYY-MM-DD`/`HH:mm` text fields or implemented picker behavior independently.
- **Root cause:** Editable temporal fields lacked a shared UI boundary even though persistence already used canonical string formats.
- **Fix:** All audited editable date/time values now use one shared native control while preserving the existing repository contract.
- **Fix commit:** `2e4728f` (`fix(ui): standardize date and time inputs`)
- **Verification:** Focused interaction tests cover iOS selection, Android dismissal, clearing, errors, and accessibility. A static audit rejects raw editable temporal fields in the affected feature modules.
- **Data integrity affected?:** No confirmed corruption; invalid or invented values were possible before validation.
- **Status:** Resolved in source; Android execution remains unavailable.

## DF-016 — Manual breaks after midnight use the wrong local day

- **Date:** 2026-08-12
- **Severity:** P1
- **Screen:** Shift details → Breaks
- **Steps:** For a cross-midnight shift, add a manual break such as 01:00–01:15 after the shift's start date.
- **Expected:** The break belongs to the second day of the shift and reduces that shift by 15 minutes.
- **Actual:** The time-only input was anchored to the shift's first calendar date, placing the break before the shift or producing an invalid range.
- **Root cause:** Manual break timestamps were composed independently against one date rather than resolved on the shift timeline.
- **Fix:** The service anchors the range to the shift timeline and rolls it across midnight when required.
- **Fix commit:** `f4f916a` (`fix: resolve dogfooding consistency defects`)
- **Verification:** Regression coverage includes an after-midnight manual break on a cross-midnight shift.
- **Data integrity affected?:** Potentially; a saved manual break could have represented the wrong instant. Existing records were not rewritten.
- **Status:** Resolved.

## DF-017 — Applying a suggestion can save the device timezone and zero rate

- **Date:** 2026-08-12
- **Severity:** P1
- **Screen:** Apply suggestion
- **Steps:** Apply a suggestion for a workplace whose timezone/rate differs from the device/default assumptions.
- **Expected:** The scheduled shift uses the app timezone and selected workplace's current hourly rate snapshot.
- **Actual:** The route formatted through the device timezone and supplied a zero hourly-rate snapshot.
- **Root cause:** The route bypassed shared timezone constants and the selected workplace's financial context.
- **Fix:** Suggestion application now uses the app timezone and snapshots the selected workplace's current hourly rate.
- **Fix commit:** `f4f916a` (`fix: resolve dogfooding consistency defects`)
- **Verification:** Route tests cover canonical app-timezone formatting and the selected workplace rate.
- **Data integrity affected?:** Potentially; new suggested shifts could carry incorrect schedule/rate context. Existing records were not rewritten.
- **Status:** Resolved.

## DF-018 — Pay rules require numeric weekday codes

- **Date:** 2026-08-12
- **Severity:** P2
- **Screen:** Settings → Salary → Pay rules
- **Steps:** Configure a weekly special-rate window.
- **Expected:** Choose localized weekday names with accessible controls.
- **Actual:** Enter numeric weekday codes into text fields.
- **Root cause:** The form exposed the internal weekday representation directly.
- **Fix:** Localized named weekday controls now map to the unchanged domain values.
- **Fix commit:** `f4f916a` (`fix: resolve dogfooding consistency defects`)
- **Verification:** Interaction tests cover start/end weekday selection and accessible labels.
- **Data integrity affected?:** No confirmed corruption; setup errors were more likely.
- **Status:** Resolved.

## DF-019 — Clock-out review and saved salary disagree

- **Date:** 2026-08-14
- **Severity:** P0
- **Screen:** Home → Clock Out review; Home; Reports
- **Steps:** Track a short shift across a minute boundary with two breaks, tap **יציאה**, compare the review estimate with the saved shift and Reports.
- **Expected:** The review, finalized record, Home, and Reports use the same clock-out instant and show the same amount.
- **Actual:** The review showed ₪1.00; after saving, Home and Reports showed the authoritative finalized value ₪2.00. SQLite contained two payable minutes and ₪2.00.
- **Root cause:** The preview calculation used the independently advancing live-render timestamp instead of the exact clock-out timestamp captured by the button press.
- **Fix:** Freeze the preview calculation at `clockOutAt` and display money only when the calculation result belongs to that exact end instant, preventing a previous live estimate from flashing.
- **Automated verification:** The Home live-tracking regression covers the frozen instant and suppression of an obsolete salary result.
- **Native verification:** A new tracked shift was clocked out after one minute. The review showed ₪1.00, remained ₪1.00 while held open across the following wall-clock minute, and finalized as ₪1.00; Home and Reports both included the same amount.
- **Data integrity affected?:** Persisted salary was correct, but the wrong-money confirmation undermined trust.
- **Status:** Resolved.

## DF-020 — Editing a completed break can leave reporting time and salary stale

- **Date:** 2026-08-14
- **Severity:** P0
- **Screen:** Shift Details → Edit; Home; Reports
- **Steps:** Open a completed shift whose actual and reporting break are both one minute, change the visible break to zero without opening Advanced, save, then compare Shift Details, Home, Reports, and SQLite.
- **Expected:** Because the two values matched before editing, the hidden reporting break follows the correction and finalized salary is recalculated automatically.
- **Actual:** The visible break became zero while the hidden reporting break remained one minute. The shift became stale and continued to show ₪2.00 instead of the expected recalculated value.
- **Root cause:** The form mirrored actual start/end to reporting time but did not apply the same conditional behavior to breaks; the completed-edit route also saved without finalizing a new salary snapshot.
- **Fix:** Mirror break/time corrections only when the original actual and reporting values matched and the advanced reporting value was not edited; automatically finalize salary after a completed-shift edit.
- **Automated verification:** Shift-form and completed-edit regressions cover break mirroring, preservation of explicit reporting values, and salary finalization.
- **Native verification:** Starting from actual/reporting break `0` and a current ₪3.00 snapshot, changing only the visible break to one minute also changed the hidden reporting break to `1`. Saving produced a new current finalized two-minute/₪2.00 snapshot; Shift Details, Home, Reports, and SQLite agreed, and integrity/foreign-key checks passed.
- **Data integrity affected?:** Yes. The persisted shift could represent a hidden reporting deduction the user did not intend and expose stale money.
- **Status:** Resolved.

## DF-021 — “Recalculate salary” can reuse the snapshot it is meant to replace

- **Date:** 2026-08-14
- **Severity:** P0
- **Screen:** Shift Details → Salary details
- **Steps:** Change a completed shift's reporting duration, then force salary recalculation.
- **Expected:** Force recalculation ignores the historical current snapshot and computes from the edited shift.
- **Actual:** The coordinator selected the finalized frozen snapshot before honoring the ignore-snapshot option, so recalculation could return the old amount unchanged.
- **Root cause:** Frozen-snapshot selection was evaluated independently of `ignoreHistoricalSnapshotShiftIds`.
- **Fix:** A forced recalculation explicitly disables frozen-snapshot reuse for the target shift.
- **Automated verification:** The regression changes a two-hour shift to three payable hours and proves recalculation changes ₪100 to ₪150.
- **Native verification:** Editing the reporting break from one minute to zero retired the prior current snapshot and created a new finalized snapshot from the edited shift: payable time changed from two to three minutes and salary from ₪2.00 to ₪3.00.
- **Data integrity affected?:** Yes. A user-requested money correction could remain wrong while appearing recalculated.
- **Status:** Resolved.

## DF-022 — Opening Edit can overwrite an explicit reporting-time override

- **Date:** 2026-08-14
- **Severity:** P0
- **Screen:** Shift Details → Edit
- **Steps:** Save a completed shift whose reporting start/end or break intentionally differs from the actual values, reopen Edit, and save an unrelated field.
- **Expected:** Existing advanced reporting overrides remain unchanged unless edited explicitly.
- **Actual:** The form's synchronization effect could copy actual values over reporting values on mount because it checked only whether the reporting field was currently dirty.
- **Root cause:** Synchronization did not require an actual-field edit or equality between the initial actual/reporting values.
- **Fix:** Synchronization now requires the actual field to be dirty, the reporting field to remain untouched, and the original pair to have been equal.
- **Automated verification:** Shift-form regressions cover start, end, and break override preservation and conditional mirroring.
- **Native verification:** Reopening Edit for a shift with actual break `0` and an explicit reporting break `1` preserved the reporting value in Advanced before any field was changed.
- **Data integrity affected?:** Yes. An intentional employer-reporting correction could be silently removed.
- **Status:** Resolved.

## DF-023 — Migrated onboarding state can be ignored and setup has a redundant final step

- **Date:** 2026-08-14
- **Severity:** P1
- **Screen:** Startup / onboarding
- **Steps:** Launch with migration 6's boolean `onboarding_completed` value, or complete the fresh workplace form.
- **Expected:** Existing configured users go directly to Home; fresh setup reaches Home immediately after the required workplace/rate save.
- **Actual:** Startup recognized only the legacy JSON string form, so a migrated configured user could be sent to onboarding. Fresh setup also required a ceremonial third screen and another tap before recording completion.
- **Root cause:** The launcher compared serialized JSON text instead of the parsed value, while onboarding completion was persisted in a later route rather than atomically with initial setup.
- **Fix:** Parse and accept both compatible stored forms; write completion atomically with workplace/profile creation; route directly to Home while retaining the finish route only as a compatibility fallback.
- **Automated verification:** Route, service integration, and onboarding-screen tests cover both stored forms, direct navigation, and transactional rollback.
- **Native verification:** A populated Simulator database was integrity-checked, duplicated, and moved aside. A fresh launch completed welcome plus workplace/rate setup and routed directly to Home after the single required form action; `onboarding_completed` was stored as boolean `true`. The original populated SQLite directory was then restored byte-for-byte, with 3 workplaces, 7 shifts, 9 snapshots, and clean integrity/foreign-key checks.
- **Data integrity affected?:** A configured user could be prompted to create redundant setup records; the atomic fix also prevents partial initial setup.
- **Status:** Resolved.

## DF-024 — Zero- and one-minute reminders use unnatural plural copy

- **Date:** 2026-08-14
- **Severity:** P2
- **Screen:** Local shift-start notification
- **Steps:** Deliver a reminder at offset 0 or configure an offset of one minute.
- **Expected:** Zero says the shift starts now; one uses the singular; larger offsets interpolate the number.
- **Actual:** The verified physical delivery used `המשמרת שלך מתחילה בעוד 0 דקות.` and the same plural template applied to one minute.
- **Fix:** Notification planning now selects natural 0, 1, or plural bodies in Hebrew and English.
- **Automated verification:** Planner and translation regressions cover all three forms and interpolation.
- **Native verification:** Final DF-013 physical delivery retest is pending the one final signed build.
- **Data integrity affected?:** No.
- **Status:** Fixed in source and tests; physical delivery retest pending.

## DF-025 — Hebrew duration and report-count grammar is mechanical

- **Date:** 2026-08-14
- **Severity:** P2
- **Screen:** Reports; Shift Details
- **Steps:** Complete one short shift with a one-minute break and inspect Reports and Shift Details.
- **Expected:** Natural copy such as **משמרת אחת**, **2 דקות עבודה**, and **דקה אחת**.
- **Actual:** The UI showed forms including `1 משמרות שהושלמו`, `0:02 שעות עבודה`, and `1 דקות`.
- **Fix:** Shared long-duration formatting now handles Hebrew and English singular forms, Reports uses a singular completed-shift key and natural headline duration, and Shift Details uses the same formatter.
- **Automated verification:** Duration, Reports, translation, and Shift Details regressions pass.
- **Native verification:** The corrected `משמרת אחת הושלמה` / `2 דקות עבודה` headline is visible in the running Simulator build. The populated report also uses the dedicated singular salary-warning form `שכר לא זמין עבור משמרת אחת`.
- **Data integrity affected?:** No.
- **Status:** Resolved.

## DF-026 — Native date/time buttons do not announce their current value

- **Date:** 2026-08-14
- **Severity:** P2
- **Screen:** Add/Edit Shift and every shared date/time picker consumer
- **Steps:** Inspect an Edit Shift date or time control through the Simulator accessibility tree.
- **Expected:** The button exposes both its label and current localized value.
- **Actual:** The current date/time was visible but absent from accessibility metadata.
- **Fix:** Shared date/time fields expose `accessibilityValue.text` using the displayed value.
- **Automated verification:** Shared date-field interaction tests cover the value metadata.
- **Native verification:** The Edit Shift accessibility tree announced `תאריך` as `שישי, 14 באוגוסט 2026`, `כניסה` as `18:06`, and `יציאה` as `18:09`.
- **Data integrity affected?:** No.
- **Status:** Resolved.

## DF-027 — Salary details expose engine version and raw calculation timestamp

- **Date:** 2026-08-14
- **Severity:** P2
- **Screen:** Shift Details → Salary details
- **Steps:** Expand the salary breakdown for a completed shift.
- **Expected:** User-relevant components and status only.
- **Actual:** The default advanced card ended with raw `1.0.0 · <ISO timestamp>` implementation metadata.
- **Fix:** Removed engine version and raw calculation timestamp while retaining status, components, segments, and explicit recalculation.
- **Automated verification:** Salary-breakdown regression confirms neither raw value is rendered.
- **Native verification:** The expanded salary card in the running Simulator retained the component breakdown and natural duration copy while exposing neither the engine version nor the raw ISO timestamp.
- **Data integrity affected?:** No.
- **Status:** Resolved.

## DF-028 — Templates emits a nested VirtualizedList runtime warning

- **Date:** 2026-08-14
- **Severity:** P2
- **Screen:** Settings → Shift Templates
- **Steps:** Open Templates in the development client and navigate onward.
- **Expected:** A clean list with pull-to-refresh and no runtime warning.
- **Actual:** React Native reported `VirtualizedLists should never be nested inside plain ScrollViews`; the development error toast persisted over subsequent screens.
- **Root cause:** The screen placed a vertical `FlatList` inside `AppScreen`'s vertical `ScrollView`.
- **Fix:** `AppScreen` can delegate scrolling to a virtualized child; Templates uses that mode and keeps its footer outside the list.
- **Automated verification:** Component regressions cover scrollable and delegated-scroll modes; typecheck passes.
- **Native verification:** Reopened Templates in the running Simulator. Layout, empty state, and fixed footer rendered correctly, and Metro emitted no new warning.
- **Data integrity affected?:** No.
- **Status:** Resolved.

## DF-029 — Stale active-shift routes expose invalid or endless states

- **Date:** 2026-08-14
- **Severity:** P1
- **Screen:** Clock Out, Cancel Tracking, Expected End
- **Steps:** With no active shift, open `/shifts/active/end`, `/cancel`, or `/expected-end` through a stale/deep link.
- **Expected:** Return safely to Home.
- **Actual:** Clock Out remained on **טוענים…**, Expected End showed disabled controls for a nonexistent shift, and Cancel Tracking exposed a destructive cancellation action.
- **Root cause:** The routes treated absence during initial load and authoritative absence after refresh as the same state and had no stale-route guard.
- **Fix:** After active-state loading completes, all three routes redirect to Home when no active shift exists and render no invalid action while redirecting.
- **Automated verification:** Route-guard regressions cover all three screens; existing Clock Out tests remain green.
- **Native verification:** Deep-linked all three routes in the running Simulator; each returned to Home.
- **Data integrity affected?:** No destructive mutation was observed, but a recovery route exposed an action without a valid target.
- **Status:** Resolved.

## DF-030 — Backup restore choices expose English implementation terms

- **Date:** 2026-08-14
- **Severity:** P2
- **Screen:** Settings → Data Management → Restore
- **Steps:** Choose a valid backup and inspect the restore strategy prompt.
- **Expected:** Clear Hebrew choices describing whether existing data remains or is replaced.
- **Actual:** Buttons used `מזג (Merge)` and `החלף הכל (Replace)`, while the screen described replacement as `לדרוס`.
- **Fix:** Copy now uses **מיזוג עם הקיים** and **החלפת כל הנתונים**, with a plain-language explanation before file selection.
- **Automated verification:** The screen regression exercises a valid backup preview and asserts both choices.
- **Native verification:** Updated explanatory copy rendered in the running Simulator. The destructive restore actions were not executed in this sprint.
- **Data integrity affected?:** No.
- **Status:** Resolved.

## DF-031 — An incomplete completed shift can reappear with a numeric salary

- **Date:** 2026-08-15
- **Severity:** P0
- **Screen:** Shift Details; Home salary dashboard
- **Steps:** Create a completed shift for a zero-rate workplace after another workplace has populated a historical rate snapshot, then reopen its details.
- **Expected:** The current incomplete salary snapshot remains authoritative and no numeric total is shown until explicit recalculation succeeds.
- **Actual:** Persistence correctly stored an incomplete snapshot with no total, but the dashboard coordinator ignored it and recomputed from the shift's historical numeric rate snapshot, displaying an incorrect ₪480 estimate.
- **Root cause:** Frozen-result selection covered finalized/stale snapshots only. Completed shifts marked `incomplete` were recalculated for display, allowing an old rate snapshot to override the authoritative missing state.
- **Fix:** Completed incomplete shifts now preserve their current incomplete snapshot; if that snapshot is unavailable, normal dashboard calculation still suppresses a numeric total. Explicit user recalculation continues to bypass the frozen state.
- **Automated verification:** Two coordinator regressions cover current incomplete snapshots and the snapshot-persistence-failure fallback. Both were observed red before the minimal fix and green afterward.
- **Native verification:** The same zero-rate completed shift changed from `שכר משוער · ₪480.00` to `חישוב שכר חסר` with no numeric amount. SQLite retained the incomplete snapshot and missing-rate issue.
- **Data integrity affected?:** Persisted salary stayed incomplete, but the UI made a false monetary claim.
- **Status:** Resolved.

## DF-032 — The one-shift salary warning uses a plural noun

- **Date:** 2026-08-15
- **Severity:** P2
- **Screen:** Reports
- **Steps:** Open a populated month with exactly one shift whose salary is unavailable.
- **Expected:** Natural singular Hebrew.
- **Actual:** The headline showed `שכר לא זמין עבור 1 משמרות`.
- **Fix:** Reports now selects a dedicated singular key for exactly one salary issue in Hebrew and English.
- **Automated verification:** Reports regression covers the singular warning.
- **Native verification:** The populated August report shows `שכר לא זמין עבור משמרת אחת`.
- **Data integrity affected?:** No.
- **Status:** Resolved.

## DF-033 — Cross-midnight PDF/CSV rows hide the exit date

- **Date:** 2026-08-15
- **Severity:** P1
- **Screen:** Monthly PDF and CSV exports
- **Steps:** Export a month containing a shift from Saturday 17:20 to Sunday 05:20.
- **Expected:** The external report makes the next-day exit unambiguous.
- **Actual:** Both formats placed the row under `2026-08-08` and showed only `17:20-5:20`, which can be read as a negative or same-day range.
- **Fix:** When start and end fall on different local dates, the exit value includes the local end date (`2026-08-09 5:20`) in both CSV and PDF.
- **Automated verification:** Export regression covers the cross-midnight exit date in both formats.
- **Native verification:** Regenerated the populated August exports. CSV retained its UTF-8 BOM and explicit empty incomplete-salary cell; the rendered one-page RTL PDF was visually clean and showed `17:20-2026-08-09 5:20` without clipping.
- **Data integrity affected?:** No storage corruption; the external report could previously be misinterpreted.
- **Status:** Resolved.

## New issue template

- **ID:**
- **Date:**
- **Severity:**
- **Screen:**
- **Steps:**
- **Expected:**
- **Actual:**
- **Screenshot:**
- **Reproducible?:**
- **Data integrity affected?:**
- **Notes:**
