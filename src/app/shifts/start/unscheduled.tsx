import { Controller, useForm, useWatch } from 'react-hook-form';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { shiftSchema } from '@/domain/entities';
import { useActiveShift } from '@/features/shifts/hooks/use-active-shift';
import { useShiftTemplates } from '@/features/shifts/hooks/use-shift-templates';
import { useWorkplaces } from '@/features/workplaces/hooks/use-workplaces';
import { AppScreen, FormField, PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, useAppTheme } from '@/shared/theme';
import { createId } from '@/shared/utils/id';
import { formatLocalDateKey, formatLocalTime, resolveLocalShiftRange } from '@/shared/utils/zoned-time';

interface Values { workplaceId: string; roleId: string; templateId: string; title: string; notes: string; expectedEnd: string }
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function StartUnscheduledShiftScreen() {
  const { t, isRtl } = useTranslation(); const { colors } = useAppTheme();
  const { workplaces, roles } = useWorkplaces(); const { templates } = useShiftTemplates(); const active = useActiveShift();
  const [startedAt] = useState(() => new Date().toISOString());
  const { control, handleSubmit, setValue, formState: { errors } } = useForm<Values>({ defaultValues: { workplaceId: '', roleId: '', templateId: '', title: '', notes: '', expectedEnd: '' } });
  const workplaceId = useWatch({ control, name: 'workplaceId' }); const direction = isRtl ? 'row-reverse' : 'row';
  const submit = handleSubmit(async (values) => {
    try {
      const workplace = workplaces.find((item) => item.id === values.workplaceId); if (!workplace) return;
      const template = templates.find((item) => item.id === values.templateId);
      const date = formatLocalDateKey(startedAt); const actualTime = formatLocalTime(startedAt);
      const scheduled = template ? resolveLocalShiftRange(date, template.defaultStartTime, template.defaultEndTime) : undefined;
      const expectedEnd = values.expectedEnd ? resolveLocalShiftRange(date, actualTime, values.expectedEnd).end : scheduled?.end;
      const shift = shiftSchema.parse({ id: createId('shift'), workplaceId: workplace.id, roleId: values.roleId || template?.roleId || undefined, shiftTemplateId: template?.id, title: values.title.trim() || undefined, notes: values.notes.trim() || undefined, scheduledStart: scheduled?.start, scheduledEnd: scheduled?.end, actualStart: startedAt, expectedEnd, expectedBreakMinutes: template?.expectedBreakMinutes ?? workplace.defaultBreakMinutes, status: 'active', activeOrigin: 'unscheduled', hourlyRateSnapshotMinor: workplace.defaultHourlyRateMinor, timezone: 'Asia/Jerusalem', createdAt: startedAt, updatedAt: startedAt });
      await active.startUnscheduled(shift); router.replace('/');
    } catch { Alert.alert(t('common.error'), t('active.mutationError')); }
  });
  return <AppScreen title={t('active.unscheduledTitle')}>
    <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
    <Text style={[styles.label, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{t('form.workplace')}</Text>
    <Controller control={control} name="workplaceId" rules={{ required: t('form.required') }} render={({ field }) => <View style={[styles.choices, { flexDirection: direction }]}>{workplaces.map((item) => <Choice checked={field.value === item.id} key={item.id} label={item.name} onPress={() => { field.onChange(item.id); setValue('roleId', ''); }} />)}</View>} />
    {errors.workplaceId ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{t('form.required')}</Text> : null}
    {roles.some((item) => item.workplaceId === workplaceId) ? <Controller control={control} name="roleId" render={({ field }) => <View style={[styles.choices, { flexDirection: direction }]}>{roles.filter((item) => item.workplaceId === workplaceId).map((item) => <Choice checked={field.value === item.id} key={item.id} label={item.name} onPress={() => field.onChange(item.id)} />)}</View>} /> : null}
    {templates.length ? <><Text style={[styles.label, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{t('form.template')}</Text><Controller control={control} name="templateId" render={({ field }) => <View style={[styles.choices, { flexDirection: direction }]}><Choice checked={!field.value} label={t('form.noTemplate')} onPress={() => field.onChange('')} />{templates.map((item) => <Choice checked={field.value === item.id} key={item.id} label={item.name} onPress={() => { field.onChange(item.id); if (item.workplaceId) setValue('workplaceId', item.workplaceId); }} />)}</View>} /></> : null}
    <Controller control={control} name="expectedEnd" rules={{ pattern: { value: timePattern, message: t('form.invalidTime') } }} render={({ field }) => <FormField error={errors.expectedEnd?.message} label={t('active.expectedEndOptional')} onChangeText={field.onChange} value={field.value} />} />
    <Controller control={control} name="title" render={({ field }) => <FormField label={t('form.title')} onChangeText={field.onChange} value={field.value} />} />
    <Controller control={control} name="notes" render={({ field }) => <FormField label={t('form.notes')} multiline onChangeText={field.onChange} value={field.value} />} />
    <PrimaryButton disabled={active.busy || !workplaces.length} label={active.busy ? t('active.starting') : t('active.startNow')} onPress={() => void submit()} />
  </AppScreen>;
}

function Choice({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) { const { colors } = useAppTheme(); return <Pressable accessibilityRole="radio" accessibilityState={{ checked }} onPress={onPress} style={[styles.choice, { backgroundColor: colors.surface, borderColor: checked ? colors.primary : colors.border }]}><Text style={{ color: colors.text }}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ label: { fontWeight: '700' }, choices: { flexWrap: 'wrap', gap: spacing.xs }, choice: { borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md } });
