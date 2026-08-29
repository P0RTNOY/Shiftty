import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useAppStore } from '@/features/settings/store/app-store';
import { Alert, Text } from 'react-native';

import type { RecurrenceScope, Shift, ShiftStatus } from '@/domain/entities';
import { assertShiftStatusTransition, selectRecurrenceScopeOccurrences } from '@/domain/services';
import { RecurrenceScopeChooser } from '@/features/shifts/components/recurrence-scope-chooser';
import { ShiftDetailView } from '@/features/shifts/components/shift-detail-view';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { useShift } from '@/features/shifts/hooks/use-shifts';
import { useShiftTemplates } from '@/features/shifts/hooks/use-shift-templates';
import { useWorkplaces } from '@/features/workplaces/hooks/use-workplaces';
import { AppScreen, EmptyState, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { createId } from '@/shared/utils/id';
import { confirmAlert } from '@/shared/utils/confirm-alert';
import { formatLocalDateKey } from '@/shared/utils/zoned-time';
import { SalaryBreakdown, useSalaryDashboard } from '@/features/pay-rules';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

type ScopedAction = 'cancel' | 'restore' | 'delete';

export default function ShiftDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shift, loading, error, refresh, clear } = useShift(id);
  const repositories = useRepositories();
  const { workplaces, roles } = useWorkplaces();
  const { templates } = useShiftTemplates();
  const { t, formatCurrency } = useTranslation();
  const [pendingAction, setPendingAction] = useState<ScopedAction | null>(null);
  const [salaryCalculatedAt] = useState(() => new Date().toISOString());
  const activeShiftStore = useAppStore((state) => state.activeShift);
  const setActiveShiftStore = useAppStore((state) => state.setActiveShift);
  const salaryShifts = useMemo(() => shift ? [shift] : [], [shift]);
  const salary = useSalaryDashboard(salaryShifts, salaryCalculatedAt, shift?.status === 'active' ? salaryCalculatedAt : undefined);

  const requestScoped = (action: ScopedAction) => {
    if (shift?.recurrenceGroupId) setPendingAction(action);
    else void applyAction(action, 'only');
  };
  const applyAction = async (action: ScopedAction, scope: RecurrenceScope) => {
    if (!shift) return;
    try {
      const occurrences = shift.recurrenceGroupId ? await repositories.shifts.list({ recurrenceGroupId: shift.recurrenceGroupId }) : [shift];
      const selected = selectRecurrenceScopeOccurrences(occurrences, shift, scope);
      const localDate = shift.recurrenceGroupId
        ? formatLocalDateKey(shift.recurrenceOriginalStart ?? shift.scheduledStart!, shift.timezone)
        : undefined;
      const series = shift.recurrenceGroupId ? await repositories.recurrence.getSeries(shift.recurrenceGroupId) : null;
      if (action === 'delete') {
        if (shift.recurrenceGroupId) await repositories.recurrence.applyMutation({
          shiftIdsToDelete: selected.map((item) => item.id),
          exceptionsToSave: scope === 'only' ? [recurrenceException(shift, 'deleted')] : [],
          seriesToSave: scope === 'future' && series ? [{ ...series, disabledFrom: localDate, updatedAt: new Date().toISOString() }] : [],
          seriesIdsToDelete: scope === 'entire' ? [shift.recurrenceGroupId] : [],
        });
        else await repositories.shifts.deleteMany(selected.map((item) => item.id));
        if (activeShiftStore?.id === shift.id) setActiveShiftStore(null);
        clear();
        router.replace('/calendar');
        return;
      }
      const targetStatus: ShiftStatus = action === 'cancel' ? 'cancelled' : 'scheduled';
      const now = new Date().toISOString();
      const updates = selected.filter((item) => {
        try { assertShiftStatusTransition(item.status, targetStatus); return true; } catch { return false; }
      }).map((item) => ({ ...item, status: targetStatus, cancelledAt: targetStatus === 'cancelled' ? now : undefined, updatedAt: now }));
      if (action === 'restore') {
        const overlaps = (await Promise.all(updates.map((item) => repositories.shifts.findOverlapping({ start: item.scheduledStart!, end: item.scheduledEnd! }, item.id)))).flat();
        if (overlaps.length && !await confirmAlert(t('form.overlapTitle'), t('form.overlapBody'), t('common.cancel'), t('common.confirm'))) return;
      }
      if (shift.recurrenceGroupId) await repositories.recurrence.applyMutation({
        shiftsToSave: updates,
        exceptionsToSave: scope === 'only' ? [recurrenceException(shift, 'modified')] : [],
        seriesToSave: scope !== 'only' && series ? [{ ...series, disabledFrom: action === 'cancel' ? (scope === 'entire' ? series.rule.startsOn : localDate) : undefined, updatedAt: new Date().toISOString() }] : [],
      });
      else await repositories.shifts.saveMany(updates);
      await refresh();
    } catch (caught) { reportUnexpectedError('shift.details.applyAction', caught); Alert.alert(t('common.error')); }
    finally { setPendingAction(null); }
  };
  const markMissed = async () => {
    if (!shift) return;
    try { assertShiftStatusTransition(shift.status, 'missed'); await repositories.shifts.update({ ...shift, status: 'missed', updatedAt: new Date().toISOString() }); await refresh(); }
    catch (caught) { reportUnexpectedError('shift.details.markMissed', caught); Alert.alert(t('common.error')); }
  };
  const recalculateSalary = async () => {
    if (!shift || shift.status !== 'completed') return;
    try {
      const now = new Date().toISOString(); const preview = await salary.coordinator.previewShift(shift, now, undefined, true);
      const previous = salary.summary?.resultsByShiftId[shift.id]?.totalGrossPayMinor; const next = preview.totalGrossPayMinor;
      Alert.alert(t('salary.recalculateTitle'), `${t('salary.recalculateBody')}\n${previous === undefined ? t('salary.missingConfig') : formatCurrency(previous)} → ${next === undefined ? t('salary.missingConfig') : formatCurrency(next)}`, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: () => void salary.coordinator.finalizeCompletedShift(shift, now, true).then(refresh).catch((caught) => { reportUnexpectedError('shift.details.recalculate.confirm', caught); Alert.alert(t('common.error')); }) },
      ]);
    } catch (caught) { reportUnexpectedError('shift.details.recalculate.preview', caught); Alert.alert(t('common.error')); }
  };

  return <AppScreen title={t('shift.details')}>
    <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
    {loading ? <Text>{t('common.loading')}</Text> : null}
    {error ? <Text accessibilityRole="alert">{t('common.error')}</Text> : null}
    {!loading && !shift ? <EmptyState body={t('shift.notFound')} title={t('common.error')} /> : null}
    {shift ? <ShiftDetailView
      onCancel={() => requestScoped('cancel')}
      onDelete={() => requestScoped('delete')}
      onDuplicate={() => router.push(`/shifts/new?mode=${shift.status === 'completed' ? 'completed' : 'scheduled'}&duplicate=${shift.id}`)}
      onEdit={() => router.push(`/shifts/${shift.id}/edit`)}
      onMarkMissed={() => void markMissed()}
      onRestore={() => requestScoped('restore')}
      onStart={() => shift.status === 'active' ? router.push('/shifts/active/end') : router.push(`/shifts/start?shiftId=${shift.id}`)}
      onManageBreaks={() => router.push(`/shifts/${shift.id}/breaks`)}
      onCancelTracking={() => router.push('/shifts/active/cancel')}
      roleName={roles.find((item) => item.id === shift.roleId)?.name}
      shift={shift}
      templateName={templates.find((item) => item.id === shift.shiftTemplateId)?.name}
      workplaceName={workplaces.find((item) => item.id === shift.workplaceId)?.name ?? '—'}
    /> : null}
    {shift ? <SalaryBreakdown
      onOpenSalarySettings={() => router.push('/settings/salary')}
      onRecalculate={shift.status === 'completed' ? () => void recalculateSalary() : undefined}
      result={salary.summary?.resultsByShiftId[shift.id]}
      status={shift.status === 'scheduled' || shift.status === 'active' ? 'estimated' : shift.salaryCalculationStatus}
    /> : null}
    <RecurrenceScopeChooser onChoose={(scope) => pendingAction ? void applyAction(pendingAction, scope) : undefined} onDismiss={() => setPendingAction(null)} visible={pendingAction !== null} />
  </AppScreen>;
}

function recurrenceException(target: Shift, type: 'deleted' | 'modified') {
  return { id: createId('exception'), seriesId: target.recurrenceGroupId!, localDate: formatLocalDateKey(target.recurrenceOriginalStart ?? target.scheduledStart!, target.timezone), type, shiftId: type === 'modified' ? target.id : undefined, createdAt: new Date().toISOString() } as const;
}
