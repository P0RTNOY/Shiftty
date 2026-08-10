import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Switch, Text, View, ScrollView } from 'react-native';

import { AppScreen } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { useWorkplaceNotificationSettings } from '@/features/notifications/hooks/use-workplace-notification-settings';
import { SettingsBackButton } from '@/features/settings/components/settings-back-button';
import { useNotificationReconciler } from '@/features/shifts/hooks/use-notification-reconciler';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

export default function WorkplaceNotificationOverridesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { isRtl, t } = useTranslation();
  const { reconcileAll } = useNotificationReconciler();
  const {
    globalSettings,
    workplaceOverride,
    loading,
    saving,
    error,
    updateWorkplaceOverride,
    clearWorkplaceOverride,
  } = useWorkplaceNotificationSettings(id as string);

  if (loading || !globalSettings) {
    return (
      <AppScreen title={t('settings.overrideWorkplaceSettings')}>
        <SettingsBackButton />
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
          {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{t('common.error')}</Text> : null}
        </View>
      </AppScreen>
    );
  }

  const hasOverride = workplaceOverride != null;
  const override = workplaceOverride;
  const toggleOverride = async (enabled: boolean) => {
    if (!id) return;
    if (enabled) {
      await updateWorkplaceOverride({
        scheduledShiftReminders: globalSettings.scheduledShiftReminders,
      });
    } else {
      await clearWorkplaceOverride();
    }
    await reconcileAll(new Date()).catch((caught: unknown) => reportUnexpectedError('workplace-notification-settings.reconcile', caught));
  };

  const updateSetting = async (key: keyof NonNullable<typeof override>, value: boolean) => {
    if (!id) return;
    await updateWorkplaceOverride({
      [key]: value,
    });
    await reconcileAll(new Date()).catch((caught: unknown) => reportUnexpectedError('workplace-notification-settings.reconcile', caught));
  };

  const headingStyle = [
    styles.heading,
    { color: colors.textMuted, textAlign: isRtl ? ('right' as const) : ('left' as const) },
  ];
  const direction = isRtl ? 'row-reverse' : 'row';

  return (
    <AppScreen title={t('settings.overrideWorkplaceSettings')}>
      <SettingsBackButton />
      <ScrollView contentContainerStyle={styles.container}>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, textAlign: isRtl ? 'right' : 'left' }}>{t('common.error')}</Text> : null}
        <View style={styles.section}>
          <Text style={headingStyle}>{t('settings.overrideWorkplaceSettings')}</Text>
          <View style={[styles.row, { backgroundColor: colors.surface, flexDirection: direction }]}>
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: colors.text }]}>{t('settings.enableOverride')}</Text>
              <Text style={[styles.description, { color: colors.textMuted }]}>{t('settings.enableOverrideDescription')}</Text>
            </View>
            <Switch
              accessibilityLabel={t('settings.enableOverride')}
              accessibilityRole="switch"
              accessibilityState={{ checked: hasOverride, disabled: saving }}
              disabled={saving}
              value={hasOverride}
              onValueChange={toggleOverride}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </View>

        {hasOverride && (
          <View style={styles.section}>
            <Text style={headingStyle}>{t('settings.notificationTypes')}</Text>
            <SettingSwitch
              label={t('settings.scheduledShiftReminders')}
              description={t('settings.scheduledShiftRemindersDesc')}
              value={override?.scheduledShiftReminders ?? globalSettings.scheduledShiftReminders}
              disabled={saving}
              onValueChange={(val) => updateSetting('scheduledShiftReminders', val)}
            />
            <SettingSwitch
              label={t('settings.missedClockIn')}
              description={t('settings.missedClockInDesc')}
              value={override?.missedClockInReminders ?? globalSettings.missedClockInReminders}
              disabled={saving}
              onValueChange={(val) => updateSetting('missedClockInReminders', val)}
            />
            <SettingSwitch
              label={t('settings.expectedEnd')}
              description={t('settings.expectedEndDesc')}
              value={override?.expectedEndReminders ?? globalSettings.expectedEndReminders}
              disabled={saving}
              onValueChange={(val) => updateSetting('expectedEndReminders', val)}
            />
            <SettingSwitch
              label={t('settings.overdueShift')}
              description={t('settings.overdueShiftDesc')}
              value={override?.overdueShiftReminders ?? globalSettings.overdueShiftReminders}
              disabled={saving}
              onValueChange={(val) => updateSetting('overdueShiftReminders', val)}
            />
            <SettingSwitch
              label={t('settings.longBreak')}
              description={t('settings.longBreakDesc')}
              value={override?.longBreakReminders ?? globalSettings.longBreakReminders}
              disabled={saving}
              onValueChange={(val) => updateSetting('longBreakReminders', val)}
            />
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

function SettingSwitch({ label, description, value, disabled, onValueChange }: { label: string; description?: string; value: boolean; disabled: boolean; onValueChange: (v: boolean) => void }) {
  const { colors } = useAppTheme();
  const { isRtl } = useTranslation();
  const direction = isRtl ? 'row-reverse' : 'row';

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, flexDirection: direction }]}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {description && <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', flex: 1, gap: spacing.sm, justifyContent: 'center' },
  container: { padding: spacing.md, gap: spacing.xl },
  section: { gap: spacing.sm },
  heading: { fontSize: typography.caption, fontWeight: '700', paddingHorizontal: spacing.xs },
  row: { alignItems: 'center', borderRadius: 12, justifyContent: 'space-between', padding: spacing.md, gap: spacing.md },
  rowText: { flex: 1, gap: 4 },
  label: { fontSize: typography.body, fontWeight: '500' },
  description: { fontSize: typography.caption },
});
