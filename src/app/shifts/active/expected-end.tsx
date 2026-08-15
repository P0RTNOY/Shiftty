import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useActiveShift } from '@/features/shifts/hooks/use-active-shift';
import { AppScreen, DateField, PrimaryButton, SecondaryButton, TimeField } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { formatLocalDateKey, formatLocalTime, resolveLocalDateTime } from '@/shared/utils/zoned-time';

export default function ExpectedEndScreen() {
  const active = useActiveShift(); const shift = active.activeShift; const { t } = useTranslation();
  const initial = shift?.expectedEnd ?? shift?.scheduledEnd ?? new Date().toISOString();
  const [date, setDate] = useState(() => formatLocalDateKey(initial, shift?.timezone)); const [time, setTime] = useState(() => formatLocalTime(initial, shift?.timezone));
  useEffect(() => { if (!active.loading && !shift) router.replace('/'); }, [active.loading, shift]);
  const save = async () => { if (!shift) return; try { await active.updateExpectedEnd(resolveLocalDateTime(date, time, shift.timezone), new Date().toISOString()); router.back(); } catch { Alert.alert(t('common.error'), t('active.mutationError')); } };
  if (!shift) return null;
  return <AppScreen title={t('active.changeExpectedEnd')}><SecondaryButton label={t('common.back')} onPress={() => router.back()} /><DateField label={t('form.date')} onChange={(value) => value && setDate(value)} value={date} /><TimeField label={t('active.expectedEnd')} onChange={(value) => value && setTime(value)} value={time} /><PrimaryButton disabled={active.busy || !shift} label={t('active.saveExpectedEnd')} onPress={() => void save()} /></AppScreen>;
}
