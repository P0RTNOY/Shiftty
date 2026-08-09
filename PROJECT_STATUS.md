# Shiftty Project Status

Last updated: 2026-08-09

## Current milestone

Development is stopped at the boundary between **RC1.5B (input simplification)** and **RC1.5C (Home and active-shift redesign)** on branch `codex/initial-shifty-foundation`.

The product foundation through Phase 6 is present in source: onboarding; workplaces, roles, salary profiles, pay rules, and templates; planned, completed, and live shifts; break tracking; deterministic salary calculation; monthly forecasts and reports; notifications; exports; backup and restore; Hebrew localization and RTL UI. RC1 reliability fixes and RC1.5A/B shift-form simplification have also been implemented.

This is not yet a release-candidate claim. Native behavior has not completed the required simulator acceptance matrix, and the automated gate set is not fully green.

## Git baseline

- Branch: `codex/initial-shifty-foundation`
- Audited HEAD before this status update: `ac03fa768a7611846a50b5f3217788f23da50743`
- Remote baseline before this status update: `origin/codex/initial-shifty-foundation` at `80b28aa2bfa447a193b49a14ef1fc79d71ca2843`
- Relationship at audit time: local branch was 18 commits ahead and 0 behind
- Working tree at audit time: no tracked modifications; only the two untracked frontend audit/plan documents now being recorded

## Implemented and source-verified

- Phase 1 application shell, domain boundaries, SQLite persistence, RTL/localization foundation, and automated-test setup.
- Workplace, role, salary-profile, pay-rule, shift-template, shift, break-session, and settings persistence.
- Shift scheduling, completed-shift entry, live clock-in/out, breaks, cancellation/recovery, deletion, and live timers.
- Salary calculation, calculation snapshots, invalidation/recalculation handling, forecasts, reports, and export adapters.
- Onboarding, notification scheduling, data management, and backup/restore flows.
- RC1 reliability work including legacy-report invalidation, timestamp handling, deletion-state recovery, live timer behavior, and form/timezone corrections.
- RC1.5A/B UI work: simplified shift forms and native date/time picker integration.

## Automated validation baseline

These are the latest observed results before Phase 1 remediation begins:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed with 54 warnings |
| `npm test` | 72 suites and 297 tests passed, but Jest exited 1 because Expo logged twice after teardown |
| `npm run validate:migrations` | Passed |
| Expo web export | Passed; 36 routes exported |
| `npx expo config --type public` | Passed |
| `npx expo install --check` | Failed: five Expo packages require SDK-compatible patch alignment |
| `git diff --check` | Passed for tracked source at the audit baseline |

Expected dependency alignment reported by Expo:

- `expo`: `~57.0.11`
- `expo-file-system`: `~57.0.2`
- `expo-notifications`: `~57.0.9`
- `expo-router`: `~57.0.11`
- `expo-sharing`: `~57.0.10`

The Jest lifecycle failure is associated with late `ExpoModulesCoreJSLogger` output after export/share adapter tests. It must be root-caused; globally suppressing console output is not an acceptable fix.

## Native/manual verification still required

- Produce or identify a fresh iOS simulator development build containing the native date/time picker.
- Record the EAS build ID and install the artifact in the simulator.
- Run Metro against that installed build.
- Complete onboarding, relaunch persistence, planned/completed/cross-midnight shifts, one-tap live tracking, breaks, clock-out, cancellation/recovery, deletion, forecast/report refresh, exports, notification behavior, and backup/restore acceptance checks.
- Exercise Hebrew RTL layout, picker interaction, validation, navigation, keyboard avoidance, and empty/error states on native iOS.
- Run practical Android validation where available after iOS reaches a stable candidate.

## Partial or not started

- RC1.5C: unified Home and active-shift experience is not started.
- RC1.5D: Calendar, Reports, Settings, and navigation simplification is not started.
- RC1.5E: progressive disclosure is only partial; some advanced concepts remain exposed in legacy screens.
- Release hardening and the final evidence matrix are not started.

## Safest next development step

Align the five Expo SDK patch dependencies first, then reproduce and root-cause the Jest post-teardown logger failure until the full automated gate set exits successfully. Commit and push those green milestones separately. Only then create a fresh iOS simulator build and begin the native acceptance matrix; RC1.5C implementation should start after that baseline is stable and recorded.

## Recent development history

The latest source milestones before this status document were:

- `ac03fa7` final timezone and form UX corrections
- `c3beaff` simplified shift forms
- `eac332b` native date/time picker integration
- `8f8bc39` deletion recovery and live timers
- `a93b59c` invalid legacy report handling
- `2e537c9` timestamp corrections
- `cba05ea` onboarding integration
- `449212b` service-layer work
- `5539ec7` salary-column work
- `82fab00` crypto/router work
