import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Platform } from 'react-native';

import type { NotificationPreferences } from '@/domain/entities/notification-preferences';
import { SqliteNotificationSettingsRepository } from '@/data/repositories/sqlite-notification-settings-repository';
import { expoNotificationAdapter, noOpNotificationAdapter } from '@/features/shifts/notifications/expo-notification-adapter';

const adapter = Platform.OS === 'web' ? noOpNotificationAdapter : expoNotificationAdapter;

export function useNotificationSettings() {
  const database = useSQLiteContext();
  const repo = new SqliteNotificationSettingsRepository(database);

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [prefs, status] = await Promise.all([
        repo.getGlobal(),
        adapter.getPermissionStatus(),
      ]);
      setPreferences(prefs);
      setPermissionStatus(status);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function requestPermission() {
    const status = await adapter.requestPermission();
    setPermissionStatus(status);
    return status;
  }

  async function save(updated: NotificationPreferences) {
    setSaving(true);
    try {
      const saved = await repo.updateGlobal(updated);
      setPreferences(saved);
    } finally {
      setSaving(false);
    }
  }

  return { preferences, permissionStatus, loading, saving, refresh, save, requestPermission };
}
