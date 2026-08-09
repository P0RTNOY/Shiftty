import { useState } from 'react';
import { StyleSheet, Text, View, Alert, ActivityIndicator } from 'react-native';
import { AppScreen, PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { BackupOrchestrator } from '@/domain/services/backup-orchestrator';
import { useSQLiteContext } from 'expo-sqlite';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { shareFile } from '@/features/exports/adapters/file-share-adapter';
import { router } from 'expo-router';

export default function DataManagementScreen() {
  const { colors } = useAppTheme();
  const { t, isRtl } = useTranslation();
  const db = useSQLiteContext();
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
    } catch (e: any) {
      Alert.alert('שגיאה בגיבוי', e.message);
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
      const content = await FileSystem.readAsStringAsync(fileUri);

      const orchestrator = new BackupOrchestrator(db);
      const validation = await orchestrator.validateBackup(content);
      
      if (!validation.valid || !validation.envelope) {
        Alert.alert('שגיאה בשחזור', 'קובץ הגיבוי לא תקין או פגום.\n' + (validation.errors || []).join('\n'));
        return;
      }

      // Restore Preview & Strategy Choice
      Alert.alert(
        'שחזור נתונים',
        `נמצא גיבוי תקין הכולל ${validation.envelope.counts.shifts} משמרות.\nהאם להחליף את כל הנתונים הקיימים (מומלץ) או למזג עם הנתונים הקיימים?`,
        [
          { text: 'ביטול', style: 'cancel' },
          { 
            text: 'מזג (Merge)', 
            onPress: async () => {
              setLoading(true);
              const result = await orchestrator.restoreMerge(content);
              setLoading(false);
              if (result.success) {
                Alert.alert('הצלחה', 'הנתונים מוזגו בהצלחה.');
              } else {
                Alert.alert('שגיאה', result.message || 'אירעה שגיאה במיזוג.');
              }
            } 
          },
          { 
            text: 'החלף הכל (Replace)', 
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              const result = await orchestrator.restoreReplace(content);
              setLoading(false);
              if (result.success) {
                Alert.alert('הצלחה', 'הנתונים שוחזרו בהצלחה.');
              } else {
                Alert.alert('שגיאה', result.message || 'אירעה שגיאה בשחזור.');
              }
            } 
          }
        ]
      );
    } catch (e: any) {
      Alert.alert('שגיאה בקריאת קובץ', e.message);
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
              await db.withTransactionAsync(async () => {
                await db.execAsync(`
                  DELETE FROM scheduled_notification_records;
                  DELETE FROM prediction_feedback;
                  DELETE FROM salary_calculation_snapshots;
                  DELETE FROM break_sessions;
                  DELETE FROM recurrence_exceptions;
                  DELETE FROM shifts;
                  DELETE FROM recurrence_series;
                  DELETE FROM shift_templates;
                  DELETE FROM pay_rules;
                  DELETE FROM roles;
                  DELETE FROM workplaces;
                  DELETE FROM salary_profiles;
                  DELETE FROM export_history;
                  DELETE FROM export_presets;
                  DELETE FROM app_settings;
                `);
              });
              Alert.alert('הצלחה', 'כל הנתונים נמחקו.', [
                { text: 'אישור', onPress: () => router.replace('/') } // Go to onboarding later
              ]);
            } catch (e: any) {
              Alert.alert('שגיאה במחיקה', e.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <AppScreen title={t('settings.dataManagement' as any)}>
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
            <Text style={textStyle}>ייבוא מתוך קובץ גיבוי של Shiftty. תוכל לבחור האם למזג או לדרוס.</Text>
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
