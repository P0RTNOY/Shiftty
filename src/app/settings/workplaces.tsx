import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { workplaceSchema } from '@/domain/entities';
import { useWorkplaces } from '@/features/workplaces/hooks/use-workplaces';
import { AppScreen, EmptyState, FormField, PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { createId } from '@/shared/utils/id';
import { formatMinorUnits, parseCurrencyToMinor } from '@/shared/utils/money';

export default function WorkplacesScreen() {
  const { workplaces, repository, refresh } = useWorkplaces();
  const { colors } = useAppTheme();
  const { isRtl, locale, t } = useTranslation();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [address, setAddress] = useState('');
  const [color, setColor] = useState('#2563EB');
  const [breakMinutes, setBreakMinutes] = useState('30');
  const [rate, setRate] = useState('');
  const [travel, setTravel] = useState('0');
  const [bonus, setBonus] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    try {
      const now = new Date().toISOString();
      const existing = workplaces.find((item) => item.id === editingId);
      const workplace = workplaceSchema.parse({ id: editingId ?? createId('workplace'), name, address: address || undefined, color, defaultHourlyRateMinor: rate ? parseCurrencyToMinor(rate) : 0, defaultTravelReimbursementMinor: parseCurrencyToMinor(travel), defaultShiftBonusMinor: parseCurrencyToMinor(bonus), defaultBreakMinutes: Number(breakMinutes), salaryProfileId: existing?.salaryProfileId, isArchived: existing?.isArchived ?? false, createdAt: existing?.createdAt ?? now, updatedAt: now });
      await repository.save(workplace);
      reset(); setError(null); await refresh();
    } catch { setError(t('salary.invalidForm')); }
  };
  const reset = () => { setEditingId(undefined); setName(''); setAddress(''); setColor('#2563EB'); setBreakMinutes('30'); setRate(''); setTravel('0'); setBonus('0'); };
  const edit = (workplace: (typeof workplaces)[number]) => { setEditingId(workplace.id); setName(workplace.name); setAddress(workplace.address ?? ''); setColor(workplace.color ?? '#2563EB'); setBreakMinutes(String(workplace.defaultBreakMinutes)); setRate(workplace.defaultHourlyRateMinor ? String(workplace.defaultHourlyRateMinor / 100) : ''); setTravel(String((workplace.defaultTravelReimbursementMinor ?? 0) / 100)); setBonus(String((workplace.defaultShiftBonusMinor ?? 0) / 100)); };
  const archive = async (workplace: (typeof workplaces)[number]) => { await repository.save({ ...workplace, isArchived: true, updatedAt: new Date().toISOString() }); await refresh(); };
  return <AppScreen title={t('workplaces.title')}>
    <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
    <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <FormField label={t('workplaces.name')} onChangeText={setName} value={name} />
      <FormField label={t('workplaces.address')} onChangeText={setAddress} value={address} />
      <FormField label={t('workplaces.color')} onChangeText={setColor} placeholder="#2563EB" value={color} />
      <FormField keyboardType="number-pad" label={t('workplaces.break')} onChangeText={setBreakMinutes} value={breakMinutes} />
      <FormField keyboardType="decimal-pad" label={t('workplaces.rate')} onChangeText={setRate} value={rate} />
      <FormField keyboardType="decimal-pad" label={t('workplaces.travel')} onChangeText={setTravel} value={travel} />
      <FormField keyboardType="decimal-pad" label={t('workplaces.bonus')} onChangeText={setBonus} value={bonus} />
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger, textAlign: isRtl ? 'right' : 'left' }]}>{error}</Text> : null}
      <PrimaryButton disabled={!name.trim()} label={editingId ? t('common.save') : t('workplaces.add')} onPress={() => void save()} />
      {editingId ? <SecondaryButton label={t('common.cancel')} onPress={reset} /> : null}
    </View>
    {!workplaces.length ? <EmptyState body={t('form.noWorkplaces')} title={t('workplaces.empty')} /> : <View style={styles.list}>{workplaces.map((workplace) => <View key={workplace.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, opacity: workplace.isArchived ? 0.6 : 1 }]}><Text style={[styles.name, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{workplace.name}</Text><Text style={{ color: colors.textMuted, textAlign: isRtl ? 'right' : 'left' }}>{workplace.defaultHourlyRateMinor > 0 ? formatMinorUnits(workplace.defaultHourlyRateMinor, 'ILS', locale) : t('salary.missingConfig')}</Text><SecondaryButton label={t('common.edit')} onPress={() => edit(workplace)} /><SecondaryButton label={t('workplaces.roles')} onPress={() => router.push(`/settings/roles?workplaceId=${workplace.id}`)} /><SecondaryButton label={t('settings.notificationWorkplace')} onPress={() => router.push(`/settings/workplaces/${workplace.id}/notifications`)} />{!workplace.isArchived ? <SecondaryButton destructive label={t('common.archive')} onPress={() => void archive(workplace)} /> : null}</View>)}</View>}
  </AppScreen>;
}

const styles = StyleSheet.create({
  form: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md, padding: spacing.md },
  error: { fontSize: typography.caption }, list: { gap: spacing.sm }, row: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, minHeight: 56, justifyContent: 'center', padding: spacing.md }, name: { fontSize: typography.body, fontWeight: '700' },
});
