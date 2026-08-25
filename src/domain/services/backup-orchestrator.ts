import { SQLiteDatabase } from 'expo-sqlite';
import { BackupEnvelopeV1, BackupDataV1, parseBackupEnvelope, BackupEnvelopeV1Schema } from '@/domain/entities/backup';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { calendarEvidenceIntervalSchema, weeklyRestScheduleSchema, type WeeklyRestSchedule } from '@/domain/entities/calendar-evidence';
import { resolveWeeklyRestOccurrences } from '@/domain/services/weekly-rest-occurrence-service';
import { payRuleSchema } from '@/domain/entities/pay-rule';
import { salaryCalculationSnapshotSchema } from '@/domain/entities/salary-calculation';
import { collectSpecialRuleAffectedShiftIds, markSalaryStaleMany } from '@/data/repositories/sqlite-salary-repositories';

export interface RestoreResult {
  success: boolean;
  message?: string;
  errors?: string[];
}

export class BackupOrchestrator {
  constructor(private readonly db: SQLiteDatabase) {}

  async generateBackup(): Promise<BackupEnvelopeV1> {
    const data: BackupDataV1 = {
      salaryProfiles: await this.fetchAll('salary_profiles', this.mapSalaryProfile),
      payRules: await this.fetchAll('pay_rules', this.mapPayRule),
      workplaces: await this.fetchAll('workplaces', this.mapWorkplace),
      roles: await this.fetchAll('roles', this.mapRole),
      shiftTemplates: await this.fetchAll('shift_templates', this.mapShiftTemplate),
      shifts: await this.fetchAll('shifts', this.mapShift),
      breakSessions: await this.fetchAll('break_sessions', this.mapBreakSession),
      recurrenceSeries: await this.fetchAll('recurrence_series', this.mapRecurrenceSeries),
      recurrenceExceptions: await this.fetchAll('recurrence_exceptions', this.mapRecurrenceException),
      salarySnapshots: await this.fetchAll('salary_calculation_snapshots', this.mapSalarySnapshot),
      predictionFeedback: await this.fetchAll('prediction_feedback', this.mapPredictionFeedback),
      scheduledNotifications: await this.fetchAll('scheduled_notification_records', this.mapScheduledNotification),
      workplaceNotificationOverrides: await this.fetchAll('workplace_notification_overrides', this.mapWorkplaceNotificationOverride),
      calendarEvidenceIntervals: await this.fetchAll('calendar_evidence_intervals', this.mapCalendarEvidenceInterval),
      weeklyRestSchedules: await this.fetchAll('weekly_rest_schedules', this.mapWeeklyRestSchedule),
      exportPresets: await this.fetchAll('export_presets', this.mapExportPreset),
      exportHistory: await this.fetchAll('export_history', this.mapExportHistory),
      appSettings: await this.fetchAll('app_settings', this.mapAppSetting),
    };

    const envelope: BackupEnvelopeV1 = {
      format: 'shiftty_backup',
      backupVersion: 1,
      appVersion: Constants.expoConfig?.version || '0.1.0',
      exportedAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem',
      locale: 'he-IL',
      counts: {
        salaryProfiles: data.salaryProfiles.length,
        payRules: data.payRules.length,
        workplaces: data.workplaces.length,
        roles: data.roles.length,
        shiftTemplates: data.shiftTemplates.length,
        shifts: data.shifts.length,
        breakSessions: data.breakSessions.length,
        recurrenceSeries: data.recurrenceSeries.length,
        recurrenceExceptions: data.recurrenceExceptions.length,
        salarySnapshots: data.salarySnapshots.length,
        predictionFeedback: data.predictionFeedback.length,
        scheduledNotifications: data.scheduledNotifications.length,
        workplaceNotificationOverrides: data.workplaceNotificationOverrides.length,
        calendarEvidenceIntervals: data.calendarEvidenceIntervals.length,
        weeklyRestSchedules: data.weeklyRestSchedules.length,
        exportPresets: data.exportPresets.length,
        exportHistory: data.exportHistory.length,
        appSettings: data.appSettings.length,
      },
      data,
    };

    return BackupEnvelopeV1Schema.parse(envelope);
  }

  async validateBackup(jsonString: string): Promise<{ valid: boolean; envelope?: BackupEnvelopeV1; errors?: string[] }> {
    try {
      const parsed = JSON.parse(jsonString);
      const envelope = parseBackupEnvelope(parsed);
      
      const errors = this.validateRelationalIntegrity(envelope.data, envelope.counts);
      if (errors.length > 0) {
        return { valid: false, errors };
      }
      return { valid: true, envelope };
    } catch (e: any) {
      return { valid: false, errors: [e.message] };
    }
  }

