import { addDays, format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';

import type { RecurrenceSeries, Shift } from '@/domain/entities';
import { assertShiftDurationWithinLimit, calculateShiftDuration, generateRecurrenceOccurrences, getEffectiveShiftRange, isCompletedShiftFutureDated } from '@/domain/services';
import { ShiftForm, type RecurrenceDraft } from '@/features/shifts/components/shift-form';
import { useActiveShift } from '@/features/shifts/hooks/use-active-shift';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { useShift } from '@/features/shifts/hooks/use-shifts';
import { useShiftTemplates } from '@/features/shifts/hooks/use-shift-templates';
import { useWorkplaces } from '@/features/workplaces/hooks/use-workplaces';
import { AppScreen, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { confirmAlert } from '@/shared/utils/confirm-alert';
import { createId } from '@/shared/utils/id';
import { formatLocalDateKey, formatLocalTime } from '@/shared/utils/zoned-time';
import { SalaryCalculationCoordinator } from '@/features/pay-rules';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

export default function NewShiftScreen() {
  const params = useLocalSearchParams<{ mode?: string; date?: string; duplicate?: string }>();
  const mode = params.mode === 'completed' ? 'completed' : params.mode === 'scheduled' ? 'scheduled' : 'auto';
  const repositories = useRepositories(); const { shifts: shiftRepository, recurrence: recurrenceRepository } = repositories;
  const salaryCoordinator = useMemo(() => new SalaryCalculationCoordinator(repositories), [repositories]);
  const { shift: duplicateSource } = useShift(params.duplicate);
  const { workplaces, roles } = useWorkplaces();
  const { templates } = useShiftTemplates();
  const active = useActiveShift();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const duplicateInitial = useMemo(() => duplicateSource ? {
    ...duplicateSource,
    id: createId('shift'),
    status: duplicateSource.status === 'completed' ? 'completed' as const : 'scheduled' as const,
    cancelledAt: undefined,
    recurrenceGroupId: undefined,
    recurrenceOriginalStart: undefined,
    recurrenceExceptionType: undefined,
    salaryCalculationStatus: 'not_calculated' as const,
    expectedGrossPayMinor: undefined,
    actualGrossPayMinor: undefined,
    payableGrossPayMinor: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } : undefined, [duplicateSource]);
  const goBack = async () => {
    if (!dirty || await confirmAlert(t('form.unsavedTitle'), t('form.unsavedBody'), t('common.cancel'), t('common.confirm'), true)) router.back();
  };
  const promptCurrentShift = (shift: Shift) => {
    Alert.alert(t('form.currentShiftTitle'), t('form.currentShiftBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('active.startNow'), onPress: () => void active.startUnscheduled(shift).then(() => router.replace('/')).catch((caught) => { reportUnexpectedError('shift.new.startCurrent', caught); Alert.alert(t('common.error'), t('active.mutationError')); }) },
    ]);
  };

  const save = async (shift: Shift, recurrence?: RecurrenceDraft) => {
    setSaving(true);
    try {
      if (!await confirmWarnings(shift, shiftRepository, t)) return;
      if (recurrence && shift.scheduledStart && shift.scheduledEnd) {
        const now = new Date().toISOString();
        const localDate = formatLocalDateKey(shift.scheduledStart, shift.timezone);
        const series: RecurrenceSeries = {
          id: createId('series'),
          rule: { id: createId('rule'), frequency: recurrence.frequency, weekdays: recurrence.weekdays, startsOn: localDate, endsOn: recurrence.endsOn, occurrenceLimit: recurrence.occurrenceLimit, timezone: shift.timezone },
          template: { workplaceId: shift.workplaceId, roleId: shift.roleId, shiftTemplateId: shift.shiftTemplateId, shiftTypeNameSnapshot: shift.shiftTypeNameSnapshot, shiftTypePayMultiplierBasisPoints: shift.shiftTypePayMultiplierBasisPoints, title: shift.title, notes: shift.notes, startTime: formatLocalTime(shift.scheduledStart, shift.timezone), endTime: formatLocalTime(shift.scheduledEnd, shift.timezone), expectedBreakMinutes: shift.expectedBreakMinutes, hourlyRateSnapshotMinor: shift.hourlyRateSnapshotMinor },
          createdAt: now, updatedAt: now,
        };
        const windowEnd = recurrence.endsOn ?? format(addDays(new Date(`${localDate}T12:00:00`), 180), 'yyyy-MM-dd');
        const generated = generateRecurrenceOccurrences(series, localDate, windowEnd);
        const occurrences = generated.map((item) => {
          assertShiftDurationWithinLimit(item.scheduledStart, item.scheduledEnd);
          return { ...shift, id: item.id, scheduledStart: item.scheduledStart, scheduledEnd: item.scheduledEnd, recurrenceGroupId: series.id, recurrenceOriginalStart: item.scheduledStart };
        });
        const recurrenceOverlaps = (await Promise.all(occurrences.map((item) => recurrenceOverlapsFor(item, shiftRepository)))).flat();
        if (recurrenceOverlaps.length && !await confirmAlert(t('form.overlapTitle'), t('form.overlapBody'), t('common.cancel'), t('common.confirm'))) return;
        await recurrenceRepository.materializeOccurrences(series, occurrences);
        router.replace(`/shifts/${occurrences[0]?.id ?? shift.id}`);
      } else {
        await shiftRepository.create(shift);
        if (shift.status === 'completed') {
          try { await salaryCoordinator.finalizeCompletedShift(shift, shift.completedAt ?? shift.updatedAt); }
          catch (caught) { reportUnexpectedError('shift.new.finalizeSalary', caught); Alert.alert(t('salary.missingConfig'), t('salary.snapshotFailed')); }
        }
        router.replace(`/shifts/${shift.id}`);
      }
    } catch (caught) {
      reportUnexpectedError('shift.new.save', caught);
      throw caught;
    } finally {
      setSaving(false);
    }
  };

  return <AppScreen title={mode === 'auto' ? t('addShift.title') : mode === 'completed' ? t('addShift.completed') : t('addShift.future')}>
    <SecondaryButton label={t('common.back')} onPress={() => void goBack()} />
    <ShiftForm initialDate={params.date} initialShift={duplicateInitial} mode={mode} onCurrentShift={promptCurrentShift} onDirtyChange={setDirty} onSave={save} roles={roles} saving={saving || active.busy} templates={templates} workplaces={workplaces} />
    {!workplaces.length ? <SecondaryButton label={t('form.manageWorkplaces')} onPress={() => router.push('/settings/workplaces')} /> : null}
  </AppScreen>;
}

async function recurrenceOverlapsFor(shift: Shift, repository: ReturnType<typeof useRepositories>['shifts']): Promise<Shift[]> {
  return repository.findOverlapping(getEffectiveShiftRange(shift), shift.id);
}

async function confirmWarnings(shift: Shift, repository: ReturnType<typeof useRepositories>['shifts'], t: ReturnType<typeof useTranslation>['t']): Promise<boolean> {
  const range = getEffectiveShiftRange(shift);
  const overlaps = await repository.findOverlapping(range, shift.id);
  const duplicate = overlaps.some((item) => {
    const other = getEffectiveShiftRange(item);
    return other.start === range.start && other.end === range.end && item.workplaceId === shift.workplaceId;
  });
  if (duplicate && !await confirmAlert(t('form.duplicateTitle'), t('form.overlapBody'), t('common.cancel'), t('common.confirm'))) return false;
  if (!duplicate && overlaps.length && !await confirmAlert(t('form.overlapTitle'), t('form.overlapBody'), t('common.cancel'), t('common.confirm'))) return false;
  const duration = calculateShiftDuration(shift, shift.status === 'completed' ? 'actual' : 'scheduled');
  if (duration && duration.grossMinutes > 16 * 60 && !await confirmAlert(t('form.longShiftTitle'), t('form.overlapBody'), t('common.cancel'), t('common.confirm'))) return false;
  if (isCompletedShiftFutureDated(shift) && !await confirmAlert(t('form.futureCompletedTitle'), t('form.overlapBody'), t('common.cancel'), t('common.confirm'))) return false;
  return true;
}
