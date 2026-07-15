import { restoreActiveShift } from '@/domain/services/active-shift-service';
import type { ShiftRepository } from '@/domain/repositories';
import { createShift } from '@/test/fixtures';

function createRepository(activeShift: ReturnType<typeof createShift> | null): ShiftRepository {
  return {
    findActive: jest.fn().mockResolvedValue(activeShift),
    getById: jest.fn(),
    list: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

describe('restoreActiveShift', () => {
  it('restores an active shift from persistence', async () => {
    const active = createShift({
      status: 'active',
      actualStart: '2026-07-15T13:24:00+03:00',
    });

    await expect(restoreActiveShift(createRepository(active))).resolves.toEqual(active);
  });

  it('returns null when no shift is active', async () => {
    await expect(restoreActiveShift(createRepository(null))).resolves.toBeNull();
  });
});
