# Product Simplification Recommendations

**Audit date:** 2026-08-14
**Principle:** Powerful engine, extremely simple interface.
**Daily mental model:** **כניסה → הפסקה → יציאה**, plus effortless **הוספת משמרת**.

## Ranking method

Recommendations are ordered by likely worker impact divided by implementation and regression risk. “Implement now” is **yes** only for contained changes completed and covered during this sprint. Sophisticated salary, recurrence, reporting, and recovery capability remains preserved underneath the simple path.

## Implemented during this sprint

| Recommendation | Current behavior / problem | Proposed behavior | User benefit | Risk | Effort | Implement now? |
| --- | --- | --- | --- | --- | --- | --- |
| Remove ceremonial onboarding completion | A third screen repeated that setup succeeded and required another tap. | Persist setup completion atomically and go directly to Home; keep route as compatibility fallback. | Faster first success and fewer partial-setup states. | Low | Small | **Yes — done** |
| Keep salary-preview time authoritative | Live render time could disagree with the instant captured by **יציאה**. | Freeze review salary at the captured clock-out instant. | Review and saved money agree. | Medium because money | Small | **Yes — done** |
| Make completed edits self-consistent | Visible actual corrections could leave hidden reporting values and salary stale. | Mirror only unmodified equal values; preserve explicit overrides; finalize salary automatically. | Ordinary edits do not require understanding reporting snapshots. | Medium because historical pay | Medium | **Yes — done** |
| Remove implementation metadata | Salary detail exposed engine version and raw ISO time. | Keep user-relevant components/status only. | Less technical noise and stronger trust. | Low | Small | **Yes — done** |
| Natural reminder and duration language | 0/1 used plural forms and Reports used clock-like duration headlines. | Context-aware singular/plural copy and human duration headlines. | Hebrew reads like a product, not a formatter. | Low | Small | **Yes — done** |
| Safe stale-route behavior | Active-only routes showed invalid actions with no active shift. | Return to Home after authoritative active-state loading. | Recovery never strands or misleads the worker. | Low | Small | **Yes — done** |
| Keep Templates as one scroll owner | A list nested inside the screen scroll container emitted a runtime warning. | Let the virtualized list own vertical scrolling; fix the add footer. | Stable layout and clean runtime. | Low | Small | **Yes — done** |
| Plain Hebrew restore choices | Restore exposed Merge/Replace and “overwrite” jargon. | Explain “merge with existing” versus “replace all data” in Hebrew. | Safer destructive decision. | Low | Small | **Yes — done** |

## Top 10 Next Simplifications

### 1. Make salary setup “hourly rate first, advanced rules second”

- **Current behavior:** Salary Profiles combines workplace selection, profile identity/effective dates, break policy, rounding, bonuses, travel, and entry into Pay Rules.
- **Problem:** The common “I earn ₪X/hour” task looks as complex as the full legal-pay engine.
- **Proposed behavior:** Lead with the active workplace rate and a single edit action. Put versioning, break policy, rounding, bonuses, and Pay Rules behind **הגדרות שכר מתקדמות**.
- **User benefit:** Most workers can trust salary setup after one obvious value.
- **Risk:** Must preserve effective-dated history and never rewrite finalized snapshots.
- **Effort:** Medium.
- **Implement now?** No; requires dedicated salary migration/interaction testing.

### 2. Move Workplace row actions into one detail screen or overflow

- **Current behavior:** Every workplace row can show Edit, Roles, Notifications, and Archive as separate buttons.
- **Problem:** Four equal actions compete in a list that should primarily answer “which workplaces exist?”
- **Proposed behavior:** Tap the row for workplace details; keep Archive in an overflow/destructive section; link Roles and notification override from detail.
- **User benefit:** Cleaner Settings list with one obvious destination.
- **Risk:** Adds one tap for frequent rate edits.
- **Effort:** Medium.
- **Implement now?** No; measure how often users edit rates versus secondary setup.

### 3. Put Duplicate and Delete in Shift Details overflow

- **Current behavior:** Edit, Duplicate, and Delete are individually visible below the completed-shift card.
- **Problem:** Rare/recovery actions compete with the normal correction action.
- **Proposed behavior:** Keep **עריכה** prominent; move Duplicate and Delete into a three-dot menu or clearly separated “more actions” sheet.
- **User benefit:** A completed record reads as information first, actions second.
- **Risk:** Destructive action discoverability and accessible-menu behavior need care.
- **Effort:** Small–medium.
- **Implement now?** No; add/shared menu primitive and native accessibility test first.

### 4. Replace separate entry/exit rows with one human time range on Shift Details

