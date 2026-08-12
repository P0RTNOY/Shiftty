import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { generateIcs } from '@/domain/services/ics-generator';
import { shareFile } from '@/features/exports/adapters/file-share-adapter';
import { processPdf } from '@/features/exports/adapters/print-share-adapter';
import { generateMonthlyReportCsv, generateMonthlyReportPdfHtml } from '@/features/reports/monthly-report-export';
import { useMonthlyReport } from '@/features/reports/use-monthly-report';
import { SettingsBackButton } from '@/features/settings/components/settings-back-button';
import { AppScreen, PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatMonth } from '@/shared/utils/date-time-format';
import { formatLocalDateKey } from '@/shared/utils/zoned-time';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

const REPORT_TIMEZONE = 'Asia/Jerusalem';

export default function ExportsScreen() {
  const params = useLocalSearchParams<{ month?: string }>();
  const { colors } = useAppTheme();
  const { t, locale, isRtl } = useTranslation();
  const initialMonth = /^\d{4}-\d{2}$/.test(params.month ?? '') ? params.month! : formatLocalDateKey(new Date(), REPORT_TIMEZONE).slice(0, 7);
  const [month, setMonth] = useState(initialMonth);
  const [exporting, setExporting] = useState<'pdf' | 'csv' | 'ics' | null>(null);
  const { report, loading, error } = useMonthlyReport(month, REPORT_TIMEZONE);
  const align = isRtl ? 'right' : 'left';

  const runExport = async (format: 'pdf' | 'csv' | 'ics') => {
    if (!report || exporting) return;
    try {
      setExporting(format);
      if (format === 'csv') {
        await shareFile({ filename: `shiftty-report-${month}.csv`, content: generateMonthlyReportCsv(report, locale), mimeType: 'text/csv' });
      } else if (format === 'pdf') {
        await processPdf({ html: generateMonthlyReportPdfHtml(report, locale), filename: `shiftty-report-${month}.pdf`, action: 'share' });
      } else {
        await shareFile({ filename: `shiftty-shifts-${month}.ics`, content: generateIcs(report.rows.map((row) => row.shift)), mimeType: 'text/calendar' });
      }
    } catch (caught) {
      reportUnexpectedError(`export.${format}`, caught);
      Alert.alert(t('common.error'));
    } finally {
      setExporting(null);
    }
  };

  return <AppScreen title={t('settings.exports')}>
    <SettingsBackButton />
    <View style={[styles.navigation, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
      <MonthButton label={t('reports.previousMonth')} onPress={() => setMonth((value) => addMonths(value, -1))} />
      <Text accessibilityRole="header" style={[styles.monthTitle, { color: colors.text }]}>{formatMonth(month, locale)}</Text>
      <MonthButton label={t('reports.nextMonth')} onPress={() => setMonth((value) => addMonths(value, 1))} />
    </View>

    {loading ? <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={{ color: colors.textMuted }}>{t('exports.preparing')}</Text></View> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, textAlign: align }}>{t('common.error')}</Text> : null}
    {report && report.rows.length === 0 ? <Text style={{ color: colors.textMuted, textAlign: align }}>{t('exports.noShifts')}</Text> : null}

    {report && report.rows.length > 0 ? <View style={styles.container}>
      <ExportSection body={t('exports.pdfBody')} button={t('exports.pdfAction')} disabled={Boolean(exporting)} onPress={() => void runExport('pdf')} title={t('exports.pdfTitle')} />
      <ExportSection body={t('exports.csvBody')} button={t('exports.csvAction')} disabled={Boolean(exporting)} onPress={() => void runExport('csv')} title={t('exports.csvTitle')} />
      <ExportSection body={t('exports.icsBody')} button={t('exports.icsAction')} disabled={Boolean(exporting)} onPress={() => void runExport('ics')} title={t('exports.icsTitle')} />
    </View> : null}
  </AppScreen>;
}

function ExportSection({ title, body, button, disabled, onPress }: { title: string; body: string; button: string; disabled: boolean; onPress: () => void }) {
  const { colors } = useAppTheme(); const { isRtl } = useTranslation(); const align = isRtl ? 'right' : 'left';
  return <View style={styles.section}><Text style={[styles.heading, { color: colors.text, textAlign: align }]}>{title}</Text><Text style={[styles.text, { color: colors.textMuted, textAlign: align }]}>{body}</Text><PrimaryButton disabled={disabled} label={button} onPress={onPress} /></View>;
}

function MonthButton({ label, onPress }: { label: string; onPress: () => void }) { const { colors } = useAppTheme(); return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.choice, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border }]}><Text style={{ color: colors.text }}>{label}</Text></Pressable>; }
function addMonths(month: string, delta: number): string { const [year, monthNumber] = month.split('-').map(Number); const next = new Date(Date.UTC(year!, monthNumber! - 1 + delta, 1)); return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`; }

const styles = StyleSheet.create({
  navigation: { alignItems: 'center', gap: spacing.xs, justifyContent: 'space-between' },
  monthTitle: { fontSize: typography.title, fontWeight: '800' },
  choice: { borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  container: { gap: spacing.lg },
  center: { alignItems: 'center', gap: spacing.sm },
  section: { gap: spacing.sm },
  heading: { fontSize: typography.title, fontWeight: '800' },
  text: { fontSize: typography.body, lineHeight: 24 },
});
