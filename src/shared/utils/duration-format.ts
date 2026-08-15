import type { SupportedLocale } from '@/shared/i18n';

export function formatDurationLong(minutes: number, locale: SupportedLocale): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  if (locale === 'he') {
    const minuteText = remainder === 1 ? 'דקה אחת' : `${remainder} דקות`;
    const hourText = hours === 1 ? 'שעה אחת' : `${hours} שעות`;
    if (!hours) return minuteText;
    if (!remainder) return hourText;
    return `${hourText} ${remainder === 1 ? 'ו' : 'ו־'}${minuteText}`;
  }
  const minuteText = `${remainder} ${remainder === 1 ? 'minute' : 'minutes'}`;
  const hourText = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  if (!hours) return minuteText;
  if (!remainder) return hourText;
  return `${hourText} and ${minuteText}`;
}

export function formatDurationCompact(minutes: number, locale: SupportedLocale = 'he'): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  return `${hours}:${String(safeMinutes % 60).padStart(2, '0')} ${locale === 'he' ? 'שעות' : 'hours'}`;
}

export function formatTimer(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
