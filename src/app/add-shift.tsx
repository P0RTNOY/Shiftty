import { router } from 'expo-router';

import { AppScreen, PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';

export default function AddShiftScreen() {
  const { t } = useTranslation();

  return (
    <AppScreen title={t('addShift.title')}>
      <PrimaryButton label={t('addShift.future')} onPress={() => router.push('/shifts/new?mode=scheduled')} />
      <SecondaryButton label={t('addShift.completed')} onPress={() => router.push('/shifts/new?mode=completed')} />
    </AppScreen>
  );
}
