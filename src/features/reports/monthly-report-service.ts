import type {
  Role,
  SalaryCalculationSnapshot,
  Shift,
  SpecialIntervalType,
  Workplace,
} from '@/domain/entities';
import type { SalaryCalculationRepository, ShiftRepository, WorkplaceRepository } from '@/domain/repositories';
import { calculateShiftDuration } from '@/domain/services';
import { resolveLocalDateTime } from '@/shared/utils/zoned-time';

export type ReportSalaryStatus = 'available' | 'missing' | 'stale' | 'incomplete';

export interface MonthlyReportRow {
  shiftId: string;
  shift: Shift;
  title?: string;
  workplaceName: string;
  roleName?: string;
  start: string;
  end: string;
  paidMinutes: number;
  breakMinutes: number;
  salaryStatus: ReportSalaryStatus;
  salaryMinor?: number;
  /** Concise labels copied from the immutable salary snapshot, never live evidence rows. */
  specialIntervals: MonthlyReportSpecialInterval[];
}

export interface MonthlyReportSpecialInterval {
  intervalId: string;
  type: SpecialIntervalType;
  name: string;
  contributedToEstimate: boolean;
}

export interface MonthlyReport {
  month: string;
  timezone: string;
  generatedAt: string;
  range: { start: string; end: string };
  rows: MonthlyReportRow[];
  totals: {
    shiftCount: number;
    paidMinutes: number;
    breakMinutes: number;
    availableSalaryMinor: number;
    salaryMinor?: number;
    salaryIssueCount: number;
    invalidShiftCount: number;
  };
}

interface MonthlyReportInput {
  month: string;
  timezone: string;
  generatedAt: string;
  shifts: readonly Shift[];
  snapshots: readonly SalaryCalculationSnapshot[];
  workplaces: readonly Pick<Workplace, 'id' | 'name'>[];
  roles: readonly Pick<Role, 'id' | 'name'>[];
}

export function createMonthlyReportRange(month: string, timezone: string): { start: string; end: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error('A report month must use YYYY-MM.');
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error('A report month must use YYYY-MM.');
  const next = new Date(Date.UTC(year, monthIndex + 1, 1));
  const nextMonth = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
  return {
    start: resolveLocalDateTime(`${month}-01`, '00:00', timezone),
    end: resolveLocalDateTime(nextMonth, '00:00', timezone),
  };
}

