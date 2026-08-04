import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';

import { matchNearbyScheduledShifts } from '@/domain/services';
import { NearbyShiftList } from '@/features/shifts/components/nearby-shift-list';
import { useActiveShift } from '@/features/shifts/hooks/use-active-shift';
import { useShift, useShifts } from '@/features/shifts/hooks/use-shifts';
import { useWorkplaces } from '@/features/workplaces/hooks/use-workplaces';
import { AppScreen, EmptyState, PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { useAppTheme } from '@/shared/theme';

export default function StartShiftScreen() {
  const { shiftId } = useLocalSearchParams<{ shiftId?: string }>();
  const { t } = useTranslation(); const { colors } = useAppTheme();
  const { workplaces } = useWorkplaces(); const { shifts, loading } = useShifts({ statuses: ['scheduled'] });
  const requested = useShift(shiftId); const active = useActiveShift();
  const [referenceTime] = useState(() => new Date());
  const match = useMemo(() => matchNearbyScheduledShifts(shifts, referenceTime, { maximumDifferenceMinutes: 180 }), [referenceTime, shifts]);
  const candidates = shiftId && requested.shift?.status === 'scheduled' ? [requested.shift] : match.candidates.map((candidate) => shifts.find((shift) => shift.id === candidate.shiftId)!).filter(Boolean);
  const start = async (id: string) => {
    try { await active.startScheduled(id, new Date().toISOString()); router.replace('/'); }
    catch { Alert.alert(t('common.error'), t('active.mutationError')); }
  };
  return <AppScreen title={t('active.startNow')}>
    <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
    {loading || (shiftId && requested.loading) ? <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text> : null}
    {candidates.length ? <>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{t('active.nearbyTitle')}</Text>
      <Text style={{ color: colors.textMuted }}>{t('active.nearbyBody')}</Text>
      <NearbyShiftList candidates={candidates} onSelect={(id) => void start(id)} workplaceNames={Object.fromEntries(workplaces.map((item) => [item.id, item.name]))} />
    </> : !loading ? <EmptyState body={t('active.nearbyBody')} title={t('active.noNearby')} /> : null}
    <PrimaryButton disabled={active.busy} label={t('active.startUnscheduled')} onPress={() => router.push('/shifts/start/unscheduled')} />
  </AppScreen>;
}