  private validateRelationalIntegrity(data: BackupDataV1, counts: BackupEnvelopeV1['counts']): string[] {
    const errors: string[] = [];
    const actualCounts: BackupEnvelopeV1['counts'] = {
      salaryProfiles: data.salaryProfiles.length,
      payRules: data.payRules.length,
      workplaces: data.workplaces.length,
      roles: data.roles.length,
      shiftTemplates: data.shiftTemplates.length,
      shifts: data.shifts.length,
      breakSessions: data.breakSessions.length,
      recurrenceSeries: data.recurrenceSeries.length,
      recurrenceExceptions: data.recurrenceExceptions.length,
      salarySnapshots: data.salarySnapshots.length,
      predictionFeedback: data.predictionFeedback.length,
      scheduledNotifications: data.scheduledNotifications.length,
      workplaceNotificationOverrides: data.workplaceNotificationOverrides.length,
      calendarEvidenceIntervals: data.calendarEvidenceIntervals.length,
      weeklyRestSchedules: data.weeklyRestSchedules.length,
      exportPresets: data.exportPresets.length,
      exportHistory: data.exportHistory.length,
      appSettings: data.appSettings.length,
    };
    for (const [key, actual] of Object.entries(actualCounts)) {
      if (counts[key as keyof typeof counts] !== actual) errors.push(`Backup count mismatch for ${key}`);
    }
    const wpIds = new Set(data.workplaces.map(w => w.id));
    const roleIds = new Set(data.roles.map(r => r.id));
    const shiftIds = new Set(data.shifts.map(s => s.id));
    const profileIds = new Set(data.salaryProfiles.map((profile) => profile.id));
    const roleWorkplaces = new Map(data.roles.map((role) => [role.id, role.workplaceId]));
    const profileWorkplaces = new Map(data.salaryProfiles.map((profile) => [profile.id, profile.workplaceId]));
    const templateIds = new Set(data.shiftTemplates.map((template) => template.id));
    const seriesIds = new Set(data.recurrenceSeries.map((series) => series.id));
    const breakIds = new Set(data.breakSessions.map((session) => session.id));
    const evidenceIds = new Set(data.calendarEvidenceIntervals.map((interval) => interval.id));
    const scheduleIds = new Set(data.weeklyRestSchedules.map((schedule) => schedule.id));
    const schedulesById = new Map(data.weeklyRestSchedules.map((schedule) => [schedule.id, schedule]));

    // Validations: Unique IDs
    if (wpIds.size !== data.workplaces.length) errors.push('Duplicate workplace IDs found');
    if (roleIds.size !== data.roles.length) errors.push('Duplicate role IDs found');
    if (shiftIds.size !== data.shifts.length) errors.push('Duplicate shift IDs found');
    if (profileIds.size !== data.salaryProfiles.length) errors.push('Duplicate salary profile IDs found');
    if (templateIds.size !== data.shiftTemplates.length) errors.push('Duplicate shift template IDs found');
    if (seriesIds.size !== data.recurrenceSeries.length) errors.push('Duplicate recurrence series IDs found');
    if (breakIds.size !== data.breakSessions.length) errors.push('Duplicate break session IDs found');
    if (evidenceIds.size !== data.calendarEvidenceIntervals.length) errors.push('Duplicate evidence interval IDs found');
    if (scheduleIds.size !== data.weeklyRestSchedules.length) errors.push('Duplicate weekly-rest schedule IDs found');
    if (new Set(data.weeklyRestSchedules.map((schedule) => schedule.salaryProfileId)).size !== data.weeklyRestSchedules.length) errors.push('Multiple weekly-rest schedules reference the same salary profile');
    if (new Set(data.scheduledNotifications.map((item) => item.logicalKey)).size !== data.scheduledNotifications.length) errors.push('Duplicate scheduled notification keys found');
    if (new Set(data.appSettings.map((item) => item.key)).size !== data.appSettings.length) errors.push('Duplicate app setting keys found');

    // FK Checks
    for (const r of data.roles) {
      if (!wpIds.has(r.workplaceId)) errors.push(`Role ${r.id} references missing workplace ${r.workplaceId}`);
    }
    for (const s of data.shifts) {
      if (!wpIds.has(s.workplaceId)) errors.push(`Shift ${s.id} references missing workplace ${s.workplaceId}`);
      if (s.roleId && !roleIds.has(s.roleId)) errors.push(`Shift ${s.id} references missing role ${s.roleId}`);
      if (s.roleId && roleWorkplaces.get(s.roleId) !== s.workplaceId) errors.push(`Shift ${s.id} references a role from another workplace`);
      if (s.salaryProfileId && !profileIds.has(s.salaryProfileId)) errors.push(`Shift ${s.id} references missing salary profile ${s.salaryProfileId}`);
      if (s.salaryProfileId && profileWorkplaces.get(s.salaryProfileId) && profileWorkplaces.get(s.salaryProfileId) !== s.workplaceId) errors.push(`Shift ${s.id} references a salary profile from another workplace`);
      if (s.shiftTemplateId && !templateIds.has(s.shiftTemplateId)) errors.push(`Shift ${s.id} references missing template ${s.shiftTemplateId}`);
      if (s.recurrenceGroupId && !seriesIds.has(s.recurrenceGroupId)) errors.push(`Shift ${s.id} references missing recurrence series ${s.recurrenceGroupId}`);
    }
    for (const workplace of data.workplaces) {
      if (workplace.salaryProfileId && !profileIds.has(workplace.salaryProfileId)) errors.push(`Workplace ${workplace.id} references missing salary profile ${workplace.salaryProfileId}`);
    }
    for (const profile of data.salaryProfiles) {
      if (profile.workplaceId && !wpIds.has(profile.workplaceId)) errors.push(`Salary profile ${profile.id} references missing workplace ${profile.workplaceId}`);
    }
    for (const rule of data.payRules) {
      if (!profileIds.has(rule.salaryProfileId)) errors.push(`Pay rule ${rule.id} references missing salary profile ${rule.salaryProfileId}`);
    }
    for (const template of data.shiftTemplates) {
      if (template.workplaceId && !wpIds.has(template.workplaceId)) errors.push(`Shift template ${template.id} references missing workplace ${template.workplaceId}`);
      if (template.roleId && !roleIds.has(template.roleId)) errors.push(`Shift template ${template.id} references missing role ${template.roleId}`);
      if (template.roleId && template.workplaceId && roleWorkplaces.get(template.roleId) !== template.workplaceId) errors.push(`Shift template ${template.id} references a role from another workplace`);
      if (template.salaryProfileId && !profileIds.has(template.salaryProfileId)) errors.push(`Shift template ${template.id} references missing salary profile ${template.salaryProfileId}`);
      if (template.salaryProfileId && template.workplaceId && profileWorkplaces.get(template.salaryProfileId) && profileWorkplaces.get(template.salaryProfileId) !== template.workplaceId) errors.push(`Shift template ${template.id} references a salary profile from another workplace`);
    }
    for (const series of data.recurrenceSeries) {
      if (!wpIds.has(series.template.workplaceId)) errors.push(`Recurrence series ${series.id} references missing workplace ${series.template.workplaceId}`);
      if (series.template.roleId && !roleIds.has(series.template.roleId)) errors.push(`Recurrence series ${series.id} references missing role ${series.template.roleId}`);
      if (series.template.roleId && roleWorkplaces.get(series.template.roleId) !== series.template.workplaceId) errors.push(`Recurrence series ${series.id} references a role from another workplace`);
      if (series.template.shiftTemplateId && !templateIds.has(series.template.shiftTemplateId)) errors.push(`Recurrence series ${series.id} references missing template ${series.template.shiftTemplateId}`);
    }
    for (const b of data.breakSessions) {
      if (!shiftIds.has(b.shiftId)) errors.push(`Break ${b.id} references missing shift ${b.shiftId}`);
    }
    for (const exception of data.recurrenceExceptions) {
      if (!seriesIds.has(exception.seriesId)) errors.push(`Recurrence exception ${exception.id} references missing series ${exception.seriesId}`);
      if (exception.shiftId && !shiftIds.has(exception.shiftId)) errors.push(`Recurrence exception ${exception.id} references missing shift ${exception.shiftId}`);
    }
    for (const snapshot of data.salarySnapshots) {
      if (!shiftIds.has(snapshot.shiftId)) errors.push(`Salary snapshot ${snapshot.id} references missing shift ${snapshot.shiftId}`);
      if (snapshot.salaryProfileId && !profileIds.has(snapshot.salaryProfileId)) errors.push(`Salary snapshot ${snapshot.id} references missing salary profile ${snapshot.salaryProfileId}`);
    }
    for (const notification of data.scheduledNotifications) {
      if (notification.shiftId && !shiftIds.has(notification.shiftId)) errors.push(`Scheduled notification ${notification.logicalKey} references missing shift ${notification.shiftId}`);
      if (notification.breakSessionId && !breakIds.has(notification.breakSessionId)) errors.push(`Scheduled notification ${notification.logicalKey} references missing break ${notification.breakSessionId}`);
      if (notification.workplaceId && !wpIds.has(notification.workplaceId)) errors.push(`Scheduled notification ${notification.logicalKey} references missing workplace ${notification.workplaceId}`);
    }
    for (const override of data.workplaceNotificationOverrides) {
      if (!wpIds.has(override.workplaceId)) errors.push(`Notification override references missing workplace ${override.workplaceId}`);
    }
    for (const interval of data.calendarEvidenceIntervals) {
      if (!wpIds.has(interval.workplaceId)) errors.push(`Evidence interval ${interval.id} references missing workplace ${interval.workplaceId}`);
      if (interval.salaryProfileId && !profileIds.has(interval.salaryProfileId)) errors.push(`Evidence interval ${interval.id} references missing salary profile ${interval.salaryProfileId}`);
      if (interval.salaryProfileId && profileWorkplaces.get(interval.salaryProfileId) !== interval.workplaceId) errors.push(`Evidence interval ${interval.id} references a salary profile from another workplace`);
      if (interval.scheduleId && !scheduleIds.has(interval.scheduleId)) errors.push(`Evidence interval ${interval.id} references missing weekly-rest schedule ${interval.scheduleId}`);
      const linkedSchedule = interval.scheduleId ? schedulesById.get(interval.scheduleId) : undefined;
      if (linkedSchedule && linkedSchedule.workplaceId !== interval.workplaceId) errors.push(`Evidence interval ${interval.id} references a weekly-rest schedule from another workplace`);
      if (linkedSchedule && linkedSchedule.salaryProfileId !== interval.salaryProfileId) errors.push(`Evidence interval ${interval.id} references a weekly-rest schedule from another salary profile`);
    }
    for (const schedule of data.weeklyRestSchedules) {
      if (!wpIds.has(schedule.workplaceId)) errors.push(`Weekly-rest schedule ${schedule.id} references missing workplace ${schedule.workplaceId}`);
      if (!profileIds.has(schedule.salaryProfileId)) errors.push(`Weekly-rest schedule ${schedule.id} references missing salary profile ${schedule.salaryProfileId}`);
      if (profileWorkplaces.get(schedule.salaryProfileId) !== schedule.workplaceId) errors.push(`Weekly-rest schedule ${schedule.id} references a salary profile from another workplace`);
    }

    // Active shift rules
    const activeShifts = data.shifts.filter(s => s.status === 'active');
    if (activeShifts.length > 1) {
      errors.push(`Only one active shift allowed, found ${activeShifts.length}`);
    }

    const openBreaks = data.breakSessions.filter(b => !b.end);
    if (openBreaks.length > 1) {
      errors.push(`Only one open break allowed, found ${openBreaks.length}`);
    }

    if (openBreaks.length === 1 && activeShifts.length === 1) {
      if (openBreaks[0]?.shiftId !== activeShifts[0]?.id) {
        errors.push('Open break must belong to the active shift');
      }
    } else if (openBreaks.length === 1 && activeShifts.length === 0) {
      errors.push('Cannot have an open break without an active shift');
    }

    for (const b of data.breakSessions) {
      const shift = data.shifts.find(s => s.id === b.shiftId);
      if (shift && (shift.status === 'cancelled' || shift.status === 'missed') && !b.end) {
        errors.push(`Cancelled/missed shift ${shift.id} cannot have an open break`);
      }
    }

    return errors;
  }

