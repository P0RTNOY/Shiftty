import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useActiveShift } from '@/features/shifts/hooks/use-active-shift';
import { AppScreen, FormField, PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { formatLocalDateKey, formatLocalTime, resolveLocalDateTime } from '@/shared/utils/zoned-time';

export default function ExpectedEndScreen() {
  const active = useActiveShift(); const shift = active.activeShift; const { t } = useTranslation();
  const initial = shift?.expectedEnd ?? shift?.scheduledEnd ?? new Date().toISOString();
  const [date, setDate] = useState(() => formatLocalDateKey(initial, shift?.timezone)); const [time, setTime] = useState(() => formatLocalTime(initial, shift?.timezone));
  const save = async () => { if (!shift) return; try { await active.updateExpectedEnd(resolveLocalDateTime(date, time, shift.timezone), new Date().toISOString()); router.back(); } catch { Alert.alert(t('common.error'), t('active.mutationError')); } };
  return <AppScreen title={t('active.changeExpectedEnd')}><SecondaryButton label={t('common.back')} onPress={() => router.back()} /><FormField label={t('form.date')} onChangeText={setDate} value={date} /><FormField label={t('active.expectedEnd')} onChangeText={setTime} value={time} /><PrimaryButton disabled={active.busy || !shift} label={t('active.saveExpectedEnd')} onPress={() => void save()} /></AppScreen>;
}
