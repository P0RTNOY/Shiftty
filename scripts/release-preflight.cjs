#!/usr/bin/env node
/* global __dirname */

const { existsSync, readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const projectRoot = resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(projectRoot, relativePath), 'utf8'));
}

function sourceAssertion(description, condition) {
  if (!condition) {
    throw new Error(description);
  }
}

function validateReleaseConfiguration() {
  const app = readJson('app.json').expo;
  const eas = readJson('eas.json');

  sourceAssertion('Expo display name must be Shiftty.', app.name === 'Shiftty');
  sourceAssertion('The stable Expo slug must remain shifty.', app.slug === 'shifty');
  sourceAssertion('The stable URL scheme must remain shifty.', app.scheme === 'shifty');
  sourceAssertion(
    'The stable iOS bundle identifier must remain com.omerportnoy.shifty.',
    app.ios?.bundleIdentifier === 'com.omerportnoy.shifty',
  );
  sourceAssertion(
    'The stable Android package must remain com.shifty.app.',
    app.android?.package === 'com.shifty.app',
  );
  sourceAssertion('An Expo EAS project ID is required.', Boolean(app.extra?.eas?.projectId));
  sourceAssertion('The validated EAS CLI version must remain pinned.', eas.cli?.version === '22.4.0');
  sourceAssertion('EAS must use remote app-version management.', eas.cli?.appVersionSource === 'remote');
  sourceAssertion('EAS builds must require a commit.', eas.cli?.requireCommit === true);
  sourceAssertion('A production EAS profile is required.', Boolean(eas.build?.production));
  sourceAssertion(
    'Production builds must use store distribution.',
    eas.build.production.distribution === 'store',
  );
  sourceAssertion(
    'Production build numbers must auto-increment.',
    eas.build.production.autoIncrement === true,
  );
  sourceAssertion(
    'Production Android builds must produce an app bundle.',
    eas.build.production.android?.buildType === 'app-bundle',
  );
  sourceAssertion(
    'The iOS export-compliance declaration must be explicit.',
    app.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false,
  );

  for (const asset of [
    app.icon,
    app.ios?.icon,
    app.android?.adaptiveIcon?.foregroundImage,
    app.web?.favicon,
  ]) {
    sourceAssertion(`Configured asset is missing: ${asset}`, Boolean(asset) && existsSync(resolve(projectRoot, asset)));
  }
}

const sourceChecks = [
  ['TypeScript', 'npm', ['run', 'typecheck']],
  ['ESLint', 'npm', ['run', 'lint']],
  ['Jest', 'npm', ['test', '--', '--runInBand']],
  ['SQLite migrations', 'npm', ['run', 'validate:migrations']],
  ['Expo export', 'npm', ['run', 'validate:expo']],
  ['Expo dependency compatibility', 'npm', ['run', 'validate:expo-dependencies']],
  ['Expo public configuration', 'npx', ['--no-install', 'expo', 'config', '--type', 'public']],
  ['Patch whitespace', 'git', ['diff', '--check']],
];

console.log('Shiftty release preflight');
console.log('===========================');

try {
  validateReleaseConfiguration();
  console.log('PASS  Release configuration and required assets');
} catch (error) {
  console.error(`FAIL  Release configuration: ${error.message}`);
  process.exitCode = 1;
}

if (process.argv.includes('--configuration-only')) {
  if (process.exitCode) {
    console.error('\nSOURCE_BLOCKED: fix the release configuration before continuing.');
  } else {
    console.log('\nSOURCE_READY: release configuration and required assets passed.');
  }
  process.exit(process.exitCode ?? 0);
}

for (const [label, command, args] of sourceChecks) {
  console.log(`\nRUN   ${label}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: { ...process.env, CI: '1' },
    stdio: 'inherit',
  });

  if (result.error || result.status !== 0) {
    console.error(`FAIL  ${label}`);
    process.exitCode = 1;
    break;
  }
  console.log(`PASS  ${label}`);
}

console.log('\nExternal release checks (not source failures)');
console.log('---------------------------------------------');
console.log('- EAS account access and authenticated `eas whoami`.');
console.log('- Apple Developer Program membership, distribution signing, and App Store Connect access.');
console.log('- Google Play Console access and Android upload credentials.');
console.log('- Store listings: privacy/support URLs, age/content declarations, screenshots, and reviewer metadata.');
console.log('- Physical-device coverage and the platform matrix recorded in the native verification report.');
console.log('- Any optional EAS environment variables or remote services introduced after this local-first build.');

if (process.exitCode) {
  console.error('\nSOURCE_BLOCKED: fix the failed source check before starting a store build.');
} else {
  console.log('\nSOURCE_READY: source checks passed; complete the external release checks above.');
}
