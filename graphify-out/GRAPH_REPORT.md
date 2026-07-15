# Graph Report - .  (2026-07-15)

## Corpus Check
- Corpus is ~6,780 words - fits in a single context window. You may not need a graph.

## Summary
- 329 nodes · 500 edges · 51 communities (26 shown, 25 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Shift Repository and State
- App Screens and UI
- App Bootstrap and Testing
- Shift Time Domain
- Expo App Configuration
- Development Toolchain
- Architecture and Persistence
- Package Scripts and Platforms
- TypeScript Configuration
- Internationalization and RTL
- Runtime Dependencies
- Zoned Time Utilities
- Theme System
- Pay Rules
- Workplace and Roles
- ESLint Configuration
- Metro Bundler Configuration
- Product Vision
- Date Fns Time Zones
- Expo Core Package
- Expo Constants Package
- Expo Linking Package
- Expo Localization Package
- Expo Metro Runtime
- Expo Notifications Package
- Expo Printing Package
- Expo Sharing Package
- Expo SQLite Package
- Expo Status Bar
- Expo Vector Icons
- Hook Form Resolvers
- React Package
- React DOM Package
- React Hook Form
- React Native Package
- Safe Area Context
- React Native Screens
- React Native Web
- Zod Validation
- Zustand State
- Feature Architecture Layer

## God Nodes (most connected - your core abstractions)
1. `useTranslation()` - 23 edges
2. `useAppTheme()` - 21 edges
3. `Shift` - 16 edges
4. `expo` - 13 edges
5. `ShiftRepository` - 12 edges
6. `scripts` - 10 edges
7. `SqliteShiftRepository` - 10 edges
8. `AppScreen()` - 8 edges
9. `spacing` - 8 edges
10. `typography` - 8 edges

## Surprising Connections (you probably didn't know these)
- `DatabaseRoot()` --calls--> `useAppTheme()`  [EXTRACTED]
  src/app/_layout.tsx → src/shared/theme/theme-provider.tsx
- `AddShiftScreen()` --calls--> `useTranslation()`  [EXTRACTED]
  src/app/(tabs)/add-shift.tsx → src/shared/i18n/i18n-provider.tsx
- `CalendarScreen()` --calls--> `useTranslation()`  [EXTRACTED]
  src/app/(tabs)/calendar.tsx → src/shared/i18n/i18n-provider.tsx
- `ReportsScreen()` --calls--> `useTranslation()`  [EXTRACTED]
  src/app/(tabs)/reports.tsx → src/shared/i18n/i18n-provider.tsx
- `ShiftRow` --references--> `ShiftStatus`  [EXTRACTED]
  src/data/repositories/sqlite-shift-repository.ts → src/domain/entities/shift.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Phase 1 Foundation Components** — readme_expo_application_shell, readme_deterministic_domain_model, readme_sqlite_persistence, readme_rtl_localization_foundation, readme_automated_test_setup [EXTRACTED 1.00]
- **Shifty Application Architecture Layers** — readme_app_layer, readme_features_layer, readme_domain_layer, readme_data_layer, readme_shared_layer [EXTRACTED 1.00]
- **Persistence Integrity Model** — readme_separate_shift_times, readme_integer_minor_unit_money, readme_single_active_shift_constraint [INFERRED 0.85]

## Communities (51 total, 25 thin omitted)

### Community 0 - "Shift Repository and State"
Cohesion: 0.09
Nodes (19): mapRow(), ShiftRow, SqliteShiftRepository, toParameters(), AppSettings, appSettingsSchema, DEFAULT_APP_SETTINGS, SalaryProfile (+11 more)

### Community 1 - "App Screens and UI"
Cohesion: 0.13
Nodes (28): AddShiftScreen(), CalendarScreen(), HomeScreen(), styles, IconName, ICONS, TabsLayout(), ReportsScreen() (+20 more)

### Community 2 - "App Bootstrap and Testing"
Cohesion: 0.11
Nodes (16): plugins, expo-notifications, expo-router, expo-sqlite, DatabaseRoot(), initializeDatabase(), DATABASE_MIGRATIONS, DatabaseMigration (+8 more)

### Community 3 - "Shift Time Domain"
Cohesion: 0.11
Nodes (18): row, BreakSession, breakSessionSchema, isoTimestampSchema, minorUnitsSchema, nonNegativeMinutesSchema, shiftSchema, shiftStatusSchema (+10 more)

### Community 4 - "Expo App Configuration"
Cohesion: 0.10
Nodes (20): backgroundColor, adaptiveIcon, package, typedRoutes, expo, android, experiments, ios (+12 more)

### Community 5 - "Development Toolchain"
Cohesion: 0.11
Nodes (19): eslint, eslint-config-expo, jest, jest-expo, devDependencies, eslint, eslint-config-expo, jest (+11 more)

### Community 6 - "Architecture and Persistence"
Cohesion: 0.12
Nodes (17): Application Layer, Automated Test Setup, Data Layer, Deterministic Domain Model, Domain Layer, Domain Platform Independence, Expo Application Shell, Independently Testable Calculations (+9 more)

### Community 7 - "Package Scripts and Platforms"
Cohesion: 0.13
Nodes (14): main, name, private, scripts, android, ios, lint, start (+6 more)

### Community 8 - "TypeScript Configuration"
Cohesion: 0.14
Nodes (13): expo-env.d.ts, expo/tsconfig.base, .expo/types/**/*.ts, jest, src/**/*.ts, src/**/*.tsx, compilerOptions, noUncheckedIndexedAccess (+5 more)

### Community 9 - "Internationalization and RTL"
Cohesion: 0.33
Nodes (7): configureNativeRtl(), I18nContext, I18nValue, SupportedLocale, en, he, TranslationKey

### Community 10 - "Runtime Dependencies"
Cohesion: 0.29
Nodes (7): date-fns, expo-router, dependencies, date-fns, expo-router, react-native-gesture-handler, react-native-gesture-handler

### Community 11 - "Zoned Time Utilities"
Cohesion: 0.43
Nodes (4): parseLocalDate(), parseLocalTime(), ResolvedShiftRange, resolveLocalShiftRange()

### Community 12 - "Theme System"
Cohesion: 0.48
Nodes (5): darkColors, lightColors, ThemeContext, ThemeValue, ThemeColors

### Community 13 - "Pay Rules"
Cohesion: 0.40
Nodes (4): PayRule, PayRuleCondition, payRuleConditionSchema, payRuleSchema

### Community 14 - "Workplace and Roles"
Cohesion: 0.40
Nodes (4): Role, roleSchema, Workplace, workplaceSchema

### Community 17 - "Product Vision"
Cohesion: 0.67
Nodes (3): Future Shift, Salary, Forecasting, and Export Workflows, Hebrew-First Local-First Shift and Salary Assistant, Shifty

## Knowledge Gaps
- **130 isolated node(s):** `name`, `slug`, `version`, `orientation`, `userInterfaceStyle` (+125 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `expo-sqlite` connect `App Bootstrap and Testing` to `Shift Repository and State`, `Shift Time Domain`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `plugins` connect `App Bootstrap and Testing` to `Expo App Configuration`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `expo` connect `Expo App Configuration` to `App Bootstrap and Testing`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _130 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shift Repository and State` be split into smaller, more focused modules?**
  _Cohesion score 0.08527131782945736 - nodes in this community are weakly interconnected._
- **Should `App Screens and UI` be split into smaller, more focused modules?**
  _Cohesion score 0.1329268292682927 - nodes in this community are weakly interconnected._
- **Should `App Bootstrap and Testing` be split into smaller, more focused modules?**
  _Cohesion score 0.10826210826210826 - nodes in this community are weakly interconnected._