import { useLocalSearchParams, router , useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View, ScrollView } from 'react-native';

import { AppScreen } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { useWorkplaceNotificationSettings } from '@/features/notifications/hooks/use-workplace-notification-settings';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';

export default function WorkplaceNotificationOverridesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const { isRtl, t } = useTranslation();
  const {
    globalSettings,
    workplaceOverride,
    updateWorkplaceOverride,
    clearWorkplaceOverride,
    permissionStatus,
    requestPermission,
  } = useWorkplaceNotificationSettings(id as string);
  const repositories = useRepositories();
  const [workplaceName, setWorkplaceName] = useState<string>('');

  useFocusEffect(
    useCallback(() => {
      if (id) {
        repositories.workplaces.getById(id).then((wp: any) => {
          if (wp) setWorkplaceName(wp.name);
        }).catch(console.error);
      }
    }, [id, repositories.workplaces])
  );

  if (!globalSettings) return null;

  const hasOverride = workplaceOverride != null;
  const override = workplaceOverride;
  const settings = hasOverride ? override : globalSettings;

  const toggleOverride = async (enabled: boolean) => {
    if (!id) return;
    if (enabled) {
      await updateWorkplaceOverride({
        scheduledShiftReminders: globalSettings.scheduledShiftReminders,
      });
    } else {
      await clearWorkplaceOverride();
    }
  };

  const updateSetting = async (key: keyof NonNullable<typeof override>, value: boolean) => {
    if (!id) return;
    await updateWorkplaceOverride({
      [key]: value,
    });
  };

  const headingStyle = [
    styles.heading,
    { color: colors.textMuted, textAlign: isRtl ? ('right' as const) : ('left' as const) },
  ];
  const direction = isRtl ? 'row-reverse' : 'row';

  return (
    <AppScreen title={t('settings.overrideWorkplaceSettings')}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Text style={headingStyle}>{t('settings.overrideWorkplaceSettings')}</Text>
          <View style={[styles.row, { backgroundColor: colors.surface, flexDirection: direction }]}>
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: colors.text }]}>{t('settings.enableOverride')}</Text>
              <Text style={[styles.description, { color: colors.textMuted }]}>{t('settings.enableOverrideDescription')}</Text>
            </View>
            <Switch
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
              onValueChange={(val) => updateSetting('scheduledShiftReminders', val)}
            />
            <SettingSwitch
              label={t('settings.missedClockIn')}
              description={t('settings.missedClockInDesc')}
              value={override?.missedClockInReminders ?? globalSettings.missedClockInReminders}
              onValueChange={(val) => updateSetting('missedClockInReminders', val)}
            />
            <SettingSwitch
              label={t('settings.expectedEnd')}
              description={t('settings.expectedEndDesc')}
              value={override?.expectedEndReminders ?? globalSettings.expectedEndReminders}
              onValueChange={(val) => updateSetting('expectedEndReminders', val)}
            />
            <SettingSwitch
              label={t('settings.overdueShift')}
              description={t('settings.overdueShiftDesc')}
              value={override?.overdueShiftReminders ?? globalSettings.overdueShiftReminders}
              onValueChange={(val) => updateSetting('overdueShiftReminders', val)}
            />
            <SettingSwitch
              label={t('settings.longBreak')}
              description={t('settings.longBreakDesc')}
              value={override?.longBreakReminders ?? globalSettings.longBreakReminders}
              onValueChange={(val) => updateSetting('longBreakReminders', val)}
            />
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

function SettingSwitch({ label, description, value, onValueChange }: { label: string; description?: string; value: boolean; onValueChange: (v: boolean) => void }) {
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
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.xl },
  section: { gap: spacing.sm },
  heading: { fontSize: typography.caption, fontWeight: '700', paddingHorizontal: spacing.xs },
  row: { alignItems: 'center', borderRadius: 12, justifyContent: 'space-between', padding: spacing.md, gap: spacing.md },
  rowText: { flex: 1, gap: 4 },
  label: { fontSize: typography.body, fontWeight: '500' },
  description: { fontSize: typography.caption },
});
