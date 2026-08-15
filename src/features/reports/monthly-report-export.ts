import { generateCsv } from '@/domain/services/csv-generator';
import { generatePdfHtml } from '@/domain/services/pdf-html-generator';
import type { MonthlyReport, ReportSalaryStatus } from '@/features/reports/monthly-report-service';
import { formatMonth, formatTime, type DateTimeLocale } from '@/shared/utils/date-time-format';
import { formatLocalDateKey } from '@/shared/utils/zoned-time';

const copy = {
  he: {
    title: 'דוח משמרות', date: 'תאריך', start: 'כניסה', end: 'יציאה', duration: 'שעות בתשלום', breaks: 'הפסקות', workplace: 'מקום עבודה', role: 'תפקיד', shift: 'משמרת', salaryStatus: 'מצב שכר', salary: 'שכר ברוטו', shifts: 'משמרות', totalHours: 'סה״כ שעות בתשלום', totalBreaks: 'סה״כ הפסקות', totalSalary: 'סה״כ שכר ברוטו', unavailable: 'לא זמין', generated: 'הופק',
    statuses: { available: 'סופי', missing: 'חישוב חסר', stale: 'חישוב לא מעודכן', incomplete: 'חישוב לא שלם' },
  },
  en: {
    title: 'Shift report', date: 'Date', start: 'Start', end: 'End', duration: 'Paid hours', breaks: 'Breaks', workplace: 'Workplace', role: 'Role', shift: 'Shift', salaryStatus: 'Salary status', salary: 'Gross salary', shifts: 'Shifts', totalHours: 'Total paid hours', totalBreaks: 'Total breaks', totalSalary: 'Total gross salary', unavailable: 'Unavailable', generated: 'Generated',
    statuses: { available: 'Final', missing: 'Missing calculation', stale: 'Outdated calculation', incomplete: 'Incomplete calculation' },
  },
} as const;

export function generateMonthlyReportCsv(report: MonthlyReport, locale: DateTimeLocale): string {
  const labels = copy[locale];
  return generateCsv({
    columns: [
      { key: 'date', header: labels.date },
      { key: 'start', header: labels.start },
      { key: 'end', header: labels.end },
      { key: 'duration', header: labels.duration },
      { key: 'breaks', header: labels.breaks },
      { key: 'workplace', header: labels.workplace, isUserText: true },
      { key: 'role', header: labels.role, isUserText: true },
      { key: 'title', header: labels.shift, isUserText: true },
      { key: 'salaryStatus', header: labels.salaryStatus },
      { key: 'salary', header: labels.salary },
    ],
    rows: report.rows.map((row) => ({
      date: formatLocalDateKey(row.start, report.timezone),
      start: formatTime(row.start, locale, report.timezone),
      end: formatExit(row.start, row.end, locale, report.timezone),
      duration: formatMinutes(row.paidMinutes),
      breaks: formatMinutes(row.breakMinutes),
      workplace: row.workplaceName,
      role: row.roleName ?? '',
      title: row.title ?? labels.shift,
      salaryStatus: labels.statuses[row.salaryStatus],
      salary: row.salaryMinor === undefined ? undefined : (row.salaryMinor / 100).toFixed(2),
    })),
  });
}

export function generateMonthlyReportPdfHtml(report: MonthlyReport, locale: DateTimeLocale): string {
  const labels = copy[locale];
  const salaryTotal = report.totals.salaryMinor === undefined
    ? `${labels.unavailable} (${report.totals.salaryIssueCount})`
    : formatCurrency(report.totals.salaryMinor, locale);
  return generatePdfHtml({
    title: labels.title,
    subtitle: `${formatMonth(report.month, locale)} · ${labels.generated} ${formatDateTime(report.generatedAt, locale, report.timezone)}`,
    direction: locale === 'he' ? 'rtl' : 'ltr',
    language: locale,
    totals: [
      { label: labels.shifts, value: String(report.totals.shiftCount) },
      { label: labels.totalHours, value: formatMinutes(report.totals.paidMinutes) },
      { label: labels.totalBreaks, value: formatMinutes(report.totals.breakMinutes) },
      { label: labels.totalSalary, value: salaryTotal },
    ],
    headers: [labels.date, labels.shift, labels.workplace, `${labels.start}–${labels.end}`, labels.duration, labels.breaks, labels.salaryStatus, labels.salary],
    rows: report.rows.map((row) => [
      formatLocalDateKey(row.start, report.timezone),
      row.title ?? labels.shift,
      row.workplaceName,
      `\u200E${formatTime(row.start, locale, report.timezone)}-${formatExit(row.start, row.end, locale, report.timezone)}\u200E`,
      formatMinutes(row.paidMinutes),
      formatMinutes(row.breakMinutes),
      salaryStatusLabel(row.salaryStatus, locale),
      row.salaryMinor === undefined ? labels.unavailable : formatCurrency(row.salaryMinor, locale),
    ]),
  });
}

function salaryStatusLabel(status: ReportSalaryStatus, locale: DateTimeLocale): string { return copy[locale].statuses[status]; }
function formatExit(start: string, end: string, locale: DateTimeLocale, timezone: string): string {
  const endTime = formatTime(end, locale, timezone);
  const startDate = formatLocalDateKey(start, timezone);
  const endDate = formatLocalDateKey(end, timezone);
  return startDate === endDate ? endTime : `${endDate} ${endTime}`;
}
function formatMinutes(minutes: number): string { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
function formatCurrency(minor: number, locale: DateTimeLocale): string { return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100); }
function formatDateTime(value: string, locale: DateTimeLocale, timezone: string): string { return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: timezone }).format(new Date(value)); }
