import type { SalaryCalculationSnapshot } from '@/domain/entities';
import { generateMonthlyReportCsv, generateMonthlyReportPdfHtml } from '@/features/reports/monthly-report-export';
import { buildMonthlyReport } from '@/features/reports/monthly-report-service';
import { createShift } from '@/test/fixtures';

function snapshot(shiftId: string, totalGrossPayMinor: number): SalaryCalculationSnapshot {
  return { id: `snapshot-${shiftId}`, shiftId, version: 1, status: 'finalized', isCurrent: true, result: { totalGrossPayMinor } as SalaryCalculationSnapshot['result'], createdAt: '2026-08-12T10:00:00+03:00' };
}

function reportFixture() {
  const final = createShift({
    id: 'final', title: '=SUM(A1:A2)', status: 'completed', salaryCalculationStatus: 'finalized',
    actualStart: '2026-08-04T10:30:00+03:00', actualEnd: '2026-08-04T19:00:00+03:00',
    payableStart: '2026-08-04T10:30:00+03:00', payableEnd: '2026-08-04T19:00:00+03:00', payableBreakMinutes: 30,
  });
  const missing = createShift({
    id: 'missing', status: 'completed', salaryCalculationStatus: 'not_calculated',
    actualStart: '2026-08-05T08:00:00+03:00', actualEnd: '2026-08-05T09:00:00+03:00',
    payableStart: '2026-08-05T08:00:00+03:00', payableEnd: '2026-08-05T09:00:00+03:00', payableBreakMinutes: 0,
  });
  return buildMonthlyReport({
    month: '2026-08', timezone: 'Asia/Jerusalem', generatedAt: '2026-08-12T10:00:00+03:00',
    shifts: [final, missing], snapshots: [snapshot(final.id, 42_500)],
    workplaces: [{ id: 'workplace-1', name: 'קפה' } as never], roles: [],
  });
}

describe('monthly report exports', () => {
  it('generates an Excel-safe Hebrew CSV with local values and an empty missing-salary cell', () => {
    const lines = generateMonthlyReportCsv(reportFixture(), 'he').replace(/^\uFEFF/, '').trim().split('\r\n');

    expect(lines[0]).toContain('תאריך');
    expect(lines[1]).toContain("'=SUM(A1:A2)");
    expect(lines[1]).toContain('2026-08-04');
    expect(lines[1]).toContain('10:30');
    expect(lines[1]).toContain('425.00');
    expect(lines[2]).toContain('חישוב חסר');
    expect(lines[2]!.endsWith(',')).toBe(true);
  });

  it('generates a readable RTL multipage-safe PDF report with honest salary availability', () => {
    const report = reportFixture();
    const longReport = { ...report, rows: Array.from({ length: 120 }, (_, index) => ({ ...report.rows[index % report.rows.length]!, shiftId: `shift-${index}` })) };
    const html = generateMonthlyReportPdfHtml(longReport, 'he');

    expect(html).toContain('<html dir="rtl" lang="he">');
    expect(html).toContain('אוגוסט 2026');
    expect(html).toContain('לא זמין');
    expect(html).toContain('08:00-09:00');
    expect(html).toContain('display: table-header-group');
    expect(html).toContain('page-break-inside: avoid');
    expect((html.match(/<tr>/g) ?? []).length).toBeGreaterThanOrEqual(121);
    expect(html).not.toContain('חתימת עובד');
  });
});
