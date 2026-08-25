import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';

import {
  calendarEvidenceIntervalSchema,
  weeklyRestScheduleSchema,
  type CalendarEvidenceInterval,
  type WeeklyRestSchedule,
} from '@/domain/entities';
import type {
  CalendarEvidenceIntervalRepository,
  EvidenceOverlapQuery,
  EvidenceScopeQuery,
  WeeklyRestScheduleRepository,
} from '@/domain/repositories';
import { resolveWeeklyRestOccurrences } from '@/domain/services/weekly-rest-occurrence-service';

interface EvidenceRow {
  id: string;
  schedule_id: string | null;
  workplace_id: string;
  salary_profile_id: string | null;
  interval_type: CalendarEvidenceInterval['type'];
  name: string;
  start_at: string;
  end_at: string;
  timezone: string;
  source_kind: CalendarEvidenceInterval['sourceKind'];
  source_title: string | null;
  source_url: string | null;
  preset_id: string | null;
  preset_version: string | null;
  confirmed_at: string;
  is_archived: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ScheduleRow {
  id: string;
  workplace_id: string;
  salary_profile_id: string;
  label: string;
  start_weekday: number;
  start_time: string;
  end_weekday: number;
  end_time: string;
  enabled: number;
  confirmed_at: string | null;
  source_kind: WeeklyRestSchedule['sourceKind'];
  source_title: string | null;
  source_url: string | null;
  preset_id: string | null;
  preset_version: string | null;
  is_archived: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ScheduleCandidateRow {
  id: string;
  payable_start: string | null;
  actual_start: string | null;
  scheduled_start: string | null;
  payable_end: string | null;
  actual_end: string | null;
  scheduled_end: string | null;
  result_json: string;
  timezone: string;
}

export class SqliteCalendarEvidenceIntervalRepository implements CalendarEvidenceIntervalRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async save(input: CalendarEvidenceInterval): Promise<void> {
    const interval = calendarEvidenceIntervalSchema.parse(input);
    await this.database.runAsync(
      `INSERT INTO calendar_evidence_intervals (
        id, schedule_id, workplace_id, salary_profile_id, interval_type, name, start_at, end_at, timezone,
        source_kind, source_title, source_url, preset_id, preset_version, confirmed_at,
        is_archived, archived_at, created_at, updated_at
      ) VALUES (${Array.from({ length: 19 }, () => '?').join(', ')})
      ON CONFLICT(id) DO UPDATE SET workplace_id=excluded.workplace_id,
        schedule_id=excluded.schedule_id, salary_profile_id=excluded.salary_profile_id,
        interval_type=excluded.interval_type,
        name=excluded.name, start_at=excluded.start_at, end_at=excluded.end_at,
        timezone=excluded.timezone, source_kind=excluded.source_kind,
        source_title=excluded.source_title, source_url=excluded.source_url,
        preset_id=excluded.preset_id, preset_version=excluded.preset_version,
        confirmed_at=excluded.confirmed_at, is_archived=excluded.is_archived,
        archived_at=excluded.archived_at, updated_at=excluded.updated_at;`,
      ...toEvidenceParams(interval),
    );
  }

  async getById(id: string): Promise<CalendarEvidenceInterval | null> {
    const row = await this.database.getFirstAsync<EvidenceRow>(
      'SELECT * FROM calendar_evidence_intervals WHERE id = ?;',
      id,
    );
    return row ? mapEvidenceRow(row) : null;
  }

  async listForScope(query: EvidenceScopeQuery): Promise<CalendarEvidenceInterval[]> {
    const { clause, parameters } = evidenceScopeClause(query);
    const rows = await this.database.getAllAsync<EvidenceRow>(
      `SELECT * FROM calendar_evidence_intervals WHERE ${clause}
       ORDER BY julianday(start_at), julianday(end_at), id;`,
      ...parameters,
    );
    return rows.map(mapEvidenceRow);
  }

  async listOverlapping(query: EvidenceOverlapQuery): Promise<CalendarEvidenceInterval[]> {
    const start = Date.parse(query.start);
    const end = Date.parse(query.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error('Evidence overlap range end must be after its start.');
    }
    const { clause, parameters } = evidenceScopeClause(query);
    const rows = await this.database.getAllAsync<EvidenceRow>(
      `SELECT * FROM calendar_evidence_intervals WHERE ${clause}
         AND julianday(start_at) < julianday(?) AND julianday(end_at) > julianday(?)
       ORDER BY julianday(start_at), julianday(end_at), interval_type, id;`,
      ...parameters,
      query.end,
      query.start,
    );
    return rows.map(mapEvidenceRow);
  }

  async archive(id: string, archivedAt: string): Promise<void> {
    const current = await this.getById(id);
    if (!current) return;
    await this.save({ ...current, isArchived: true, archivedAt, updatedAt: archivedAt });
  }

  async delete(id: string): Promise<void> {
    await this.database.runAsync('DELETE FROM calendar_evidence_intervals WHERE id = ?;', id);
  }
}

export class SqliteWeeklyRestScheduleRepository implements WeeklyRestScheduleRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  async save(input: WeeklyRestSchedule): Promise<void> {
    const schedule = weeklyRestScheduleSchema.parse(input);
    await this.database.withTransactionAsync(async () => {
      const previous = await this.getById(schedule.id);
      const staleIds = await this.resolveStaleShiftIds([previous, schedule]);
      await this.database.runAsync(
        `INSERT INTO weekly_rest_schedules (
          id, workplace_id, salary_profile_id, label, start_weekday, start_time, end_weekday,
          end_time, enabled, confirmed_at, source_kind, source_title, source_url, preset_id,
          preset_version, is_archived, archived_at, created_at, updated_at
        ) VALUES (${Array.from({ length: 19 }, () => '?').join(', ')})
        ON CONFLICT(id) DO UPDATE SET workplace_id=excluded.workplace_id,
          salary_profile_id=excluded.salary_profile_id, label=excluded.label,
          start_weekday=excluded.start_weekday, start_time=excluded.start_time,
          end_weekday=excluded.end_weekday, end_time=excluded.end_time,
          enabled=excluded.enabled, confirmed_at=excluded.confirmed_at,
          source_kind=excluded.source_kind, source_title=excluded.source_title,
          source_url=excluded.source_url, preset_id=excluded.preset_id,
          preset_version=excluded.preset_version, is_archived=excluded.is_archived,
          archived_at=excluded.archived_at, updated_at=excluded.updated_at;`,
        ...toScheduleParams(schedule),
      );
      await markStaleMany(this.database, staleIds);
    });
  }