export function buildMonthlyReport(input: MonthlyReportInput): MonthlyReport {
  const range = createMonthlyReportRange(input.month, input.timezone);
  const rangeStart = Date.parse(range.start);
  const rangeEnd = Date.parse(range.end);
  const snapshots = new Map(input.snapshots.filter((snapshot) => snapshot.isCurrent).map((snapshot) => [snapshot.shiftId, snapshot]));
  const workplaceNames = new Map(input.workplaces.map((workplace) => [workplace.id, workplace.name]));
  const roleNames = new Map(input.roles.map((role) => [role.id, role.name]));
  const rows: MonthlyReportRow[] = [];
  let invalidShiftCount = 0;

  for (const shift of input.shifts) {
    if (shift.status !== 'completed') continue;
    const start = shift.payableStart ?? shift.actualStart;
    const end = shift.payableEnd ?? shift.actualEnd;
    if (!start || !end) { invalidShiftCount += 1; continue; }
    const actualEndTime = shift.actualEnd ? Date.parse(shift.actualEnd) : Number.NaN;
    if (!Number.isFinite(actualEndTime)) { invalidShiftCount += 1; continue; }
    if (actualEndTime < rangeStart || actualEndTime >= rangeEnd) continue;

    let paidMinutes: number;
    try {
      const duration = calculateShiftDuration(shift, shift.payableStart ? 'payable' : 'actual');
      if (!duration) throw new Error('Missing report duration.');
      paidMinutes = duration.paidMinutes;
    } catch {
      invalidShiftCount += 1;
      continue;
    }

    const snapshot = snapshots.get(shift.id);
    const salaryStatus = resolveSalaryStatus(shift, snapshot);
    rows.push({
      shiftId: shift.id,
      shift,
      title: shift.title,
      workplaceName: workplaceNames.get(shift.workplaceId) ?? '—',
      roleName: shift.roleId ? roleNames.get(shift.roleId) : undefined,
      start,
      end,
      paidMinutes,
      breakMinutes: shift.payableBreakMinutes ?? shift.actualBreakMinutes ?? 0,
      salaryStatus,
      salaryMinor: salaryStatus === 'available' ? snapshot!.result.totalGrossPayMinor : undefined,
      specialIntervals: resolveSpecialIntervals(snapshot),
    });
  }

  rows.sort((left, right) => left.start.localeCompare(right.start) || left.shiftId.localeCompare(right.shiftId));
  const paidMinutes = rows.reduce((sum, row) => sum + row.paidMinutes, 0);
  const breakMinutes = rows.reduce((sum, row) => sum + row.breakMinutes, 0);
  const availableSalaryMinor = rows.reduce((sum, row) => sum + (row.salaryMinor ?? 0), 0);
  const salaryIssueCount = rows.filter((row) => row.salaryStatus !== 'available').length;

  return {
    month: input.month,
    timezone: input.timezone,
    generatedAt: input.generatedAt,
    range,
    rows,
    totals: {
      shiftCount: rows.length,
      paidMinutes,
      breakMinutes,
      availableSalaryMinor,
      salaryMinor: salaryIssueCount === 0 ? availableSalaryMinor : undefined,
      salaryIssueCount,
      invalidShiftCount,
    },
  };
}

function resolveSpecialIntervals(
  snapshot: SalaryCalculationSnapshot | undefined,
): MonthlyReportSpecialInterval[] {
  return [...(snapshot?.result.specialIntervalEvaluations ?? [])]
    .sort((left, right) => (
      left.start.localeCompare(right.start)
      || left.type.localeCompare(right.type)
      || left.intervalId.localeCompare(right.intervalId)
    ))
    .map((evaluation) => ({
      intervalId: evaluation.intervalId,
      type: evaluation.type,
      name: evaluation.name,
      contributedToEstimate: evaluation.contributedToEstimate,
    }));
}

interface MonthlyReportRepositories {
  shifts: ShiftRepository;
  workplaces: WorkplaceRepository;
  salaryCalculations: SalaryCalculationRepository;
}

export class MonthlyReportService {
  constructor(private readonly repositories: MonthlyReportRepositories) {}

  async load(month: string, timezone: string, generatedAt = new Date().toISOString()): Promise<MonthlyReport> {
    const range = createMonthlyReportRange(month, timezone);
    const instantBeforeRange = new Date(Date.parse(range.start) - 1).toISOString();
    const shifts = await this.repositories.shifts.list({
      startsBefore: range.end,
      endsAfter: instantBeforeRange,
      statuses: ['completed'],
      rangeSource: 'display',
    });
    const [snapshots, workplaces] = await Promise.all([
      this.repositories.salaryCalculations.listCurrentForShifts(shifts.map((shift) => shift.id)),
      this.repositories.workplaces.list(),
    ]);
    const roles = (await Promise.all(workplaces.map((workplace) => this.repositories.workplaces.listRoles(workplace.id)))).flat();
    return buildMonthlyReport({ month, timezone, generatedAt, shifts, snapshots, workplaces, roles });
  }
}

function resolveSalaryStatus(shift: Shift, snapshot: SalaryCalculationSnapshot | undefined): ReportSalaryStatus {
  if (shift.salaryCalculationStatus === 'stale') return 'stale';
  if (shift.salaryCalculationStatus === 'incomplete' || snapshot?.status === 'incomplete') return 'incomplete';
  if (shift.salaryCalculationStatus !== 'finalized' || snapshot?.status !== 'finalized' || snapshot.result.totalGrossPayMinor === undefined) return 'missing';
  return 'available';
}
