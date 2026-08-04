import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { roleSchema, type Role } from '@/domain/entities';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { AppScreen, EmptyState, FormField, PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { createId } from '@/shared/utils/id';
import { formatMinorUnits, parseCurrencyToMinor } from '@/shared/utils/money';

export default function RolesScreen() {
  const { workplaceId = '' } = useLocalSearchParams<{ workplaceId: string }>(); const repositories = useRepositories(); const { colors } = useAppTheme(); const { isRtl, locale, t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]); const [editingId, setEditingId] = useState<string>(); const [name, setName] = useState(''); const [rate, setRate] = useState(''); const [error, setError] = useState<string>();
  const refresh = useCallback(async () => setRoles(await repositories.workplaces.listRoles(workplaceId)), [repositories.workplaces, workplaceId]); useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const save = async () => { try { const now = new Date().toISOString(); const existing = roles.find((item) => item.id === editingId); const role = roleSchema.parse({ id: editingId ?? createId('role'), workplaceId, name, hourlyRateMinor: rate ? parseCurrencyToMinor(rate) : undefined, isArchived: existing?.isArchived ?? false, createdAt: existing?.createdAt ?? now, updatedAt: now }); await repositories.workplaces.saveRole(role); reset(); setError(undefined); await refresh(); } catch { setError(t('salary.invalidForm')); } };
  const reset = () => { setEditingId(undefined); setName(''); setRate(''); };
  const edit = (role: Role) => { setEditingId(role.id); setName(role.name); setRate(role.hourlyRateMinor ? String(role.hourlyRateMinor / 100) : ''); };
  const archive = async (role: Role) => { await repositories.workplaces.saveRole({ ...role, isArchived: true, updatedAt: new Date().toISOString() }); await refresh(); };
  return <AppScreen title={t('roles.title')}><SecondaryButton label={t('common.back')} onPress={() => router.back()} /><View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><FormField label={t('roles.name')} onChangeText={setName} value={name} /><FormField keyboardType="decimal-pad" label={t('roles.rateOverride')} onChangeText={setRate} value={rate} />{error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}<PrimaryButton disabled={!name.trim()} label={editingId ? t('common.save') : t('roles.add')} onPress={() => void save()} />{editingId ? <SecondaryButton label={t('common.cancel')} onPress={reset} /> : null}</View>{!roles.length ? <EmptyState title={t('roles.empty')} body={t('roles.rateOverride')} /> : roles.map((role) => <View key={role.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: role.isArchived ? 0.6 : 1 }]}><Text style={[styles.title, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{role.name}</Text><Text style={{ color: colors.textMuted }}>{role.hourlyRateMinor ? formatMinorUnits(role.hourlyRateMinor, 'ILS', locale) : '—'}</Text><SecondaryButton label={t('common.edit')} onPress={() => edit(role)} />{!role.isArchived ? <SecondaryButton destructive label={t('common.archive')} onPress={() => void archive(role)} /> : null}</View>)}</AppScreen>;
}
const styles = StyleSheet.create({ card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.sm, padding: spacing.md }, title: { fontSize: typography.title, fontWeight: '800' } });