  async getById(id: string): Promise<WeeklyRestSchedule | null> {
    const row = await this.database.getFirstAsync<ScheduleRow>(
      'SELECT * FROM weekly_rest_schedules WHERE id = ?;',
      id,
    );
    return row ? mapScheduleRow(row) : null;
  }

  async getForProfile(profileId: string): Promise<WeeklyRestSchedule | null> {
    const row = await this.database.getFirstAsync<ScheduleRow>(
      'SELECT * FROM weekly_rest_schedules WHERE salary_profile_id = ? LIMIT 1;',
      profileId,
    );
    return row ? mapScheduleRow(row) : null;
  }

  async listForWorkplace(workplaceId: string, includeArchived = false): Promise<WeeklyRestSchedule[]> {
    const rows = await this.database.getAllAsync<ScheduleRow>(
      `SELECT * FROM weekly_rest_schedules WHERE workplace_id = ? ${includeArchived ? '' : 'AND is_archived = 0'}
       ORDER BY created_at, id;`,
      workplaceId,
    );
    return rows.map(mapScheduleRow);
  }

  async archive(id: string, archivedAt: string): Promise<void> {
    const current = await this.getById(id);
    if (!current) return;
    await this.save({ ...current, enabled: false, isArchived: true, archivedAt, updatedAt: archivedAt });
  }

  async delete(id: string): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      const previous = await this.getById(id);
      if (!previous) return;
      const staleIds = await this.resolveStaleShiftIds([previous]);
      await this.database.runAsync('DELETE FROM weekly_rest_schedules WHERE id = ?;', id);
      await markStaleMany(this.database, staleIds);
    });
  }

  private async resolveStaleShiftIds(
    schedules: readonly (WeeklyRestSchedule | null)[],
  ): Promise<Set<string>> {
    const staleIds = new Set<string>();
    for (const schedule of schedules) {
      if (!schedule) continue;
      const candidates = await this.database.getAllAsync<ScheduleCandidateRow>(
        `SELECT shift_record.id, shift_record.payable_start, shift_record.actual_start,
          shift_record.scheduled_start, shift_record.payable_end, shift_record.actual_end,
          shift_record.scheduled_end, snapshot.result_json, profile.timezone
         FROM shifts shift_record
         JOIN salary_calculation_snapshots snapshot
           ON snapshot.shift_id = shift_record.id AND snapshot.is_current = 1
           AND snapshot.status = 'finalized' AND snapshot.salary_profile_id = ?
         JOIN salary_profiles profile ON profile.id = snapshot.salary_profile_id
         WHERE shift_record.status = 'completed'
           AND shift_record.salary_calculation_status = 'finalized'
           AND shift_record.workplace_id = ?;`,
        schedule.salaryProfileId,
        schedule.workplaceId,
      );
      for (const candidate of candidates) {
        if (snapshotReferencesSchedule(candidate.result_json, schedule.id)) {
          staleIds.add(candidate.id);
          continue;
        }
        const start = candidate.payable_start ?? candidate.actual_start ?? candidate.scheduled_start;
        const end = candidate.payable_end ?? candidate.actual_end ?? candidate.scheduled_end;
        if (!start || !end) continue;
        if (resolveWeeklyRestOccurrences(schedule, start, end, candidate.timezone).length > 0) {
          staleIds.add(candidate.id);
        }
      }
    }
    return staleIds;
  }
}

