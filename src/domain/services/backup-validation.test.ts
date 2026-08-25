import type { SQLiteDatabase } from 'expo-sqlite';

import { BackupOrchestrator } from '@/domain/services/backup-orchestrator';

const timestamp = '2026-08-25T00:00:00.000Z';

function makeBackup(overrides: Record<string, unknown> = {}) {
  const data = {
    salaryProfiles: [], payRules: [], workplaces: [], roles: [], shiftTemplates: [], shifts: [],
    breakSessions: [], recurrenceSeries: [], recurrenceExceptions: [], salarySnapshots: [],
    predictionFeedback: [], scheduledNotifications: [], workplaceNotificationOverrides: [],
    calendarEvidenceIntervals: [], weeklyRestSchedules: [], exportPresets: [], exportHistory: [],
    appSettings: [],
    ...overrides,
  } as Record<string, unknown[]>;
  return JSON.stringify({
    format: 'shiftty_backup', backupVersion: 1, appVersion: '0.1.0', exportedAt: timestamp,
    timezone: 'Asia/Jerusalem', locale: 'he-IL',
    counts: Object.fromEntries(Object.entries(data).map(([key, values]) => [key, values.length])),
    data,
  });
}

const workplace = {
  id: 'workplace', name: 'Work', defaultHourlyRateMinor: 0, defaultBreakMinutes: 0,
  defaultTravelReimbursementMinor: 0, defaultShiftBonusMinor: 0, isArchived: false,
  createdAt: timestamp, updatedAt: timestamp,
};

function shift(id: string, status: 'scheduled' | 'active' = 'scheduled') {
  return {
    id, workplaceId: workplace.id,
    ...(status === 'scheduled'
      ? { scheduledStart: timestamp, scheduledEnd: '2026-08-25T01:00:00.000Z' }
      : { actualStart: timestamp, activeOrigin: 'unscheduled' }),
    expectedBreakMinutes: 0, status, hourlyRateSnapshotMinor: 0,
    salaryCalculationStatus: 'not_calculated', timezone: 'Asia/Jerusalem',
    createdAt: timestamp, updatedAt: timestamp,
  };
}

describe('backup recovery validation', () => {
  const orchestrator = new BackupOrchestrator({} as SQLiteDatabase);

  it('rejects a corrupted JSON file without attempting a restore', async () => {
    await expect(orchestrator.validateBackup('{"format":')).resolves.toMatchObject({ valid: false });
  });

  it('rejects orphaned foreign-key data before opening a restore transaction', async () => {
    const content = makeBackup({
      breakSessions: [{
        id: 'orphan-break', shiftId: 'missing-shift', start: timestamp, isPaid: false,
        source: 'manual', createdAt: timestamp, updatedAt: timestamp,
      }],
    });

    await expect(orchestrator.validateBackup(content)).resolves.toMatchObject({
      valid: false,
      errors: expect.arrayContaining(['Break orphan-break references missing shift missing-shift']),
    });
  });

  it('rejects multiple active shifts in a structurally valid backup', async () => {
    const content = makeBackup({ workplaces: [workplace], shifts: [shift('active-a', 'active'), shift('active-b', 'active')] });

    await expect(orchestrator.validateBackup(content)).resolves.toMatchObject({
      valid: false,
      errors: expect.arrayContaining(['Only one active shift allowed, found 2']),
    });
  });

  it('rejects an open break unless it belongs to the one active shift', async () => {
    const content = makeBackup({
      workplaces: [workplace],
      shifts: [shift('scheduled')],
      breakSessions: [{
        id: 'open-break', shiftId: 'scheduled', start: timestamp, isPaid: false,
        source: 'tracked', createdAt: timestamp, updatedAt: timestamp,
      }],
    });

    await expect(orchestrator.validateBackup(content)).resolves.toMatchObject({
      valid: false,
      errors: expect.arrayContaining(['Cannot have an open break without an active shift']),
    });
  });
});
