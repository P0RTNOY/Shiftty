import type { Shift } from '@/domain/entities';
import type { ShiftRepository } from '@/domain/repositories';
import { restoreActiveShift } from '@/domain/services';

type DataMutationKind = 'clear' | 'restore';

export async function synchronizeActiveShiftAfterDataMutation(
  kind: DataMutationKind,
  shifts: ShiftRepository,
  setActiveShift: (shift: Shift | null) => void,
): Promise<void> {
  if (kind === 'clear') {
    setActiveShift(null);
    return;
  }
  setActiveShift(await restoreActiveShift(shifts));
}
