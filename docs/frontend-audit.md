# Frontend Product & UX Audit

## 1. Screen Inventory

| Route / Path | Screen Name | User Goal | Visible Fields & Data | Actions & Navigation | Required for Daily Workflow? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/(tabs)/index.tsx` | Home | See next shift, active shift, summary | Month stats, Next shift details, Prediction cards, Stale warnings | Clock in, Add Future, Add Completed, Apply Suggestion | **Yes** |
| `/(tabs)/calendar.tsx` | Calendar | See month schedule | Calendar days, shift blocks | Change month, tap day, Add shift | No (secondary) |
| `/(tabs)/reports.tsx` | Reports | Review earnings/hours | Month picker, filter by workplace/role/status, stats cards, shift list, detailed salary breakdown | Filter, Change Month | No (secondary) |
| `/(tabs)/settings.tsx` | Settings | App configuration | Profile info, menu links | Navigate to settings sub-screens | No |
| `/shifts/new.tsx` | New Shift | Create future/completed shift | Type (scheduled/completed), scheduled start/end, actual start/end, payable start/end, workplace, role, template, breaks | Save, Cancel | **Yes** |
| `/shifts/[id]/index.tsx` | Shift Details | View shift properties | ALL time fields (6 variants), breaks, calculation status, salary override, notes | Edit, Delete | No (read-only) |
| `/shifts/[id]/edit.tsx` | Edit Shift | Modify shift | All 6 time fields, workplace, role, salary profile, recurrence, notes | Save, Cancel | Yes (for corrections) |
| `/shifts/[id]/breaks.tsx`| Manage Breaks | Add/Edit breaks | List of breaks, paid/unpaid status | Add, Delete, Save | No (advanced) |
| `/shifts/start/index.tsx`| Start Scheduled | Clock into planned shift | Upcoming shifts list | Tap to start | **Yes** |
| `/shifts/start/unscheduled.tsx` | Start Unscheduled | Clock into unplanned shift | Workplace, Role, Expected End | Start | **Yes** |
| `/shifts/active/end.tsx` | End Shift | Clock out | Expected end, notes | Clock out | **Yes** |
| `/shifts/active/cancel.tsx` | Cancel Shift | Abort tracking | Warning message | Confirm, Back | No (recovery) |
| `/shifts/active/expected-end.tsx` | Expected End | Update target | Time input | Save | No |
| `/shifts/apply-suggestion.tsx` | Smart Suggestion | Apply predicted shift | Predicted start/end/workplace | Apply, Reject | No |
| `/settings/workplaces.tsx` | Workplaces | Manage employers | List of workplaces | Add, Edit | No |
| `/settings/salary/index.tsx` | Salary Rules | Configure overtime | Base rates, multipliers, rules | Edit | No (advanced) |
| `/settings/templates/index.tsx`| Templates | Manage standard shifts | List of templates | Add, Edit | No (advanced) |
| `/settings/data-management.tsx`| Data Mgmt | Backup/Restore | Status | Backup, Restore | No |
| `/onboarding/workplace.tsx` | Onboarding Setup | Initial config | Workplace name, base rate | Continue | No (one-time) |

## 2. Field Inventory

| Field | Current Label | Domain Property | Input Type | Required? | Need to Understand? | Can be Inferred? | Action Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Scheduled Start | שעת התחלה מתוכננת | `scheduledStart` | Raw string/Date | No | Only for planning | Yes (from template) | Hide on default manual edit |
| Scheduled End | שעת סיום מתוכננת | `scheduledEnd` | Raw string/Date | No | Only for planning | Yes (from template) | Hide on default manual edit |
| Actual Start | שעת התחלה בפועל | `actualStart` | Raw string/Date | Yes (completed) | Yes | Yes (clock in) | Keep as "כניסה" |
| Actual End | שעת סיום בפועל | `actualEnd` | Raw string/Date | Yes (completed) | Yes | Yes (clock out) | Keep as "יציאה" |
| Payable Start | שעת התחלה לדיווח | `payableStart` | Raw string/Date | No | No | Yes (fallback to actual) | Hide (Advanced) |
| Payable End | שעת סיום לדיווח | `payableEnd` | `payableEnd` | No | No | Yes (fallback to actual) | Hide (Advanced) |
| Expected End | שעת סיום משוערת | `expectedEnd` | Raw string/Date | No | No | Yes (from schedule) | Hide / Move to Advanced |
| Workplace | מקום עבודה | `workplaceId` | Select | Yes | Yes | Yes (last used) | Keep, but auto-fill |
| Role | תפקיד | `roleId` | Select | No | No | Yes (default role) | Hide (Advanced) |
| Salary Profile | פרופיל שכר | `salaryProfileId` | Select | No | No | Yes (from workplace) | Hide (Advanced) |
| Expected Break | הפסקה משוערת | `expectedBreak` | Number | No | No | Yes (from template) | Hide |
| Actual Break | זמן הפסקה | `actualBreak` | Number | No | Yes | Yes (live timer) | Keep, simplify |
| Payable Break | הפסקה לדיווח | `payableBreak` | Number | No | No | Yes (fallback) | Hide (Advanced) |

*Note: Time and date fields currently rely on raw string inputs across most forms.*

## 3. Action Inventory

| Action | Frequency | Classification |
| :--- | :--- | :--- |
| Clock In (Start) | Daily | **CORE** |
| Clock Out (End) | Daily | **CORE** |
| Start/End Break | Daily | **CORE** |
| Create Future Shift | Weekly | **CORE** |
| Edit Completed Shift | Weekly | **CORE** |
| Apply Smart Suggestion | Weekly | **CORE** |
| Add manual past shift | Monthly | **ADVANCED** |
| Edit Payable Time | Rare | **ADVANCED** |
| Edit Salary Overrides | Rare | **ADVANCED** |
| Manage Multiple Breaks | Rare | **ADVANCED** |
| Change Expected End | Rare | **ADVANCED** |
| Duplicate Shift | Rare | **ADVANCED** |
| Delete Shift | Recovery | **CORE** (but hidden in details) |
| Cancel Active Shift | Recovery | **MERGE** (into active view) |
| Configure Salary Rules | Administrative | **ADVANCED** |
| Backup/Restore | Administrative | **ADVANCED** |

## 4. Duplicate Concepts

**The "Time Tuple" Problem:**
The frontend currently exposes up to 6 timestamp fields (`scheduledStart`, `scheduledEnd`, `actualStart`, `actualEnd`, `payableStart`, `payableEnd`) on the edit and detail screens.
- **Scheduled** is for planning.
- **Actual** is the real-world occurrence.
- **Payable** is the correction for the employer.
Displaying all of these side-by-side overwhelms the user. A normal user thinks of "When did I work?" (Actual). Reporting overrides (Payable) should be an advanced sub-menu ("עריכת שעות לדיווח").

## 5. Existing RC1 Frontend Defects to fix during Simplification
- **Invalid time value on deletion**: Deleting a shift causes rendering issues if the active context or hooks don't handle the undefined state gracefully.
- **Active timer not advancing**: Starting a live shift doesn't reliably trigger a ticking UI clock. (Must implement `now - actualStart`).
- **Raw string inputs**: Dates and times require manual typing instead of native wheels.
- **Domain terminology bleed**: Internal terms like "calculation snapshot" and "payable range" are visible to standard users.
