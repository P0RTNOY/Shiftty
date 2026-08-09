# Shiftty

Shiftty is a Hebrew-first, local-first shift and salary assistant for hourly workers. It is built with Expo and React Native, stores data in SQLite, and keeps salary calculations in a deterministic domain layer.

## Current state

The application now includes onboarding, workplaces and roles, shift planning and live tracking, salary rules and calculation, forecasts, reports, exports, notifications, backup/restore, and Hebrew RTL presentation. The RC1 reliability work and the RC1.5A/B shift-form simplification are implemented in source, but the current candidate is not yet release-ready: automated lifecycle and Expo dependency checks still require remediation, and the native iOS flows have not yet completed simulator acceptance testing.

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) for the current evidence-based milestone, known gaps, and next development step. The frontend audit and approved simplification sequence are in [`docs/frontend-audit.md`](docs/frontend-audit.md) and [`docs/frontend-simplification-plan.md`](docs/frontend-simplification-plan.md).

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

Migrations create workplaces, roles, salary profiles, pay rules, templates, shifts, break sessions, and app settings. Scheduled, actual, and payable timestamps are stored separately, monetary amounts use integer minor units, and a partial unique index prevents more than one active shift.
