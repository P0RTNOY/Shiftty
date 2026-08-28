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

The raw SDK 57 compatibility check currently reports 12 exact patch-level notices. Milestone 8 removed `expo-dev-client` and its launcher/menu subtree so production artifacts cannot contain development-client behavior; retained dependency versions remain locked. The deterministic repository wrapper accepts only the reviewed installed/expected pairs, emits the original Expo output, and fails if that set changes; CI and release preflight use the wrapper while the required raw command remains recorded as an accepted nonzero advisory boundary. `npm audit --omit=dev` reports 16 transitive Expo/Metro toolchain findings: 12 moderate and 4 high. The high findings are the `image-size` denial-of-service advisories reached through Metro; the moderate group includes `uuid` through Expo's Xcode configuration tooling. The non-force audit dry run remains unable to produce a compatible repair, while the force proposal downgrades to incompatible Expo-era packages, including Expo 46 and `expo-sharing` 14. No forced audit rewrite is approved. Track an SDK-compatible upstream Metro/Expo resolution and do not process untrusted image inputs through developer tooling in the meantime.

## Source preflight

Install exactly the locked dependency graph, then run the release preflight:

```bash
npm ci
npm run release:preflight
```

The preflight validates release configuration and assets, type-checks, lints, runs the complete Jest suite and migration validator, exports the Expo web application, verifies SDK dependency compatibility, resolves the public Expo configuration, creates and scans a fresh production-mode iOS Hermes export for forbidden QA/development-client surfaces, and checks patch whitespace. A non-zero result is a source blocker.

The final checklist printed separately by the command is external: authenticated EAS access, Apple/Google program and signing access, store metadata, physical devices, and any future optional service configuration. Those checks cannot be inferred from a green source tree.

Before a native build, confirm authentication without printing or copying credentials:

```bash
npx eas-cli@22.4.0 whoami
```

## Local native builds

Install JavaScript dependencies before regenerating CocoaPods, then compile native dependencies:

```bash
npm ci
(cd ios && pod install)
npx expo run:ios
npx expo run:android
```

For local iOS development, `npx expo run:ios` uses the normal Debug/Metro path. The repository no longer installs `expo-dev-client`; the EAS development-named profiles are standalone internal builds rather than development clients. Re-adding a development client requires a separate source change and must not contaminate the production dependency graph or artifact.

These commands prove only the platform actually built and launched. An unavailable Android SDK/emulator, physical device, or signing team must be recorded as an external blocker, not as a pass.

### Verified Milestone 6 native candidates

On 2026-08-27, commit `f89d798fb68769a0b5a819fbf0d8c3467134b9fc` built as an Android arm64 Release using the isolated API 36 toolchain. The installed `com.shifty.app` APK had SHA-256 `8d9bfba9c341c2e5c0f7e54a69239cd016b5035ac17675ee060d7cedca89d143`. All seven Android Maestro journeys passed on the pinned disposable API 36 emulator when each journey used a fresh driver process. Direct Android notification delivery, artifact readback, DocumentsUI replace restore, semantic backup comparison, restored-shift completion, and SQLite integrity/foreign-key checks also passed.

Hosted CI later reproduced a host-timezone-dependent ambiguity in the documented fall-back overlap choice. The corrected final product-bearing source commit, `58ab0820cda2d8ff79eee886b87758d5000a8232`, rebuilt as an arm64 Release APK with SHA-256 `1cbbc1b9ce02edae7d11bf6a4f091a294022aa9097e053fbab5e6eae2578d37a`. It installed, cold-launched, and reran the seven Android journeys on the same pinned emulator. The correction adds no new pay concept or automatic recalculation; it makes the existing earlier-occurrence rule independent of the host timezone. Exact tool versions, hashes, and boundaries are in `MILESTONE_6_EXTERNAL_NATIVE_EVIDENCE.md`.

The original `f89d798fb68769a0b5a819fbf0d8c3467134b9fc` product commit built as a side-by-side physical-iPhone Release with temporary bundle `com.omerportnoy.shifty.m6qa`, existing team `9R9UQ6GTQW`, and the existing Apple Development identity. It installed and ran on the iPhone 15 Pro Max, iOS 26.6. Lifecycle, open-break recovery, Reports, a native CSV share sheet, Hebrew RTL, English LTR, permission grant, scheduling, and dedupe passed. Foreground/background/terminated notification delivery, notification tap, pre-trigger cancellation, and timezone variation were not directly completed. This QA build does not prove stable production-bundle signing, archive, TestFlight, App Store, or distribution readiness.

The existing `com.omerportnoy.shifty` dogfood application and database are protected. They were not installed over, launched, cleared, uninstalled, or modified. Do not use same-bundle installation as a shortcut for future verification.

