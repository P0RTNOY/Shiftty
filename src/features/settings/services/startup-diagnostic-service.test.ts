import { Platform } from 'react-native';

import { shareFile } from '@/features/exports/adapters/file-share-adapter';
import {
  createStartupDiagnostic,
  shareStartupDiagnostic,
} from '@/features/settings/services/startup-diagnostic-service';

jest.mock('@/features/exports/adapters/file-share-adapter', () => ({ shareFile: jest.fn() }));

describe('startup diagnostic service', () => {
  it('contains only allowlisted app, schema, build, time, and error-name metadata', () => {
    const diagnostic = createStartupDiagnostic(
      'SQLiteError',
      new Date('2026-08-25T12:34:56.000Z'),
    );

    expect(Object.keys(diagnostic)).toEqual([
      'format', 'diagnosticVersion', 'application', 'schema', 'capturedAt', 'error',
    ]);
    expect(Object.keys(diagnostic.application)).toEqual([
      'name', 'version', 'platform', 'nativeBuildVersion',
    ]);
    expect(diagnostic).toMatchObject({
      format: 'shiftty_startup_diagnostic',
      diagnosticVersion: 1,
      application: { platform: Platform.OS },
      schema: { expectedVersion: 9 },
      capturedAt: '2026-08-25T12:34:56.000Z',
      error: { name: 'SQLiteError' },
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(/message|path|"shifts"|salary|workplace|databaseName/i);
  });

  it('does not allow arbitrary text to escape through the error-name field', () => {
    expect(createStartupDiagnostic('/private/user/data.sqlite secret').error)
      .toEqual({ name: 'Error' });
  });

  it('shares the metadata as a JSON file without database access', async () => {
    await shareStartupDiagnostic(
      'Error',
      'Localized diagnostic title',
      new Date('2026-08-25T12:34:56.000Z'),
    );

    expect(shareFile).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'shiftty_startup_diagnostic_2026-08-25T12-34-56-000Z.json',
      mimeType: 'application/json',
      dialogTitle: 'Localized diagnostic title',
      content: expect.stringContaining('"expectedVersion": 9'),
    }));
  });
});
