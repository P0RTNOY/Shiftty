import { generateIcs } from './ics-generator';
import { Shift } from '@/domain/entities/shift';

describe('ics-generator', () => {
  const baseShift = {
    id: 'shift-1',
    workplaceId: 'wp-1',
    title: 'משמרת בוקר, בדיקה',
    notes: 'הערה: לשים לב לפרטים; חשוב מאוד\\כאן\nשורה חדשה',
    status: 'completed' as const,
    scheduledStart: '2026-08-04T10:30:00+03:00', // Asia/Jerusalem DST
    scheduledEnd: '2026-08-04T19:00:00+03:00',
    payableStart: '2026-08-04T10:30:00+03:00',
    payableEnd: '2026-08-04T19:00:00+03:00',
    actualStart: '2026-08-04T10:30:00+03:00',
    actualEnd: '2026-08-04T19:00:00+03:00',
    expectedBreakMinutes: 0,
    hourlyRateSnapshotMinor: 5000,
    salaryCalculationStatus: 'completed' as const,
    payableGrossPayMinor: 42500, // 425 ILS
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  } as unknown as Shift;
  const hebrewOptions = { fallbackTitle: 'משמרת' };

  it('generates valid ICS with UTC timestamps (Z) and escapes text', () => {
    const result = generateIcs([baseShift], hebrewOptions);
    const unfolded = result.replace(/\r\n /g, '');
    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('BEGIN:VEVENT');
    // Asia/Jerusalem +03:00 means 10:30 local is 07:30 UTC
    expect(result).toContain('DTSTART:20260804T073000Z');
    expect(result).toContain('DTEND:20260804T160000Z');
    // Title escaping: comma
    expect(unfolded).toContain('SUMMARY:משמרת בוקר\\, בדיקה');
    // Description escaping: comma, semicolon, backslash, newline
    expect(unfolded).toContain('DESCRIPTION:הערה: לשים לב לפרטים\\; חשוב מאוד\\\\כאן\\nשורה חדשה');
  });

  it('folds lines longer than 70 characters', () => {
    const longShift = {
      ...baseShift,
      notes: 'א'.repeat(100)
    };
    const result = generateIcs([longShift], hebrewOptions);
    // It should fold the line at 70 chars with CRLF + space
    expect(result).toMatch(/\r\n /);
  });

  it('folds every physical line to at most 75 UTF-8 octets without splitting Unicode', () => {
    const notes = `תחילת הערה ${'😀משמרת'.repeat(30)} סוף`;
    const result = generateIcs([{ ...baseShift, notes }], hebrewOptions);
    const physicalLines = result.split('\r\n').filter(Boolean);

    for (const line of physicalLines) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
    expect(result.replace(/\r\n /g, '')).toContain(`DESCRIPTION:${notes}`);
  });

  it('keeps the UID stable when an existing shift time changes', () => {
    const first = generateIcs([baseShift], hebrewOptions).match(/UID:(.+)\r\n/)?.[1];
    const updated = generateIcs([{ ...baseShift, payableStart: '2026-08-04T11:00:00+03:00', payableEnd: '2026-08-04T19:30:00+03:00' }], hebrewOptions).match(/UID:(.+)\r\n/)?.[1];

    expect(first).toBe('shift-1@shiftty.app');
    expect(updated).toBe(first);
  });

  it('is strictly calendar-only even when a completed shift contains salary fields', () => {
    const result = generateIcs([baseShift], hebrewOptions);
    expect(result).not.toContain('שכר משוער');
    expect(result).not.toContain('₪425.00');
    expect(result).not.toContain('425.00');
  });

  it('does not serialize special-interval provenance, source claims, rules, or multipliers', () => {
    const evidenceAwareShift = {
      ...baseShift,
      salaryCalculationEvidence: [{
        name: 'Private holiday evidence',
        sourceUrl: 'https://example.gov/private-holiday-source',
        presetId: 'preset-private-holiday',
        appliedRuleIds: ['holiday-150-rule'],
        multiplierBasisPoints: 15_000,
      }],
    } as Shift;

    const result = generateIcs([evidenceAwareShift], hebrewOptions);

    expect(result).not.toContain('Private holiday evidence');
    expect(result).not.toContain('https://example.gov');
    expect(result).not.toContain('preset-private-holiday');
    expect(result).not.toContain('holiday-150-rule');
    expect(result).not.toContain('150%');
    expect(result).not.toContain('15000');
  });

  it('uses the caller-provided localized fallback title', () => {
    const untitled = { ...baseShift, title: undefined };

    expect(generateIcs([untitled], { fallbackTitle: 'Shift' })).toContain('SUMMARY:Shift');
    expect(generateIcs([untitled], hebrewOptions)).toContain('SUMMARY:משמרת');
  });

  it('excludes cancelled shifts lacking times', () => {
    const cancelledShift = {
      ...baseShift,
      id: 'shift-2',
      status: 'cancelled' as const,
      payableStart: undefined,
      actualStart: undefined,
      scheduledStart: undefined
    } as any;
    const result = generateIcs([baseShift, cancelledShift], hebrewOptions);
    // Should only contain 1 event
    const events = result.match(/BEGIN:VEVENT/g);
    expect(events?.length).toBe(1);
  });
});
