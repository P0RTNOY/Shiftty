import { AppScreen, EmptyState } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';

export default function AddShiftScreen() {
  const { t } = useTranslation();

  return (
    <AppScreen title={t('addShift.title')}>
      <EmptyState body={t('addShift.foundationBody')} title={t('addShift.foundation')} />
    </AppScreen>
  );
}
