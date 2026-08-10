import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Platform } from 'react-native';

import type { NotificationPreferences } from '@/domain/entities/notification-preferences';
import { SqliteNotificationSettingsRepository } from '@/data/repositories/sqlite-notification-settings-repository';
import { expoNotificationAdapter, noOpNotificationAdapter } from '@/features/shifts/notifications/expo-notification-adapter';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

const adapter = Platform.OS === 'web' ? noOpNotificationAdapter : expoNotificationAdapter;

export function useNotificationSettings() {
  const database = useSQLiteContext();
  const repo = new SqliteNotificationSettingsRepository(database);

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [prefs, status] = await Promise.all([
        repo.getGlobal(),
        adapter.getPermissionStatus(),
      ]);
      setPreferences(prefs);
      setPermissionStatus(status);
    } catch (caught) {
      reportUnexpectedError('notification-settings.refresh', caught);
      setError(true);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function requestPermission() {
    setError(false);
    try {
      const status = await adapter.requestPermission();
      setPermissionStatus(status);
      return status;
    } catch (caught) {
      reportUnexpectedError('notification-settings.permission', caught);
      setError(true);
      return 'undetermined' as const;
    }
  }

  async function save(updated: NotificationPreferences) {
    setSaving(true);
    setError(false);
    try {
      const saved = await repo.updateGlobal(updated);
      setPreferences(saved);
    } catch (caught) {
      reportUnexpectedError('notification-settings.save', caught);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return { preferences, permissionStatus, loading, saving, error, refresh, save, requestPermission };
}
