import { AppScreen, EmptyState } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';

export default function CalendarScreen() {
  const { t } = useTranslation();

  return (
    <AppScreen title={t('calendar.title')}>
      <EmptyState body={t('calendar.emptyBody')} title={t('calendar.empty')} />
    </AppScreen>
  );
}
