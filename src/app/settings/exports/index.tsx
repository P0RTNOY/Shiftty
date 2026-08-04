import { useState } from 'react';
import { StyleSheet, Text, View, Alert, ActivityIndicator } from 'react-native';
import { AppScreen, PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { useSQLiteContext } from 'expo-sqlite';
import { generateCsv } from '@/domain/services/csv-generator';
import { generateIcs } from '@/domain/services/ics-generator';
import { generatePdfHtml } from '@/domain/services/pdf-html-generator';
import { shareFile } from '@/features/exports/adapters/file-share-adapter';
import { processPdf } from '@/features/exports/adapters/print-share-adapter';

export default function ExportsScreen() {
  const { colors } = useAppTheme();
  const { t, isRtl } = useTranslation();
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(false);

  const textStyle = [styles.text, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];
  const headingStyle = [styles.heading, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];

  const fetchShifts = async () => {
    // For MVP export all shifts
    const rows = await db.getAllAsync<any>('SELECT * FROM shifts');
    return rows.map(row => ({
      title: row.title,
      actualStart: row.actual_start,
      scheduledStart: row.scheduled_start,
      actualEnd: row.actual_end,
      scheduledEnd: row.scheduled_end,
      payableGrossPayMinor: row.payable_gross_pay_minor,
      id: row.id,
      updatedAt: row.updated_at,
      status: row.status,
    }));
  };

  const handleExportCsv = async () => {
    try {
      setLoading(true);
      const shifts = await fetchShifts();
      const csvData = {
        columns: [
          { key: 'title', header: 'כותרת', isUserText: true },
          { key: 'start', header: 'התחלה' },
          { key: 'end', header: 'סיום' },
          { key: 'pay', header: 'שכר' },
        ],
        rows: shifts.map((s: any) => ({
          title: s.title || 'משמרת',
          start: s.actualStart || s.scheduledStart || '',
          end: s.actualEnd || s.scheduledEnd || '',
          pay: s.payableGrossPayMinor ? (s.payableGrossPayMinor / 100).toFixed(2) : '0.00',
        }))
      };
      const content = generateCsv(csvData);
      await shareFile({
        filename: `shifts_${Date.now()}.csv`,
        content,
        mimeType: 'text/csv',
      });
    } catch (e: any) {
      Alert.alert('שגיאה', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportIcs = async () => {
    try {
      setLoading(true);
      const shifts = await fetchShifts();
      const content = generateIcs(shifts as any, { includeSalary: true });
      await shareFile({
        filename: `shifts_${Date.now()}.ics`,
        content,
        mimeType: 'text/calendar',
      });
    } catch (e: any) {
      Alert.alert('שגיאה', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setLoading(true);
      const shifts = await fetchShifts();
      const html = generatePdfHtml({
        title: 'דו"ח משמרות',
        headers: ['כותרת', 'התחלה', 'סיום', 'שכר'],
        rows: shifts.map((s: any) => [
          s.title || 'משמרת',
          s.actualStart || s.scheduledStart || '',
          s.actualEnd || s.scheduledEnd || '',
          s.payableGrossPayMinor ? (s.payableGrossPayMinor / 100).toFixed(2) : '0.00',
        ])
      });
      await processPdf({
        html,
        filename: `report_${Date.now()}.pdf`,
        action: 'share'
      });
    } catch (e: any) {
      Alert.alert('שגיאה', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen title={t('settings.exports' as any)}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.text, { color: colors.text, marginTop: spacing.md }]}>מכין ייצוא...</Text>
        </View>
      ) : (
        <View style={styles.container}>
          <View style={styles.section}>
            <Text style={headingStyle}>ייצוא ל-PDF</Text>
            <Text style={textStyle}>הפקת דו&quot;ח נוכחות חודשי בפורמט PDF, נוח להדפסה או שליחה למעסיק.</Text>
            <PrimaryButton label="הפק PDF" onPress={handleExportPdf} />
          </View>

          <View style={styles.section}>
            <Text style={headingStyle}>ייצוא ל-CSV (אקסל)</Text>
            <Text style={textStyle}>שמירת הנתונים בפורמט התואם ל-Excel לחישובים מותאמים אישית. הגיליון מקודד מראש כהלכה.</Text>
            <PrimaryButton label="הפק CSV" onPress={handleExportCsv} />
          </View>

          <View style={styles.section}>
            <Text style={headingStyle}>ייצוא ליומן (ICS)</Text>
            <Text style={textStyle}>יצירת קובץ אירועי יומן שאפשר לייבא ל-Google Calendar, Apple Calendar, ויומנים אחרים.</Text>
            <PrimaryButton label="הפק יומן" onPress={handleExportIcs} />
          </View>
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { gap: spacing.sm },
  heading: { fontSize: typography.heading, fontWeight: '700' },
  text: { fontSize: typography.body, lineHeight: 24 }
});
