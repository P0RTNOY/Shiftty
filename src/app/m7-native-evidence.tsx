import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import * as Localization from 'expo-localization';
import * as Notifications from 'expo-notifications';

import { shiftSchema } from '@/domain/entities';
import { useNotificationReconciler } from '@/features/shifts/hooks/use-notification-reconciler';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import {
  countOwnedNotifications,
  isM7NativeEvidenceEnabled,
} from '@/features/shifts/notifications/m7-native-evidence';
import { expoNotificationAdapter } from '@/features/shifts/notifications/expo-notification-adapter';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { resolveLocalDateTime } from '@/shared/utils/zoned-time';

const QA_SHIFT_ID_PREFIX = 'm7qa-notification-';
const QA_SHIFT_TITLE = 'M7 QA notification check';

type QaScenario = 'background' | 'cancellation' | 'foreground' | 'terminated';

interface EvidenceSummary {
  deliveredCount: number;
  pendingCount: number;
  permission: Notifications.PermissionStatus;
  persistedCount: number;
  timezone: string;
  timezoneGap: string;
  timezoneOverlap: string;
}

export default function M7NativeEvidenceScreen() {
  const enabled = isM7NativeEvidenceEnabled();
  const { colors } = useAppTheme();
  const repositories = useRepositories();
  const { reconcileAll } = useNotificationReconciler();
  const [summary, setSummary] = useState<EvidenceSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setBusy(true);
    setFailed(false);
    try {
      const [permission, pending, delivered, persisted] = await Promise.all([
        Notifications.getPermissionsAsync(),
        Notifications.getAllScheduledNotificationsAsync(),
        Notifications.getPresentedNotificationsAsync(),
        repositories.scheduledNotifications.listAll(),
      ]);
      setSummary({
        deliveredCount: countOwnedNotifications(delivered.map(({ request }) => request)),
        pendingCount: countOwnedNotifications(pending),
        permission: permission.status,
        persistedCount: persisted.length,
        timezone: Localization.getCalendars()[0]?.timeZone ?? 'unknown',
        timezoneGap: resolveLocalDateTime('2026-03-27', '02:30', 'Asia/Jerusalem'),
        timezoneOverlap: resolveLocalDateTime('2026-10-25', '01:30', 'Asia/Jerusalem'),
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [enabled, repositories.scheduledNotifications]);

  useEffect(() => {
    const timeout = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timeout);
  }, [refresh]);

  if (!enabled) return <Redirect href="/" />;

  async function reconcileAndRefresh() {
    setBusy(true);
    setFailed(false);
    try {
      await reconcileAll(new Date());
      await refresh();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  async function scheduleBoundedQaShift(scenario: QaScenario, delaySeconds = 45) {
    setBusy(true);
    setFailed(false);
    setActionStatus(null);
    try {
      const workplace = (await repositories.workplaces.list()).find((item) => !item.isArchived);
      if (!workplace) throw new Error('QA workplace unavailable');
      const now = new Date();
      const shiftId = `${QA_SHIFT_ID_PREFIX}${scenario}`;
      const existingShift = await repositories.shifts.getById(shiftId);
      if (existingShift) {
        await repositories.shifts.deleteMany([shiftId]);
        await reconcileAll(now);
      }
      const scheduledStart = new Date(now.getTime() + delaySeconds * 1_000);
      const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60_000);
      await repositories.shifts.save(shiftSchema.parse({
        id: shiftId,
        workplaceId: workplace.id,
        title: QA_SHIFT_TITLE,
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        expectedBreakMinutes: 0,
        status: 'scheduled',
        hourlyRateSnapshotMinor: workplace.defaultHourlyRateMinor,
        salaryCalculationStatus: 'not_calculated',
        timezone: 'Asia/Jerusalem',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }));
      await reconcileAll(now);
      setActionStatus(`${scenario} scheduled for ${scheduledStart.toISOString()}.`);
      await refresh();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  async function cleanupBoundedQaShifts() {
    setBusy(true);
    setFailed(false);
    setActionStatus(null);
    try {
      const qaShifts = (await repositories.shifts.list()).filter((shift) => shift.id.startsWith(QA_SHIFT_ID_PREFIX));
      await repositories.shifts.deleteMany(qaShifts.map((shift) => shift.id));
      await reconcileAll(new Date());
      const delivered = await Notifications.getPresentedNotificationsAsync();
      await Promise.all(delivered
        .filter(({ request }) => request.content.data?.owner === 'shifty')
        .map(({ request }) => Notifications.dismissNotificationAsync(request.identifier)));
      setActionStatus('QA notification shifts were removed through production repositories.');
      await refresh();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  async function invalidateOwnedNativeRequests() {
    setBusy(true);
    setFailed(false);
    setActionStatus(null);
    try {
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      const owned = pending.filter((request) => request.content.data?.owner === 'shifty');
      await Promise.all(owned.map((request) => expoNotificationAdapter.cancelNotification(request.identifier)));
      setActionStatus(`Invalidated ${owned.length} owned native request(s); persisted metadata was retained.`);
      await refresh();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: 'M7 Native Evidence' }} />
      <Text style={[styles.title, { color: colors.text }]}>M7 Native Evidence</Text>
      <Text style={[styles.notice, { color: colors.textMuted }]}>QA-only, count-only diagnostics. No identifiers or notification content are shown or logged.</Text>
      {busy && !summary ? <ActivityIndicator color={colors.primary} /> : null}
      {summary ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <EvidenceRow label="Permission" value={summary.permission} />
          <EvidenceRow label="Native pending (Shiftty)" value={String(summary.pendingCount)} />
          <EvidenceRow label="Native delivered (Shiftty)" value={String(summary.deliveredCount)} />
          <EvidenceRow label="Persisted metadata" value={String(summary.persistedCount)} />
          <EvidenceRow label="Device timezone" value={summary.timezone} />
          <EvidenceRow label="Jerusalem overlap" value={summary.timezoneOverlap} />
          <EvidenceRow label="Jerusalem gap" value={summary.timezoneGap} />
        </View>
      ) : null}
      {failed ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>Diagnostic refresh failed.</Text> : null}
      {actionStatus ? <Text style={{ color: colors.textMuted }}>{actionStatus}</Text> : null}
      <TouchableOpacity
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void refresh()}
        style={[styles.button, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Refresh native state</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void reconcileAndRefresh()}
        style={[styles.button, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Run production reconciliation</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void scheduleBoundedQaShift('foreground')}
        style={[styles.button, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Schedule foreground scenario (+45s)</Text>
      </TouchableOpacity>
      {(['background', 'terminated'] as const).map((scenario) => (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy}
          key={scenario}
          onPress={() => void scheduleBoundedQaShift(scenario)}
          style={[styles.button, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Schedule {scenario} scenario (+45s)</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void scheduleBoundedQaShift('cancellation', 120)}
        style={[styles.button, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Schedule cancellation scenario (+120s)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void invalidateOwnedNativeRequests()}
        style={[styles.button, { backgroundColor: colors.surface, opacity: busy ? 0.6 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: colors.text }]}>Invalidate owned native request (D8)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void cleanupBoundedQaShifts()}
        style={[styles.button, { backgroundColor: colors.surface, opacity: busy ? 0.6 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: colors.text }]}>Remove QA notification shifts</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 10,
    padding: spacing.md,
  },
  buttonText: {
    fontSize: typography.body,
    fontWeight: '700',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  container: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  label: {
    fontSize: typography.caption,
  },
  notice: {
    fontSize: typography.body,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: typography.title,
    fontWeight: '700',
  },
  value: {
    fontSize: typography.body,
    fontWeight: '600',
  },
});
