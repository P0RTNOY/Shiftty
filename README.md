# Shiftty

Shiftty is a Hebrew-first, local-first shift and salary assistant for hourly workers. It is built with Expo and React Native, stores data in SQLite, and keeps salary calculations in a deterministic domain layer.

## Current state

The application includes onboarding, workplaces and roles, shift planning and live tracking, predefined shift types with pay multipliers, salary rules and snapshots, recurrence, suggestions, forecasts, reports, exports, notifications, backup/restore, and Hebrew RTL presentation. RC1 reliability, RC1.5A-E frontend simplification, Phase 7 release hardening, and the first physical dogfooding correction sprint are implemented.

The corrected candidate has a real Shiftty icon, zero-break defaults, an uninterrupted active-break experience, Hebrew weekdays, one Add Shift flow, predefined shift types, and a simplified salary-first monthly report. Salary engine `1.3.0` transparently defaults to 8 net hours at the normal rate, the next 2 at 125%, and the next 2 at 150%, with a 12-hour maximum for new/manual shifts; configured or disabled threshold rules override both tiers. Android verification and distribution details are tracked separately in the project status.

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) for the current evidence-based milestone and known gaps, and [`DOGFOODING.md`](DOGFOODING.md) for the frozen-candidate launch and daily-use checklist. The frontend audit and approved simplification sequence are in [`docs/frontend-audit.md`](docs/frontend-audit.md) and [`docs/frontend-simplification-plan.md`](docs/frontend-simplification-plan.md).

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

## Architecture

- `src/app`: Expo Router screens and navigation.
- `src/features`: feature-owned UI, state, and orchestration.
- `src/domain`: pure entities, repository contracts, and deterministic services.
- `src/data`: SQLite migrations and repository adapters.
- `src/shared`: design tokens, reusable components, localization, hooks, and utilities.

The domain layer does not import React Native, Expo, SQLite, or Zustand. This keeps calculations independently testable and leaves room for a future synchronized repository implementation without rewriting domain services.

## Persistence

Migrations create workplaces, roles, salary profiles, pay rules, shift types (internally retained as `shift_templates` for compatibility), shifts, break sessions, and app settings. Scheduled, actual, and payable timestamps are stored separately, monetary amounts use integer minor units, and a partial unique index prevents more than one active shift. Migration 7 adds integer-basis-point type multipliers and immutable type name/multiplier snapshots on shifts. See [`docs/shift-types-and-pay-multipliers.md`](docs/shift-types-and-pay-multipliers.md) for the calculation, migration, deletion, backup, and security decisions.
