import { router } from 'expo-router';
import { Alert, Text } from 'react-native';
import type { ActiveShiftCancellationMode } from '@/domain/repositories';
import { useActiveShift } from '@/features/shifts/hooks/use-active-shift';
import { AppScreen, PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { useAppTheme } from '@/shared/theme';

export default function CancelActiveShiftScreen() {
  const active = useActiveShift(); const { t } = useTranslation(); const { colors } = useAppTheme();
  const apply = (mode: ActiveShiftCancellationMode) => Alert.alert(t('active.cancelTitle'), t('active.cancelWarning'), [{ text: t('common.back'), style: 'cancel' }, { text: t('common.confirm'), style: 'destructive', onPress: () => void active.cancelActiveShift(mode, new Date().toISOString()).then(() => router.replace('/')).catch(() => Alert.alert(t('common.error'), t('active.mutationError'))) }]);
  return <AppScreen title={t('active.cancelTitle')}>
    <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
    <Text style={{ color: colors.text }}>{t('active.cancelWarning')}</Text>
    {active.activeShift?.activeOrigin === 'scheduled' ? <PrimaryButton disabled={active.busy} label={t('active.restoreScheduled')} onPress={() => apply('restore')} /> : null}
    <SecondaryButton destructive disabled={active.busy} label={t('active.cancelPreserve')} onPress={() => apply('cancel')} />
    {active.activeShift?.activeOrigin === 'unscheduled' ? <SecondaryButton destructive disabled={active.busy} label={t('active.discardUnscheduled')} onPress={() => apply('delete')} /> : null}
  </AppScreen>;
}
