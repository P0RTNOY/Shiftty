import { AppScreen, EmptyState } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';

export default function ReportsScreen() {
  const { t } = useTranslation();

  return (
    <AppScreen title={t('reports.title')}>
      <EmptyState body={t('reports.emptyBody')} title={t('reports.empty')} />
    </AppScreen>
  );
}
