# Release and build guide

Read this guide with [`BETA_READINESS.md`](BETA_READINESS.md) for go/no-go criteria and [`NATIVE_VERIFICATION_REPORT.md`](NATIVE_VERIFICATION_REPORT.md) for platform-specific evidence. Successful source preflight does not substitute for the native matrix.

Shiftty is an Expo SDK 57 local-first application. The public product name is **Shiftty / שיפטי**. Existing native identities remain intentionally unchanged for install, deep-link, database, and EAS continuity:

- Expo slug and URL scheme: `shifty`
- iOS bundle identifier: `com.omerportnoy.shifty`
- Android application ID: `com.shifty.app`
- EAS project ID: `25182fca-22be-477f-ac1b-45638f64db2e`
- Xcode project, target, workspace, and scheme: legacy `Shifty`

Changing any of those stable identifiers is a separate migration and release-management project. The tracked iOS `CFBundleDisplayName` is synchronized to `Shiftty`; native target names do not determine the user-visible name.

## Version and platform policy

`app.json` owns the public semantic version (`0.1.0` for this beta line). EAS uses remote native version management and the production profile auto-increments iOS build numbers and Android version codes. Production Android builds are App Bundles; preview Android builds are installable APKs.

The application currently declares iPhone and iPad support, portrait-only on iPhone and all interface orientations on iPad through the generated native configuration. A release claim must list the device classes actually exercised; declaring iPad support is not evidence that an iPad journey was run.

Over-the-air updates are not enabled: `expo-updates` is not a direct dependency and no update channel or runtime-version policy is configured. Shipping an update therefore requires a new native build. Adding OTA updates later requires an explicit runtime-version and rollback policy.

The app is local-first and currently has no required runtime secrets or remote service environment variables. `.env` files remain ignored. Do not add credentials to `app.json`, `eas.json`, GitHub Actions, source files, or committed environment files.

## Dependency advisory boundary

The SDK 57 compatibility check is clean after applying Expo's eight recommended patch updates. `npm audit --omit=dev` nevertheless reports 16 transitive Expo/Metro toolchain findings: 12 moderate and 4 high. The high findings are the `image-size` denial-of-service advisories reached through Metro; the moderate group includes `uuid` through Expo's Xcode configuration tooling. The non-force audit dry run remains unable to produce a compatible repair, while the force proposal downgrades to incompatible Expo-era packages, including Expo 46 and `expo-sharing` 14. No forced audit rewrite is approved. Track an SDK-compatible upstream Metro/Expo resolution and do not process untrusted image inputs through developer tooling in the meantime.

## Source preflight

Install exactly the locked dependency graph, then run the release preflight:

```bash
npm ci
npm run release:preflight
```

The preflight validates release configuration and assets, type-checks, lints, runs the complete Jest suite and migration validator, exports the Expo web application, verifies SDK dependency compatibility, resolves the public Expo configuration, and checks patch whitespace. A non-zero result is a source blocker.

The final checklist printed separately by the command is external: authenticated EAS access, Apple/Google program and signing access, store metadata, physical devices, and any future optional service configuration. Those checks cannot be inferred from a green source tree.

Before a native build, confirm authentication without printing or copying credentials:

```bash
npx eas-cli@22.4.0 whoami
```

## Local native builds

Regenerate and compile native dependencies after an Expo module update:

```bash
npx expo run:ios
npx expo run:android
```

For an iOS Simulator development client:

```bash
npx expo run:ios
npx expo start --dev-client
```

These commands prove only the platform actually built and launched. An unavailable Android SDK/emulator, physical device, or signing team must be recorded as an external blocker, not as a pass.

### Verified Milestone 5 local candidate

On 2026-08-26, a fresh arm64 Release built and ran without Metro on the pinned disposable iPhone 17 Pro clone running iOS 26.5, UDID `73B7FFB2-1EC0-470C-B7E5-38D401BA4255`. The application used the stable `com.omerportnoy.shifty` bundle. Production English and Hebrew UI generated PDF, CSV, calendar-only ICS, and backup files through real share sheets. Independent `pypdf`, Quick Look, standard-library CSV, `icalendar`, and `qpdf` readback was performed with the exact warning boundary documented in `NATIVE_VERIFICATION_REPORT.md`.

The production document picker selected **On My iPhone → `m5-source-backup.json`**. Replace restore, cold-relaunch active/open-break restoration, SQLite integrity/foreign-key checks, canonical backup-data comparison, bounded merge, full end review, new snapshot finalization, historical-result preservation, and expected weekly dependency staleness passed on disposable Simulator data. This is still Simulator evidence, not a signed device/archive/TestFlight artifact.

The connected iPhone 15 Pro Max already holds the stable bundle with existing data. A safe current-candidate device build was unavailable because the configured project team and only installed signing identity belong to different teams and no matching provisioning profile exists. Do not create profiles, alter credentials, or replace the existing container merely to bypass that boundary. First establish the authorized Apple team and profile, then preserve a recoverable copy of the complete app container before any same-identifier installation.

Android is also blocked: the host has no complete SDK, Android Studio, emulator, AVD, or connected device. The presence of `adb` 37 and an incomplete Unity SDK is not a reproducible Expo/Gradle build environment.

## EAS builds

Development clients:

```bash
npx eas-cli@22.4.0 build --platform ios --profile development-simulator
npx eas-cli@22.4.0 build --platform ios --profile development
npx eas-cli@22.4.0 build --platform android --profile development
```

Internally distributed preview builds:

```bash
npx eas-cli@22.4.0 build --platform ios --profile preview
npx eas-cli@22.4.0 build --platform android --profile preview
```

Unsigned source validation does not require credentials, but iOS device/preview/production builds require an eligible Apple team. Android store builds require Google Play upload credentials only for submission, not for compilation.

Store artifacts:

```bash
npx eas-cli@22.4.0 build --platform ios --profile production
npx eas-cli@22.4.0 build --platform android --profile production
```

The repository intentionally defines no automatic submit step. Review artifacts, native verification evidence, privacy declarations, screenshots, support/privacy URLs, store metadata, and credentials before any separate manual submission. This milestone does not submit to TestFlight, App Store Connect, or Google Play.

## CI boundary

`.github/workflows/ci.yml` runs locked installation and the source gate on pushes and pull requests. It has read-only repository permission, does not persist the checkout credential, receives no deployment secrets, cancels superseded runs, and never builds, publishes, signs, or submits an application.

No hosted workflow/run exists for the Milestone 5 candidate, and the exact commit is not remote. The checked-in workflow runs the source-gate commands individually but does not invoke the `npm run release:preflight` wrapper, whose additional release configuration and asset assertions are therefore local-only evidence. Before relying on hosted CI for a release decision, either add those assertions or demonstrate equivalent hosted steps. Do not push merely to create evidence when pushing is outside the authorized task.

## Rollback boundary

Because OTA updates are not configured, stop distributing a defective artifact and build a higher native version from the last verified commit. Do not downgrade or rewrite a populated SQLite schema. Preserve the full database container before recovery work, use only validated transactional restore, and record the incident and platform evidence in `NATIVE_VERIFICATION_REPORT.md`. Store rollback, phased release, and tester removal are manual account operations outside this repository.
