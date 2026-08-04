import { View } from 'react-native';
import type { Shift } from '@/domain/entities';
import { ShiftCard } from '@/features/shifts/components/shift-card';
import { spacing } from '@/shared/theme';

export function NearbyShiftList({ candidates, workplaceNames, onSelect }: { candidates: readonly Shift[]; workplaceNames: Record<string, string>; onSelect: (id: string) => void }) {
  return <View style={{ gap: spacing.sm }}>{candidates.map((shift) => <ShiftCard key={shift.id} onPress={() => onSelect(shift.id)} shift={shift} workplaceName={workplaceNames[shift.workplaceId] ?? '—'} />)}</View>;
}
