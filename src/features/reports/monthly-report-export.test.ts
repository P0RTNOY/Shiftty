import type { SalaryCalculationSnapshot } from '@/domain/entities';
import { generateMonthlyReportCsv, generateMonthlyReportPdfHtml } from '@/features/reports/monthly-report-export';
import { buildMonthlyReport } from '@/features/reports/monthly-report-service';
import { createShift } from '@/test/fixtures';

function snapshot(
  shiftId: string,
  totalGrossPayMinor: number,
  specialIntervalEvaluations?: SalaryCalculationSnapshot['result']['specialIntervalEvaluations'],
): SalaryCalculationSnapshot {
  return { id: `snapshot-${shiftId}`, shiftId, version: 1, status: 'finalized', isCurrent: true, result: { totalGrossPayMinor, specialIntervalEvaluations } as SalaryCalculationSnapshot['result'], createdAt: '2026-08-12T10:00:00+03:00' };
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
  const stale = createShift({
    id: 'stale', status: 'completed', salaryCalculationStatus: 'stale',
    actualStart: '2026-08-05T10:00:00+03:00', actualEnd: '2026-08-05T11:00:00+03:00',
    payableStart: '2026-08-05T10:00:00+03:00', payableEnd: '2026-08-05T11:00:00+03:00', payableBreakMinutes: 0,
  });
  const overnight = createShift({
    id: 'overnight', status: 'completed', salaryCalculationStatus: 'finalized',
    actualStart: '2026-08-06T17:20:00+03:00', actualEnd: '2026-08-07T05:20:00+03:00',
    payableStart: '2026-08-06T17:20:00+03:00', payableEnd: '2026-08-07T05:20:00+03:00', payableBreakMinutes: 0,
  });
  const zero = createShift({
    id: 'zero', status: 'completed', salaryCalculationStatus: 'finalized',
    actualStart: '2026-08-08T08:00:00+03:00', actualEnd: '2026-08-08T09:00:00+03:00',
    payableStart: '2026-08-08T08:00:00+03:00', payableEnd: '2026-08-08T09:00:00+03:00', payableBreakMinutes: 0,
  });
  return buildMonthlyReport({
    month: '2026-08', timezone: 'Asia/Jerusalem', generatedAt: '2026-08-12T10:00:00+03:00',
    shifts: [final, missing, stale, overnight, zero], snapshots: [snapshot(final.id, 42_500, [{
      intervalId: 'holiday-evidence',
      type: 'holiday',
      name: '=SUM(A1:A2)',
      start: '2026-08-04T12:00:00+03:00',
      end: '2026-08-04T16:00:00+03:00',
      timezone: 'Asia/Jerusalem',
      sourceKind: 'confirmed_preset',
      sourceTitle: 'Official date source',
      sourceUrl: 'https://example.gov/source?salary=150%25',
      presetId: 'representative-date',
      presetVersion: '1',
      confirmedAt: '2026-08-01T10:00:00+03:00',
      appliedRuleIds: ['holiday-150-rule'],
      contributedToEstimate: true,
    }]), snapshot(stale.id, 99_999), snapshot(overnight.id, 72_000), snapshot(zero.id, 0)],
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
    expect(lines[0]).toContain('שכר ברוטו משוער');
    expect(lines[0]).toContain('הערה על הערכת השכר');
    expect(lines[0]).toContain('קלט מיוחד');
    expect(lines[1]).toContain('חג: =SUM(A1:A2)');
    expect(lines[1]).not.toContain('https://example.gov');
    expect(lines[1]).toContain('סכומי השכר הם הערכות המבוססות על ההגדרות שלך.');
    expect(lines[1]).toContain('ולא קביעה של זכאות משפטית.');
    expect(lines.join('\n').match(/סכומי השכר הם הערכות המבוססות על ההגדרות שלך\./g)).toHaveLength(1);
    const missingLine = lines.find((line) => line.includes('חישוב חסר'))!;
    const staleLine = lines.find((line) => line.includes('חישוב לא מעודכן'))!;
    const zeroLine = lines.find((line) => line.includes('2026-08-08'))!;
    expect(missingLine.split(',')[9]).toBe('');
    expect(staleLine.split(',')[9]).toBe('');
    expect(staleLine).not.toContain('999.99');
    expect(zeroLine).toContain('0.00');
  });

  it('uses honest English estimate terminology and includes the concise CSV note once', () => {
    const csv = generateMonthlyReportCsv(reportFixture(), 'en');

    expect(csv).toContain('Estimated-pay status');
    expect(csv).toContain('Estimated gross pay');
    expect(csv).toContain('Estimated-pay note');
    expect(csv).toContain('Estimated,425.00');
    expect(csv.match(/Pay amounts are estimates based on your settings\./g)).toHaveLength(1);
    expect(csv).toContain('not legal entitlement.');
    expect(csv).not.toContain('Final');
  });

  it('includes the local exit date when a shift crosses midnight', () => {
    const report = reportFixture();
    const csvLines = generateMonthlyReportCsv(report, 'he').replace(/^\uFEFF/, '').trim().split('\r\n');
    const html = generateMonthlyReportPdfHtml(report, 'he');

    expect(csvLines.find((line) => line.includes('2026-08-06'))).toContain('2026-08-07 05:20');
    expect(html).toContain('17:20-2026-08-07 05:20');
  });

  it('generates a readable RTL multipage-safe PDF report with honest salary availability', () => {
    const report = reportFixture();
    const longReport = { ...report, rows: Array.from({ length: 120 }, (_, index) => ({ ...report.rows[index % report.rows.length]!, shiftId: `shift-${index}` })) };
    const html = generateMonthlyReportPdfHtml(longReport, 'he');

    expect(html).toContain('<html dir="rtl" lang="he">');
    expect(html).toContain('אוגוסט 2026');
    expect(html).toContain('שכר ברוטו משוער');
    expect(html).toContain('סה״כ שכר ברוטו משוער');
    expect(html.match(/סכומי השכר הם הערכות המבוססות על ההגדרות שלך\./g)).toHaveLength(1);
    expect(html).toContain('ולא קביעה של זכאות משפטית.');
    expect(html).toContain('לא זמין');
    expect(html).toContain('חישוב לא מעודכן');
    expect(html).not.toContain('999.99');
    expect(html).toContain('08:00-09:00');
    expect(html).toContain('display: table-header-group');
    expect(html).toContain('page-break-inside: avoid');
    expect(html).toContain('חג: =SUM(A1:A2)');
    expect(html).not.toContain('https://example.gov');
    expect((html.match(/<tr>/g) ?? []).length).toBeGreaterThanOrEqual(121);
    expect(html).not.toContain('חתימת עובד');
  });

  it('uses honest English estimate terminology and includes the concise PDF note once', () => {
    const html = generateMonthlyReportPdfHtml(reportFixture(), 'en');

    expect(html).toContain('Estimated-pay status');
    expect(html).toContain('Estimated gross pay');
    expect(html).toContain('Total estimated gross pay');
    expect(html.match(/Pay amounts are estimates based on your settings\./g)).toHaveLength(1);
    expect(html).toContain('not legal entitlement.');
    expect(html).not.toContain('>Final<');
    expect(html).toContain('Holiday: =SUM(A1:A2)');
    expect(html).not.toContain('holiday-150-rule');
  });
});
