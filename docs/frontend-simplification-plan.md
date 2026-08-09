# Frontend Simplification Plan

## 1. New Product Principles
> **Powerful engine, extremely simple interface.**

A first-time user should understand how to track a shift in a few seconds. The core mental model is:
**CLOCK IN → BREAK → CLOCK OUT**
Everything else should be automatic, inferred, hidden, or placed behind an advanced-details flow.

## 2. Removal & Hiding Matrix (CORE / AUTO / ADVANCED / MERGE / REMOVE)

| Current UI Element | Current Screen | Keep? | New Location | Automatic? | Advanced? | Remove from default UI? | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `scheduledStart` / `scheduledEnd` | New/Edit Shift | Yes | "Advanced" or inferred | Yes (from template) | Yes | **Yes** | Users mostly care about "actual" hours worked. Scheduled time is only for planning. |
| `actualStart` / `actualEnd` | New/Edit Shift | Yes | Main Form | No (manual) | No | **No** | Core data for completed shifts. Should be labeled simply as "כניסה" and "יציאה". |
| `payableStart` / `payableEnd` | New/Edit Shift | Yes | "Advanced" | Yes (fallback to actual) | Yes | **Yes** | Most shifts have identical actual/payable times. This is for overrides. |
| `expectedEnd` | Active Shift / Start | Yes | Active View | Yes (from schedule) | Yes | **Yes** | Exposing expected end requires too many clicks; can be inferred or hidden in a settings modal. |
| Role Selection | New/Edit Shift | Yes | "Advanced" | Yes (from workplace default) | Yes | **Yes** | Workers typically have one role per workplace. |
| Salary Profile | New/Edit Shift | Yes | "Advanced" | Yes (from workplace) | Yes | **Yes** | Users rarely change the underlying calculation profile for a single shift. |
| `payableBreak` / `actualBreak` | New/Edit Shift | Yes | "Advanced" / Main Form | Yes (from live timer) | Partial | **Yes** | Break logic should be simplified to a single "Total Break Time" on the main form. |
| Cancel Active Shift | `active/cancel.tsx` | Yes | Active Shift View | No | No | **Yes** | Should be a secondary action on the main active shift screen (MERGE). |
| Change Expected End | `active/expected-end.tsx` | Yes | Active Shift View | No | Yes | **Yes** | Can be an inline modal/sheet on the active shift screen (MERGE). |
| Start Unscheduled | `start/unscheduled.tsx` | Yes | Home | No | No | **Yes** | "Clock In" should just start a shift automatically (MERGE to Home). |

## 3. Proposed Navigation
Keep the bottom navigation extremely minimal:
1. **בית** (Home & Active Shift)
2. **לוח שנה** (Calendar)
3. **דוחות** (Reports)
4. **הגדרות** (Settings)

## 4. Proposed Screen Designs

### A. Proposed Home
**No Active Shift:**
```text
שלום

המשמרת הבאה
היום 16:00–00:00

[ כניסה ]

החודש
74:20 שעות
₪4,782 צפויים
```

**Active Shift (Dominant UI):**
```text
משמרת פעילה
02:43:17 (Live Timer: now - actualStart)

כניסה
16:02

[ הפסקה ]
[ יציאה ]
```

### B. Proposed Manual Shift Form
```text
משמרת

תאריך (Native Date Picker)
7 באוגוסט 2026

כניסה (Native Time Picker)
08:00

יציאה (Native Time Picker)
16:00

מקום עבודה
סיור

הפסקה
ללא

[ שמור ]

[ אפשרויות נוספות ] (Progressive Disclosure)
```

### C. Proposed Future Shift Form
```text
משמרת חדשה

תאריך
12 באוגוסט

התחלה
16:00

סיום
00:00 למחרת

מקום עבודה
סיור

[ שמור ]
```

### D. Proposed Calendar
Focus on "When am I working?". Show month/week view, shift blocks, simple add button, tap to edit. Hide unnecessary technical metadata (like salary profiles).

