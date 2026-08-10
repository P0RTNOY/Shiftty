import type { RecurrenceScope, Shift } from '@/domain/entities';
import { getEffectiveShiftRange } from '@/domain/services/shift-overlap-service';

export function selectRecurrenceScopeOccurrences(
  occurrences: readonly Shift[],
  target: Shift,
  scope: RecurrenceScope,
): Shift[] {
  if (scope === 'only') return occurrences.filter((shift) => shift.id === target.id);
  const sorted = [...occurrences].sort((left, right) => occurrenceStart(left).localeCompare(occurrenceStart(right)));
  if (scope === 'entire') return sorted;
  const targetStart = occurrenceStart(target);
  return sorted.filter((shift) => occurrenceStart(shift) >= targetStart);
}

function occurrenceStart(shift: Shift): string {
  return shift.recurrenceOriginalStart ?? shift.scheduledStart ?? getEffectiveShiftRange(shift).start;
}
