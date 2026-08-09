import { router } from 'expo-router';

import { SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';

export function SettingsBackButton() {
  const { t } = useTranslation();

  return <SecondaryButton label={t('common.back')} onPress={() => router.back()} />;
}
