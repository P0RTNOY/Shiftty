import React from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';

import type { NotificationPreferences } from '@/domain/entities/notification-preferences';
import { AppScreen } from '@/shared/components/app-screen';
import { PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { useNotificationSettings } from '@/features/notifications/hooks/use-notification-settings';
import { SettingsBackButton } from '@/features/settings/components/settings-back-button';
import { useNotificationReconciler } from '@/features/shifts/hooks/use-notification-reconciler';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

const OFFSET_OPTIONS = [1440, 120, 60, 30, 15, 0] as const;

export default function NotificationSettingsScreen() {
  const { isRtl, t } = useTranslation();
  const { colors } = useAppTheme();
  const { preferences, permissionStatus, loading, saving, error, save, requestPermission } = useNotificationSettings();
  const { reconcileAll } = useNotificationReconciler();

  if (loading || !preferences) {
    return (
      <AppScreen title={t('notification.settings.title')}>
        <Stack.Screen options={{ title: t('notification.settings.title') }} />
        <SettingsBackButton />
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel={t('common.loading')} color={colors.primary} />
          <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>
          {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{t('common.error')}</Text> : null}
        </View>
      </AppScreen>
    );
  }

  async function toggle<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) {
    await save({ ...preferences!, [key]: value });
    await reconcileAll(new Date()).catch((caught: unknown) => reportUnexpectedError('notification-settings.reconcile', caught));
  }

  async function handlePermissionRequest() {
    if (Platform.OS === 'web') {
      Alert.alert(t('notification.webUnsupported'));
      return;
    }
    const status = await requestPermission();
    if (status === 'granted') {
      await reconcileAll(new Date()).catch((caught: unknown) => reportUnexpectedError('notification-settings.reconcile', caught));
    }
    if (status === 'denied') {
      Alert.alert(t('notification.permissionDeniedTitle'), t('notification.permissionDeniedBody'));
    }
  }

  const renderSectionHeader = (title: string) => (
    <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>{title}</Text>
  );

  const renderToggleRow = (label: string, value: boolean, onToggle: (v: boolean) => void, testID?: string) => (
    <View style={[styles.row, { borderBottomColor: colors.border, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value, disabled: saving }}
        disabled={saving}
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
      <SettingsBackButton />
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, textAlign: isRtl ? 'right' : 'left' }}>{t('common.error')}</Text> : null}
        {/* Permission banner */}
        {permissionStatus !== 'granted' && (
          <View style={[styles.permissionBanner, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.permissionText, { color: colors.textMuted }]}>
              {t('notification.permissionExplain')}
            </Text>
            <PrimaryButton
              label={t('notification.enableNotifications')}
              onPress={() => void handlePermissionRequest()}
              testID="e2e-notifications-enable"
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
          'e2e-notifications-scheduled',
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
                  accessibilityLabel={t(`notification.offset.${offset}` as `notification.offset.${typeof offset}`)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active, disabled: saving }}
                  disabled={saving}
                  key={offset}
                  testID={`e2e-notification-offset-${offset}`}
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
          'e2e-notifications-missed',
        )}

        {renderSectionHeader(t('notification.activeShiftSafety'))}
        {renderToggleRow(
          t('notification.expectedEndReminders'),
          preferences.expectedEndReminders,
          (v) => void toggle('expectedEndReminders', v),
          'e2e-notifications-expected-end',
        )}
        {renderToggleRow(
          t('notification.overdueShift'),
          preferences.overdueShiftReminders,
          (v) => void toggle('overdueShiftReminders', v),
          'e2e-notifications-overdue',
        )}
        {renderToggleRow(
          t('notification.longBreak'),
          preferences.longBreakReminders,
          (v) => void toggle('longBreakReminders', v),
          'e2e-notifications-long-break',
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, gap: spacing.sm, justifyContent: 'center' },
  content: { padding: spacing.md, gap: spacing.xxs },
  permissionBanner: { borderRadius: 12, gap: spacing.sm, marginBottom: spacing.md, padding: spacing.md },
  permissionText: { fontSize: typography.body, lineHeight: 22, textAlign: 'center' },
  sectionHeader: { fontSize: typography.caption, marginBottom: spacing.xs, marginTop: spacing.md, textTransform: 'uppercase' },
  row: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'space-between', paddingVertical: spacing.sm },
  rowLabel: { flex: 1, fontSize: typography.body },
  offsetsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm, marginTop: spacing.xs },
  offsetChip: { alignItems: 'center', borderRadius: 22, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.sm },
  offsetText: { fontSize: typography.caption },
});
