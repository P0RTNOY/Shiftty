#!/usr/bin/env node
/* global __dirname */

const { spawnSync } = require('node:child_process');
const { Buffer } = require('node:buffer');
const { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');

const projectRoot = resolve(__dirname, '..');
const outputDirectory = mkdtempSync(join(tmpdir(), 'shiftty-production-surface-'));

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function fail(message) {
  throw new Error(message);
}

try {
  const config = spawnSync(process.execPath, [resolve(__dirname, 'validate-production-ios-config.cjs')], {
    cwd: projectRoot,
    env: { ...process.env, CI: '1', NODE_ENV: 'production' },
    encoding: 'utf8',
  });
  if (config.stdout) process.stdout.write(config.stdout);
  if (config.stderr) process.stderr.write(config.stderr);
  if (config.error || config.status !== 0) fail('Static production configuration validation failed.');

  const exported = spawnSync(
    'npx',
    ['--no-install', 'expo', 'export', '--platform', 'ios', '--output-dir', outputDirectory, '--clear'],
    { cwd: projectRoot, env: { ...process.env, CI: '1', NODE_ENV: 'production' }, encoding: 'utf8' },
  );
  if (exported.stdout) process.stdout.write(exported.stdout);
  if (exported.stderr) process.stderr.write(exported.stderr);
  if (exported.error || exported.status !== 0) fail('Production-mode iOS export failed.');

  const files = walk(outputDirectory);
  if (files.some((path) => /m7-native-evidence/i.test(path))) fail('Production export contains the M7 evidence route.');
  const bundle = files
    .filter((path) => /\.(?:hbc|js)$/.test(path))
    .sort((a, b) => statSync(b).size - statSync(a).size)[0];
  if (!bundle) fail('Production export did not produce an inspectable JavaScript bundle.');

  const bytes = readFileSync(bundle);
  const forbiddenTokens = [
    'M7 Native Evidence',
    'm7-native-evidence',
    'm7qa-notification-',
    'EXPO_PUBLIC_M7_NATIVE_EVIDENCE',
    'Invalidate native request',
    'Remove QA notification shifts',
    'expo-dev-client',
    'expo-dev-launcher',
    'expo-dev-menu',
    'exp+shifty',
  ];
  const present = forbiddenTokens.filter((token) => bytes.includes(Buffer.from(token)));
  if (present.length > 0) fail(`Production JavaScript contains forbidden token(s): ${present.join(', ')}`);

  console.log('PRODUCTION_SURFACE_READY: native production route graph and JavaScript contain no QA or development-client surface.');
} catch (error) {
  console.error(`PRODUCTION_SURFACE_BLOCKED: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}
