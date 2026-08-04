import type { RecurrenceScope, Shift } from '@/domain/entities';
import { getEffectiveShiftRange } from '@/domain/services/shift-overlap-service';

export function selectRecurrenceScopeOccurrences(
  occurrences: readonly Shift[],
  target: Shift,
  scope: RecurrenceScope,
): Shift[] {
  if (scope === 'only') return occurrences.filter((shift) => shift.id === target.id);
  const sorted = [...occurrences].sort((left, right) => getEffectiveShiftRange(left).start.localeCompare(getEffectiveShiftRange(right).start));
  if (scope === 'entire') return sorted;
  const targetStart = getEffectiveShiftRange(target).start;
  return sorted.filter((shift) => getEffectiveShiftRange(shift).start >= targetStart);
}
