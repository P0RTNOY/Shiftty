import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Platform } from 'react-native';

import type { NotificationPreferences, WorkplaceNotificationOverride } from '@/domain/entities/notification-preferences';
import { SqliteNotificationSettingsRepository } from '@/data/repositories/sqlite-notification-settings-repository';
import { expoNotificationAdapter, noOpNotificationAdapter } from '@/features/shifts/notifications/expo-notification-adapter';

const adapter = Platform.OS === 'web' ? noOpNotificationAdapter : expoNotificationAdapter;

export function useWorkplaceNotificationSettings(workplaceId: string) {
  const database = useSQLiteContext();
  const repo = new SqliteNotificationSettingsRepository(database);

  const [globalSettings, setGlobalSettings] = useState<NotificationPreferences | null>(null);
  const [workplaceOverride, setWorkplaceOverride] = useState<WorkplaceNotificationOverride | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [global, override, status] = await Promise.all([
        repo.getGlobal(),
        repo.getWorkplaceOverride(workplaceId),
        adapter.getPermissionStatus(),
      ]);
      setGlobalSettings(global);
      setWorkplaceOverride(override);
      setPermissionStatus(status);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workplaceId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function requestPermission() {
    const status = await adapter.requestPermission();
    setPermissionStatus(status);
    return status;
  }

  async function updateWorkplaceOverride(updated: Partial<WorkplaceNotificationOverride>) {
    setSaving(true);
    try {
      const current = workplaceOverride || { workplaceId };
      const next = { ...current, ...updated };
      await repo.updateWorkplaceOverride(next as WorkplaceNotificationOverride);
      setWorkplaceOverride(next as WorkplaceNotificationOverride);
    } finally {
      setSaving(false);
    }
  }

  async function clearWorkplaceOverride() {
    setSaving(true);
    try {
      await repo.clearWorkplaceOverride(workplaceId);
      setWorkplaceOverride(null);
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
    refresh,
    updateWorkplaceOverride,
    clearWorkplaceOverride,
    requestPermission,
  };
}