  async restoreReplace(jsonString: string): Promise<RestoreResult> {
    const validation = await this.validateBackup(jsonString);
    if (!validation.valid || !validation.envelope) {
      return { success: false, message: 'Invalid backup format', errors: validation.errors };
    }

    const { data } = validation.envelope;

    try {
      await this.db.withTransactionAsync(async () => {
        // Clear all tables (order matters for cascading deletes if foreign_keys are ON, but we'll defer them anyway to be safe)
        await this.db.runAsync('PRAGMA defer_foreign_keys = ON');

        await this.db.runAsync('DELETE FROM prediction_feedback');
        await this.db.runAsync('DELETE FROM salary_calculation_snapshots');
        await this.db.runAsync('DELETE FROM scheduled_notification_records');
        await this.db.runAsync('DELETE FROM workplace_notification_overrides');
        await this.db.runAsync('DELETE FROM break_sessions');
        await this.db.runAsync('DELETE FROM recurrence_exceptions');
        await this.db.runAsync('DELETE FROM shifts');
        await this.db.runAsync('DELETE FROM recurrence_series');
        await this.db.runAsync('DELETE FROM shift_templates');
        await this.db.runAsync('DELETE FROM roles');
        await this.db.runAsync('DELETE FROM calendar_evidence_intervals');
        await this.db.runAsync('DELETE FROM weekly_rest_schedules');
        // Due to circular FKs, we must clear workplaces' salary_profile_id first
        await this.db.runAsync('UPDATE workplaces SET salary_profile_id = NULL');
        await this.db.runAsync('DELETE FROM pay_rules');
        await this.db.runAsync('DELETE FROM salary_profiles');
        await this.db.runAsync('DELETE FROM workplaces');
        await this.db.runAsync('DELETE FROM export_history');
        await this.db.runAsync('DELETE FROM export_presets');
        await this.db.runAsync('DELETE FROM app_settings');

        // Insert in dependency order
        for (const item of data.appSettings) {
          await this.db.runAsync('INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)', [item.key, item.valueJson, item.updatedAt]);
        }
        for (const item of data.exportPresets) {
          await this.db.runAsync('INSERT INTO export_presets (id, name, format, config_json, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [item.id, item.name, item.format, JSON.stringify(item.config), item.isArchived ? 1 : 0, item.createdAt, item.updatedAt]);
        }
        for (const item of data.exportHistory) {
          await this.db.runAsync('INSERT INTO export_history (id, format, preset_id, reporting_period, workplace_filter, generated_at, sanitized_filename, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [item.id, item.format, item.presetId || null, item.reportingPeriod || null, item.workplaceFilter || null, item.generatedAt, item.sanitizedFilename || null, item.status, item.createdAt]);
        }
        for (const w of data.workplaces) {
          await this.db.runAsync('INSERT INTO workplaces (id, name, address, default_hourly_rate_minor, default_break_minutes, salary_profile_id, color, default_travel_reimbursement_minor, default_shift_bonus_minor, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [w.id, w.name, w.address || null, w.defaultHourlyRateMinor ?? null, w.defaultBreakMinutes ?? 0, null, w.color || null, w.defaultTravelReimbursementMinor ?? 0, w.defaultShiftBonusMinor ?? 0, w.isArchived ? 1 : 0, w.createdAt, w.updatedAt]);
        }
        for (const sp of data.salaryProfiles) {
          await this.db.runAsync('INSERT INTO salary_profiles (id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy, timezone, default_travel_reimbursement_minor, default_shift_bonus_minor, calculation_rounding_mode, workweek_start_weekday, weekly_overtime_enabled, weekly_regular_minutes, weekly_overtime_multiplier_basis_points, weekly_overtime_basis, effective_from, effective_to, is_active, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [sp.id, sp.workplaceId || null, sp.name, sp.currency, sp.baseHourlyRateMinor ?? null, sp.breakPolicy, sp.timezone, sp.defaultTravelReimbursementMinor ?? 0, sp.defaultShiftBonusMinor ?? 0, sp.calculationRoundingMode, sp.workweekStartWeekday, sp.weeklyOvertimeEnabled ? 1 : 0, sp.weeklyRegularMinutes ?? null, sp.weeklyOvertimeMultiplierBasisPoints ?? null, sp.weeklyOvertimeBasis, sp.effectiveFrom ?? null, sp.effectiveTo ?? null, sp.isActive ? 1 : 0, sp.isArchived ? 1 : 0, sp.createdAt, sp.updatedAt]);
        }
        for (const r of data.payRules) {
          await this.db.runAsync('INSERT INTO pay_rules (id, salary_profile_id, name, priority, conditions_json, effect_json, can_stack, premium_family, is_enabled, effective_from, effective_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [r.id, r.salaryProfileId, r.name, r.priority, JSON.stringify(r.conditions), JSON.stringify(r.effect), r.canStack ? 1 : 0, r.premiumFamily ?? null, r.isEnabled ? 1 : 0, r.effectiveFrom || null, r.effectiveTo || null, r.createdAt, r.updatedAt]);
        }
        for (const schedule of data.weeklyRestSchedules) {
          await this.insertWeeklyRestSchedule(schedule, schedule.id, schedule.workplaceId, schedule.salaryProfileId);
        }
        for (const interval of data.calendarEvidenceIntervals) {
          await this.insertCalendarEvidenceInterval(interval, interval.id, interval.workplaceId, interval.salaryProfileId ?? null);
        }
        for (const w of data.workplaces) {
          if (w.salaryProfileId) {
            await this.db.runAsync('UPDATE workplaces SET salary_profile_id = ? WHERE id = ?', [w.salaryProfileId, w.id]);
          }
        }
        for (const r of data.roles) {
          await this.db.runAsync('INSERT INTO roles (id, workplace_id, name, hourly_rate_minor, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [r.id, r.workplaceId, r.name, r.hourlyRateMinor ?? null, r.isArchived ? 1 : 0, r.createdAt, r.updatedAt]);
        }
        for (const t of data.shiftTemplates) {
          await this.db.runAsync('INSERT INTO shift_templates (id, name, default_start_time, default_end_time, pay_multiplier_basis_points, expected_break_minutes, expected_break_type, workplace_id, role_id, salary_profile_id, valid_weekdays, color_token, is_archived, expected_duration_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [t.id, t.name, t.defaultStartTime, t.defaultEndTime, t.payMultiplierBasisPoints ?? 10_000, t.expectedBreakMinutes, t.expectedBreakType ?? null, t.workplaceId ?? null, t.roleId ?? null, t.salaryProfileId ?? null, t.validWeekdays ? JSON.stringify(t.validWeekdays) : null, t.colorToken ?? null, t.isArchived ? 1 : 0, t.expectedDurationMinutes ?? null, t.createdAt, t.updatedAt]);
        }
        for (const rs of data.recurrenceSeries) {
          await this.db.runAsync('INSERT INTO recurrence_series (id, rule_json, template_json, disabled_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [rs.id, JSON.stringify(rs.rule), JSON.stringify(rs.template), rs.disabledFrom || null, rs.createdAt, rs.updatedAt]);
        }
        for (const s of data.shifts) {
          await this.db.runAsync('INSERT INTO shifts (id, workplace_id, role_id, salary_profile_id, title, notes, scheduled_start, scheduled_end, actual_start, actual_end, payable_start, payable_end, expected_break_minutes, actual_break_minutes, payable_break_minutes, status, hourly_rate_snapshot_minor, expected_gross_pay_minor, actual_gross_pay_minor, payable_gross_pay_minor, shift_template_id, shift_type_name_snapshot, shift_type_pay_multiplier_basis_points, recurrence_group_id, recurrence_original_start, recurrence_exception_type, cancelled_at, expected_end, active_origin, payable_source, completed_at, timezone, hourly_rate_override_minor, fixed_bonus_override_minor, travel_reimbursement_override_minor, salary_calculation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            s.id, s.workplaceId, s.roleId ?? null, s.salaryProfileId ?? null, s.title ?? null, s.notes ?? null, s.scheduledStart ?? null, s.scheduledEnd ?? null, s.actualStart ?? null, s.actualEnd ?? null, s.payableStart ?? null, s.payableEnd ?? null, s.expectedBreakMinutes, s.actualBreakMinutes ?? null, s.payableBreakMinutes ?? null, s.status, s.hourlyRateSnapshotMinor, s.expectedGrossPayMinor ?? null, s.actualGrossPayMinor ?? null, s.payableGrossPayMinor ?? null, s.shiftTemplateId ?? null, s.shiftTypeNameSnapshot ?? null, s.shiftTypePayMultiplierBasisPoints ?? 10_000, s.recurrenceGroupId ?? null, s.recurrenceOriginalStart ?? null, s.recurrenceExceptionType ?? null, s.cancelledAt ?? null, s.expectedEnd ?? null, s.activeOrigin ?? null, s.payableSource ?? null, s.completedAt ?? null, s.timezone, s.hourlyRateOverrideMinor ?? null, s.fixedBonusOverrideMinor ?? null, s.travelReimbursementOverrideMinor ?? null, s.salaryCalculationStatus, s.createdAt, s.updatedAt
          ]);
        }
        for (const re of data.recurrenceExceptions) {
          await this.db.runAsync('INSERT INTO recurrence_exceptions (id, series_id, local_date, type, shift_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', [re.id, re.seriesId, re.localDate, re.type, re.shiftId || null, re.createdAt]);
        }
        for (const b of data.breakSessions) {
          await this.db.runAsync('INSERT INTO break_sessions (id, shift_id, start_at, end_at, is_paid, source, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [b.id, b.shiftId, b.start, b.end ?? null, b.isPaid ? 1 : 0, b.source, b.notes ?? null, b.createdAt, b.updatedAt]);
        }
        for (const ss of data.salarySnapshots) {
          await this.db.runAsync('INSERT INTO salary_calculation_snapshots (id, shift_id, version, status, context, salary_profile_id, resolved_rate_minor, payable_minutes, regular_minutes, special_rate_minutes, base_pay_minor, premium_pay_minor, fixed_bonuses_minor, reimbursements_minor, total_gross_pay_minor, result_json, engine_version, calculated_at, is_current, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [ss.id, ss.shiftId, ss.version, ss.status, ss.result.context, ss.salaryProfileId ?? null, ss.result.resolvedBaseHourlyRateMinor ?? null, ss.result.payableMinutes, ss.result.regularMinutes, ss.result.specialRateMinutes, ss.result.basePayMinor, ss.result.premiumPayMinor, ss.result.fixedBonusesMinor, ss.result.reimbursementsMinor, ss.result.totalGrossPayMinor ?? null, JSON.stringify(ss.result), ss.result.engineVersion, ss.result.calculatedAt, ss.isCurrent ? 1 : 0, ss.createdAt]);
        }
        // Current-snapshot insertion deliberately runs salary dependency triggers.
        // Replace restore must nevertheless reproduce the backup exactly and be
        // independent of payload order, so reinstate each backed-up shift status
        // after all snapshot relationships have been reconstructed.
        for (const s of data.shifts) {
          await this.db.runAsync('UPDATE shifts SET salary_calculation_status = ? WHERE id = ?', [s.salaryCalculationStatus, s.id]);
        }
        for (const pf of data.predictionFeedback) {
          await this.db.runAsync('INSERT INTO prediction_feedback (id, feedback_type, engine_version, candidate_source, candidate_source_id, score, accepted_fields_json, rejected_fields_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [pf.id, pf.feedbackType, pf.engineVersion, pf.candidateSource, pf.candidateSourceId, pf.score, JSON.stringify(pf.acceptedFields), JSON.stringify(pf.rejectedFields), pf.createdAt]);
        }
        for (const sn of data.scheduledNotifications) {
          // Native ID is intentionally stripped on restore.
          await this.db.runAsync('INSERT INTO scheduled_notification_records (logical_key, type, scheduled_for, shift_id, break_session_id, workplace_id, title_key, body_key, body_params_json, native_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [sn.logicalKey, sn.type, sn.scheduledFor, sn.shiftId || null, sn.breakSessionId || null, sn.workplaceId || null, sn.titleKey, sn.bodyKey, sn.bodyParams ? JSON.stringify(sn.bodyParams) : null, null, sn.createdAt, sn.updatedAt]);
        }
        for (const override of data.workplaceNotificationOverrides) {
          await this.insertWorkplaceNotificationOverride(override, override.workplaceId);
        }

        await this.assertDatabaseIntegrity();
        await this.assertReplaceCounts(data);
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  async restoreMerge(jsonString: string): Promise<RestoreResult> {
    const validation = await this.validateBackup(jsonString);
    if (!validation.valid || !validation.envelope) {
      return { success: false, message: 'Invalid backup format', errors: validation.errors };
    }
    const { data } = validation.envelope;

    const importedActive = data.shifts.find((shift) => shift.status === 'active');
    if (importedActive) {
      const localActive = await this.db.getFirstAsync<{ id: string; created_at: string; updated_at: string }>(
        "SELECT id, created_at, updated_at FROM shifts WHERE status = 'active' LIMIT 1",
      );
      const samePersistedShift = localActive?.id === importedActive.id
        && localActive.created_at === importedActive.createdAt
        && localActive.updated_at === importedActive.updatedAt;
      if (localActive && !samePersistedShift) {
        return { success: false, message: 'Active shift conflict' };
      }
    }

    try {
      await this.db.withTransactionAsync(async () => {
        await this.db.runAsync('PRAGMA defer_foreign_keys = ON');

        const idMap = new Map<string, string>();
        const payRuleIdMap = new Map<string, string>();
        const evidenceIdMap = new Map<string, string>();
        const scheduleIdMap = new Map<string, string>();
        const insertedWorkplaceIds = new Set<string>();
        
        const remapId = async (table: string, oldId: string, fieldsToCheck: any, registerGlobal = true): Promise<{id: string, isNew: boolean, skip: boolean}> => {
          const existing = await this.db.getFirstAsync<any>(`SELECT * FROM ${table} WHERE id = ?`, [oldId]);
          if (!existing) {
            return { id: oldId, isNew: true, skip: false }; // Insert with original ID
          }
          if (existing.updated_at === fieldsToCheck.updatedAt && existing.created_at === fieldsToCheck.createdAt) {
            return { id: oldId, isNew: false, skip: true };
          }
          const newId = Crypto.randomUUID();
          if (registerGlobal) idMap.set(oldId, newId);
          return { id: newId, isNew: true, skip: false };
        };

        const getMappedId = (oldId?: string | null) => oldId ? (idMap.get(oldId) || oldId) : null;

        for (const item of data.exportPresets) {
          const { id, skip } = await remapId('export_presets', item.id, item);
          if (!skip) await this.db.runAsync('INSERT INTO export_presets (id, name, format, config_json, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, item.name, item.format, JSON.stringify(item.config), item.isArchived ? 1 : 0, item.createdAt, item.updatedAt]);
        }
        for (const item of data.exportHistory) {
          const { id, skip } = await remapId('export_history', item.id, item);
          if (!skip) await this.db.runAsync('INSERT INTO export_history (id, format, preset_id, reporting_period, workplace_filter, generated_at, sanitized_filename, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, item.format, getMappedId(item.presetId), item.reportingPeriod || null, item.workplaceFilter || null, item.generatedAt, item.sanitizedFilename || null, item.status, item.createdAt]);
        }
        for (const w of data.workplaces) {
          const { id, skip } = await remapId('workplaces', w.id, w);
          if (!skip) {
            await this.db.runAsync('INSERT INTO workplaces (id, name, address, default_hourly_rate_minor, default_break_minutes, salary_profile_id, color, default_travel_reimbursement_minor, default_shift_bonus_minor, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, w.name, w.address ?? null, w.defaultHourlyRateMinor ?? null, w.defaultBreakMinutes ?? 0, null, w.color ?? null, w.defaultTravelReimbursementMinor ?? 0, w.defaultShiftBonusMinor ?? 0, w.isArchived ? 1 : 0, w.createdAt, w.updatedAt]);
            insertedWorkplaceIds.add(id);
          }
        }
        for (const sp of data.salaryProfiles) {
          const { id, skip } = await remapId('salary_profiles', sp.id, sp);
          if (!skip) await this.db.runAsync('INSERT INTO salary_profiles (id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy, timezone, default_travel_reimbursement_minor, default_shift_bonus_minor, calculation_rounding_mode, workweek_start_weekday, weekly_overtime_enabled, weekly_regular_minutes, weekly_overtime_multiplier_basis_points, weekly_overtime_basis, effective_from, effective_to, is_active, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, getMappedId(sp.workplaceId), sp.name, sp.currency, sp.baseHourlyRateMinor ?? null, sp.breakPolicy, sp.timezone, sp.defaultTravelReimbursementMinor ?? 0, sp.defaultShiftBonusMinor ?? 0, sp.calculationRoundingMode, sp.workweekStartWeekday, sp.weeklyOvertimeEnabled ? 1 : 0, sp.weeklyRegularMinutes ?? null, sp.weeklyOvertimeMultiplierBasisPoints ?? null, sp.weeklyOvertimeBasis, sp.effectiveFrom ?? null, sp.effectiveTo ?? null, sp.isActive ? 1 : 0, sp.isArchived ? 1 : 0, sp.createdAt, sp.updatedAt]);
        }
        for (const r of data.payRules) {
          let { id, skip } = await remapId('pay_rules', r.id, r, false);
          let mappedRule = payRuleSchema.parse({
            ...r,
            id,
            salaryProfileId: getMappedId(r.salaryProfileId),
          });
          if (skip) {
            const existing = await this.db.getFirstAsync<any>('SELECT * FROM pay_rules WHERE id = ?;', r.id);
            const existingRule = existing
              ? payRuleSchema.parse(this.stripNulls(this.mapPayRule(existing)))
              : null;
            if (!existingRule || JSON.stringify(existingRule) !== JSON.stringify(mappedRule)) {
              id = Crypto.randomUUID();
              skip = false;
              mappedRule = payRuleSchema.parse({ ...mappedRule, id });
            }
          }
          if (id !== r.id) payRuleIdMap.set(r.id, id);
          if (!skip) {
            const staleIds = await collectSpecialRuleAffectedShiftIds(this.db, null, mappedRule);
            await this.db.runAsync('INSERT INTO pay_rules (id, salary_profile_id, name, priority, conditions_json, effect_json, can_stack, premium_family, is_enabled, effective_from, effective_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, mappedRule.salaryProfileId, r.name, r.priority, JSON.stringify(r.conditions), JSON.stringify(r.effect), r.canStack ? 1 : 0, r.premiumFamily ?? null, r.isEnabled ? 1 : 0, r.effectiveFrom || null, r.effectiveTo || null, r.createdAt, r.updatedAt]);
            await markSalaryStaleMany(this.db, staleIds);
          }
        }
        for (const schedule of data.weeklyRestSchedules) {
          let { id, skip } = await remapId('weekly_rest_schedules', schedule.id, schedule, false);
          const mappedSchedule = weeklyRestScheduleSchema.parse({
            ...schedule,
            id,
            workplaceId: getMappedId(schedule.workplaceId),
            salaryProfileId: getMappedId(schedule.salaryProfileId),
          });
          if (skip) {
            const existing = await this.db.getFirstAsync<any>(
              'SELECT * FROM weekly_rest_schedules WHERE id = ?;',
              schedule.id,
            );
            const existingSchedule = existing
              ? weeklyRestScheduleSchema.parse(this.stripNulls(this.mapWeeklyRestSchedule(existing)))
              : null;
            if (!existingSchedule || JSON.stringify(existingSchedule) !== JSON.stringify(mappedSchedule)) {
              id = Crypto.randomUUID();
              skip = false;
            }
          }
          if (id !== schedule.id) scheduleIdMap.set(schedule.id, id);
          const mappedWorkplaceId = getMappedId(schedule.workplaceId)!;
          const mappedProfileId = getMappedId(schedule.salaryProfileId)!;
          const profileConflict = await this.db.getFirstAsync<{ id: string }>(
            'SELECT id FROM weekly_rest_schedules WHERE salary_profile_id = ? AND id != ?;',
            mappedProfileId,
            id,
          );
          if (profileConflict) throw new Error(`Weekly-rest schedule conflict for salary profile ${mappedProfileId}`);
          if (!skip) await this.insertWeeklyRestSchedule(schedule, id, mappedWorkplaceId, mappedProfileId);
        }
        for (const interval of data.calendarEvidenceIntervals) {
          let { id, skip } = await remapId('calendar_evidence_intervals', interval.id, interval, false);
          const mappedInterval = calendarEvidenceIntervalSchema.parse({
            ...interval,
            id,
            scheduleId: interval.scheduleId
              ? scheduleIdMap.get(interval.scheduleId) ?? interval.scheduleId
              : undefined,
            workplaceId: getMappedId(interval.workplaceId),
            salaryProfileId: getMappedId(interval.salaryProfileId) ?? undefined,
          });
          if (skip) {
            const existing = await this.db.getFirstAsync<any>(
              'SELECT * FROM calendar_evidence_intervals WHERE id = ?;',
              interval.id,
            );
            const existingInterval = existing
              ? calendarEvidenceIntervalSchema.parse(this.stripNulls(this.mapCalendarEvidenceInterval(existing)))
              : null;
            if (!existingInterval || JSON.stringify(existingInterval) !== JSON.stringify(mappedInterval)) {
              id = Crypto.randomUUID();
              skip = false;
            }
          }
          if (id !== interval.id) evidenceIdMap.set(interval.id, id);
          if (!skip) await this.insertCalendarEvidenceInterval(
            mappedInterval,
            id,
            getMappedId(interval.workplaceId)!,
            getMappedId(interval.salaryProfileId),
          );
        }
        for (const w of data.workplaces) {
          if (w.salaryProfileId) {
            const mappedProfileId = getMappedId(w.salaryProfileId);
            const mappedWorkplaceId = idMap.get(w.id) || w.id;
            if (insertedWorkplaceIds.has(mappedWorkplaceId)) {
              await this.db.runAsync('UPDATE workplaces SET salary_profile_id = ? WHERE id = ?', [mappedProfileId, mappedWorkplaceId]);
            }
          }
        }
        for (const r of data.roles) {
          const { id, skip } = await remapId('roles', r.id, r);
          if (!skip) await this.db.runAsync('INSERT INTO roles (id, workplace_id, name, hourly_rate_minor, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, getMappedId(r.workplaceId), r.name, r.hourlyRateMinor ?? null, r.isArchived ? 1 : 0, r.createdAt, r.updatedAt]);
        }
        for (const t of data.shiftTemplates) {
          const { id, skip } = await remapId('shift_templates', t.id, t);
          if (!skip) await this.db.runAsync('INSERT INTO shift_templates (id, name, default_start_time, default_end_time, pay_multiplier_basis_points, expected_break_minutes, expected_break_type, workplace_id, role_id, salary_profile_id, valid_weekdays, color_token, is_archived, expected_duration_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, t.name, t.defaultStartTime, t.defaultEndTime, t.payMultiplierBasisPoints ?? 10_000, t.expectedBreakMinutes, t.expectedBreakType ?? null, getMappedId(t.workplaceId), getMappedId(t.roleId), getMappedId(t.salaryProfileId), t.validWeekdays ? JSON.stringify(t.validWeekdays) : null, t.colorToken ?? null, t.isArchived ? 1 : 0, t.expectedDurationMinutes ?? null, t.createdAt, t.updatedAt]);
        }
        for (const rs of data.recurrenceSeries) {
          const { id, skip } = await remapId('recurrence_series', rs.id, rs);
          if (!skip) {
            const template = {
              ...rs.template,
              workplaceId: getMappedId(rs.template.workplaceId) ?? rs.template.workplaceId,
              ...(rs.template.roleId ? { roleId: getMappedId(rs.template.roleId) ?? rs.template.roleId } : {}),
              ...(rs.template.shiftTemplateId ? { shiftTemplateId: getMappedId(rs.template.shiftTemplateId) ?? rs.template.shiftTemplateId } : {}),
            };
            await this.db.runAsync('INSERT INTO recurrence_series (id, rule_json, template_json, disabled_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, JSON.stringify(rs.rule), JSON.stringify(template), rs.disabledFrom || null, rs.createdAt, rs.updatedAt]);
          }
        }
        for (const s of data.shifts) {
          let { id, skip } = await remapId('shifts', s.id, s);
          // Recurrence occurrence check: if semantic duplicate exists, skip it
          if (!skip && s.recurrenceGroupId && s.recurrenceOriginalStart) {
            const mGroup = getMappedId(s.recurrenceGroupId);
            const semanticMatch = await this.db.getFirstAsync('SELECT id FROM shifts WHERE recurrence_group_id = ? AND recurrence_original_start = ?', [mGroup, s.recurrenceOriginalStart]);
            if (semanticMatch && typeof semanticMatch === 'object' && 'id' in semanticMatch) {
              skip = true;
              idMap.set(s.id, String((semanticMatch as { id: string }).id));
            }
          }
          if (!skip) await this.db.runAsync('INSERT INTO shifts (id, workplace_id, role_id, salary_profile_id, title, notes, scheduled_start, scheduled_end, actual_start, actual_end, payable_start, payable_end, expected_break_minutes, actual_break_minutes, payable_break_minutes, status, hourly_rate_snapshot_minor, expected_gross_pay_minor, actual_gross_pay_minor, payable_gross_pay_minor, shift_template_id, shift_type_name_snapshot, shift_type_pay_multiplier_basis_points, recurrence_group_id, recurrence_original_start, recurrence_exception_type, cancelled_at, expected_end, active_origin, payable_source, completed_at, timezone, hourly_rate_override_minor, fixed_bonus_override_minor, travel_reimbursement_override_minor, salary_calculation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            id, getMappedId(s.workplaceId), getMappedId(s.roleId), getMappedId(s.salaryProfileId), s.title ?? null, s.notes ?? null, s.scheduledStart ?? null, s.scheduledEnd ?? null, s.actualStart ?? null, s.actualEnd ?? null, s.payableStart ?? null, s.payableEnd ?? null, s.expectedBreakMinutes, s.actualBreakMinutes ?? null, s.payableBreakMinutes ?? null, s.status, s.hourlyRateSnapshotMinor, s.expectedGrossPayMinor ?? null, s.actualGrossPayMinor ?? null, s.payableGrossPayMinor ?? null, getMappedId(s.shiftTemplateId), s.shiftTypeNameSnapshot ?? null, s.shiftTypePayMultiplierBasisPoints ?? 10_000, getMappedId(s.recurrenceGroupId), s.recurrenceOriginalStart ?? null, s.recurrenceExceptionType ?? null, s.cancelledAt ?? null, s.expectedEnd ?? null, s.activeOrigin ?? null, s.payableSource ?? null, s.completedAt ?? null, s.timezone, s.hourlyRateOverrideMinor ?? null, s.fixedBonusOverrideMinor ?? null, s.travelReimbursementOverrideMinor ?? null, s.salaryCalculationStatus, s.createdAt, s.updatedAt
          ]);
        }
        for (const re of data.recurrenceExceptions) {
          const { id, skip } = await remapId('recurrence_exceptions', re.id, re);
          if (!skip) await this.db.runAsync('INSERT INTO recurrence_exceptions (id, series_id, local_date, type, shift_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, getMappedId(re.seriesId), re.localDate, re.type, getMappedId(re.shiftId), re.createdAt]);
        }
        for (const b of data.breakSessions) {
          const { id, skip } = await remapId('break_sessions', b.id, b);
          if (!skip) await this.db.runAsync('INSERT INTO break_sessions (id, shift_id, start_at, end_at, is_paid, source, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, getMappedId(b.shiftId), b.start, b.end ?? null, b.isPaid ? 1 : 0, b.source, b.notes ?? null, b.createdAt, b.updatedAt]);
        }
        for (const ss of data.salarySnapshots) {
          const mappedShiftId = getMappedId(ss.shiftId)!;
          const mappedResult = this.remapSnapshotEvidence(ss.result, evidenceIdMap, scheduleIdMap, payRuleIdMap);
          const mappedSnapshot = salaryCalculationSnapshotSchema.parse({
            ...ss,
            shiftId: mappedShiftId,
            salaryProfileId: getMappedId(ss.salaryProfileId) ?? undefined,
            result: mappedResult,
          });
          const existingById = await this.db.getFirstAsync<any>(
            'SELECT * FROM salary_calculation_snapshots WHERE id = ?;',
            ss.id,
          );
          const existingSnapshot = existingById
            ? salaryCalculationSnapshotSchema.parse(this.stripNulls(this.mapSalarySnapshot(existingById)))
            : null;
          if (existingSnapshot && JSON.stringify(existingSnapshot) === JSON.stringify(mappedSnapshot)) continue;
          const id = existingSnapshot ? Crypto.randomUUID() : ss.id;
          const versionConflict = await this.db.getFirstAsync<any>(
            'SELECT * FROM salary_calculation_snapshots WHERE shift_id = ? AND version = ? LIMIT 1;',
            mappedShiftId,
            ss.version,
          );
          if (versionConflict) {
            const conflictingSnapshot = salaryCalculationSnapshotSchema.parse(
              this.stripNulls(this.mapSalarySnapshot(versionConflict)),
            );
            const sameVersionSnapshot = salaryCalculationSnapshotSchema.parse({
              ...mappedSnapshot,
              id: conflictingSnapshot.id,
            });
            if (JSON.stringify(conflictingSnapshot) === JSON.stringify(sameVersionSnapshot)) continue;
            throw new Error(`Salary snapshot version conflict for shift ${mappedShiftId}, version ${ss.version}`);
          }
          const existingCurrent = await this.db.getFirstAsync<{ id: string }>(
            'SELECT id FROM salary_calculation_snapshots WHERE shift_id = ? AND is_current = 1 LIMIT 1;',
            mappedShiftId,
          );
          const preserveCurrent = ss.isCurrent && !existingCurrent;
          await this.db.runAsync('INSERT INTO salary_calculation_snapshots (id, shift_id, version, status, context, salary_profile_id, resolved_rate_minor, payable_minutes, regular_minutes, special_rate_minutes, base_pay_minor, premium_pay_minor, fixed_bonuses_minor, reimbursements_minor, total_gross_pay_minor, result_json, engine_version, calculated_at, is_current, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, mappedShiftId, ss.version, ss.status, mappedResult.context, getMappedId(ss.salaryProfileId), mappedResult.resolvedBaseHourlyRateMinor ?? null, mappedResult.payableMinutes, mappedResult.regularMinutes, mappedResult.specialRateMinutes, mappedResult.basePayMinor, mappedResult.premiumPayMinor, mappedResult.fixedBonusesMinor, mappedResult.reimbursementsMinor, mappedResult.totalGrossPayMinor ?? null, JSON.stringify(mappedResult), mappedResult.engineVersion, mappedResult.calculatedAt, preserveCurrent ? 1 : 0, ss.createdAt]);
        }

        for (const feedback of data.predictionFeedback) {
          const { id, skip } = await remapId('prediction_feedback', feedback.id, feedback);
          if (!skip) await this.db.runAsync('INSERT INTO prediction_feedback (id, feedback_type, engine_version, candidate_source, candidate_source_id, score, accepted_fields_json, rejected_fields_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, feedback.feedbackType, feedback.engineVersion, feedback.candidateSource, feedback.candidateSourceId, feedback.score, JSON.stringify(feedback.acceptedFields), JSON.stringify(feedback.rejectedFields), feedback.createdAt]);
        }
        for (const setting of data.appSettings) {
          await this.db.runAsync('INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING', [setting.key, setting.valueJson, setting.updatedAt]);
        }
        for (const override of data.workplaceNotificationOverrides) {
          const workplaceId = getMappedId(override.workplaceId);
          if (workplaceId) await this.insertWorkplaceNotificationOverride(override, workplaceId, true);
        }
        for (const notification of data.scheduledNotifications) {
          await this.db.runAsync(`INSERT INTO scheduled_notification_records
            (logical_key, type, scheduled_for, shift_id, break_session_id, workplace_id, title_key, body_key, body_params_json, native_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?) ON CONFLICT(logical_key) DO NOTHING`, [
            notification.logicalKey, notification.type, notification.scheduledFor, getMappedId(notification.shiftId), getMappedId(notification.breakSessionId), getMappedId(notification.workplaceId),
            notification.titleKey, notification.bodyKey, notification.bodyParams ? JSON.stringify(notification.bodyParams) : null, notification.createdAt, notification.updatedAt,
          ]);
        }

        await this.assertDatabaseIntegrity();
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  async clearAllData(): Promise<RestoreResult> {
    try {
      await this.db.withTransactionAsync(async () => {
        await this.db.execAsync(`
          DELETE FROM scheduled_notification_records;
          DELETE FROM workplace_notification_overrides;
          DELETE FROM prediction_feedback;
          DELETE FROM salary_calculation_snapshots;
          DELETE FROM break_sessions;
          DELETE FROM recurrence_exceptions;
          DELETE FROM shifts;
          DELETE FROM recurrence_series;
          DELETE FROM shift_templates;
          DELETE FROM pay_rules;
          DELETE FROM calendar_evidence_intervals;
          DELETE FROM weekly_rest_schedules;
          DELETE FROM roles;
          DELETE FROM workplaces;
          DELETE FROM salary_profiles;
          DELETE FROM export_history;
          DELETE FROM export_presets;
          DELETE FROM app_settings;
        `);
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  private async insertWorkplaceNotificationOverride(
    override: BackupDataV1['workplaceNotificationOverrides'][number],
    workplaceId: string,
    preserveExisting = false,
  ): Promise<void> {
    const conflict = preserveExisting ? 'ON CONFLICT(workplace_id) DO NOTHING' : '';
    await this.db.runAsync(`INSERT INTO workplace_notification_overrides
      (workplace_id, scheduled_shift_reminders, shift_reminder_offsets_json,
       missed_clock_in_reminders, missed_clock_in_grace_minutes, expected_end_reminders,
       overdue_shift_reminders, long_break_reminders, long_unpaid_break_threshold_minutes,
       long_paid_break_threshold_minutes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ${conflict}`, [
      workplaceId,
      override.scheduledShiftReminders == null ? null : override.scheduledShiftReminders ? 1 : 0,
      override.shiftReminderOffsets == null ? null : JSON.stringify(override.shiftReminderOffsets),
      override.missedClockInReminders == null ? null : override.missedClockInReminders ? 1 : 0,
      override.missedClockInGraceMinutes ?? null,
      override.expectedEndReminders == null ? null : override.expectedEndReminders ? 1 : 0,
      override.overdueShiftReminders == null ? null : override.overdueShiftReminders ? 1 : 0,
      override.longBreakReminders == null ? null : override.longBreakReminders ? 1 : 0,
      override.longUnpaidBreakThresholdMinutes ?? null,
      override.longPaidBreakThresholdMinutes ?? null,
      override.updatedAt,
    ]);
  }

  private async insertCalendarEvidenceInterval(
    interval: BackupDataV1['calendarEvidenceIntervals'][number],
    id: string,
    workplaceId: string,
    salaryProfileId: string | null,
  ): Promise<void> {
    await this.db.runAsync(`INSERT INTO calendar_evidence_intervals (
      id, schedule_id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at, timezone,
      source_kind, source_title, source_url, preset_id, preset_version, confirmed_at,
      is_archived, archived_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, interval.scheduleId ?? null, workplaceId, salaryProfileId, interval.type, interval.name, interval.start,
      interval.end, interval.timezone, interval.sourceKind, interval.sourceTitle ?? null,
      interval.sourceUrl ?? null, interval.presetId ?? null, interval.presetVersion ?? null,
      interval.confirmedAt, interval.isArchived ? 1 : 0, interval.archivedAt ?? null,
      interval.createdAt, interval.updatedAt,
    ]);
  }

  private async insertWeeklyRestSchedule(
    schedule: BackupDataV1['weeklyRestSchedules'][number],
    id: string,
    workplaceId: string,
    salaryProfileId: string,
  ): Promise<void> {
    await this.db.runAsync(`INSERT INTO weekly_rest_schedules (
      id, workplace_id, salary_profile_id, label, start_weekday, start_time, end_weekday,
      end_time, enabled, confirmed_at, source_kind, source_title, source_url, preset_id,
      preset_version, is_archived, archived_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, workplaceId, salaryProfileId, schedule.label, schedule.startWeekday,
      schedule.startTime, schedule.endWeekday, schedule.endTime, schedule.enabled ? 1 : 0,
      schedule.confirmedAt ?? null, schedule.sourceKind, schedule.sourceTitle ?? null,
      schedule.sourceUrl ?? null, schedule.presetId ?? null, schedule.presetVersion ?? null,
      schedule.isArchived ? 1 : 0, schedule.archivedAt ?? null, schedule.createdAt,
      schedule.updatedAt,
    ]);
    await this.markScheduleAffectedShiftsStale(weeklyRestScheduleSchema.parse({
      ...schedule,
      id,
      workplaceId,
      salaryProfileId,
    }));
  }

  private async markScheduleAffectedShiftsStale(schedule: WeeklyRestSchedule): Promise<void> {
    if (!schedule.enabled || schedule.isArchived || !schedule.confirmedAt) return;
    const candidates = await this.db.getAllAsync<{
      id: string;
      start_at: string;
      end_at: string;
      timezone: string;
    }>(`SELECT shift_record.id,
        COALESCE(shift_record.payable_start, shift_record.actual_start, shift_record.scheduled_start) AS start_at,
        COALESCE(shift_record.payable_end, shift_record.actual_end, shift_record.scheduled_end) AS end_at,
        profile.timezone
      FROM shifts shift_record
      JOIN salary_calculation_snapshots snapshot
        ON snapshot.shift_id = shift_record.id AND snapshot.is_current = 1
        AND snapshot.status = 'finalized' AND snapshot.salary_profile_id = ?
      JOIN salary_profiles profile ON profile.id = snapshot.salary_profile_id
      WHERE shift_record.workplace_id = ? AND shift_record.status = 'completed'
        AND shift_record.salary_calculation_status = 'finalized';`,
    schedule.salaryProfileId, schedule.workplaceId);
    const affected = candidates
      .filter((candidate) => candidate.start_at && candidate.end_at
        && resolveWeeklyRestOccurrences(
          schedule,
          candidate.start_at,
          candidate.end_at,
          candidate.timezone,
        ).length > 0)
      .map((candidate) => candidate.id);
    if (!affected.length) return;
    await this.db.runAsync(
      `UPDATE shifts SET salary_calculation_status='stale'
       WHERE salary_calculation_status='finalized'
         AND id IN (${affected.map(() => '?').join(', ')})`,
      ...affected,
    );
  }

  private remapSnapshotEvidence(
    result: BackupDataV1['salarySnapshots'][number]['result'],
    evidenceIds: ReadonlyMap<string, string>,
    scheduleIds: ReadonlyMap<string, string>,
    payRuleIds: ReadonlyMap<string, string>,
  ): BackupDataV1['salarySnapshots'][number]['result'] {
    const mapRule = (id: string) => payRuleIds.get(id) ?? id;
    const mapInterval = (id: string) => {
      const mappedEvidenceId = evidenceIds.get(id);
      if (mappedEvidenceId) return mappedEvidenceId;
      for (const [oldScheduleId, newScheduleId] of scheduleIds) {
        const prefix = `weekly-rest:${oldScheduleId}:`;
        if (id.startsWith(prefix)) return `weekly-rest:${newScheduleId}:${id.slice(prefix.length)}`;
      }
      return id;
    };
    return {
      ...result,
      appliedRuleIds: result.appliedRuleIds.map(mapRule),
      segments: result.segments.map((segment) => ({
        ...segment,
        appliedRuleIds: segment.appliedRuleIds.map(mapRule),
        ...(segment.specialIntervalIds
          ? { specialIntervalIds: segment.specialIntervalIds.map(mapInterval) }
          : {}),
      })),
      ...(result.specialIntervalEvaluations
        ? {
          specialIntervalEvaluations: result.specialIntervalEvaluations.map((evaluation) => ({
            ...evaluation,
            intervalId: mapInterval(evaluation.intervalId),
            ...(evaluation.scheduleId
              ? { scheduleId: scheduleIds.get(evaluation.scheduleId) ?? evaluation.scheduleId }
              : {}),
            appliedRuleIds: evaluation.appliedRuleIds.map(mapRule),
          })),
        }
        : {}),
    };
  }

  private async assertDatabaseIntegrity(): Promise<void> {
    const fkIssues = await this.db.getAllAsync<Record<string, unknown>>('PRAGMA foreign_key_check');
    if (fkIssues.length > 0) throw new Error('Foreign key constraint violation after restore');
    const integrity = await this.db.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (integrity?.integrity_check !== 'ok') throw new Error('Database integrity check failed after restore');
  }

  private async assertReplaceCounts(data: BackupDataV1): Promise<void> {
    const expectedByTable: readonly [string, number][] = [
      ['salary_profiles', data.salaryProfiles.length],
      ['pay_rules', data.payRules.length],
      ['workplaces', data.workplaces.length],
      ['roles', data.roles.length],
      ['shift_templates', data.shiftTemplates.length],
      ['shifts', data.shifts.length],
      ['break_sessions', data.breakSessions.length],
      ['recurrence_series', data.recurrenceSeries.length],
      ['recurrence_exceptions', data.recurrenceExceptions.length],
      ['salary_calculation_snapshots', data.salarySnapshots.length],
      ['prediction_feedback', data.predictionFeedback.length],
      ['scheduled_notification_records', data.scheduledNotifications.length],
      ['workplace_notification_overrides', data.workplaceNotificationOverrides.length],
      ['calendar_evidence_intervals', data.calendarEvidenceIntervals.length],
      ['weekly_rest_schedules', data.weeklyRestSchedules.length],
      ['export_presets', data.exportPresets.length],
      ['export_history', data.exportHistory.length],
      ['app_settings', data.appSettings.length],
    ];
    for (const [table, expected] of expectedByTable) {
      const row = await this.db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
      if ((row?.count ?? 0) !== expected) throw new Error(`Restore count mismatch for ${table}`);
    }
  }

  // Mapper helpers omitted for brevity, but they basically map snake_case row to camelCase object
  // Since we use the entity schemas from `src/domain/entities`, we need to map the raw db rows to those types.
  private async fetchAll<T>(table: string, mapper: (row: any) => T): Promise<T[]> {
    const rows = await this.db.getAllAsync<any>(`SELECT * FROM ${table}`);
    return rows.map(r => this.stripNulls(mapper(r))) as T[];
  }

  private stripNulls(obj: any): any {
    if (obj === null) return undefined;
    if (Array.isArray(obj)) return obj.map(o => this.stripNulls(o));
    if (typeof obj === 'object' && obj !== null) {
      const newObj: any = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== null) {
          newObj[k] = this.stripNulls(v);
        }
      }
      return newObj;
    }
    return obj;
  }

  private mapSalaryProfile = (row: any) => ({
    id: row.id, workplaceId: row.workplace_id, name: row.name, currency: row.currency,
    baseHourlyRateMinor: row.standard_hourly_rate_minor, breakPolicy: row.break_policy,
    timezone: row.timezone, defaultTravelReimbursementMinor: row.default_travel_reimbursement_minor,
    defaultShiftBonusMinor: row.default_shift_bonus_minor, calculationRoundingMode: row.calculation_rounding_mode,
    workweekStartWeekday: row.workweek_start_weekday, weeklyOvertimeEnabled: row.weekly_overtime_enabled === 1,
    weeklyRegularMinutes: row.weekly_regular_minutes,
    weeklyOvertimeMultiplierBasisPoints: row.weekly_overtime_multiplier_basis_points,
    weeklyOvertimeBasis: row.weekly_overtime_basis,
    effectiveFrom: row.effective_from, effectiveTo: row.effective_to, isActive: row.is_active === 1,
    isArchived: row.is_archived === 1, createdAt: row.created_at, updatedAt: row.updated_at
  });
  
  private mapPayRule = (row: any) => ({
    id: row.id, salaryProfileId: row.salary_profile_id, name: row.name, priority: row.priority,
    conditions: JSON.parse(row.conditions_json), effect: JSON.parse(row.effect_json),
    canStack: row.can_stack === 1, premiumFamily: row.premium_family, isEnabled: row.is_enabled === 1, effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to, createdAt: row.created_at, updatedAt: row.updated_at
  });

  private mapWorkplace = (row: any) => ({
    id: row.id, name: row.name, address: row.address, defaultHourlyRateMinor: row.default_hourly_rate_minor,
    defaultBreakMinutes: row.default_break_minutes, salaryProfileId: row.salary_profile_id, color: row.color,
    defaultTravelReimbursementMinor: row.default_travel_reimbursement_minor, defaultShiftBonusMinor: row.default_shift_bonus_minor,
    isArchived: row.is_archived === 1, createdAt: row.created_at, updatedAt: row.updated_at
  });

  private mapRole = (row: any) => ({
    id: row.id, workplaceId: row.workplace_id, name: row.name, hourlyRateMinor: row.hourly_rate_minor,
    isArchived: row.is_archived === 1, createdAt: row.created_at, updatedAt: row.updated_at
  });

  private mapShiftTemplate = (row: any) => ({
    id: row.id, name: row.name, defaultStartTime: row.default_start_time, defaultEndTime: row.default_end_time,
    payMultiplierBasisPoints: row.pay_multiplier_basis_points,
    expectedBreakMinutes: row.expected_break_minutes, expectedBreakType: row.expected_break_type,
    workplaceId: row.workplace_id, roleId: row.role_id, salaryProfileId: row.salary_profile_id,
    validWeekdays: row.valid_weekdays ? JSON.parse(row.valid_weekdays) : undefined, colorToken: row.color_token,
    isArchived: row.is_archived === 1, expectedDurationMinutes: row.expected_duration_minutes,
    createdAt: row.created_at, updatedAt: row.updated_at
  });

  private mapShift = (row: any) => ({
    id: row.id, workplaceId: row.workplace_id, roleId: row.role_id, salaryProfileId: row.salary_profile_id,
    title: row.title, notes: row.notes, scheduledStart: row.scheduled_start, scheduledEnd: row.scheduled_end,
    actualStart: row.actual_start, actualEnd: row.actual_end, payableStart: row.payable_start, payableEnd: row.payable_end,
    expectedBreakMinutes: row.expected_break_minutes, actualBreakMinutes: row.actual_break_minutes, payableBreakMinutes: row.payable_break_minutes,
    status: row.status, hourlyRateSnapshotMinor: row.hourly_rate_snapshot_minor, expectedGrossPayMinor: row.expected_gross_pay_minor,
    actualGrossPayMinor: row.actual_gross_pay_minor, payableGrossPayMinor: row.payable_gross_pay_minor, shiftTemplateId: row.shift_template_id,
    shiftTypeNameSnapshot: row.shift_type_name_snapshot, shiftTypePayMultiplierBasisPoints: row.shift_type_pay_multiplier_basis_points,
    recurrenceGroupId: row.recurrence_group_id, recurrenceOriginalStart: row.recurrence_original_start, recurrenceExceptionType: row.recurrence_exception_type,
    cancelledAt: row.cancelled_at, expectedEnd: row.expected_end, activeOrigin: row.active_origin, payableSource: row.payable_source,
    completedAt: row.completed_at, timezone: row.timezone, hourlyRateOverrideMinor: row.hourly_rate_override_minor,
    fixedBonusOverrideMinor: row.fixed_bonus_override_minor, travelReimbursementOverrideMinor: row.travel_reimbursement_override_minor,
    salaryCalculationStatus: row.salary_calculation_status, createdAt: row.created_at, updatedAt: row.updated_at
  });

  private mapBreakSession = (row: any) => ({
    id: row.id, shiftId: row.shift_id, start: row.start_at, end: row.end_at, isPaid: row.is_paid === 1,
    source: row.source, notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at
  });

  private mapRecurrenceSeries = (row: any) => ({
    id: row.id, rule: JSON.parse(row.rule_json), template: JSON.parse(row.template_json),
    disabledFrom: row.disabled_from, createdAt: row.created_at, updatedAt: row.updated_at
  });

  private mapRecurrenceException = (row: any) => ({
    id: row.id, seriesId: row.series_id, localDate: row.local_date, type: row.type,
    shiftId: row.shift_id, createdAt: row.created_at
  });

  private mapSalarySnapshot = (row: any) => ({
    id: row.id, shiftId: row.shift_id, version: row.version, status: row.status, 
    salaryProfileId: row.salary_profile_id, 
    result: JSON.parse(row.result_json), 
    isCurrent: row.is_current === 1, createdAt: row.created_at
  });

  private mapPredictionFeedback = (row: any) => ({
    id: row.id, feedbackType: row.feedback_type, engineVersion: row.engine_version, candidateSource: row.candidate_source,
    candidateSourceId: row.candidate_source_id, score: row.score, acceptedFields: JSON.parse(row.accepted_fields_json),
    rejectedFields: JSON.parse(row.rejected_fields_json), createdAt: row.created_at
  });

  private mapScheduledNotification = (row: any) => ({
    logicalKey: row.logical_key, type: row.type, scheduledFor: row.scheduled_for, shiftId: row.shift_id || undefined,
    breakSessionId: row.break_session_id || undefined, workplaceId: row.workplace_id || undefined, titleKey: row.title_key,
    bodyKey: row.body_key, bodyParams: row.body_params_json ? JSON.parse(row.body_params_json) : undefined,
    nativeId: undefined, createdAt: row.created_at, updatedAt: row.updated_at
  });

  private mapWorkplaceNotificationOverride = (row: any) => ({
    workplaceId: row.workplace_id,
    scheduledShiftReminders: row.scheduled_shift_reminders == null ? undefined : row.scheduled_shift_reminders === 1,
    shiftReminderOffsets: row.shift_reminder_offsets_json ? JSON.parse(row.shift_reminder_offsets_json) : undefined,
    missedClockInReminders: row.missed_clock_in_reminders == null ? undefined : row.missed_clock_in_reminders === 1,
    missedClockInGraceMinutes: row.missed_clock_in_grace_minutes,
    expectedEndReminders: row.expected_end_reminders == null ? undefined : row.expected_end_reminders === 1,
    overdueShiftReminders: row.overdue_shift_reminders == null ? undefined : row.overdue_shift_reminders === 1,
    longBreakReminders: row.long_break_reminders == null ? undefined : row.long_break_reminders === 1,
    longUnpaidBreakThresholdMinutes: row.long_unpaid_break_threshold_minutes,
    longPaidBreakThresholdMinutes: row.long_paid_break_threshold_minutes,
    updatedAt: row.updated_at,
  });

  private mapCalendarEvidenceInterval = (row: any) => ({
    id: row.id, scheduleId: row.schedule_id, workplaceId: row.workplace_id, salaryProfileId: row.salary_profile_id,
    type: row.interval_type, name: row.name, start: row.start_at, end: row.end_at,
    timezone: row.timezone, sourceKind: row.source_kind, sourceTitle: row.source_title,
    sourceUrl: row.source_url, presetId: row.preset_id, presetVersion: row.preset_version,
    confirmedAt: row.confirmed_at, isArchived: row.is_archived === 1,
    archivedAt: row.archived_at, createdAt: row.created_at, updatedAt: row.updated_at,
  });

  private mapWeeklyRestSchedule = (row: any) => ({
    id: row.id, workplaceId: row.workplace_id, salaryProfileId: row.salary_profile_id,
    label: row.label, startWeekday: row.start_weekday, startTime: row.start_time,
    endWeekday: row.end_weekday, endTime: row.end_time, enabled: row.enabled === 1,
    confirmedAt: row.confirmed_at, sourceKind: row.source_kind,
    sourceTitle: row.source_title, sourceUrl: row.source_url, presetId: row.preset_id,
    presetVersion: row.preset_version, isArchived: row.is_archived === 1,
    archivedAt: row.archived_at, createdAt: row.created_at, updatedAt: row.updated_at,
  });

  private mapExportPreset = (row: any) => ({
    id: row.id, name: row.name, format: row.format, config: JSON.parse(row.config_json),
    isArchived: row.is_archived === 1, createdAt: row.created_at, updatedAt: row.updated_at
  });

  private mapExportHistory = (row: any) => ({
    id: row.id, format: row.format, presetId: row.preset_id, reportingPeriod: row.reporting_period,
    workplaceFilter: row.workplace_filter, generatedAt: row.generated_at, sanitizedFilename: row.sanitized_filename,
    status: row.status, createdAt: row.created_at
  });

  private mapAppSetting = (row: any) => ({
    key: row.key, valueJson: row.value_json, updatedAt: this.normalizeSqliteTimestamp(row.updated_at)
  });

  private normalizeSqliteTimestamp(value: string): string {
    const timestamp = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`Invalid app setting timestamp: ${value}`);
    }
    return parsed.toISOString();
  }
}
