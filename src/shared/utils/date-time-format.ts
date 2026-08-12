import { formatLocalDateKey } from '@/shared/utils/zoned-time';

export type DateTimeLocale = 'he' | 'en';

function intlLocale(locale: DateTimeLocale): string {
  return locale === 'he' ? 'he-IL' : 'en-US';
}

function asDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

function weekday(value: Date | string, locale: DateTimeLocale, timezone: string): string {
  const formatted = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'long',
    timeZone: timezone,
  }).format(asDate(value));
  return locale === 'he' ? formatted.replace(/^יום\s+/, '') : formatted;
}

export function formatCompactDate(value: Date | string, locale: DateTimeLocale, timezone: string): string {
  const date = asDate(value);
  const numeric = new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'numeric',
    timeZone: timezone,
  }).format(date);
  return `${weekday(date, locale, timezone)} · ${numeric}`;
}

export function formatFullDate(value: Date | string, locale: DateTimeLocale, timezone: string): string {
  const date = asDate(value);
  const calendarDate = new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  }).format(date);
  return `${weekday(date, locale, timezone)}, ${calendarDate}`;
}

export function formatTime(value: Date | string, locale: DateTimeLocale, timezone: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(asDate(value));
}

export function formatTimeRange(
  start: Date | string,
  end: Date | string,
  locale: DateTimeLocale,
  timezone: string,
): string {
  const crossesMidnight = formatLocalDateKey(start, timezone) !== formatLocalDateKey(end, timezone);
  const nextDay = locale === 'he' ? ' למחרת' : ' next day';
  return `${formatTime(start, locale, timezone)}–${formatTime(end, locale, timezone)}${crossesMidnight ? nextDay : ''}`;
}

export function formatMonth(monthKey: string, locale: DateTimeLocale): string {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error('Month must use YYYY-MM format.');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1, 12));
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatLocalDateValue(value: string, locale: DateTimeLocale): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error('Date must use YYYY-MM-DD format.');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return formatFullDate(date, locale, 'UTC');
}
