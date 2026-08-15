import { subDays, format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';

import type { RecurrenceException, RecurrenceScope, RecurrenceSeries, Shift } from '@/domain/entities';
import { generateRecurrenceOccurrences, getEffectiveShiftRange, planRecurrenceEdit, selectRecurrenceScopeOccurrences } from '@/domain/services';
import { RecurrenceScopeChooser } from '@/features/shifts/components/recurrence-scope-chooser';
import { ShiftForm } from '@/features/shifts/components/shift-form';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { useShift } from '@/features/shifts/hooks/use-shifts';
import { useShiftTemplates } from '@/features/shifts/hooks/use-shift-templates';
import { useWorkplaces } from '@/features/workplaces/hooks/use-workplaces';
import { AppScreen, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { createId } from '@/shared/utils/id';
import { confirmAlert } from '@/shared/utils/confirm-alert';
import { formatLocalDateKey, formatLocalTime, resolveLocalShiftRange } from '@/shared/utils/zoned-time';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';
import { SalaryCalculationCoordinator } from '@/features/pay-rules/services/salary-calculation-coordinator';

export default function EditShiftScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shift, loading } = useShift(id);
  const repositories = useRepositories();
  const salaryCoordinator = useMemo(() => new SalaryCalculationCoordinator(repositories), [repositories]);
  const { workplaces, roles } = useWorkplaces();
  const { templates } = useShiftTemplates();
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Shift | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const goBack = async () => {
    if (!dirty || await confirmAlert(t('form.unsavedTitle'), t('form.unsavedBody'), t('common.cancel'), t('common.confirm'), true)) router.back();
  };
  const submit = async (next: Shift) => {
    if (shift?.status === 'scheduled' && shift.recurrenceGroupId) setDraft(next);
    else await saveDirect(next);
  };
  const saveDirect = async (next: Shift) => {
    setSaving(true);
    try {
      const overlaps = await repositories.shifts.findOverlapping(getEffectiveShiftRange(next), next.id);
      if (overlaps.length && !await confirmAlert(t('form.overlapTitle'), t('form.overlapBody'), t('common.cancel'), t('common.confirm'))) return;
      await repositories.shifts.update(next);
      if (next.status === 'completed') await salaryCoordinator.finalizeCompletedShift(next, next.updatedAt, true);
      router.replace(`/shifts/${next.id}`);
    } catch (caught) { reportUnexpectedError('shift.edit.save', caught); Alert.alert(t('common.error')); }
    finally { setSaving(false); }
  };
  const applyScope = async (scope: RecurrenceScope) => {
    if (!shift?.recurrenceGroupId || !draft) return;
    setSaving(true);
    try {
      const series = await repositories.recurrence.getSeries(shift.recurrenceGroupId);
      if (!series) throw new Error('Recurrence series not found.');
      const occurrences = await repositories.shifts.list({ recurrenceGroupId: series.id });
      const selected = selectRecurrenceScopeOccurrences(occurrences, shift, scope);
      const localDate = formatLocalDateKey(shift.recurrenceOriginalStart ?? shift.scheduledStart!, shift.timezone);
      if (scope === 'only') {
        await repositories.recurrence.applyMutation({
          shiftsToSave: [{ ...draft, recurrenceExceptionType: 'modified' }],
          exceptionsToSave: [{ id: createId('exception'), seriesId: series.id, localDate, type: 'modified', shiftId: shift.id, createdAt: new Date().toISOString() }],
        });
      } else {
        const template = { ...series.template, workplaceId: draft.workplaceId, roleId: draft.roleId, title: draft.title, notes: draft.notes, startTime: formatLocalTime(draft.scheduledStart!, draft.timezone), endTime: formatLocalTime(draft.scheduledEnd!, draft.timezone), expectedBreakMinutes: draft.expectedBreakMinutes, hourlyRateSnapshotMinor: draft.hourlyRateSnapshotMinor };
        let targetSeries: RecurrenceSeries = { ...series, template, updatedAt: new Date().toISOString() };
        const seriesToSave: RecurrenceSeries[] = [];
        const exceptionsToSave: RecurrenceException[] = [];
        if (scope === 'future') {
          if (localDate > series.rule.startsOn) {
            const plan = planRecurrenceEdit(series, localDate, scope);
            if (plan.type !== 'splitSeries') throw new Error('Invalid recurrence split.');
            seriesToSave.push({ ...series, rule: plan.previousRule, updatedAt: new Date().toISOString() });
            const elapsedOccurrences = series.rule.occurrenceLimit ? generateRecurrenceOccurrences({ ...series, disabledFrom: undefined }, series.rule.startsOn, format(subDays(new Date(`${localDate}T12:00:00`), 1), 'yyyy-MM-dd')).length : 0;
            const remainingLimit = series.rule.occurrenceLimit ? Math.max(1, series.rule.occurrenceLimit - elapsedOccurrences) : undefined;
            targetSeries = { ...series, id: createId('series'), rule: { ...plan.nextRule, id: createId('rule'), occurrenceLimit: remainingLimit }, template, disabledFrom: undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            const futureExceptions = (await repositories.recurrence.listExceptions(series.id)).filter((exception) => exception.localDate >= localDate);
            exceptionsToSave.push(...futureExceptions.map((exception) => ({ ...exception, id: createId('exception'), seriesId: targetSeries.id })));
          }
        }
        seriesToSave.push(targetSeries);
        const updates = selected.map((item) => {
          const occurrenceDate = formatLocalDateKey(item.recurrenceOriginalStart ?? item.scheduledStart!, item.timezone);
          const range = resolveLocalShiftRange(occurrenceDate, template.startTime, template.endTime, item.timezone);
          return { ...item, workplaceId: template.workplaceId, roleId: template.roleId, title: template.title, notes: template.notes, scheduledStart: range.start, scheduledEnd: range.end, expectedBreakMinutes: template.expectedBreakMinutes, hourlyRateSnapshotMinor: template.hourlyRateSnapshotMinor, recurrenceGroupId: targetSeries.id, recurrenceOriginalStart: range.start, updatedAt: new Date().toISOString() };
        });
        await repositories.recurrence.applyMutation({ seriesToSave, shiftsToSave: updates, exceptionsToSave });
      }
      router.replace(`/shifts/${shift.id}`);
    } catch (caught) { reportUnexpectedError('shift.edit.applyScope', caught); Alert.alert(t('common.error')); }
    finally { setDraft(null); setSaving(false); }
  };

  return <AppScreen title={t('common.edit')}>
    <SecondaryButton label={t('common.back')} onPress={() => void goBack()} />
    {loading ? <Text>{t('common.loading')}</Text> : null}
    {shift ? <ShiftForm initialShift={shift} mode={shift.status === 'completed' ? 'completed' : 'scheduled'} onDirtyChange={setDirty} onSave={submit} roles={roles} saving={saving} templates={templates} workplaces={workplaces} /> : null}
    <RecurrenceScopeChooser onChoose={(scope) => void applyScope(scope)} onDismiss={() => setDraft(null)} visible={draft !== null} />
  </AppScreen>;
}
