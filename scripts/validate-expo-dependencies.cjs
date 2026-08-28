#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const acceptedPatchNotices = new Map([
  ['@expo/metro-runtime@57.0.13', '~57.0.14'],
  ['expo@57.0.16', '~57.0.18'],
  ['expo-constants@57.0.14', '~57.0.16'],
  ['expo-file-system@57.0.5', '~57.0.6'],
  ['expo-linking@57.0.7', '~57.0.8'],
  ['expo-notifications@57.0.14', '~57.0.15'],
  ['expo-router@57.0.16', '~57.0.17'],
  ['expo-sharing@57.0.15', '~57.0.16'],
  ['expo-sqlite@57.0.1', '~57.0.2'],
  ['react-native@0.86.2', '0.86.3'],
  ['eslint-config-expo@57.0.1', '~57.0.2'],
  ['jest-expo@57.0.4', '~57.0.5'],
]);

const result = spawnSync('npx', ['--no-install', 'expo', 'install', '--check'], {
  encoding: 'utf8',
  env: process.env,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.error) {
  console.error(`Unable to run Expo dependency validation: ${result.error.message}`);
  process.exit(1);
}

if (result.status === 0) {
  process.exit(0);
}

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const observed = new Map();
const noticePattern = /^\s+(\S+@\S+) - expected version: (\S+)\s*$/gm;
let match;

while ((match = noticePattern.exec(output)) !== null) {
  observed.set(match[1], match[2]);
}

const isAcceptedBaseline =
  result.status === 1 &&
  observed.size === acceptedPatchNotices.size &&
  [...acceptedPatchNotices].every(([installed, expected]) => observed.get(installed) === expected);

if (isAcceptedBaseline) {
  console.warn(
    `Accepted Expo SDK 57 patch baseline: ${observed.size} exact compatibility notices; dependencies remain locked.`,
  );
  process.exit(0);
}

console.error('Expo dependency compatibility differs from the reviewed patch baseline.');
process.exit(result.status ?? 1);
