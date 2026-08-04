import React from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';

import type { NotificationPreferences } from '@/domain/entities/notification-preferences';
import { notificationPreferencesSchema } from '@/domain/entities/notification-preferences';
import { AppScreen } from '@/shared/components/app-screen';
import { PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { useNotificationSettings } from '@/features/notifications/hooks/use-notification-settings';

const OFFSET_OPTIONS = [1440, 120, 60, 30, 15, 0] as const;

export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { preferences, permissionStatus, loading, saving, save, requestPermission } = useNotificationSettings();

  if (loading || !preferences) {
    return (
      <AppScreen title={t('notification.settings.title')}>
        <Stack.Screen options={{ title: t('notification.settings.title') }} />
        <View style={styles.center} />
      </AppScreen>
    );
  }

  async function toggle<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) {
    await save({ ...preferences!, [key]: value });
  }

  async function handlePermissionRequest() {
    if (Platform.OS === 'web') {
      Alert.alert(t('notification.webUnsupported'));
      return;
    }
    const status = await requestPermission();
    if (status === 'denied') {
      Alert.alert(t('notification.permissionDeniedTitle'), t('notification.permissionDeniedBody'));
    }
  }

  const renderSectionHeader = (title: string) => (
    <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>{title}</Text>
  );

  const renderToggleRow = (label: string, value: boolean, onToggle: (v: boolean) => void, testID?: string) => (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
      />
    </View>
  );

  return (
    <AppScreen title={t('notification.settings.title')}>
      <Stack.Screen options={{ title: t('notification.settings.title') }} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Permission banner */}
        {permissionStatus !== 'granted' && (
          <View style={[styles.permissionBanner, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.permissionText, { color: colors.textMuted }]}>
              {t('notification.permissionExplain')}
            </Text>
            <PrimaryButton
              label={t('notification.enableNotifications')}
              onPress={() => void handlePermissionRequest()}
            />
          </View>
        )}

        {/* Master toggle */}
        {renderToggleRow(
          t('notification.masterToggle'),
          preferences.masterEnabled,
          (v) => void toggle('masterEnabled', v),
          'notif_master_toggle',
        )}

        {renderSectionHeader(t('notification.shiftReminders'))}
        {renderToggleRow(
          t('notification.shiftReminders'),
          preferences.scheduledShiftReminders,
          (v) => void toggle('scheduledShiftReminders', v),
        )}

        {preferences.scheduledShiftReminders && (
          <View style={styles.offsetsContainer}>
            <Text style={[styles.rowLabel, { color: colors.textMuted, marginBottom: spacing.xs }]}>
              {t('notification.shiftReminderOffsets')}
            </Text>
            {OFFSET_OPTIONS.map((offset) => {
              const active = preferences.shiftReminderOffsets.includes(offset);
              return (
                <TouchableOpacity
                  key={offset}
                  style={[styles.offsetChip, { backgroundColor: active ? colors.primary : colors.surfaceMuted }]}
                  onPress={() => {
                    const next = active
                      ? preferences.shiftReminderOffsets.filter((o) => o !== offset)
                      : [...preferences.shiftReminderOffsets, offset];
                    void toggle('shiftReminderOffsets', next);
                  }}
                >
                  <Text style={[styles.offsetText, { color: active ? colors.onPrimary : colors.textMuted }]}>
                    {t(`notification.offset.${offset}` as `notification.offset.${typeof offset}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {renderSectionHeader(t('notification.missedClockIn'))}
        {renderToggleRow(
          t('notification.missedClockIn'),
          preferences.missedClockInReminders,
          (v) => void toggle('missedClockInReminders', v),
        )}

        {renderSectionHeader('שמירת משמרת פעילה')}
        {renderToggleRow(
          t('notification.expectedEndReminders'),
          preferences.expectedEndReminders,
          (v) => void toggle('expectedEndReminders', v),
        )}
        {renderToggleRow(
          t('notification.overdueShift'),
          preferences.overdueShiftReminders,
          (v) => void toggle('overdueShiftReminders', v),
        )}
        {renderToggleRow(
          t('notification.longBreak'),
          preferences.longBreakReminders,
          (v) => void toggle('longBreakReminders', v),
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.xxs },
  permissionBanner: { borderRadius: 12, gap: spacing.sm, marginBottom: spacing.md, padding: spacing.md },
  permissionText: { fontSize: typography.body, lineHeight: 22, textAlign: 'center' },
  sectionHeader: { fontSize: typography.caption, marginBottom: spacing.xs, marginTop: spacing.md, textTransform: 'uppercase' },
  row: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  rowLabel: { flex: 1, fontSize: typography.body },
  offsetsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm, marginTop: spacing.xs },
  offsetChip: { borderRadius: 20, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  offsetText: { fontSize: typography.caption },
});
