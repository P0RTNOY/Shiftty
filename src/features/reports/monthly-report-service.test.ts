import type { SalaryCalculationSnapshot } from '@/domain/entities';
import { buildMonthlyReport, createMonthlyReportRange, MonthlyReportService } from '@/features/reports/monthly-report-service';
import { createShift } from '@/test/fixtures';

const workplace = { id: 'workplace-1', name: 'קפה' } as const;

function finalizedSnapshot(
  shiftId: string,
  totalGrossPayMinor: number,
  specialIntervalEvaluations?: SalaryCalculationSnapshot['result']['specialIntervalEvaluations'],
): SalaryCalculationSnapshot {
  return {
    id: `snapshot-${shiftId}`,
    shiftId,
    version: 1,
    status: 'finalized',
    isCurrent: true,
    result: { totalGrossPayMinor, specialIntervalEvaluations } as SalaryCalculationSnapshot['result'],
    createdAt: '2026-08-05T12:00:00+03:00',
  };
}

describe('monthly report model', () => {
  it('uses completed shifts in the selected app-timezone month and authoritative finalized snapshots', () => {
    const completed = createShift({
      id: 'august-shift',
      title: 'משמרת ערב',
      status: 'completed',
      actualStart: '2026-08-04T10:30:00+03:00',
      actualEnd: '2026-08-04T19:00:00+03:00',
      payableStart: '2026-08-04T10:30:00+03:00',
      payableEnd: '2026-08-04T19:00:00+03:00',
      payableBreakMinutes: 30,
      salaryCalculationStatus: 'finalized',
    });
    const scheduled = createShift({ id: 'scheduled', scheduledStart: '2026-08-12T08:00:00+03:00', scheduledEnd: '2026-08-12T16:00:00+03:00' });
    const july = createShift({
      id: 'july-shift',
      status: 'completed',
      actualStart: '2026-07-30T08:00:00+03:00',
      actualEnd: '2026-07-30T16:00:00+03:00',
      salaryCalculationStatus: 'finalized',
    });

    const report = buildMonthlyReport({
      month: '2026-08',
      timezone: 'Asia/Jerusalem',
      generatedAt: '2026-08-12T10:00:00+03:00',
      shifts: [scheduled, july, completed],
      snapshots: [finalizedSnapshot(completed.id, 42_500), finalizedSnapshot(july.id, 40_000)],
      workplaces: [workplace],
      roles: [],
    });

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      shiftId: 'august-shift',
      workplaceName: 'קפה',
      paidMinutes: 480,
      breakMinutes: 30,
      salaryStatus: 'available',
      salaryMinor: 42_500,
    });
    expect(report.totals).toMatchObject({ shiftCount: 1, paidMinutes: 480, breakMinutes: 30, salaryMinor: 42_500, salaryIssueCount: 0 });
  });

  it('never turns stale, incomplete, or missing salary into zero while preserving a legitimate finalized zero', () => {
    const base = {
      status: 'completed' as const,
      actualStart: '2026-08-05T08:00:00+03:00',
      actualEnd: '2026-08-05T09:00:00+03:00',
      payableStart: '2026-08-05T08:00:00+03:00',
      payableEnd: '2026-08-05T09:00:00+03:00',
    };
    const stale = createShift({ ...base, id: 'stale', salaryCalculationStatus: 'stale' });
    const incomplete = createShift({ ...base, id: 'incomplete', salaryCalculationStatus: 'incomplete' });
    const missing = createShift({ ...base, id: 'missing', salaryCalculationStatus: 'finalized' });
    const free = createShift({ ...base, id: 'free', salaryCalculationStatus: 'finalized' });

    const frozenEvidence: NonNullable<SalaryCalculationSnapshot['result']['specialIntervalEvaluations']> = [{
      intervalId: 'frozen-holiday',
      type: 'holiday',
      name: 'Frozen holiday',
      start: '2026-08-05T08:00:00+03:00',
      end: '2026-08-05T09:00:00+03:00',
      timezone: 'Asia/Jerusalem',
      sourceKind: 'manual',
      confirmedAt: '2026-08-01T10:00:00+03:00',
      appliedRuleIds: ['holiday-rule'],
      contributedToEstimate: true,
    }];
    const report = buildMonthlyReport({
      month: '2026-08', timezone: 'Asia/Jerusalem', generatedAt: '2026-08-12T10:00:00+03:00',
      shifts: [stale, incomplete, missing, free],
      snapshots: [finalizedSnapshot(stale.id, 9_999, frozenEvidence), finalizedSnapshot(free.id, 0, frozenEvidence)],
      workplaces: [workplace], roles: [],
    });

    expect(Object.fromEntries(report.rows.map((row) => [row.shiftId, [row.salaryStatus, row.salaryMinor]]))).toEqual({
      stale: ['stale', undefined],
      incomplete: ['incomplete', undefined],
      missing: ['missing', undefined],
      free: ['available', 0],
    });
    expect(report.totals.salaryMinor).toBeUndefined();
    expect(report.totals.availableSalaryMinor).toBe(0);
    expect(report.totals.salaryIssueCount).toBe(3);
    expect(report.rows.find((row) => row.shiftId === 'stale')?.specialIntervals).toEqual([
      { intervalId: 'frozen-holiday', type: 'holiday', name: 'Frozen holiday', contributedToEstimate: true },
    ]);
    expect(report.rows.find((row) => row.shiftId === 'free')?.specialIntervals).toEqual([
      { intervalId: 'frozen-holiday', type: 'holiday', name: 'Frozen holiday', contributedToEstimate: true },
    ]);
  });

  it('uses concise evidence labels frozen in the snapshot without querying live evidence', () => {
    const completed = createShift({
      id: 'evidence-shift',
      status: 'completed',
      actualStart: '2026-08-05T08:00:00+03:00',
      actualEnd: '2026-08-05T12:00:00+03:00',
      payableStart: '2026-08-05T08:00:00+03:00',
      payableEnd: '2026-08-05T12:00:00+03:00',
      salaryCalculationStatus: 'finalized',
    });
    const evaluations: NonNullable<SalaryCalculationSnapshot['result']['specialIntervalEvaluations']> = [
      {
        intervalId: 'manual-holiday',
        type: 'holiday',
        name: 'User holiday',
        start: '2026-08-05T09:00:00+03:00',
        end: '2026-08-05T11:00:00+03:00',
        timezone: 'Asia/Jerusalem',
        sourceKind: 'manual',
        confirmedAt: '2026-08-01T10:00:00+03:00',
        appliedRuleIds: ['holiday-rule'],
        contributedToEstimate: true,
      },
      {
        intervalId: 'custom-no-rule',
        type: 'custom',
        name: 'Confirmed marker only',
        start: '2026-08-05T10:00:00+03:00',
        end: '2026-08-05T10:30:00+03:00',
        timezone: 'Asia/Jerusalem',
        sourceKind: 'imported',
        confirmedAt: '2026-08-01T10:00:00+03:00',
        appliedRuleIds: [],
        contributedToEstimate: false,
      },
    ];

    const report = buildMonthlyReport({
      month: '2026-08',
      timezone: 'Asia/Jerusalem',
      generatedAt: '2026-08-12T10:00:00+03:00',
      shifts: [completed],
      snapshots: [finalizedSnapshot(completed.id, 30_000, evaluations)],
      workplaces: [workplace],
      roles: [],
    });

    expect(report.rows[0]?.specialIntervals).toEqual([
      { intervalId: 'manual-holiday', type: 'holiday', name: 'User holiday', contributedToEstimate: true },
      { intervalId: 'custom-no-rule', type: 'custom', name: 'Confirmed marker only', contributedToEstimate: false },
    ]);
    expect(report.rows).toHaveLength(1);
  });

  it('assigns a cross-month shift to the month of its actual clock-out', () => {
    const endingAtAugustStart = createShift({
      id: 'august-boundary',
      status: 'completed',
      actualStart: '2026-07-31T23:00:00+03:00',
      actualEnd: '2026-08-01T00:00:00+03:00',
      payableStart: '2026-07-31T23:00:00+03:00',
      payableEnd: '2026-08-01T00:00:00+03:00',
      salaryCalculationStatus: 'finalized',
    });
    const crossingIntoAugust = createShift({
      id: 'into-august',
      status: 'completed',
      actualStart: '2026-07-31T23:30:00+03:00',
      actualEnd: '2026-08-01T00:30:00+03:00',
      payableStart: '2026-07-31T23:30:00+03:00',
      payableEnd: '2026-08-01T00:30:00+03:00',
      salaryCalculationStatus: 'finalized',
    });
    const crossingOutOfAugust = createShift({
      id: 'out-of-august',
      status: 'completed',
      actualStart: '2026-08-31T23:30:00+03:00',
      actualEnd: '2026-09-01T00:30:00+03:00',
      payableStart: '2026-08-31T23:30:00+03:00',
      payableEnd: '2026-09-01T00:30:00+03:00',
      salaryCalculationStatus: 'finalized',
    });
    const input = {
      timezone: 'Asia/Jerusalem',
      generatedAt: '2026-09-02T10:00:00+03:00',
      shifts: [endingAtAugustStart, crossingIntoAugust, crossingOutOfAugust],
      snapshots: [finalizedSnapshot(endingAtAugustStart.id, 4_000), finalizedSnapshot(crossingIntoAugust.id, 5_000), finalizedSnapshot(crossingOutOfAugust.id, 6_000)],
      workplaces: [workplace],
      roles: [],
    };

    expect(buildMonthlyReport({ ...input, month: '2026-08' }).rows.map((row) => row.shiftId)).toEqual(['august-boundary', 'into-august']);
    expect(buildMonthlyReport({ ...input, month: '2026-09' }).rows.map((row) => row.shiftId)).toEqual(['out-of-august']);
  });

  it('derives daylight-saving-safe month bounds in the configured timezone', () => {
    expect(createMonthlyReportRange('2026-03', 'Asia/Jerusalem')).toEqual({
      start: '2026-03-01T00:00:00.000+02:00',
      end: '2026-04-01T00:00:00.000+03:00',
    });
  });

  it('loads candidates by their actual display range before applying clock-out inclusion', async () => {
    const list = jest.fn().mockResolvedValue([]);
    const service = new MonthlyReportService({
      shifts: { list } as never,
      salaryCalculations: { listCurrentForShifts: jest.fn().mockResolvedValue([]) } as never,
      workplaces: { list: jest.fn().mockResolvedValue([]), listRoles: jest.fn().mockResolvedValue([]) } as never,
    });

    await service.load('2026-08', 'Asia/Jerusalem', '2026-09-02T10:00:00+03:00');

    expect(list).toHaveBeenCalledWith({
      startsBefore: '2026-09-01T00:00:00.000+03:00',
      endsAfter: '2026-07-31T20:59:59.999Z',
      statuses: ['completed'],
      rangeSource: 'display',
    });
  });
});