function evidenceScopeClause(query: EvidenceScopeQuery): {
  clause: string;
  parameters: SQLiteBindValue[];
} {
  const archived = query.includeArchived ? '' : ' AND is_archived = 0';
  if (query.salaryProfileId) {
    return {
      clause: `workplace_id = ? AND (salary_profile_id IS NULL OR salary_profile_id = ?)${archived}`,
      parameters: [query.workplaceId, query.salaryProfileId],
    };
  }
  return {
    clause: `workplace_id = ? AND salary_profile_id IS NULL${archived}`,
    parameters: [query.workplaceId],
  };
}

function toEvidenceParams(interval: CalendarEvidenceInterval): SQLiteBindValue[] {
  return [
    interval.id, interval.scheduleId ?? null, interval.workplaceId,
    interval.salaryProfileId ?? null, interval.type,
    interval.name, interval.start, interval.end, interval.timezone, interval.sourceKind,
    interval.sourceTitle ?? null, interval.sourceUrl ?? null, interval.presetId ?? null,
    interval.presetVersion ?? null, interval.confirmedAt, interval.isArchived ? 1 : 0,
    interval.archivedAt ?? null, interval.createdAt, interval.updatedAt,
  ];
}

function toScheduleParams(schedule: WeeklyRestSchedule): SQLiteBindValue[] {
  return [
    schedule.id, schedule.workplaceId, schedule.salaryProfileId, schedule.label,
    schedule.startWeekday, schedule.startTime, schedule.endWeekday, schedule.endTime,
    schedule.enabled ? 1 : 0, schedule.confirmedAt ?? null, schedule.sourceKind,
    schedule.sourceTitle ?? null, schedule.sourceUrl ?? null, schedule.presetId ?? null,
    schedule.presetVersion ?? null, schedule.isArchived ? 1 : 0, schedule.archivedAt ?? null,
    schedule.createdAt, schedule.updatedAt,
  ];
}

function mapEvidenceRow(row: EvidenceRow): CalendarEvidenceInterval {
  return calendarEvidenceIntervalSchema.parse({
    id: row.id, scheduleId: row.schedule_id ?? undefined, workplaceId: row.workplace_id,
    salaryProfileId: row.salary_profile_id ?? undefined, type: row.interval_type,
    name: row.name, start: row.start_at, end: row.end_at, timezone: row.timezone,
    sourceKind: row.source_kind, sourceTitle: row.source_title ?? undefined,
    sourceUrl: row.source_url ?? undefined, presetId: row.preset_id ?? undefined,
    presetVersion: row.preset_version ?? undefined, confirmedAt: row.confirmed_at,
    isArchived: row.is_archived === 1, archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  });
}

function mapScheduleRow(row: ScheduleRow): WeeklyRestSchedule {
  return weeklyRestScheduleSchema.parse({
    id: row.id, workplaceId: row.workplace_id, salaryProfileId: row.salary_profile_id,
    label: row.label, startWeekday: row.start_weekday, startTime: row.start_time,
    endWeekday: row.end_weekday, endTime: row.end_time, enabled: row.enabled === 1,
    confirmedAt: row.confirmed_at ?? undefined, sourceKind: row.source_kind,
    sourceTitle: row.source_title ?? undefined, sourceUrl: row.source_url ?? undefined,
    presetId: row.preset_id ?? undefined, presetVersion: row.preset_version ?? undefined,
    isArchived: row.is_archived === 1, archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  });
}

function snapshotReferencesSchedule(resultJson: string, scheduleId: string): boolean {
  try {
    const result = JSON.parse(resultJson) as {
      specialIntervalEvaluations?: readonly { scheduleId?: string }[];
    };
    return result.specialIntervalEvaluations?.some((item) => item.scheduleId === scheduleId) ?? false;
  } catch {
    return false;
  }
}

async function markStaleMany(database: SQLiteDatabase, shiftIds: ReadonlySet<string>): Promise<void> {
  if (!shiftIds.size) return;
  const values = [...shiftIds];
  await database.runAsync(
    `UPDATE shifts SET salary_calculation_status = 'stale'
     WHERE salary_calculation_status = 'finalized'
       AND id IN (${values.map(() => '?').join(', ')});`,
    ...(values as SQLiteBindValue[]),
  );
}
