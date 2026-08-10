import type { Workplace } from '@/domain/entities';
import { createShift } from '@/test/fixtures';
import { resolveClockInDecision } from './clock-in-decision-service';

const now = new Date('2026-07-15T13:24:00+03:00');
const workplace = (id: string, isArchived = false): Workplace => ({
  id,
  name: id,
  defaultHourlyRateMinor: 5_000,
  defaultBreakMinutes: 30,
  isArchived,
  createdAt: '2026-01-01T00:00:00+02:00',
  updatedAt: '2026-01-01T00:00:00+02:00',
});

describe('clock-in decision', () => {
  it('uses a clearly relevant scheduled shift before workplace defaults', () => {
    const nearby = createShift({ id: 'scheduled-1' });

    expect(resolveClockInDecision({ shifts: [nearby], workplaces: [workplace('workplace-1')], now }))
      .toEqual({ kind: 'scheduled', shiftId: nearby.id });
  });

  it('starts directly with the only active workplace', () => {
    expect(resolveClockInDecision({ shifts: [], workplaces: [workplace('workplace-1')], now }))
      .toEqual({ kind: 'workplace', workplaceId: 'workplace-1' });
  });

  it('requires an explicit workplace choice when multiple are active', () => {
    expect(resolveClockInDecision({ shifts: [], workplaces: [workplace('one'), workplace('archived', true), workplace('two')], now }))
      .toEqual({ kind: 'choose-workplace', workplaceIds: ['one', 'two'] });
  });

  it('uses the existing shift picker when nearby scheduled shifts are ambiguous', () => {
    const shifts = [
      createShift({ id: 'one', scheduledStart: '2026-07-15T13:15:00+03:00' }),
      createShift({ id: 'two', scheduledStart: '2026-07-15T13:35:00+03:00' }),
    ];

    expect(resolveClockInDecision({ shifts, workplaces: [workplace('workplace-1')], now }))
      .toEqual({ kind: 'choose-shift', shiftIds: ['one', 'two'] });
  });

  it('reports unavailable when no safe target exists', () => {
    expect(resolveClockInDecision({ shifts: [], workplaces: [workplace('archived', true)], now }))
      .toEqual({ kind: 'unavailable' });
  });
});