- **Current behavior:** Normal details use separate **כניסה** and **יציאה** rows.
- **Problem:** The user mentally reads a shift as `17:20–05:20 למחרת`, not two database fields.
- **Proposed behavior:** Show one dominant localized range, duration, pay, and optional break; keep individual/alternate ranges in More Details.
- **User benefit:** Faster scanning and closer alignment with calendar/report language.
- **Risk:** Must keep cross-midnight day labeling and accessibility unambiguous.
- **Effort:** Small.
- **Implement now?** No; validate the exact visual hierarchy across scheduled/active/completed states.

### 5. Fold Expected End into the active-shift disclosure

- **Current behavior:** Changing expected end opens a separate route.
- **Problem:** A reminder target adds navigation depth during a live shift and exposes a domain concept more prominently than its frequency warrants.
- **Proposed behavior:** Add an optional row inside Active Shift details or a small sheet, hidden by default.
- **User benefit:** The live screen stays focused on break/resume/exit while the reminder remains reachable.
- **Risk:** Clear/remove semantics and notification explanation must remain visible.
- **Effort:** Medium.
- **Implement now?** No; test notification scheduling and restoration around the new presentation.

### 6. Remove the Reports & Backup intermediate hub

- **Current behavior:** Settings opens **דוחות וגיבוי**, which then offers Exports or Backup/Restore.
- **Problem:** Two clearly named tasks may not justify an intermediate page.
- **Proposed behavior:** Put **ייצוא דוחות** and **גיבוי ושחזור** directly in Settings under one section.
- **User benefit:** One fewer navigation tap for infrequent but important tasks.
- **Risk:** Settings becomes longer; report export and full-data backup must remain conceptually distinct.
- **Effort:** Small.
- **Implement now?** No; confirm the Settings group stays scannable on smaller phones.

### 7. Hide optional title, notes, and expected end on the fallback “start now” form

- **Current behavior:** The unscheduled-start route shows workplace, expected-end format, title, and notes before the start button.
- **Problem:** When the one-workplace direct Home start cannot be used, the fallback still asks for optional planning metadata before the worker clocks in.
- **Proposed behavior:** Show workplace choice and **התחלת משמרת עכשיו**; put expected end/title/notes under **אפשרויות נוספות**.
- **User benefit:** Multiple-workplace clock in remains nearly as fast as the one-workplace case.
- **Risk:** Users who rely on expected-end reminders need discoverability.
- **Effort:** Small.
- **Implement now?** No. Multiple-workplace native dogfooding is complete; keep this as the next contained start-flow simplification because it changes an active-work safety path.

### 8. Collapse per-break actions into row interaction/overflow

- **Current behavior:** Each historical break shows separate Change Type and Delete buttons.
- **Problem:** A few breaks turn an advanced repair screen into a wall of equally weighted buttons.
- **Proposed behavior:** Tap a break to edit; keep Delete inside that edit sheet with confirmation.
- **User benefit:** Break history becomes readable and less destructive-looking.
- **Risk:** Requires an edit presentation and must preserve paid/unpaid clarity.
- **Effort:** Medium.
- **Implement now?** No.

### 9. Reassess Calendar day/week/month mode count from usage evidence

- **Current behavior:** Three modes are always visible.
- **Problem:** Mode controls consume early visual attention before the schedule itself.
- **Proposed behavior:** Keep the most-used month or week view visible and move less-used modes behind a compact selector if evidence supports it.
- **User benefit:** Faster answer to “when am I working?”
- **Risk:** Removing a valuable planning mode would be a capability regression.
- **Effort:** Small UI, medium evidence requirement.
- **Implement now?** No; instrumentation or longer dogfooding is required.

### 10. Shorten onboarding introduction while preserving the privacy promise

- **Current behavior:** Welcome explains shift tracking, salary, monthly reports, and privacy in two large text sections.
- **Problem:** The user must read product positioning before the only required setup task.
- **Proposed behavior:** One sentence about shifts/pay and one concise local-data statement, followed by **התחל עכשיו**.
- **User benefit:** Faster first workplace setup without losing the trust message.
- **Risk:** Privacy differentiation may become too subtle.
- **Effort:** Small.
- **Implement now?** No; copy should be tested with first-time users.

## Principles for future simplification

1. Preserve the engine; simplify where and when its controls appear.
2. Never hide missing or stale money behind a numeric zero.
3. Prefer one obvious action per daily state.
4. Infer only when there is one safe answer; surface a choice when workplaces or reporting intent differ.
5. Keep recovery/destructive actions reachable but visually subordinate.
6. Require native task evidence before deleting a route or Calendar/salary capability.