### E. Proposed Reports
Default monthly report should be simple: Month, Shift count, Total hours, Expected earnings. List of shifts. Advanced details ("פירוט שכר") hidden behind a button.

### F. Proposed Settings
Top-level settings should be understandable:
- מקומות עבודה
- שכר
- תבניות משמרת
- התראות
- דוחות וגיבוי
- הגדרות מתקדמות (Move technical/rare configuration here)

## 5. Native Date/Time Picker Migration Plan
Replace all raw string inputs (`<TextInput>`) for timestamps with native components (e.g., `@react-native-community/datetimepicker` or Expo equivalent). Users should tap a value (e.g., `08:00`) and use a native wheel to select the time.

## 6. Terminology Simplification

| Current Technical Term | Proposed Replacement |
| :--- | :--- |
| שעת התחלה בפועל | כניסה |
| שעת סיום בפועל | יציאה |
| הפסקה בפועל | הפסקה |
| שעת התחלה לדיווח | עריכת שעות לדיווח (Behind advanced) |
| טווח לתשלום | שעות לדיווח |
| calculation snapshot | תלוש / סיכום (Hide entirely from default UI) |
| salary profile | פרופיל שכר (Hide in advanced) |

## 7. Smart Defaults
- **Workplace:** Infer from last/current/default workplace.
- **Role:** Infer from workplace default.
- **Salary Profile:** Infer from workplace.
- **Template:** Infer from selected times/history.
- **Expected End:** Infer from schedule/template.
- **Expected Break:** Infer from template.
- **Payable Range:** Mirror actual range by default.
- **Currency:** Infer from workplace/default.
- **Timezone:** Infer from application setting.
- **Shift Date:** Infer from selected calendar day.
- **Cross-midnight:** Infer automatically when End Time < Start Time.

## 8. Progressive Disclosure Rules
The following features belong behind "פרטים נוספים" (Advanced Options):
- Scheduled versus actual times.
- Payable/reporting override.
- Paid/unpaid break detail.
- Role.
- Salary profile override.
- Expected end.
- Notes.
- Template selection.
- Recurrence advanced configuration.
- Salary override.

## 9. Screens to Merge/Remove
- `/shifts/active/cancel.tsx` → Merge into `index.tsx` active shift view.
- `/shifts/active/expected-end.tsx` → Merge into `index.tsx` active shift view (bottom sheet).
- `/shifts/active/end.tsx` → Merge into `index.tsx` active shift view (bottom sheet).
- `/shifts/start/unscheduled.tsx` → Merge into `index.tsx` Home screen (Main "Clock In" button).
- `/shifts/[id]/breaks.tsx` → Merge into `/shifts/[id]/edit.tsx` as a dynamic list or bottom sheet.

## 10. Before/After User Flows

**Flow 1 — Clock In Now**
- *Current:* Home → Start Unscheduled → Pick Workplace → Pick Expected End → Confirm
- *Proposed:* Home → Tap "כניסה" (Automatically uses default workplace).
- *Tap Reduction:* 4+ taps → 1 tap.

**Flow 3 — Add completed shift manually**
- *Current:* Home → Add Completed → Fill Scheduled/Actual/Payable fields → Fill Workplace/Role/Profile → Save.
- *Proposed:* Home → Add Completed → Fill Date, In, Out, Workplace → Save.
- *Tap Reduction:* Huge cognitive load reduction.

## 11. Recommended Implementation Sequence

1. **RC1.5A — Core reliability**
   - Fix delete shift bug.
   - Fix active timer to use `now - actualStart`.
2. **RC1.5B — Input simplification**
   - Implement Native date/time picker.
   - Simplify manual and future shift forms.
3. **RC1.5C — Active shift redesign**
   - Implement single-tap "Clock In".
   - Create unified Active Shift UI (merge cancel, expected-end, clock-out).
4. **RC1.5D — Navigation and screens**
   - Simplify Home to strictly show active/next shift.
   - Simplify Calendar and Reports to hide technical data.
5. **RC1.5E — Progressive disclosure**
   - Build the "פרטים נוספים" (Advanced Options) sheet/accordion for all legacy inputs.
