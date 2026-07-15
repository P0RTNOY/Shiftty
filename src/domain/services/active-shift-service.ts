import type { Shift } from '@/domain/entities';
import type { ShiftRepository } from '@/domain/repositories';

export async function restoreActiveShift(repository: ShiftRepository): Promise<Shift | null> {
  const shift = await repository.findActive();

  if (!shift) {
    return null;
  }

  if (!shift.actualStart || shift.actualEnd) {
    throw new Error('Stored active shift is internally inconsistent.');
  }

  return shift;
}
