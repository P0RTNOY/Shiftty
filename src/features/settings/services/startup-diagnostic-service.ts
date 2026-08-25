import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { DATABASE_MIGRATIONS } from '@/data/database/migrations';
import { shareFile } from '@/features/exports/adapters/file-share-adapter';

const latestSchemaVersion = DATABASE_MIGRATIONS.at(-1)?.version ?? 0;

function safeErrorName(value: string): string {
  return /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(value) ? value : 'Error';
}

export function createStartupDiagnostic(errorName: string, capturedAt = new Date()) {
  const platform = Platform.OS;
  const nativeBuildVersion = platform === 'ios'
    ? Constants.expoConfig?.ios?.buildNumber ?? null
    : platform === 'android'
      ? Constants.expoConfig?.android?.versionCode ?? null
      : null;

  return {
    format: 'shiftty_startup_diagnostic',
    diagnosticVersion: 1,
    application: {
      name: Constants.expoConfig?.name ?? 'Shiftty',
      version: Constants.expoConfig?.version ?? 'unknown',
      platform,
      nativeBuildVersion,
    },
    schema: {
      expectedVersion: latestSchemaVersion,
    },
    capturedAt: capturedAt.toISOString(),
    error: {
      name: safeErrorName(errorName),
    },
  } as const;
}

export async function shareStartupDiagnostic(
  errorName: string,
  dialogTitle: string,
  capturedAt = new Date(),
): Promise<void> {
  const diagnostic = createStartupDiagnostic(errorName, capturedAt);
  const timestamp = diagnostic.capturedAt.replace(/[:.]/g, '-');
  await shareFile({
    filename: `shiftty_startup_diagnostic_${timestamp}.json`,
    content: JSON.stringify(diagnostic, null, 2),
    mimeType: 'application/json',
    dialogTitle,
  });
}
