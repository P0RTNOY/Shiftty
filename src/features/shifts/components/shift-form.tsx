import { useEffect, useMemo } from 'react';
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type RegisterOptions,
  type UseFormSetValue,
} from 'react-hook-form';
import { Pressable, StyleSheet, Switch, Text, View, type TextInputProps } from 'react-native';

import type { RecurrenceFrequency, Role, Shift, ShiftTemplate, Workplace } from '@/domain/entities';
import { createCompletedShift, createScheduledShift } from '@/domain/services';
import { FormField, PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { createId } from '@/shared/utils/id';
import { formatLocalDateKey, formatLocalTime } from '@/shared/utils/zoned-time';
import { parseCurrencyToMinor } from '@/shared/utils/money';

export interface RecurrenceDraft {
  frequency: RecurrenceFrequency;
  weekdays: number[];
  endsOn?: string;
  occurrenceLimit?: number;
}

export interface ShiftFormValues {
  date: string; scheduledStart: string; scheduledEnd: string; actualStart: string; actualEnd: string;
  payableStart: string; payableEnd: string; workplaceId: string; roleId: string; shiftTemplateId: string; title: string; notes: string;
  expectedBreak: string; actualBreak: string; payableBreak: string; recurring: boolean;
  frequency: RecurrenceFrequency; weekdays: number[]; endsOn: string; occurrenceLimit: string;
  hourlyRateOverride: string; fixedBonusOverride: string; travelOverride: string;
}

interface Props {
  mode: 'scheduled' | 'completed';
  workplaces: readonly Workplace[];
  roles?: readonly Role[];
  templates?: readonly ShiftTemplate[];
  initialShift?: Shift;
  initialDate?: string;
  saving?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSave: (shift: Shift, recurrence?: RecurrenceDraft) => Promise<void> | void;
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

type StringFieldName = Exclude<keyof ShiftFormValues, 'recurring' | 'weekdays'>;

export function ShiftForm({ mode, workplaces, roles = [], templates = [], initialShift, initialDate, saving = false, onDirtyChange, onSave }: Props) {
  const { colors } = useAppTheme();
  const { t, isRtl } = useTranslation();
  const defaults = useMemo(() => makeDefaults(mode, initialShift, initialDate), [initialDate, initialShift, mode]);
  const { control, handleSubmit, setValue, setError, formState: { errors, dirtyFields, isDirty } } = useForm<ShiftFormValues>({ defaultValues: defaults });
  const actualStart = useWatch({ control, name: 'actualStart' });
  const actualEnd = useWatch({ control, name: 'actualEnd' });
  const recurring = useWatch({ control, name: 'recurring' });
  const weekdays = useWatch({ control, name: 'weekdays' });
  const workplaceId = useWatch({ control, name: 'workplaceId' });
  const scheduledStart = useWatch({ control, name: 'scheduledStart' });
  const scheduledEnd = useWatch({ control, name: 'scheduledEnd' });
  const shiftDate = useWatch({ control, name: 'date' });
  const direction = isRtl ? 'row-reverse' : 'row';

  useEffect(() => {
    if (mode !== 'completed') return;
    if (!dirtyFields.payableStart) setValue('payableStart', actualStart);
    if (!dirtyFields.payableEnd) setValue('payableEnd', actualEnd);
  }, [actualEnd, actualStart, dirtyFields.payableEnd, dirtyFields.payableStart, mode, setValue]);

  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  const submit = handleSubmit(async (values) => {
    try {
      const now = new Date().toISOString();
      const context = { id: initialShift?.id ?? createId('shift'), now, timezone: initialShift?.timezone ?? 'Asia/Jerusalem' };
      const workplace = workplaces.find((item) => item.id === values.workplaceId);
      if (!workplace) {
        setError('workplaceId', { message: t('form.required') });
        return;
      }
      if (values.recurring && values.weekdays.length === 0) {
        setError('weekdays', { message: t('form.required') });
        return;
      }
      const base = { workplaceId: workplace.id, roleId: clean(values.roleId), shiftTemplateId: clean(values.shiftTemplateId), title: clean(values.title), notes: clean(values.notes), hourlyRateSnapshotMinor: initialShift?.hourlyRateSnapshotMinor ?? workplace.defaultHourlyRateMinor };
      const created = mode === 'scheduled'
        ? createScheduledShift({ ...base, date: values.date, startTime: values.scheduledStart, endTime: values.scheduledEnd, expectedBreakMinutes: Number(values.expectedBreak || 0) }, context)
        : createCompletedShift({
            ...base, date: values.date, scheduledStartTime: clean(values.scheduledStart), scheduledEndTime: clean(values.scheduledEnd),
            actualStartTime: values.actualStart, actualEndTime: values.actualEnd, payableStartTime: values.payableStart,
            payableEndTime: values.payableEnd, actualBreakMinutes: Number(values.actualBreak || 0), payableBreakMinutes: Number(values.payableBreak || 0),
          }, context);
      const salaryOverrides = { hourlyRateOverrideMinor: values.hourlyRateOverride ? parseCurrencyToMinor(values.hourlyRateOverride) : undefined, fixedBonusOverrideMinor: values.fixedBonusOverride ? parseCurrencyToMinor(values.fixedBonusOverride) : undefined, travelReimbursementOverrideMinor: values.travelOverride ? parseCurrencyToMinor(values.travelOverride) : undefined };
      const shift = initialShift ? { ...created, ...salaryOverrides, id: initialShift.id, createdAt: initialShift.createdAt, updatedAt: now, status: initialShift.status, salaryCalculationStatus: initialShift.salaryCalculationStatus === 'finalized' ? 'stale' as const : initialShift.salaryCalculationStatus, cancelledAt: initialShift.cancelledAt, recurrenceGroupId: initialShift.recurrenceGroupId, recurrenceOriginalStart: initialShift.recurrenceOriginalStart, recurrenceExceptionType: initialShift.recurrenceExceptionType } : { ...created, ...salaryOverrides };
      const recurrence = values.recurring ? {
        frequency: values.frequency, weekdays: values.weekdays,
        endsOn: clean(values.endsOn), occurrenceLimit: values.occurrenceLimit ? Number(values.occurrenceLimit) : undefined,
      } : undefined;
      await onSave(shift, recurrence);
    } catch (caught) {
      setError('root', { message: mapFormError(caught, t) });
    }
  });

  return (
    <View style={styles.form}>
      <ControlledField control={control} name="date" label={t('form.date')} error={errors.date?.message} rules={{ required: t('form.required'), pattern: { value: datePattern, message: t('form.invalidDate') }, validate: (value) => isValidLocalDate(value) || t('form.invalidDate') }} />
      <Text style={[styles.label, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{t('form.workplace')}</Text>
      <View style={[styles.choices, { flexDirection: direction }]}>
        {workplaces.map((workplace) => <Controller key={workplace.id} control={control} name="workplaceId" render={({ field }) => (
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: field.value === workplace.id }} onPress={() => field.onChange(workplace.id)} style={[styles.choice, { borderColor: field.value === workplace.id ? colors.primary : colors.border, backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>{workplace.name}</Text>
          </Pressable>
        )} />)}
      </View>
      {!workplaces.length ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{t('form.noWorkplaces')}</Text> : null}
      {errors.workplaceId ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{errors.workplaceId.message}</Text> : null}

      {roles.some((role) => role.workplaceId === workplaceId) ? <>
        <Text style={[styles.label, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{t('form.role')}</Text>
        <Controller control={control} name="roleId" render={({ field }) => <View style={[styles.choices, { flexDirection: direction }]}>
          <Choice checked={!field.value} label={t('form.noRole')} onPress={() => field.onChange('')} />
          {roles.filter((role) => role.workplaceId === workplaceId).map((role) => <Choice key={role.id} checked={field.value === role.id} label={role.name} onPress={() => field.onChange(role.id)} />)}
        </View>} />
      </> : null}

      {mode === 'scheduled' ? <>
        {templates.length ? <>
          <Text style={[styles.label, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{t('form.template')}</Text>
          <Controller control={control} name="shiftTemplateId" render={({ field }) => <View style={[styles.choices, { flexDirection: direction }]}>
            <Choice checked={!field.value} label={t('form.noTemplate')} onPress={() => field.onChange('')} />
            {templates.map((template) => <Choice key={template.id} checked={field.value === template.id} label={template.name} onPress={() => { field.onChange(template.id); setValue('scheduledStart', template.defaultStartTime, { shouldDirty: true }); setValue('scheduledEnd', template.defaultEndTime, { shouldDirty: true }); setValue('expectedBreak', String(template.expectedBreakMinutes), { shouldDirty: true }); if (template.workplaceId) setValue('workplaceId', template.workplaceId, { shouldDirty: true }); if (template.roleId) setValue('roleId', template.roleId, { shouldDirty: true }); }} />)}
          </View>} />
        </> : null}
        <TimeField control={control} name="scheduledStart" label={t('form.scheduledStart')} error={errors.scheduledStart?.message} />
        <TimeField control={control} name="scheduledEnd" label={t('form.scheduledEnd')} error={errors.scheduledEnd?.message} />
        {timePattern.test(scheduledStart) && timePattern.test(scheduledEnd) && scheduledEnd < scheduledStart ? <Text style={[styles.hint, { color: colors.textMuted, textAlign: isRtl ? 'right' : 'left' }]}>{t('form.endsNextDay')}</Text> : null}
        <ControlledField control={control} name="expectedBreak" label={t('form.expectedBreak')} error={errors.expectedBreak?.message} keyboardType="number-pad" rules={minuteRules(t)} />
      </> : <>
        <TimeField control={control} name="scheduledStart" label={t('form.scheduledStart')} error={errors.scheduledStart?.message} optional />
        <TimeField control={control} name="scheduledEnd" label={t('form.scheduledEnd')} error={errors.scheduledEnd?.message} optional />
        <TimeField control={control} name="actualStart" label={t('form.actualStart')} error={errors.actualStart?.message} />
        <TimeField control={control} name="actualEnd" label={t('form.actualEnd')} error={errors.actualEnd?.message} />
        <TimeField control={control} name="payableStart" label={t('form.payableStart')} error={errors.payableStart?.message} />
        <TimeField control={control} name="payableEnd" label={t('form.payableEnd')} error={errors.payableEnd?.message} />
        <ControlledField control={control} name="actualBreak" label={t('form.actualBreak')} keyboardType="number-pad" error={errors.actualBreak?.message} rules={minuteRules(t)} />
        <ControlledField control={control} name="payableBreak" label={t('form.payableBreak')} keyboardType="number-pad" error={errors.payableBreak?.message} rules={minuteRules(t)} />
      </>}
      <ControlledField control={control} name="title" label={t('form.title')} error={errors.title?.message} />
      <ControlledField control={control} name="notes" label={t('form.notes')} error={errors.notes?.message} multiline />
      <Text style={[styles.label, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{t('salary.shiftOverrides')}</Text>
      <ControlledField control={control} name="hourlyRateOverride" label={t('salary.hourlyOverride')} keyboardType="decimal-pad" />
      <ControlledField control={control} name="fixedBonusOverride" label={t('salary.shiftBonus')} keyboardType="decimal-pad" />
      <ControlledField control={control} name="travelOverride" label={t('salary.travel')} keyboardType="decimal-pad" />

      {mode === 'scheduled' && !initialShift ? <>
        <Controller control={control} name="recurring" render={({ field }) => <View style={[styles.switchRow, { flexDirection: direction }]}><Text style={[styles.label, { color: colors.text }]}>{t('recurrence.toggle')}</Text><Switch accessibilityLabel={t('recurrence.toggle')} onValueChange={field.onChange} value={field.value} /></View>} />
        {recurring ? <RecurrenceFields control={control} startDate={shiftDate} weekdays={weekdays} setValue={setValue} /> : null}
        {errors.weekdays?.message ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{errors.weekdays.message}</Text> : null}
      </> : null}
      {errors.root?.message ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{errors.root.message}</Text> : null}
      <PrimaryButton disabled={saving || !workplaces.length} label={t('common.save')} onPress={() => void submit()} />
    </View>
  );
}

interface ControlledFieldProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  control: Control<ShiftFormValues>;
  name: StringFieldName;
  label: string;
  error?: string;
  rules?: RegisterOptions<ShiftFormValues, StringFieldName>;
}

function ControlledField({ control, name, label, error, rules, ...props }: ControlledFieldProps) {
  return <Controller control={control} name={name} rules={rules} render={({ field }) => <FormField {...props} error={error} label={label} onBlur={field.onBlur} onChangeText={field.onChange} value={field.value} />} />;
}

function TimeField({ optional, ...props }: ControlledFieldProps & { optional?: boolean }) {
  const { t } = useTranslation();
  return <ControlledField {...props} autoCapitalize="none" rules={optional ? { pattern: { value: timePattern, message: t('form.invalidTime') } } : { required: t('form.required'), pattern: { value: timePattern, message: t('form.invalidTime') } }} />;
}

function RecurrenceFields({ control, startDate, weekdays, setValue }: {
  control: Control<ShiftFormValues>;
  startDate: string;
  weekdays: number[];
  setValue: UseFormSetValue<ShiftFormValues>;
}) {
  const { colors } = useAppTheme(); const { t, isRtl } = useTranslation();
  const labels = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  return <View style={styles.recurrence}>
    <Controller control={control} name="frequency" render={({ field }) => <View style={[styles.choices, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>{(['weekly', 'biweekly'] as const).map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: field.value === value }} onPress={() => field.onChange(value)} style={[styles.choice, { backgroundColor: colors.surface, borderColor: field.value === value ? colors.primary : colors.border }]}><Text style={{ color: colors.text }}>{t(`recurrence.${value}`)}</Text></Pressable>)}</View>} />
    <Text style={[styles.label, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{t('recurrence.weekdays')}</Text>
    <View style={[styles.choices, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>{labels.map((label, day) => <Pressable key={label} accessibilityRole="checkbox" accessibilityState={{ checked: weekdays.includes(day) }} onPress={() => setValue('weekdays', weekdays.includes(day) ? weekdays.filter((item: number) => item !== day) : [...weekdays, day], { shouldDirty: true })} style={[styles.day, { borderColor: weekdays.includes(day) ? colors.primary : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.text }}>{t(`calendar.day.${label}`)}</Text></Pressable>)}</View>
    <ControlledField control={control} name="endsOn" label={t('recurrence.endsOn')} rules={{ pattern: { value: datePattern, message: t('form.invalidDate') }, validate: (value) => !value || (!isValidLocalDate(value) ? t('form.invalidDate') : value >= startDate || t('recurrence.endBeforeStart')) }} />
    <ControlledField control={control} name="occurrenceLimit" label={t('recurrence.limit')} keyboardType="number-pad" rules={{ validate: (value) => !value || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 520) || t('recurrence.invalidLimit') }} />
  </View>;
}

function makeDefaults(mode: Props['mode'], shift: Shift | undefined, date: string | undefined): ShiftFormValues {
  const timezone = shift?.timezone ?? 'Asia/Jerusalem';
  const dateValue = date ?? (shift ? formatLocalDateKey(shift.actualStart ?? shift.scheduledStart!, timezone) : formatLocalDateKey(new Date(), timezone));
  const time = (value?: string) => value ? formatLocalTime(value, timezone) : '';
  return { date: dateValue, scheduledStart: time(shift?.scheduledStart) || (mode === 'scheduled' ? '08:00' : ''), scheduledEnd: time(shift?.scheduledEnd) || (mode === 'scheduled' ? '16:00' : ''), actualStart: time(shift?.actualStart) || '08:00', actualEnd: time(shift?.actualEnd) || '16:00', payableStart: time(shift?.payableStart) || '08:00', payableEnd: time(shift?.payableEnd) || '16:00', workplaceId: shift?.workplaceId ?? '', roleId: shift?.roleId ?? '', shiftTemplateId: shift?.shiftTemplateId ?? '', title: shift?.title ?? '', notes: shift?.notes ?? '', expectedBreak: String(shift?.expectedBreakMinutes ?? 30), actualBreak: String(shift?.actualBreakMinutes ?? 0), payableBreak: String(shift?.payableBreakMinutes ?? 0), hourlyRateOverride: shift?.hourlyRateOverrideMinor ? String(shift.hourlyRateOverrideMinor / 100) : '', fixedBonusOverride: shift?.fixedBonusOverrideMinor ? String(shift.fixedBonusOverrideMinor / 100) : '', travelOverride: shift?.travelReimbursementOverrideMinor ? String(shift.travelReimbursementOverrideMinor / 100) : '', recurring: false, frequency: 'weekly', weekdays: [new Date(`${dateValue}T12:00:00`).getDay()], endsOn: '', occurrenceLimit: '' };
}

function clean(value: string): string | undefined { const trimmed = value.trim(); return trimmed || undefined; }

function minuteRules(t: ReturnType<typeof useTranslation>['t']): RegisterOptions<ShiftFormValues, StringFieldName> {
  return { required: t('form.required'), validate: (value) => /^\d+$/.test(value) || t('form.invalidMinutes') };
}

function isValidLocalDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function mapFormError(error: unknown, t: ReturnType<typeof useTranslation>['t']): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('both be provided')) return t('form.schedulePair');
  if (message.includes('break cannot exceed')) return t('form.breakTooLong');
  if (message.includes('identical')) return t('form.invalidRange');
  return t('form.repositoryError');
}

function Choice({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked }} onPress={onPress} style={[styles.choice, { borderColor: checked ? colors.primary : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.text, fontWeight: '600' }}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  form: { gap: spacing.md }, label: { fontSize: typography.body, fontWeight: '600' },
  choices: { flexWrap: 'wrap', gap: spacing.xs },
  choice: { borderRadius: radius.pill, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  day: { alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  error: { fontSize: typography.caption }, hint: { fontSize: typography.caption }, switchRow: { alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  recurrence: { gap: spacing.md },
});
