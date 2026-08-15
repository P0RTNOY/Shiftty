import { useState } from 'react';
import { StyleSheet, Text, View, Alert, ActivityIndicator } from 'react-native';
import { AppScreen, PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { BackupOrchestrator } from '@/domain/services/backup-orchestrator';
import { useSQLiteContext } from 'expo-sqlite';
import * as DocumentPicker from 'expo-document-picker';
import { shareFile } from '@/features/exports/adapters/file-share-adapter';
import { readTextFile } from '@/features/exports/adapters/file-read-adapter';
import { router } from 'expo-router';
import { SettingsBackButton } from '@/features/settings/components/settings-back-button';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';
import { SqliteShiftRepository } from '@/data/repositories';
import { useAppStore } from '@/features/settings/store/app-store';
import { synchronizeActiveShiftAfterDataMutation } from '@/features/settings/services/data-management-state-service';

export default function DataManagementScreen() {
  const { colors } = useAppTheme();
  const { t, isRtl } = useTranslation();
  const db = useSQLiteContext();
  const setActiveShift = useAppStore((state) => state.setActiveShift);
  const [loading, setLoading] = useState(false);

  const textStyle = [styles.text, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];
  const headingStyle = [styles.heading, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];

  const handleExportBackup = async () => {
    try {
      setLoading(true);
      const orchestrator = new BackupOrchestrator(db);
      const envelope = await orchestrator.generateBackup();
      const content = JSON.stringify(envelope, null, 2);
      
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `shiftty_backup_${dateStr}.json`;
      
      await shareFile({
        filename,
        content,
        mimeType: 'application/json',
        dialogTitle: 'ייצוא גיבוי נתונים'
      });
    } catch (error) {
      reportUnexpectedError('backup.export', error);
      Alert.alert(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      setLoading(true);
      const fileUri = res.assets[0]?.uri;
      if (!fileUri) return;
      const content = await readTextFile(fileUri);

      const orchestrator = new BackupOrchestrator(db);
      const validation = await orchestrator.validateBackup(content);
      
      if (!validation.valid || !validation.envelope) {
        reportUnexpectedError('backup.validate', validation.errors);
        Alert.alert('שגיאה בשחזור', 'קובץ הגיבוי לא תקין או פגום.');
        return;
      }

      // Restore Preview & Strategy Choice
      Alert.alert(
        'שחזור נתונים',
        `נמצא גיבוי תקין הכולל ${validation.envelope.counts.shifts} משמרות.\nהאם להחליף את כל הנתונים הקיימים (מומלץ) או למזג עם הנתונים הקיימים?`,
        [
          { text: 'ביטול', style: 'cancel' },
          { 
            text: 'מיזוג עם הקיים',
            onPress: async () => {
              setLoading(true);
              const result = await orchestrator.restoreMerge(content);
              setLoading(false);
              if (result.success) {
                await synchronizeActiveShiftAfterDataMutation('restore', new SqliteShiftRepository(db), setActiveShift);
                Alert.alert('הצלחה', 'הנתונים מוזגו בהצלחה.');
              } else {
                reportUnexpectedError('backup.restore.merge', result.message);
                Alert.alert(t('common.error'), 'לא ניתן היה למזג את הגיבוי. הנתונים הקיימים לא שונו.');
              }
            } 
          },
          { 
            text: 'החלפת כל הנתונים',
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              const result = await orchestrator.restoreReplace(content);
              setLoading(false);
              if (result.success) {
                await synchronizeActiveShiftAfterDataMutation('restore', new SqliteShiftRepository(db), setActiveShift);
                Alert.alert('הצלחה', 'הנתונים שוחזרו בהצלחה.');
              } else {
                reportUnexpectedError('backup.restore.replace', result.message);
                Alert.alert(t('common.error'), 'לא ניתן היה לשחזר את הגיבוי. הנתונים הקיימים לא שונו.');
              }
            } 
          }
        ]
      );
    } catch (error) {
      reportUnexpectedError('backup.read', error);
      Alert.alert('שגיאה בקריאת קובץ', 'לא ניתן היה לקרוא את קובץ הגיבוי.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllData = () => {
    Alert.alert(
      'מחיקת כל הנתונים',
      'פעולה זו תמחק את כל הנתונים מהמכשיר באופן בלתי הפיך. האם אתה בטוח?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק הכל',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const result = await new BackupOrchestrator(db).clearAllData();
              if (!result.success) throw new Error(result.message ?? 'Clear all failed');
              await synchronizeActiveShiftAfterDataMutation('clear', new SqliteShiftRepository(db), setActiveShift);
              Alert.alert('הצלחה', 'כל הנתונים נמחקו.', [
                { text: 'אישור', onPress: () => router.replace('/') }
              ]);
            } catch (error) {
              reportUnexpectedError('backup.clearAll', error);
              Alert.alert('שגיאה במחיקה', 'לא ניתן היה למחוק את הנתונים. הנתונים הקיימים נשמרו.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <AppScreen title={t('settings.dataManagement')}>
      <SettingsBackButton />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.text, { color: colors.text, marginTop: spacing.md }]}>מעבד נתונים...</Text>
        </View>
      ) : (
        <View style={styles.container}>
          <View style={styles.section}>
            <Text style={headingStyle}>גיבוי נתונים</Text>
            <Text style={textStyle}>ייצוא קובץ המכיל את כל המידע שלך לשמירה בענן או במכשיר אחר.</Text>
            <PrimaryButton label="ייצא גיבוי עכשיו" onPress={handleExportBackup} />
          </View>

          <View style={styles.section}>
            <Text style={headingStyle}>שחזור נתונים</Text>
            <Text style={textStyle}>ייבוא מתוך קובץ גיבוי של Shiftty. לאחר בחירת הקובץ אפשר למזג אותו עם הנתונים הקיימים או להחליף אותם.</Text>
            <PrimaryButton label="בחר קובץ לשחזור" onPress={handleRestoreBackup} />
          </View>

          <View style={styles.section}>
            <Text style={headingStyle}>איפוס כללי</Text>
            <Text style={textStyle}>מחיקת כל הנתונים, המשמרות וההגדרות מהמכשיר.</Text>
            <PrimaryButton 
              label="מחק את כל הנתונים" 
              onPress={handleClearAllData} 
            />
          </View>
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.xl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    gap: spacing.sm,
  },
  heading: {
    fontSize: typography.heading,
    fontWeight: '700',
  },
  text: {
    fontSize: typography.body,
    lineHeight: 24,
  }
});
