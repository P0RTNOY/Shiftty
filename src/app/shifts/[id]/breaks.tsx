import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import type { BreakSession } from '@/domain/entities';
import { summarizeBreakSessions, validateBreakSessions } from '@/domain/services';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { useShift } from '@/features/shifts/hooks/use-shifts';
import { AppScreen, EmptyState, FormField, PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatDurationLong } from '@/shared/utils/duration-format';
import { createId } from '@/shared/utils/id';
import { formatLocalDateKey, resolveLocalShiftRange } from '@/shared/utils/zoned-time';

interface BreakForm { start: string; end: string; notes: string }
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function BreakManagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { shift } = useShift(id); const repositories = useRepositories();
  const { t, locale, isRtl, formatDate } = useTranslation(); const { colors } = useAppTheme();
  const [breaks, setBreaks] = useState<BreakSession[]>([]); const [paid, setPaid] = useState(false); const [busy, setBusy] = useState(false);
  const { control, handleSubmit, reset, formState: { errors } } = useForm<BreakForm>({ defaultValues: { start: '', end: '', notes: '' } });
  const refresh = useCallback(async () => { if (id) setBreaks(await repositories.activeShifts.listBreaks(id)); }, [id, repositories.activeShifts]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const mutate = async (operation: () => Promise<unknown>) => { if (busy) return; setBusy(true); try { await operation(); await refresh(); } catch { Alert.alert(t('common.error'), t('breaks.invalid')); } finally { setBusy(false); } };
  const add = handleSubmit(async (values) => {
    if (!shift?.actualStart) return;
    const range = resolveLocalShiftRange(formatLocalDateKey(shift.actualStart, shift.timezone), values.start, values.end, shift.timezone); const now = new Date().toISOString();
    const session: BreakSession = { id: createId('break'), shiftId: shift.id, start: range.start, end: range.end, isPaid: paid, source: 'manual', notes: values.notes.trim() || undefined, createdAt: now, updatedAt: now };
    validateBreakSessions(shift, [...breaks, session], new Date());
    await mutate(() => repositories.activeShifts.saveBreak(session)); reset();
  });
  const summary = summarizeBreakSessions(breaks, new Date());
  return <AppScreen title={t('breaks.title')}>
    <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
    <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={{ color: colors.text }}>{t('active.paidBreaks')}: {formatDurationLong(summary.paidMinutes, locale)}</Text><Text style={{ color: colors.text }}>{t('active.unpaidBreaks')}: {formatDurationLong(summary.unpaidMinutes, locale)}</Text></View>
    {!breaks.length ? <EmptyState body={t('breaks.empty')} title={t('breaks.title')} /> : breaks.map((session) => <View key={session.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{session.isPaid ? t('breaks.paid') : t('breaks.unpaid')}{!session.end ? ` · ${t('breaks.active')}` : ''}</Text>
      <Text style={{ color: colors.textMuted }}>{formatDate(session.start, { hour: '2-digit', minute: '2-digit', timeZone: shift?.timezone })}–{session.end ? formatDate(session.end, { hour: '2-digit', minute: '2-digit', timeZone: shift?.timezone }) : '…'}</Text>
      {session.notes ? <Text style={{ color: colors.text }}>{session.notes}</Text> : null}
      <SecondaryButton disabled={busy} label={t('breaks.changeType')} onPress={() => void mutate(() => repositories.activeShifts.saveBreak({ ...session, isPaid: !session.isPaid, updatedAt: new Date().toISOString() }))} />
      {session.end ? <SecondaryButton destructive disabled={busy} label={t('breaks.delete')} onPress={() => void mutate(() => repositories.activeShifts.deleteBreak(session.id))} /> : null}
    </View>)}
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{t('breaks.addManual')}</Text>
    <Controller control={control} name="start" rules={{ required: t('form.required'), pattern: { value: timePattern, message: t('form.invalidTime') } }} render={({ field }) => <FormField error={errors.start?.message} label={t('breaks.startTime')} onChangeText={field.onChange} value={field.value} />} />
    <Controller control={control} name="end" rules={{ required: t('form.required'), pattern: { value: timePattern, message: t('form.invalidTime') } }} render={({ field }) => <FormField error={errors.end?.message} label={t('breaks.endTime')} onChangeText={field.onChange} value={field.value} />} />
    <Controller control={control} name="notes" render={({ field }) => <FormField label={t('breaks.notes')} onChangeText={field.onChange} value={field.value} />} />
    <SecondaryButton label={paid ? t('breaks.paid') : t('breaks.unpaid')} onPress={() => setPaid((value) => !value)} />
    <PrimaryButton disabled={busy || !shift} label={t('breaks.addManual')} onPress={() => void add()} />
  </AppScreen>;
}
const styles = StyleSheet.create({ summary: { borderRadius: radius.md, borderWidth: 1, gap: spacing.xs, padding: spacing.md }, card: { borderRadius: radius.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md }, title: { fontSize: typography.title, fontWeight: '800' } });
