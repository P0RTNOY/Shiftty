import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Platform } from 'react-native';

import type { NotificationPreferences, WorkplaceNotificationOverride } from '@/domain/entities/notification-preferences';
import { SqliteNotificationSettingsRepository } from '@/data/repositories/sqlite-notification-settings-repository';
import { expoNotificationAdapter, noOpNotificationAdapter } from '@/features/shifts/notifications/expo-notification-adapter';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

const adapter = Platform.OS === 'web' ? noOpNotificationAdapter : expoNotificationAdapter;

export function useWorkplaceNotificationSettings(workplaceId: string) {
  const database = useSQLiteContext();
  const repo = new SqliteNotificationSettingsRepository(database);

  const [globalSettings, setGlobalSettings] = useState<NotificationPreferences | null>(null);
  const [workplaceOverride, setWorkplaceOverride] = useState<WorkplaceNotificationOverride | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [global, override, status] = await Promise.all([
        repo.getGlobal(),
        repo.getWorkplaceOverride(workplaceId),
        adapter.getPermissionStatus(),
      ]);
      setGlobalSettings(global);
      setWorkplaceOverride(override);
      setPermissionStatus(status);
    } catch (caught) {
      reportUnexpectedError('workplace-notification-settings.refresh', caught);
      setError(true);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workplaceId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function requestPermission() {
    setError(false);
    try {
      const status = await adapter.requestPermission();
      setPermissionStatus(status);
      return status;
    } catch (caught) {
      reportUnexpectedError('workplace-notification-settings.permission', caught);
      setError(true);
      return 'undetermined' as const;
    }
  }

  async function updateWorkplaceOverride(updated: Partial<WorkplaceNotificationOverride>) {
    setSaving(true);
    setError(false);
    try {
      const current = workplaceOverride || { workplaceId };
      const next = { ...current, ...updated };
      await repo.updateWorkplaceOverride(next as WorkplaceNotificationOverride);
      setWorkplaceOverride(next as WorkplaceNotificationOverride);
    } catch (caught) {
      reportUnexpectedError('workplace-notification-settings.save', caught);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  async function clearWorkplaceOverride() {
    setSaving(true);
    setError(false);
    try {
      await repo.clearWorkplaceOverride(workplaceId);
      setWorkplaceOverride(null);
    } catch (caught) {
      reportUnexpectedError('workplace-notification-settings.clear', caught);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return {
    globalSettings,
    workplaceOverride,
    permissionStatus,
    loading,
    saving,
    error,
    refresh,
    updateWorkplaceOverride,
    clearWorkplaceOverride,
    requestPermission,
  };
}
