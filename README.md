# Shifty

Shifty is a Hebrew-first, local-first shift and salary assistant for hourly workers. Phase 1 establishes the Expo application shell, deterministic domain model, SQLite persistence, RTL/localization foundation, and automated test setup. Shift workflows, live tracking, salary rules, forecasting, and exports belong to later phases.

## Development

```sh
npm install
npm start
```

Validation commands:

```sh
npm run typecheck
npm run lint
npm test
npm run validate:expo
```

## Architecture

- `src/app`: Expo Router screens and navigation only.
- `src/features`: feature-owned UI, state, and orchestration.
- `src/domain`: pure entities, repository contracts, and deterministic services.
- `src/data`: SQLite migrations and repository adapters.
- `src/shared`: design tokens, reusable components, localization, hooks, and utilities.

The domain layer does not import React Native, Expo, SQLite, or Zustand. This keeps calculations independently testable and allows a future synchronized repository implementation to be added without rewriting domain services.

## Persistence

The initial migration creates workplaces, roles, salary profiles, pay rules, templates, shifts, individual break sessions, and app settings. Scheduled, actual, and payable times are stored separately. Monetary amounts are integer minor units. A partial unique index prevents more than one active shift.
