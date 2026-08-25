import { generateCsv } from '@/domain/services/csv-generator';
import { generatePdfHtml } from '@/domain/services/pdf-html-generator';
import type { MonthlyReport, ReportSalaryStatus } from '@/features/reports/monthly-report-service';
import { en, he } from '@/shared/i18n/translations';
import { formatMonth, formatTime, type DateTimeLocale } from '@/shared/utils/date-time-format';
import { formatLocalDateKey } from '@/shared/utils/zoned-time';

export function generateMonthlyReportCsv(report: MonthlyReport, locale: DateTimeLocale): string {
  const labels = exportLabels(locale);
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
      { key: 'salaryStatus', header: labels.estimateStatus },
      { key: 'salary', header: labels.salary },
      { key: 'specialIntervals', header: labels.specialIntervals, isUserText: true },
      { key: 'estimateNote', header: labels.noteHeader },
    ],
    rows: report.rows.map((row, index) => ({
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
      specialIntervals: row.salaryStatus === 'available'
        ? formatSpecialIntervalLabels(row.specialIntervals, labels.specialIntervalTypes)
        : undefined,
      estimateNote: index === 0 ? labels.estimateNote : undefined,
    })),
  });
}

export function generateMonthlyReportPdfHtml(report: MonthlyReport, locale: DateTimeLocale): string {
  const labels = exportLabels(locale);
  const salaryTotal = report.totals.salaryMinor === undefined
    ? `${labels.unavailable} (${report.totals.salaryIssueCount})`
    : formatCurrency(report.totals.salaryMinor, locale);
  return generatePdfHtml({
    title: labels.title,
    subtitle: `${formatMonth(report.month, locale)} · ${labels.generated} ${formatDateTime(report.generatedAt, locale, report.timezone)}`,
    note: labels.estimateNote,
    direction: locale === 'he' ? 'rtl' : 'ltr',
    language: locale,
    totals: [
      { label: labels.shifts, value: String(report.totals.shiftCount) },
      { label: labels.totalHours, value: formatMinutes(report.totals.paidMinutes) },
      { label: labels.totalBreaks, value: formatMinutes(report.totals.breakMinutes) },
      { label: labels.totalSalary, value: salaryTotal },
    ],
    headers: [labels.date, labels.shift, labels.workplace, `${labels.start}–${labels.end}`, labels.duration, labels.breaks, labels.estimateStatus, labels.salary, labels.specialIntervals],
    rows: report.rows.map((row) => [
      formatLocalDateKey(row.start, report.timezone),
      row.title ?? labels.shift,
      row.workplaceName,
      `\u200E${formatTime(row.start, locale, report.timezone)}-${formatExit(row.start, row.end, locale, report.timezone)}\u200E`,
      formatMinutes(row.paidMinutes),
      formatMinutes(row.breakMinutes),
      salaryStatusLabel(row.salaryStatus, locale),
      row.salaryMinor === undefined ? labels.unavailable : formatCurrency(row.salaryMinor, locale),
      row.salaryStatus === 'available'
        ? formatSpecialIntervalLabels(row.specialIntervals, labels.specialIntervalTypes)
        : '',
    ]),
  });
}

function salaryStatusLabel(status: ReportSalaryStatus, locale: DateTimeLocale): string { return exportLabels(locale).statuses[status]; }

function exportLabels(locale: DateTimeLocale) {
  const messages = locale === 'he' ? he : en;
  return {
    title: messages['exports.report.title'],
    date: messages['exports.report.date'],
    start: messages['exports.report.start'],
    end: messages['exports.report.end'],
    duration: messages['exports.report.duration'],
    breaks: messages['exports.report.breaks'],
    workplace: messages['exports.report.workplace'],
    role: messages['exports.report.role'],
    shift: messages['exports.report.shift'],
    estimateStatus: messages['exports.report.estimateStatus'],
    salary: messages['exports.report.estimatedGrossPay'],
    specialIntervals: messages['exports.report.specialIntervals'],
    shifts: messages['exports.report.shifts'],
    totalHours: messages['exports.report.totalHours'],
    totalBreaks: messages['exports.report.totalBreaks'],
    totalSalary: messages['exports.report.totalEstimatedGrossPay'],
    unavailable: messages['exports.report.unavailable'],
    generated: messages['exports.report.generated'],
    noteHeader: messages['exports.report.noteHeader'],
    estimateNote: messages['exports.report.estimateNote'],
    specialIntervalTypes: {
      holiday: messages['salary.specialIntervalTypeHoliday'],
      weekly_rest: messages['salary.specialIntervalTypeWeeklyRest'],
      custom: messages['salary.specialIntervalTypeCustom'],
    },
    statuses: {
      available: messages['exports.report.statusAvailable'],
      missing: messages['exports.report.statusMissing'],
      stale: messages['exports.report.statusStale'],
      incomplete: messages['exports.report.statusIncomplete'],
    } satisfies Record<ReportSalaryStatus, string>,
  };
}

function formatSpecialIntervalLabels(
  intervals: MonthlyReport['rows'][number]['specialIntervals'],
  typeLabels: Record<'holiday' | 'weekly_rest' | 'custom', string>,
): string {
  return intervals
    .filter((interval) => interval.contributedToEstimate)
    .map((interval) => `${typeLabels[interval.type]}: ${interval.name}`)
    .join(' · ');
}
function formatExit(start: string, end: string, locale: DateTimeLocale, timezone: string): string {
  const endTime = formatTime(end, locale, timezone);
  const startDate = formatLocalDateKey(start, timezone);
  const endDate = formatLocalDateKey(end, timezone);
  return startDate === endDate ? endTime : `${endDate} ${endTime}`;
}
function formatMinutes(minutes: number): string { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
function formatCurrency(minor: number, locale: DateTimeLocale): string { return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100); }
function formatDateTime(value: string, locale: DateTimeLocale, timezone: string): string { return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: timezone }).format(new Date(value)); }
