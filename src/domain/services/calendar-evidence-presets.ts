import { calendarEvidenceIntervalSchema, type CalendarEvidenceInterval, type SpecialIntervalType } from '@/domain/entities';

export interface CalendarEvidencePreset {
  id: string;
  version: string;
  type: SpecialIntervalType;
  name: Readonly<{ he: string; en: string }>;
  start: string;
  end: string;
  timezone: string;
  sourceTitle: string;
  sourceUrl: string;
  retrievedAt: string;
  /** Human-reviewable limitation shown before values are copied. */
  assumption: Readonly<{ he: string; en: string }>;
}
/**
 * A deliberately small, date-only civic fixture. The official circular names
 * the civil date but does not establish hourly, religious, entitlement, permit,
 * or multiplier facts. Midnight boundaries are therefore a reviewable preset
 * assumption and acceptance creates editable user-owned evidence only.
 */
export const IL_CIVIL_SERVICE_INDEPENDENCE_DAY_2026_PRESET: CalendarEvidencePreset = Object.freeze({
  id: 'il-csc-independence-day-2026-date-only',
  version: '1',
  type: 'holiday',
  name: Object.freeze({ he: 'יום העצמאות — 2026', en: 'Independence Day — 2026' }),
  start: '2026-04-22T00:00:00+03:00',
  end: '2026-04-23T00:00:00+03:00',
  timezone: 'Asia/Jerusalem',
  sourceTitle: 'ימי מועד, ימי בחירה וימי עבודה מקוצרים לשנת 2026',
  sourceUrl: 'https://www.gov.il/BlobFolder/policy/calendar_2026/he/calendar_2026.pdf',
  retrievedAt: '2026-08-24',
  assumption: Object.freeze({
    he: 'המקור מציין תאריך אזרחי; גבולות חצות עד חצות הם הנחת תצוגה שניתנת לעריכה.',
    en: 'The source names a civil date; midnight-to-midnight boundaries are an editable preview assumption.',
  }),
});

export function acceptCalendarEvidencePreset(input: {
  preset: CalendarEvidencePreset;
  intervalId: string;
  workplaceId: string;
  salaryProfileId?: string;
  locale: 'he' | 'en';
  confirmedAt: string;
}): CalendarEvidenceInterval {
  return calendarEvidenceIntervalSchema.parse({
    id: input.intervalId,
    workplaceId: input.workplaceId,
    salaryProfileId: input.salaryProfileId,
    type: input.preset.type,
    name: input.preset.name[input.locale],
    start: input.preset.start,
    end: input.preset.end,
    timezone: input.preset.timezone,
    sourceKind: 'confirmed_preset',
    sourceTitle: input.preset.sourceTitle,
    sourceUrl: input.preset.sourceUrl,
    presetId: input.preset.id,
    presetVersion: input.preset.version,
    confirmedAt: input.confirmedAt,
    isArchived: false,
    createdAt: input.confirmedAt,
    updatedAt: input.confirmedAt,
  });
}
