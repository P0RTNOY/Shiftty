import { summarizeBreakSessions, validateBreakSessions } from '@/domain/services/break-session-service';
import { createBreak, createShift } from '@/test/fixtures';

describe('break session validation', () => {
  const active = createShift({ status: 'active', actualStart: '2026-07-15T13:00:00+03:00', activeOrigin: 'scheduled' });

  it('separates paid, unpaid, and currently active break minutes', () => {
    expect(summarizeBreakSessions([
      createBreak({ id: 'paid', start: '2026-07-15T14:00:00+03:00', end: '2026-07-15T14:10:00+03:00', isPaid: true }),
      createBreak({ id: 'unpaid', start: '2026-07-15T15:00:00+03:00', end: '2026-07-15T15:20:00+03:00' }),
      createBreak({ id: 'active', start: '2026-07-15T16:00:00+03:00', end: undefined }),
    ], new Date('2026-07-15T16:08:00+03:00'))).toEqual({ paidMinutes: 10, unpaidMinutes: 28, activeMinutes: 8, activeBreak: expect.objectContaining({ id: 'active' }) });
  });

  it('rejects overlaps and breaks before the actual shift', () => {
    expect(() => validateBreakSessions(active, [
      createBreak({ id: 'one', start: '2026-07-15T14:00:00+03:00', end: '2026-07-15T14:30:00+03:00' }),
      createBreak({ id: 'two', start: '2026-07-15T14:20:00+03:00', end: '2026-07-15T14:40:00+03:00' }),
    ], new Date('2026-07-15T17:00:00+03:00'))).toThrow('overlap');
    expect(() => validateBreakSessions(active, [createBreak({ start: '2026-07-15T12:50:00+03:00', end: '2026-07-15T13:10:00+03:00' })], new Date('2026-07-15T17:00:00+03:00'))).toThrow('inside');
  });

  it('rejects an open break on a completed shift and more than one open break', () => {
    const completed = createShift({ status: 'completed', actualStart: active.actualStart, actualEnd: '2026-07-15T17:00:00+03:00' });
    expect(() => validateBreakSessions(completed, [createBreak({ end: undefined })], new Date('2026-07-15T17:00:00+03:00'))).toThrow('open break');
    expect(() => validateBreakSessions(active, [createBreak({ id: 'one', end: undefined }), createBreak({ id: 'two', start: '2026-07-15T17:30:00+03:00', end: undefined })], new Date('2026-07-15T18:00:00+03:00'))).toThrow('one open');
  });
});
