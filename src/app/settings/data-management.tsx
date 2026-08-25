import { useState } from 'react';
import { StyleSheet, Text, View, Alert, ActivityIndicator } from 'react-native';
import { AppScreen, PrimaryButton, SecondaryButton } from '@/shared/components';
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
        dialogTitle: t('data.exportDialogTitle')
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
        Alert.alert(t('data.restoreErrorTitle'), t('data.invalidBackup'));
        return;
      }

      // Restore Preview & Strategy Choice
      Alert.alert(
        t('data.restoreTitle'),
        t('data.restorePreview', { count: validation.envelope.counts.shifts }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { 
            text: t('data.merge'),
            onPress: async () => {
              setLoading(true);
              const result = await orchestrator.restoreMerge(content);
              setLoading(false);
              if (result.success) {
                await synchronizeActiveShiftAfterDataMutation('restore', new SqliteShiftRepository(db), setActiveShift);
                Alert.alert(t('data.success'), t('data.mergeSuccess'));
              } else {
                reportUnexpectedError('backup.restore.merge', result.message);
                Alert.alert(t('common.error'), t('data.mergeFailure'));
              }
            } 
          },
          { 
            text: t('data.replace'),
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              const result = await orchestrator.restoreReplace(content);
              setLoading(false);
              if (result.success) {
                await synchronizeActiveShiftAfterDataMutation('restore', new SqliteShiftRepository(db), setActiveShift);
                Alert.alert(t('data.success'), t('data.replaceSuccess'));
              } else {
                reportUnexpectedError('backup.restore.replace', result.message);
                Alert.alert(t('common.error'), t('data.replaceFailure'));
              }
            } 
          }
        ]
      );
    } catch (error) {
      reportUnexpectedError('backup.read', error);
      Alert.alert(t('data.readErrorTitle'), t('data.readError'));
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllData = () => {
    Alert.alert(
      t('data.deleteAll'),
      t('data.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('data.deleteAll'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const result = await new BackupOrchestrator(db).clearAllData();
              if (!result.success) throw new Error(result.message ?? 'Clear all failed');
              await synchronizeActiveShiftAfterDataMutation('clear', new SqliteShiftRepository(db), setActiveShift);
              Alert.alert(t('data.success'), t('data.deleted'), [
                { text: t('common.confirm'), onPress: () => router.replace('/') }
              ]);
            } catch (error) {
              reportUnexpectedError('backup.clearAll', error);
              Alert.alert(t('data.deleteErrorTitle'), t('data.deleteFailure'));
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
          <Text accessibilityRole="alert" style={[styles.text, { color: colors.text, marginTop: spacing.md }]}>{t('data.processing')}</Text>
        </View>
      ) : (
        <View style={styles.container}>
          <View style={styles.section}>
            <Text style={headingStyle}>{t('data.backupHeading')}</Text>
            <Text style={textStyle}>{t('data.backupBody')}</Text>
            <PrimaryButton label={t('data.exportNow')} onPress={handleExportBackup} testID="e2e-backup-export" />
          </View>

          <View style={styles.section}>
            <Text style={headingStyle}>{t('data.restoreHeading')}</Text>
            <Text style={textStyle}>{t('data.restoreBody')}</Text>
            <PrimaryButton label={t('data.chooseBackup')} onPress={handleRestoreBackup} testID="e2e-backup-restore" />
          </View>

          <View style={styles.section}>
            <Text style={headingStyle}>{t('data.resetHeading')}</Text>
            <Text style={textStyle}>{t('data.resetBody')}</Text>
            <SecondaryButton
              destructive
              label={t('data.deleteAll')}
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
