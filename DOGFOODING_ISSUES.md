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
- **Screenshot:** Not captured; observed directly during the physical-device smoke test.
- **Reproducible?:** Confirmed on both the original and Expo-patch-aligned standalone Release builds; source mismatch is deterministic.
- **Data integrity affected?:** No. The notification record had a native identifier, SQLite integrity was `ok`, and foreign-key verification returned zero violations.
- **Notes:** Logged during dogfooding freeze; no product-code fix was attempted in this build/install task.

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
