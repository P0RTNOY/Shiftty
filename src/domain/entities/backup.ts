import { z } from 'zod';
import { salaryProfileSchema } from './salary-profile';
import { payRuleSchema } from './pay-rule';
import { workplaceSchema, roleSchema } from './workplace';
import { shiftTemplateSchema } from './shift-template';
import { shiftSchema } from './shift';
import { breakSessionSchema } from './break-session';
import { recurrenceSeriesSchema, recurrenceExceptionSchema } from './recurrence';
import { salaryCalculationSnapshotSchema } from './salary-calculation';
import { predictionFeedbackSchema } from './prediction-feedback';
import { scheduledNotificationRecordSchema } from './scheduled-notification';
import { workplaceNotificationOverrideSchema } from './notification-preferences';
import { ExportPresetSchema } from './export-preset';
import { ExportHistorySchema } from './export-history';
import { calendarEvidenceIntervalSchema, weeklyRestScheduleSchema } from './calendar-evidence';

export const AppSettingSchema = z.object({
  key: z.string(),
  valueJson: z.string(),
  updatedAt: z.string().datetime(),
});
export type AppSettingRow = z.infer<typeof AppSettingSchema>;

export const BackupDataSchemaV1 = z.object({
  salaryProfiles: z.array(salaryProfileSchema),
  payRules: z.array(payRuleSchema),
  workplaces: z.array(workplaceSchema),
  roles: z.array(roleSchema),
  shiftTemplates: z.array(shiftTemplateSchema),
  shifts: z.array(shiftSchema),
  breakSessions: z.array(breakSessionSchema),
  recurrenceSeries: z.array(recurrenceSeriesSchema),
  recurrenceExceptions: z.array(recurrenceExceptionSchema),
  salarySnapshots: z.array(salaryCalculationSnapshotSchema),
  predictionFeedback: z.array(predictionFeedbackSchema),
  scheduledNotifications: z.array(scheduledNotificationRecordSchema),
  workplaceNotificationOverrides: z.array(workplaceNotificationOverrideSchema).default([]),
  calendarEvidenceIntervals: z.array(calendarEvidenceIntervalSchema).default([]),
  weeklyRestSchedules: z.array(weeklyRestScheduleSchema).default([]),
  exportPresets: z.array(ExportPresetSchema),
  exportHistory: z.array(ExportHistorySchema),
  appSettings: z.array(AppSettingSchema),
});

export const BackupCountsSchema = z.object({
  salaryProfiles: z.number().int().nonnegative(),
  payRules: z.number().int().nonnegative(),
  workplaces: z.number().int().nonnegative(),
  roles: z.number().int().nonnegative(),
  shiftTemplates: z.number().int().nonnegative(),
  shifts: z.number().int().nonnegative(),
  breakSessions: z.number().int().nonnegative(),
  recurrenceSeries: z.number().int().nonnegative(),
  recurrenceExceptions: z.number().int().nonnegative(),
  salarySnapshots: z.number().int().nonnegative(),
  predictionFeedback: z.number().int().nonnegative(),
  scheduledNotifications: z.number().int().nonnegative(),
  workplaceNotificationOverrides: z.number().int().nonnegative().default(0),
  calendarEvidenceIntervals: z.number().int().nonnegative().default(0),
  weeklyRestSchedules: z.number().int().nonnegative().default(0),
  exportPresets: z.number().int().nonnegative(),
  exportHistory: z.number().int().nonnegative(),
  appSettings: z.number().int().nonnegative(),
});

export const BackupEnvelopeV1Schema = z.object({
  format: z.literal('shiftty_backup'),
  backupVersion: z.literal(1),
  appVersion: z.string(),
  exportedAt: z.string().datetime(),
  timezone: z.string(),
  locale: z.string(),
  counts: BackupCountsSchema,
  data: BackupDataSchemaV1,
});

export type BackupEnvelopeV1 = z.infer<typeof BackupEnvelopeV1Schema>;
export type BackupDataV1 = z.infer<typeof BackupDataSchemaV1>;

export function parseBackupEnvelope(input: unknown): BackupEnvelopeV1 {
  const baseSchema = z.object({
    format: z.literal('shiftty_backup'),
    backupVersion: z.number(),
  });
  const parsedBase = baseSchema.safeParse(input);
  if (!parsedBase.success) {
    throw new Error('Invalid backup file format');
  }
  
  if (parsedBase.data.backupVersion !== 1) {
    throw new Error(`Unsupported backup version: ${parsedBase.data.backupVersion}`);
  }

  return BackupEnvelopeV1Schema.parse(input);
}
