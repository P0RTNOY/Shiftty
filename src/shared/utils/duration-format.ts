import type { SupportedLocale } from '@/shared/i18n';

export function formatDurationLong(minutes: number, locale: SupportedLocale): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;

  if (locale === 'he') {
    if (!hours) return `${remainder} דקות`;
    if (!remainder) return `${hours} שעות`;
    return `${hours} שעות ו־${remainder} דקות`;
  }
  if (!hours) return `${remainder} minutes`;
  if (!remainder) return `${hours} hours`;
  return `${hours} hours and ${remainder} minutes`;
}

export function formatDurationCompact(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  return `${hours}:${String(safeMinutes % 60).padStart(2, '0')} שעות`;
}
