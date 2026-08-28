#!/usr/bin/env node
/* global __dirname */

const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs');
const { extname, join, resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..');

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function read(relativePath) {
  return readFileSync(resolve(projectRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function walk(relativeDirectory) {
  const directory = resolve(projectRoot, relativeDirectory);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    return entry.isDirectory()
      ? walk(absolutePath.slice(projectRoot.length + 1))
      : [absolutePath];
  });
}

function plistStringsForArray(infoPlist, key) {
  const match = infoPlist.match(new RegExp(`<key>${key}<\\/key>\\s*<array>([\\s\\S]*?)<\\/array>`));
  if (!match) return [];
  return [...match[1].matchAll(/<string>([^<]+)<\/string>/g)].map((item) => item[1]);
}

function resolvedExpoConfig() {
  const result = spawnSync(
    'npx',
    ['--no-install', 'expo', 'config', '--type', 'public', '--json'],
    { cwd: projectRoot, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' } },
  );
  if (result.error || result.status !== 0) {
    fail(`Expo public configuration could not be resolved: ${(result.stderr || result.error?.message || '').trim()}`);
  }
  return JSON.parse(result.stdout);
}

function validate() {
  const app = readJson('app.json').expo;
  const eas = readJson('eas.json');
  const packageManifest = readJson('package.json');
  const infoPlist = read('ios/Shifty/Info.plist');
  const project = read('ios/Shifty.xcodeproj/project.pbxproj');
  const entitlements = read('ios/Shifty/Shifty.entitlements');
  const storyboard = read('ios/Shifty/SplashScreen.storyboard');
  const podfileLock = read('ios/Podfile.lock');
  const privacyManifest = read('ios/Shifty/PrivacyInfo.xcprivacy');

  assert(app.name === 'Shiftty', 'Production display name must be Shiftty.');
  assert(app.slug === 'shifty' && app.scheme === 'shifty', 'Stable Expo slug and URL scheme must remain shifty.');
  assert(app.version === '0.1.0', 'Marketing version must remain 0.1.0 for this candidate.');
  assert(app.ios?.bundleIdentifier === 'com.omerportnoy.shifty', 'Production iOS bundle identifier drifted.');
  assert(app.ios?.supportsTablet === true, 'The checked-in native target supports iPhone and iPad.');
  assert(app.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false, 'Export-compliance declaration must remain explicit and false.');
  assert(eas.cli?.appVersionSource === 'remote' && eas.cli?.requireCommit === true, 'EAS version/SHA provenance settings drifted.');
  assert(eas.build?.production?.distribution === 'store', 'Production EAS builds must use store distribution.');
  assert(eas.build?.production?.autoIncrement === true, 'Production EAS build numbers must auto-increment.');
  assert(eas.build?.production?.developmentClient !== true, 'Production EAS builds must not be development clients.');

  for (const dependencySection of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    assert(!packageManifest[dependencySection]?.['expo-dev-client'], 'expo-dev-client must not be installed by the production source manifest.');
  }
  assert(!podfileLock.includes('expo-dev-client'), 'The native dependency lock must not contain expo-dev-client.');
  assert(!podfileLock.includes('expo-dev-launcher'), 'The native dependency lock must not contain expo-dev-launcher.');
  assert(!podfileLock.includes('expo-dev-menu'), 'The native dependency lock must not contain expo-dev-menu.');

  assert(!existsSync(resolve(projectRoot, 'src/app/m7-native-evidence.tsx')), 'The M7 evidence route must not exist in the production route tree.');
  assert(!existsSync(resolve(projectRoot, 'src/features/shifts/notifications/m7-native-evidence.ts')), 'The M7 evidence helper must not exist in production source.');
  const forbiddenProductPatterns = [
    /m7qa/i,
    /M7 Native Evidence/,
    /EXPO_PUBLIC_M7_NATIVE_EVIDENCE/,
    /Invalidate native request/,
    /Remove QA notification shifts/,
  ];
  const productFiles = ['src/app', 'src/features', 'src/shared']
    .flatMap(walk)
    .filter((path) => ['.ts', '.tsx', '.js', '.jsx'].includes(extname(path)))
    .filter((path) => !/\.(?:test|spec)\.[^.]+$/.test(path));
  for (const path of productFiles) {
    const source = readFileSync(path, 'utf8');
    assert(!forbiddenProductPatterns.some((pattern) => pattern.test(source)), `Forbidden QA surface remains in ${path.slice(projectRoot.length + 1)}.`);
  }

  const schemeFiles = walk('ios/Shifty.xcodeproj/xcshareddata/xcschemes');
  assert(schemeFiles.length === 1 && schemeFiles[0].endsWith('/Shifty.xcscheme'), 'Only the production Shifty scheme may be tracked.');
  assert(!schemeFiles.some((path) => /m7|qa/i.test(readFileSync(path, 'utf8'))), 'A QA identifier remains in the tracked native scheme.');

  const nativeSchemes = [...infoPlist.matchAll(/<key>CFBundleURLSchemes<\/key>\s*<array>([\s\S]*?)<\/array>/g)]
    .flatMap((match) => [...match[1].matchAll(/<string>([^<]+)<\/string>/g)].map((item) => item[1]));
  assert(JSON.stringify(nativeSchemes) === JSON.stringify(['shifty']), 'The native app must register only the production shifty URL scheme.');
  assert(!infoPlist.includes('NSBonjourServices') && !infoPlist.includes('NSLocalNetworkUsageDescription'), 'Development-client local-network metadata must not be in production Info.plist.');
  assert(infoPlist.includes('<string>$(MARKETING_VERSION)</string>'), 'Info.plist must resolve its marketing version from Xcode settings.');
  assert(infoPlist.includes('<string>$(CURRENT_PROJECT_VERSION)</string>'), 'Info.plist must resolve its build number from Xcode settings.');
  assert((project.match(/MARKETING_VERSION = 0\.1\.0;/g) ?? []).length === 2, 'Debug and Release marketing versions must both be 0.1.0.');
  assert(!project.includes('MARKETING_VERSION = 1.0;'), 'Stale native marketing version 1.0 remains.');
  assert((project.match(/PRODUCT_BUNDLE_IDENTIFIER = com\.omerportnoy\.shifty;/g) ?? []).length === 2, 'Debug and Release native bundle identifiers must match production.');
  assert((project.match(/CODE_SIGN_IDENTITY = "Apple Development";/g) ?? []).length === 1, 'Only Debug may pin the Apple Development identity.');
  assert((project.match(/"CODE_SIGN_IDENTITY\[sdk=iphoneos\*\]" = "iPhone Developer";/g) ?? []).length === 1, 'Only Debug project settings may pin an iPhone development identity.');
  assert(project.includes('IPHONEOS_DEPLOYMENT_TARGET = 16.4;'), 'Minimum iOS version must remain 16.4.');
  assert(project.includes('TARGETED_DEVICE_FAMILY = "1,2";'), 'Native target must continue to support iPhone and iPad.');

  assert(!/\<(?:key)\>(?:aps-environment|get-task-allow)\<\/(?:key)\>/.test(entitlements), 'Production entitlements must not enable push or debug signing.');
  assert(privacyManifest.includes('NSPrivacyAccessedAPITypes'), 'The application privacy manifest must declare required-reason API access.');
  assert(!storyboard.includes('<imageView') && !storyboard.includes('<image name='), 'Launch storyboard must not reference a missing image asset.');

  const expoIcon = readFileSync(resolve(projectRoot, app.ios.icon));
  const nativeIcon = readFileSync(resolve(projectRoot, 'ios/Shifty/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png'));
  assert(expoIcon.equals(nativeIcon), 'Tracked native AppIcon must be byte-identical to the configured Expo iOS icon.');
  assert(statSync(resolve(projectRoot, 'ios/Shifty/SplashScreen.storyboard')).size > 0, 'Launch storyboard is missing.');

  const resolved = resolvedExpoConfig();
  assert(resolved.name === 'Shiftty', 'Resolved Expo display name drifted.');
  assert(resolved.scheme === 'shifty', 'Resolved Expo URL scheme drifted.');
  assert(resolved.version === '0.1.0', 'Resolved Expo marketing version drifted.');
  assert(resolved.ios?.bundleIdentifier === 'com.omerportnoy.shifty', 'Resolved Expo production bundle identifier drifted.');
  assert(resolved.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false, 'Resolved export-compliance declaration drifted.');

  const forbiddenEnvironmentNames = Object.keys(process.env).filter((name) => name.startsWith('EXPO_PUBLIC_M7_NATIVE_EVIDENCE'));
  assert(forbiddenEnvironmentNames.length === 0, 'A forbidden M7 evidence environment variable is set for production validation.');

  // Ensure array extraction remains exercised for platform values read from XML.
  assert(plistStringsForArray(infoPlist, 'CFBundleLocalizations').join(',') === 'he,en', 'Native localizations must remain Hebrew and English.');
}

try {
  validate();
  console.log('PRODUCTION_CONFIG_READY: iOS source, resolved config, identity, assets, and QA exclusions passed.');
} catch (error) {
  console.error(`PRODUCTION_CONFIG_BLOCKED: ${error.message}`);
  process.exit(1);
}
