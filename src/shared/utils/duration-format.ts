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

export function formatTimer(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
