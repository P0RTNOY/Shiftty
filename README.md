# Shiftty

Shiftty is a Hebrew-first, local-first shift and salary assistant for hourly workers. It is built with Expo and React Native, stores data in SQLite, and keeps salary calculations in a deterministic domain layer.

## Current state

The application includes onboarding, workplaces and roles, shift planning and live tracking, predefined shift types with pay multipliers, salary rules and snapshots, recurrence, suggestions, forecasts, reports, exports, notifications, backup/restore, and Hebrew RTL presentation. RC1 reliability, RC1.5A-E frontend simplification, Phase 7 release hardening, and the first physical dogfooding correction sprint are implemented.

The corrected candidate has a real Shiftty icon, zero-break defaults, an uninterrupted active-break experience, Hebrew weekdays, one Add Shift flow, predefined shift types, and a simplified salary-first monthly report. Salary engine `1.6.0` retains the transparent default of 8 net hours at the normal rate, the next 2 at 125%, and all later minutes at 150%, with a 12-hour maximum for new/manual shifts; a truthful overdue live clock-out remains fully calculated with a visible warning. Configured or disabled shift/day threshold rules override the default tiers.

Weekly overtime is an explicit advanced opt-in. A salary profile can configure the local workweek start, weekly regular-minute threshold, multiplier, and net/gross basis. Same-workplace/profile context crosses month boundaries without adding context-only report rows, daily and weekly overtime never duplicate the same premium, and finalized historical snapshots remain frozen. Migration 8 and backup version 1 preserve neutral behavior for existing data. See [`docs/workweek-aware-salary.md`](docs/workweek-aware-salary.md).

Holiday, weekly-rest, and custom intervals are now offline, user-confirmed salary inputs. Calendar evidence is stored separately from pay rules, so an interval has no pay effect until a matching rule is configured. A disabled-by-default recurring weekly-rest schedule, exact timezone/DST occurrence resolution, a single reviewable date-only civic preset, deterministic premium families, frozen snapshot provenance, targeted staleness, Migration 9, and backup V1 round-tripping are implemented without inferring religion, entitlement, permits, or legal compliance. See [`docs/evidence-aware-holiday-rest.md`](docs/evidence-aware-holiday-rest.md).

The Salary Trust Foundation labels every salary figure as unavailable, a basic estimate, or an estimate using configured settings. A reusable Hebrew/English assumptions disclosure explains what is included and what is not fully modeled; configured weekly evaluation and contributing user-confirmed special-interval rules are disclosed as included assumptions. Reports, PDF, and CSV keep missing/stale states explicit, while ICS remains calendar-only. No feature claims legal compliance. See [`docs/salary-trust-foundation.md`](docs/salary-trust-foundation.md).

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) for the current evidence-based milestone and known gaps, and [`DOGFOODING.md`](DOGFOODING.md) for the frozen-candidate launch and daily-use checklist. The frontend audit and approved simplification sequence are in [`docs/frontend-audit.md`](docs/frontend-audit.md) and [`docs/frontend-simplification-plan.md`](docs/frontend-simplification-plan.md).

Milestone 4 beta stabilization adds SDK-compatible Expo patch updates, deterministic release preflight and least-privilege CI, public `Shiftty / שיפטי` naming with stable legacy native identifiers, disposable Maestro journeys, bounded salary-coordinator repository work, serialized notification reconciliation, migration-history validation, and a privacy-minimal database recovery surface. The final source gate passed 137 suites / 685 tests, and a fresh standalone iOS Release passed 6/6 Maestro journeys in 11m 50s on an iOS 26.5 Simulator. PDF, CSV, ICS, and backup exports reached real iOS share sheets, but generated-file readback and an OS document-picker restore were not completed. The evidence-based verdict is `SOURCE_READY_NATIVE_BLOCKED`; physical-iPhone signing, Android runtime verification, hosted CI, and store distribution also remain explicit external/manual boundaries. See [`docs/BETA_READINESS.md`](docs/BETA_READINESS.md), [`docs/NATIVE_VERIFICATION_REPORT.md`](docs/NATIVE_VERIFICATION_REPORT.md), and [`docs/RELEASE_BUILD.md`](docs/RELEASE_BUILD.md).

## Development

```sh
npm install
npm start
```

Repository validation commands:

```sh
npm run typecheck
npm run lint
npm test
npm run validate:migrations
npm run validate:expo
npx expo install --check
npx expo config --type public
```

Release-candidate source preflight:

```sh
npm ci
npm run release:preflight
```

## Architecture

- `src/app`: Expo Router screens and navigation.
- `src/features`: feature-owned UI, state, and orchestration.
- `src/domain`: pure entities, repository contracts, and deterministic services.
- `src/data`: SQLite migrations and repository adapters.
- `src/shared`: design tokens, reusable components, localization, hooks, and utilities.

The domain layer does not import React Native, Expo, SQLite, or Zustand. This keeps calculations independently testable and leaves room for a future synchronized repository implementation without rewriting domain services.

## Persistence

Migrations create workplaces, roles, salary profiles, pay rules, shift types (internally retained as `shift_templates` for compatibility), shifts, break sessions, and app settings. Scheduled, actual, and payable timestamps are stored separately, monetary amounts use integer minor units, and a partial unique index prevents more than one active shift. Migration 7 adds integer-basis-point type multipliers and immutable type name/multiplier snapshots on shifts. Migration 8 adds neutral, opt-in workweek configuration and provenance-based weekly snapshot dependency invalidation. Migration 9 adds validated calendar-evidence and weekly-rest storage plus explicit premium families, without inserting a default schedule or rewriting historical results. See [`docs/shift-types-and-pay-multipliers.md`](docs/shift-types-and-pay-multipliers.md), [`docs/workweek-aware-salary.md`](docs/workweek-aware-salary.md), and [`docs/evidence-aware-holiday-rest.md`](docs/evidence-aware-holiday-rest.md).