Milestone 5's disposable iOS Simulator Release artifact/readback and real document-picker restore evidence remains valid and was not repeated. The final correction was rebuilt and rerun on Android. Milestone 7 supersedes the remaining physical-iPhone blocker with a corrected-source candidate.

### Verified Milestone 7 physical-iPhone candidate

On 2026-08-28, final product-bearing source `cca7c2b17f84bdc437eb5a5b9ea63f13aa172a7d` built as a physical-arm64 Release with temporary bundle `com.omerportnoy.shifty.m7qa`, isolated scheme `shifty-m7qa`, the existing Apple Development identity/team, and development provisioning for the connected device. The executable SHA-256 was `66e367e8ff3ee2782626c55e658170f7d193c0321347fe1b91178c6e744b9a24`, and the embedded JS SHA-256 was `9682256a286fc18b951f643ff7ece8cedb1d072899f2e1aa5f193015c73b77f1`. Deep/strict signing and physical-arm64 build checks passed on the iPhone 15 Pro Max / iOS 26.6 toolchain using Xcode 26.6 Release. The exact artifact installed over only the isolated QA bundle, launched its fail-closed evidence route, completed cleanup, and was uninstalled; the production dogfood bundle remained installed and untouched.

The candidate includes the initial notification-response fix at `2c69b0d6b56bb57d9906360a2557c70fea8bdf0d` plus QA-only harness layout, cleanup, fail-closed build gating, and the final production response-dedupe hardening at `cca7c2b17f84bdc437eb5a5b9ea63f13aa172a7d`. Direct device checks passed permission/no-reprompt, dedupe, foreground/background/terminated delivery, background and terminated tap routing, cancellation beyond trigger, stale-native-ID recreation, deterministic overlap/gap policy, active/open-break recovery, finalization, and SQLite integrity. Exact timestamps and evidence boundaries are in `MILESTONE_7_PHYSICAL_IOS_NOTIFICATIONS.md`.

The QA app used a distinct container and was removed after verification. The production dogfood application/database remained protected and untouched. The generated QA Xcode project, scheme/bundle/team overrides, profile material, device identifier, logs, screenshots, and container are absent from production/native source and configuration commits; sanitized documentation retains only the QA identity evidence required by the milestone. This development-signed QA artifact does not prove production-bundle signing, an archive, TestFlight, App Store, or distribution readiness.

## EAS builds

Standalone internal development builds:

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

`.github/workflows/ci.yml` runs locked installation and the complete source gate on pushes and pull requests. It has read-only repository permission, does not persist the checkout credential, receives no deployment secrets, cancels superseded runs, is time-bounded, and never builds, publishes, signs, or submits an application. Release configuration and asset assertions are included without needlessly running the full Jest suite twice.

Milestone 8 pushed only `codex/ios-testflight-distribution-candidate` and did not open or merge a pull request. Product SHA `75bd38268d83226f121421e2964d2c174b54d094` passed hosted run 33186767702. The final documentation-only commit receives the complete local gate and a second exact-SHA hosted run; no commit is permitted after that result.

### Milestone 8 production-signing boundary

Milestone 8 product source `75bd38268d83226f121421e2964d2c174b54d094` passed hosted CI run 33186767702. Its exact-SHA unsigned arm64 Release resolves `com.omerportnoy.shifty` version `0.1.0 (1)` and passes the production QA/dev-client resource audit with matching application dSYM UUID. This does not establish a monotonic TestFlight build number, production signing, or App Store validation.

Before any signed archive, use official authenticated App Store Connect access to verify that the application record exists and inspect every build for marketing version `0.1.0`. The selected build number must exceed the highest uploaded value. EAS remote version state is currently uninitialized and must not be treated as App Store history. If the application record is absent, stop the record-creation track until Platforms, Name, Primary Language, Bundle ID, SKU, and User Access are explicitly supplied.

No local/EAS App Store Connect API key, Apple Distribution identity, or matching App Store profile was available during Milestone 8 source preparation. Do not create metadata, upload, or guess a build number from this state. After official record/history inspection, reuse existing distribution material when possible; otherwise create no more than the one authorized Apple Distribution certificate, revoke nothing, and create one matching App Store profile. Build and submission remain separate: retrieve and inspect the archive, verify hashes/signature/entitlements/profile/dSYMs/resources, and run App Store validation before a single upload.

## Rollback boundary

Because OTA updates are not configured, stop distributing a defective artifact and build a higher native version from the last verified commit. Do not downgrade or rewrite a populated SQLite schema. Preserve the full database container before recovery work, use only validated transactional restore, and record the incident and platform evidence in `NATIVE_VERIFICATION_REPORT.md`. Store rollback, phased release, and tester removal are manual account operations outside this repository.
