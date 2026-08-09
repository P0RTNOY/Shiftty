import { SQLiteDatabase } from 'expo-sqlite';
import { BackupEnvelopeV1, BackupDataV1, parseBackupEnvelope, BackupEnvelopeV1Schema } from '@/domain/entities/backup';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';

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
      
      const errors = this.validateRelationalIntegrity(envelope.data);
      if (errors.length > 0) {
        return { valid: false, errors };
      }
      return { valid: true, envelope };
    } catch (e: any) {
      return { valid: false, errors: [e.message] };
    }
  }

  private validateRelationalIntegrity(data: BackupDataV1): string[] {
    const errors: string[] = [];
    const wpIds = new Set(data.workplaces.map(w => w.id));
    const roleIds = new Set(data.roles.map(r => r.id));
    const shiftIds = new Set(data.shifts.map(s => s.id));

    // Validations: Unique IDs
    if (wpIds.size !== data.workplaces.length) errors.push('Duplicate workplace IDs found');
    if (shiftIds.size !== data.shifts.length) errors.push('Duplicate shift IDs found');

    // FK Checks
    for (const r of data.roles) {
      if (!wpIds.has(r.workplaceId)) errors.push(`Role ${r.id} references missing workplace ${r.workplaceId}`);
    }
    for (const s of data.shifts) {
      if (!wpIds.has(s.workplaceId)) errors.push(`Shift ${s.id} references missing workplace ${s.workplaceId}`);
      if (s.roleId && !roleIds.has(s.roleId)) errors.push(`Shift ${s.id} references missing role ${s.roleId}`);
    }
    for (const b of data.breakSessions) {
      if (!shiftIds.has(b.shiftId)) errors.push(`Break ${b.id} references missing shift ${b.shiftId}`);
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
        await this.db.runAsync('DELETE FROM break_sessions');
        await this.db.runAsync('DELETE FROM recurrence_exceptions');
        await this.db.runAsync('DELETE FROM shifts');
        await this.db.runAsync('DELETE FROM recurrence_series');
        await this.db.runAsync('DELETE FROM shift_templates');
        await this.db.runAsync('DELETE FROM roles');
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
          await this.db.runAsync('INSERT INTO salary_profiles (id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy, timezone, default_travel_reimbursement_minor, default_shift_bonus_minor, calculation_rounding_mode, effective_from, effective_to, is_active, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [sp.id, sp.workplaceId || null, sp.name, sp.currency, sp.baseHourlyRateMinor ?? null, sp.breakPolicy, sp.timezone, sp.defaultTravelReimbursementMinor ?? 0, sp.defaultShiftBonusMinor ?? 0, sp.calculationRoundingMode, sp.effectiveFrom ?? null, sp.effectiveTo ?? null, sp.isActive ? 1 : 0, sp.isArchived ? 1 : 0, sp.createdAt, sp.updatedAt]);
        }
        for (const r of data.payRules) {
          await this.db.runAsync('INSERT INTO pay_rules (id, salary_profile_id, name, priority, conditions_json, effect_json, can_stack, is_enabled, effective_from, effective_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [r.id, r.salaryProfileId, r.name, r.priority, JSON.stringify(r.conditions), JSON.stringify(r.effect), r.canStack ? 1 : 0, r.isEnabled ? 1 : 0, r.effectiveFrom || null, r.effectiveTo || null, r.createdAt, r.updatedAt]);
        }
        for (const w of data.workplaces) {
          if (w.salaryProfileId) {
            await this.db.runAsync('UPDATE workplaces SET salary_profile_id = ? WHERE id = ?', [w.salaryProfileId, w.id]);
          }
        }
        for (const r of data.roles) {
          await this.db.runAsync('INSERT INTO roles (id, workplace_id, name, hourly_rate_minor, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [r.id, r.workplaceId, r.name, r.hourlyRateMinor || null, r.isArchived ? 1 : 0, r.createdAt, r.updatedAt]);
        }
        for (const t of data.shiftTemplates) {
          await this.db.runAsync('INSERT INTO shift_templates (id, name, default_start_time, default_end_time, expected_break_minutes, expected_break_type, workplace_id, role_id, salary_profile_id, valid_weekdays, color_token, is_archived, expected_duration_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [t.id, t.name, t.defaultStartTime, t.defaultEndTime, t.expectedBreakMinutes, t.expectedBreakType || null, t.workplaceId || null, t.roleId || null, t.salaryProfileId || null, t.validWeekdays ? JSON.stringify(t.validWeekdays) : null, t.colorToken || null, t.isArchived ? 1 : 0, t.expectedDurationMinutes || null, t.createdAt, t.updatedAt]);
        }
        for (const rs of data.recurrenceSeries) {
          await this.db.runAsync('INSERT INTO recurrence_series (id, rule_json, template_json, disabled_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [rs.id, JSON.stringify(rs.rule), JSON.stringify(rs.template), rs.disabledFrom || null, rs.createdAt, rs.updatedAt]);
        }
        for (const s of data.shifts) {
          await this.db.runAsync('INSERT INTO shifts (id, workplace_id, role_id, salary_profile_id, title, notes, scheduled_start, scheduled_end, actual_start, actual_end, payable_start, payable_end, expected_break_minutes, actual_break_minutes, payable_break_minutes, status, hourly_rate_snapshot_minor, expected_gross_pay_minor, actual_gross_pay_minor, payable_gross_pay_minor, shift_template_id, recurrence_group_id, recurrence_original_start, recurrence_exception_type, cancelled_at, expected_end, active_origin, payable_source, completed_at, timezone, hourly_rate_override_minor, fixed_bonus_override_minor, travel_reimbursement_override_minor, salary_calculation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            s.id, s.workplaceId, s.roleId || null, s.salaryProfileId || null, s.title || null, s.notes || null, s.scheduledStart || null, s.scheduledEnd || null, s.actualStart || null, s.actualEnd || null, s.payableStart || null, s.payableEnd || null, s.expectedBreakMinutes, s.actualBreakMinutes || null, s.payableBreakMinutes || null, s.status, s.hourlyRateSnapshotMinor, s.expectedGrossPayMinor || null, s.actualGrossPayMinor || null, s.payableGrossPayMinor || null, s.shiftTemplateId || null, s.recurrenceGroupId || null, s.recurrenceOriginalStart || null, s.recurrenceExceptionType || null, s.cancelledAt || null, s.expectedEnd || null, s.activeOrigin || null, s.payableSource || null, s.completedAt || null, s.timezone, s.hourlyRateOverrideMinor || null, s.fixedBonusOverrideMinor || null, s.travelReimbursementOverrideMinor || null, s.salaryCalculationStatus, s.createdAt, s.updatedAt
          ]);
        }
        for (const re of data.recurrenceExceptions) {
          await this.db.runAsync('INSERT INTO recurrence_exceptions (id, series_id, local_date, type, shift_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', [re.id, re.seriesId, re.localDate, re.type, re.shiftId || null, re.createdAt]);
        }
        for (const b of data.breakSessions) {
          await this.db.runAsync('INSERT INTO break_sessions (id, shift_id, start_at, end_at, is_paid, source, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [b.id, b.shiftId, b.start, b.end ?? null, b.isPaid ? 1 : 0, b.source, b.notes ?? null, b.createdAt, b.updatedAt]);
        }
        for (const ss of data.salarySnapshots) {
          await this.db.runAsync('INSERT INTO salary_calculation_snapshots (id, shift_id, version, status, context, salary_profile_id, resolved_rate_minor, payable_minutes, regular_minutes, special_rate_minutes, base_pay_minor, premium_pay_minor, fixed_bonuses_minor, reimbursements_minor, total_gross_pay_minor, result_json, engine_version, calculated_at, is_current, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [ss.id, ss.shiftId, ss.version, ss.status, ss.result.context, ss.salaryProfileId || null, ss.result.resolvedBaseHourlyRateMinor || null, ss.result.payableMinutes, ss.result.regularMinutes, ss.result.specialRateMinutes, ss.result.basePayMinor, ss.result.premiumPayMinor, ss.result.fixedBonusesMinor, ss.result.reimbursementsMinor, ss.result.totalGrossPayMinor || null, JSON.stringify(ss.result), ss.result.engineVersion, ss.result.calculatedAt, ss.isCurrent ? 1 : 0, ss.createdAt]);
        }
        for (const pf of data.predictionFeedback) {
          await this.db.runAsync('INSERT INTO prediction_feedback (id, feedback_type, engine_version, candidate_source, candidate_source_id, score, accepted_fields_json, rejected_fields_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [pf.id, pf.feedbackType, pf.engineVersion, pf.candidateSource, pf.candidateSourceId, pf.score, JSON.stringify(pf.acceptedFields), JSON.stringify(pf.rejectedFields), pf.createdAt]);
        }
        for (const sn of data.scheduledNotifications) {
          // Native ID is intentionally stripped on restore.
          await this.db.runAsync('INSERT INTO scheduled_notification_records (logical_key, type, scheduled_for, shift_id, break_session_id, workplace_id, title_key, body_key, body_params_json, native_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [sn.logicalKey, sn.type, sn.scheduledFor, sn.shiftId || null, sn.breakSessionId || null, sn.workplaceId || null, sn.titleKey, sn.bodyKey, sn.bodyParams ? JSON.stringify(sn.bodyParams) : null, null, sn.createdAt, sn.updatedAt]);
        }

        // PRAGMA foreign_key_check
        const fkIssues = await this.db.getAllAsync<any>('PRAGMA foreign_key_check');
        if (fkIssues.length > 0) {
          throw new Error('Foreign key constraint violation after restore');
        }

        // Run count checks to verify nothing was dropped silently
        const shiftCount = await this.db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM shifts');
        if ((shiftCount?.count || 0) !== data.shifts.length) {
          throw new Error(`Shift count mismatch: expected ${data.shifts.length}, got ${shiftCount?.count}`);
        }
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

    try {
      await this.db.withTransactionAsync(async () => {
        await this.db.runAsync('PRAGMA defer_foreign_keys = ON');

        const idMap = new Map<string, string>();
        
        const remapId = async (table: string, oldId: string, fieldsToCheck: any): Promise<{id: string, isNew: boolean, skip: boolean}> => {
          const existing = await this.db.getFirstAsync<any>(`SELECT * FROM ${table} WHERE id = ?`, [oldId]);
          if (!existing) {
            return { id: oldId, isNew: true, skip: false }; // Insert with original ID
          }
          if (existing.updated_at === fieldsToCheck.updatedAt && existing.created_at === fieldsToCheck.createdAt) {
            return { id: oldId, isNew: false, skip: true };
          }
          const newId = Crypto.randomUUID();
          idMap.set(oldId, newId);
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
          if (!skip) await this.db.runAsync('INSERT INTO workplaces (id, name, address, default_hourly_rate_minor, default_break_minutes, salary_profile_id, color, default_travel_reimbursement_minor, default_shift_bonus_minor, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, w.name, w.address || null, w.defaultHourlyRateMinor ?? null, w.defaultBreakMinutes ?? 0, null, w.color || null, w.defaultTravelReimbursementMinor ?? 0, w.defaultShiftBonusMinor ?? 0, w.isArchived ? 1 : 0, w.createdAt, w.updatedAt]);
        }
        for (const sp of data.salaryProfiles) {
          const { id, skip } = await remapId('salary_profiles', sp.id, sp);
          if (!skip) await this.db.runAsync('INSERT INTO salary_profiles (id, workplace_id, name, currency, standard_hourly_rate_minor, break_policy, timezone, default_travel_reimbursement_minor, default_shift_bonus_minor, calculation_rounding_mode, effective_from, effective_to, is_active, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, getMappedId(sp.workplaceId), sp.name, sp.currency, sp.baseHourlyRateMinor ?? null, sp.breakPolicy, sp.timezone, sp.defaultTravelReimbursementMinor ?? 0, sp.defaultShiftBonusMinor ?? 0, sp.calculationRoundingMode, sp.effectiveFrom ?? null, sp.effectiveTo ?? null, sp.isActive ? 1 : 0, sp.isArchived ? 1 : 0, sp.createdAt, sp.updatedAt]);
        }
        for (const r of data.payRules) {
          const { id, skip } = await remapId('pay_rules', r.id, r);
          if (!skip) await this.db.runAsync('INSERT INTO pay_rules (id, salary_profile_id, name, priority, conditions_json, effect_json, can_stack, is_enabled, effective_from, effective_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, getMappedId(r.salaryProfileId), r.name, r.priority, JSON.stringify(r.conditions), JSON.stringify(r.effect), r.canStack ? 1 : 0, r.isEnabled ? 1 : 0, r.effectiveFrom || null, r.effectiveTo || null, r.createdAt, r.updatedAt]);
        }
        for (const w of data.workplaces) {
          if (w.salaryProfileId) {
            const mappedProfileId = getMappedId(w.salaryProfileId);
            const mappedWorkplaceId = idMap.get(w.id) || w.id; // Get the mapped ID if it was inserted/remapped
            await this.db.runAsync('UPDATE workplaces SET salary_profile_id = ? WHERE id = ?', [mappedProfileId, mappedWorkplaceId]);
          }
        }
        for (const r of data.roles) {
          const { id, skip } = await remapId('roles', r.id, r);
          if (!skip) await this.db.runAsync('INSERT INTO roles (id, workplace_id, name, hourly_rate_minor, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, getMappedId(r.workplaceId), r.name, r.hourlyRateMinor || null, r.isArchived ? 1 : 0, r.createdAt, r.updatedAt]);
        }
        for (const t of data.shiftTemplates) {
          const { id, skip } = await remapId('shift_templates', t.id, t);
          if (!skip) await this.db.runAsync('INSERT INTO shift_templates (id, name, default_start_time, default_end_time, expected_break_minutes, expected_break_type, workplace_id, role_id, salary_profile_id, valid_weekdays, color_token, is_archived, expected_duration_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, t.name, t.defaultStartTime, t.defaultEndTime, t.expectedBreakMinutes, t.expectedBreakType || null, getMappedId(t.workplaceId), getMappedId(t.roleId), getMappedId(t.salaryProfileId), t.validWeekdays ? JSON.stringify(t.validWeekdays) : null, t.colorToken || null, t.isArchived ? 1 : 0, t.expectedDurationMinutes || null, t.createdAt, t.updatedAt]);
        }
        for (const rs of data.recurrenceSeries) {
          const { id, skip } = await remapId('recurrence_series', rs.id, rs);
          if (!skip) await this.db.runAsync('INSERT INTO recurrence_series (id, rule_json, template_json, disabled_from, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, JSON.stringify(rs.rule), JSON.stringify(rs.template), rs.disabledFrom || null, rs.createdAt, rs.updatedAt]);
        }
        for (const s of data.shifts) {
          let { id, skip } = await remapId('shifts', s.id, s);
          // Recurrence occurrence check: if semantic duplicate exists, skip it
          if (!skip && s.recurrenceGroupId && s.recurrenceOriginalStart) {
            const mGroup = getMappedId(s.recurrenceGroupId);
            const semanticMatch = await this.db.getFirstAsync('SELECT id FROM shifts WHERE recurrence_group_id = ? AND recurrence_original_start = ?', [mGroup, s.recurrenceOriginalStart]);
            if (semanticMatch) skip = true;
          }
          if (!skip) await this.db.runAsync('INSERT INTO shifts (id, workplace_id, role_id, salary_profile_id, title, notes, scheduled_start, scheduled_end, actual_start, actual_end, payable_start, payable_end, expected_break_minutes, actual_break_minutes, payable_break_minutes, status, hourly_rate_snapshot_minor, expected_gross_pay_minor, actual_gross_pay_minor, payable_gross_pay_minor, shift_template_id, recurrence_group_id, recurrence_original_start, recurrence_exception_type, cancelled_at, expected_end, active_origin, payable_source, completed_at, timezone, hourly_rate_override_minor, fixed_bonus_override_minor, travel_reimbursement_override_minor, salary_calculation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            id, getMappedId(s.workplaceId), getMappedId(s.roleId), getMappedId(s.salaryProfileId), s.title || null, s.notes || null, s.scheduledStart || null, s.scheduledEnd || null, s.actualStart || null, s.actualEnd || null, s.payableStart || null, s.payableEnd || null, s.expectedBreakMinutes, s.actualBreakMinutes || null, s.payableBreakMinutes || null, s.status === 'active' ? 'completed' : s.status, s.hourlyRateSnapshotMinor, s.expectedGrossPayMinor || null, s.actualGrossPayMinor || null, s.payableGrossPayMinor || null, getMappedId(s.shiftTemplateId), getMappedId(s.recurrenceGroupId), s.recurrenceOriginalStart || null, s.recurrenceExceptionType || null, s.cancelledAt || null, s.expectedEnd || null, s.activeOrigin || null, s.payableSource || null, s.completedAt || null, s.timezone, s.hourlyRateOverrideMinor || null, s.fixedBonusOverrideMinor || null, s.travelReimbursementOverrideMinor || null, s.salaryCalculationStatus, s.createdAt, s.updatedAt
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
          const { id, skip } = await remapId('salary_calculation_snapshots', ss.id, ss);
          if (!skip) await this.db.runAsync('INSERT INTO salary_calculation_snapshots (id, shift_id, version, status, context, salary_profile_id, resolved_rate_minor, payable_minutes, regular_minutes, special_rate_minutes, base_pay_minor, premium_pay_minor, fixed_bonuses_minor, reimbursements_minor, total_gross_pay_minor, result_json, engine_version, calculated_at, is_current, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, getMappedId(ss.shiftId), ss.version, ss.status, ss.result.context, getMappedId(ss.salaryProfileId), ss.result.resolvedBaseHourlyRateMinor || null, ss.result.payableMinutes, ss.result.regularMinutes, ss.result.specialRateMinutes, ss.result.basePayMinor, ss.result.premiumPayMinor, ss.result.fixedBonusesMinor, ss.result.reimbursementsMinor, ss.result.totalGrossPayMinor || null, JSON.stringify(ss.result), ss.result.engineVersion, ss.result.calculatedAt, 0, ss.createdAt]); // is_current = 0 on merge to be safe
        }
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
          DELETE FROM prediction_feedback;
          DELETE FROM salary_calculation_snapshots;
          DELETE FROM break_sessions;
          DELETE FROM recurrence_exceptions;
          DELETE FROM shifts;
          DELETE FROM recurrence_series;
          DELETE FROM shift_templates;
          DELETE FROM pay_rules;
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
    effectiveFrom: row.effective_from, effectiveTo: row.effective_to, isActive: row.is_active === 1,
    isArchived: row.is_archived === 1, createdAt: row.created_at, updatedAt: row.updated_at
  });
  
  private mapPayRule = (row: any) => ({
    id: row.id, salaryProfileId: row.salary_profile_id, name: row.name, priority: row.priority,
    conditions: JSON.parse(row.conditions_json), effect: JSON.parse(row.effect_json),
    canStack: row.can_stack === 1, isEnabled: row.is_enabled === 1, effectiveFrom: row.effective_from,
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
    key: row.key, valueJson: row.value_json, updatedAt: row.updated_at
  });
}
