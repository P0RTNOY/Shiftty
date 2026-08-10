import type { ShiftRepository } from '@/domain/repositories';
import { synchronizeActiveShiftAfterDataMutation } from '@/features/settings/services/data-management-state-service';
import { createShift } from '@/test/fixtures';

describe('data-management active state synchronization', () => {
  it('clears in-memory active state after clear-all without querying deleted rows', async () => {
    const shifts = { findActive: jest.fn() } as unknown as ShiftRepository;
    const setActiveShift = jest.fn();

    await synchronizeActiveShiftAfterDataMutation('clear', shifts, setActiveShift);

    expect(shifts.findActive).not.toHaveBeenCalled();
    expect(setActiveShift).toHaveBeenCalledWith(null);
  });

  it('reloads the authoritative active shift after restore', async () => {
    const active = createShift({ status: 'active', actualStart: '2026-08-10T09:00:00+03:00' });
    const shifts = { findActive: jest.fn().mockResolvedValue(active) } as unknown as ShiftRepository;
    const setActiveShift = jest.fn();

    await synchronizeActiveShiftAfterDataMutation('restore', shifts, setActiveShift);

    expect(setActiveShift).toHaveBeenCalledWith(active);
  });
});
