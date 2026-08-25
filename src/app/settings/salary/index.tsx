import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { salaryProfileSchema, type MoneyRoundingMode, type SalaryProfile } from '@/domain/entities';
import { SalaryTrustDisclosure } from '@/features/pay-rules/components/salary-trust-disclosure';
import { WeeklyOvertimeSettings, weeklyHoursToMinutes, type WeeklyOvertimeSettingsValue } from '@/features/pay-rules/components/weekly-overtime-settings';
import { hasCalculationProfileChange } from '@/features/pay-rules/services/salary-profile-versioning';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { useWorkplaces } from '@/features/workplaces/hooks/use-workplaces';
import { AppScreen, DateField, EmptyState, FormField, PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { createId } from '@/shared/utils/id';
import { formatMinorUnits, parseCurrencyToMinor, parsePercentageToBasisPoints } from '@/shared/utils/money';

export default function SalaryProfilesScreen() {
  const repositories = useRepositories(); const { workplaces, refresh: refreshWorkplaces } = useWorkplaces(); const { colors } = useAppTheme(); const { isRtl, locale, t } = useTranslation();
  const [workplaceId, setWorkplaceId] = useState(''); const [profiles, setProfiles] = useState<SalaryProfile[]>([]); const [editingId, setEditingId] = useState<string>();
  const [name, setName] = useState(''); const [rate, setRate] = useState(''); const [travel, setTravel] = useState('0'); const [bonus, setBonus] = useState('0');
  const [effectiveFrom, setEffectiveFrom] = useState(''); const [effectiveTo, setEffectiveTo] = useState(''); const [error, setError] = useState<string>();
  const [breakPolicy, setBreakPolicy] = useState<SalaryProfile['breakPolicy']>('perBreak'); const [roundingMode, setRoundingMode] = useState<MoneyRoundingMode>('half_up');
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [weekly, setWeekly] = useState<WeeklyOvertimeSettingsValue>(defaultWeeklySettings);
  const selectedWorkplace = workplaceId || workplaces[0]?.id || '';
  const refresh = useCallback(async () => { if (selectedWorkplace) setProfiles(await repositories.salaryProfiles.listByWorkplace(selectedWorkplace)); }, [repositories.salaryProfiles, selectedWorkplace]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const reset = () => { setEditingId(undefined); setName(''); setRate(''); setTravel('0'); setBonus('0'); setEffectiveFrom(''); setEffectiveTo(''); setBreakPolicy('perBreak'); setRoundingMode('half_up'); setAdvancedExpanded(false); setWeekly(defaultWeeklySettings); };
  const edit = (profile: SalaryProfile) => { setEditingId(profile.id); setName(profile.name); setRate(String(profile.baseHourlyRateMinor / 100)); setTravel(String(profile.defaultTravelReimbursementMinor / 100)); setBonus(String(profile.defaultShiftBonusMinor / 100)); setEffectiveFrom(profile.effectiveFrom ?? ''); setEffectiveTo(profile.effectiveTo ?? ''); setBreakPolicy(profile.breakPolicy); setRoundingMode(profile.calculationRoundingMode); setAdvancedExpanded(false); setWeekly({ enabled: profile.weeklyOvertimeEnabled, workweekStartWeekday: profile.workweekStartWeekday, regularHours: formatMinutesAsHours(profile.weeklyRegularMinutes ?? 2_520), multiplierPercent: String((profile.weeklyOvertimeMultiplierBasisPoints ?? 12_500) / 100), basis: profile.weeklyOvertimeBasis }); };
  const save = async () => { try { const now = new Date().toISOString(); const existing = profiles.find((item) => item.id === editingId); const nextRate = parseCurrencyToMinor(rate); const enteredWeeklyRegularMinutes = weeklyHoursToMinutes(weekly.regularHours); if (weekly.enabled && enteredWeeklyRegularMinutes === undefined) throw new Error(t('salary.invalidWeeklyHours')); const enteredWeeklyMultiplier = weekly.enabled ? parsePercentageToBasisPoints(weekly.multiplierPercent) : undefined; if (weekly.enabled && (enteredWeeklyMultiplier ?? 0) < 10_000) throw new Error(t('rules.invalidMultiplier')); const weeklyRegularMinutes = weekly.enabled ? enteredWeeklyRegularMinutes : existing?.weeklyRegularMinutes; const weeklyOvertimeMultiplierBasisPoints = weekly.enabled ? enteredWeeklyMultiplier : existing?.weeklyOvertimeMultiplierBasisPoints; const nextCalculationSettings = { baseHourlyRateMinor: nextRate, workweekStartWeekday: weekly.workweekStartWeekday, weeklyOvertimeEnabled: weekly.enabled, weeklyRegularMinutes, weeklyOvertimeMultiplierBasisPoints, weeklyOvertimeBasis: weekly.basis }; const salaryConfigChanged = Boolean(existing && hasCalculationProfileChange(existing, nextCalculationSettings)); if (salaryConfigChanged && (!effectiveFrom || effectiveFrom === existing?.effectiveFrom)) throw new Error(t('salary.versionDateRequired')); const profile = salaryProfileSchema.parse({ id: salaryConfigChanged ? createId('salary-profile') : editingId ?? createId('salary-profile'), workplaceId: selectedWorkplace, name, currency: 'ILS', timezone: 'Asia/Jerusalem', ...nextCalculationSettings, defaultTravelReimbursementMinor: parseCurrencyToMinor(travel), defaultShiftBonusMinor: parseCurrencyToMinor(bonus), calculationRoundingMode: roundingMode, breakPolicy, effectiveFrom: effectiveFrom || undefined, effectiveTo: effectiveTo || undefined, isActive: true, isArchived: false, createdAt: salaryConfigChanged ? now : existing?.createdAt ?? now, updatedAt: now }); if (profile.baseHourlyRateMinor <= 0) throw new Error(t('salary.invalidMoney')); if (profiles.some((item) => item.id !== existing?.id && item.isActive && !item.isArchived && rangesOverlap(profile.effectiveFrom, profile.effectiveTo, item.effectiveFrom, item.effectiveTo))) throw new Error(t('salary.profileConflict')); if (salaryConfigChanged && existing) await repositories.salaryProfiles.createVersion({ ...existing, effectiveTo: previousLocalDate(effectiveFrom), updatedAt: now }, profile); else if (editingId) await repositories.salaryProfiles.update(profile); else await repositories.salaryProfiles.create(profile); reset(); setError(undefined); await Promise.all([refresh(), refreshWorkplaces()]); } catch (caught) { const message = caught instanceof Error ? caught.message : ''; setError([t('salary.invalidMoney'), t('salary.profileConflict'), t('salary.versionDateRequired'), t('salary.invalidWeeklyHours'), t('rules.invalidMultiplier')].includes(message) ? message : t('salary.invalidForm')); } };
  const duplicate = async (profile: SalaryProfile) => { const now = new Date().toISOString(); await repositories.salaryProfiles.create({ ...profile, id: createId('salary-profile'), name: `${profile.name} · ${t('salary.duplicate')}`, isActive: false, createdAt: now, updatedAt: now }); await refresh(); };
  const archive = async (profile: SalaryProfile) => { await repositories.salaryProfiles.update({ ...profile, isActive: false, isArchived: true, updatedAt: new Date().toISOString() }); const workplace = workplaces.find((item) => item.id === profile.workplaceId); if (workplace?.salaryProfileId === profile.id) await repositories.workplaces.save({ ...workplace, salaryProfileId: undefined, updatedAt: new Date().toISOString() }); await Promise.all([refresh(), refreshWorkplaces()]); };
  const activate = async (profile: SalaryProfile) => { if (profiles.some((item) => item.id !== profile.id && item.isActive && !item.isArchived && rangesOverlap(profile.effectiveFrom, profile.effectiveTo, item.effectiveFrom, item.effectiveTo))) { setError(t('salary.profileConflict')); return; } await repositories.salaryProfiles.update({ ...profile, isActive: true, isArchived: false, updatedAt: new Date().toISOString() }); await refresh(); };
  const setDefault = async (profile: SalaryProfile) => { const workplace = workplaces.find((item) => item.id === profile.workplaceId); if (!workplace) return; await repositories.workplaces.save({ ...workplace, salaryProfileId: profile.id, updatedAt: new Date().toISOString() }); await refreshWorkplaces(); };
  return <AppScreen title={t('salary.title')}>
    <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
    <Text style={{ color: colors.textMuted, textAlign: isRtl ? 'right' : 'left' }}>{t('salary.disclaimer')}</Text>
    <SalaryTrustDisclosure mode="generic" />
    <View style={[styles.choices, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>{workplaces.map((workplace) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: selectedWorkplace === workplace.id }} key={workplace.id} onPress={() => { setWorkplaceId(workplace.id); reset(); }} style={[styles.choice, { borderColor: selectedWorkplace === workplace.id ? colors.primary : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.text }}>{workplace.name}</Text></Pressable>)}</View>
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <FormField label={t('salary.profileName')} onChangeText={setName} value={name} />
      <FormField accessibilityLabel={t('salary.hourlyRate')} keyboardType="decimal-pad" label={t('salary.hourlyRate')} onChangeText={setRate} value={rate} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: advancedExpanded }}
        onPress={() => setAdvancedExpanded((value) => !value)}
        style={({ pressed }) => [styles.advancedToggle, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
      >
        <Text style={{ color: colors.primary, fontWeight: '800', textAlign: isRtl ? 'right' : 'left' }}>{t(advancedExpanded ? 'salary.hideAdvancedRules' : 'salary.showAdvancedRules')}</Text>
      </Pressable>
      {advancedExpanded ? <View testID="advanced-salary-settings" style={styles.advancedFields}>
        <WeeklyOvertimeSettings value={weekly} onChange={setWeekly} />
        <FormField keyboardType="decimal-pad" label={t('salary.travel')} onChangeText={setTravel} value={travel} />
        <FormField keyboardType="decimal-pad" label={t('salary.shiftBonus')} onChangeText={setBonus} value={bonus} />
        <DateField label={t('salary.effectiveFrom')} onChange={(value) => setEffectiveFrom(value ?? '')} optional value={effectiveFrom || undefined} />
        <DateField label={t('salary.effectiveTo')} onChange={(value) => setEffectiveTo(value ?? '')} optional value={effectiveTo || undefined} />
        <Text style={{ color: colors.text, textAlign: isRtl ? 'right' : 'left' }}>{t('salary.breakPolicy')}</Text><View style={[styles.choices, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>{(['paid', 'unpaid', 'perBreak'] as const).map((value) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: breakPolicy === value }} key={value} onPress={() => setBreakPolicy(value)} style={[styles.choice, { borderColor: breakPolicy === value ? colors.primary : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.text }}>{t(value === 'paid' ? 'salary.breakPaid' : value === 'unpaid' ? 'salary.breakUnpaid' : 'salary.breakPerSession')}</Text></Pressable>)}</View>
        <Text style={{ color: colors.text, textAlign: isRtl ? 'right' : 'left' }}>{t('salary.roundingMode')}</Text><View style={[styles.choices, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>{(['half_up', 'floor', 'ceiling'] as const).map((value) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: roundingMode === value }} key={value} onPress={() => setRoundingMode(value)} style={[styles.choice, { borderColor: roundingMode === value ? colors.primary : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.text }}>{t(value === 'half_up' ? 'salary.roundHalfUp' : value === 'floor' ? 'salary.roundFloor' : 'salary.roundCeiling')}</Text></Pressable>)}</View>
      </View> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
      <PrimaryButton disabled={!selectedWorkplace || !name.trim() || !rate} label={editingId ? t('salary.updateProfile') : t('salary.addProfile')} onPress={() => void save()} />
      {editingId ? <SecondaryButton label={t('common.cancel')} onPress={reset} /> : null}
    </View>
    {!profiles.length ? <EmptyState title={t('salary.noProfiles')} body={t('salary.noProfilesBody')} /> : profiles.map((profile) => <View key={profile.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: profile.isArchived ? 0.6 : 1 }]}>
      <Pressable accessibilityRole="button" onPress={() => edit(profile)}><Text style={[styles.title, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{profile.name}</Text><Text style={{ color: colors.textMuted, textAlign: isRtl ? 'right' : 'left' }}>{formatMinorUnits(profile.baseHourlyRateMinor, profile.currency, locale)} · {profile.effectiveFrom ?? '—'}</Text></Pressable>
      <PrimaryButton label={t('salary.rules')} onPress={() => router.push(`/settings/salary/rules?profileId=${profile.id}`)} />
      <SecondaryButton label={t('salary.holidaysRestTitle')} onPress={() => router.push(`/settings/salary/holidays-rest?profileId=${profile.id}` as Href)} />
      <SecondaryButton label={t('salary.duplicate')} onPress={() => void duplicate(profile)} />{!profile.isArchived && workplaces.find((item) => item.id === profile.workplaceId)?.salaryProfileId !== profile.id ? <SecondaryButton label={t('salary.setDefault')} onPress={() => void setDefault(profile)} /> : null}{profile.isArchived ? <SecondaryButton label={t('salary.activate')} onPress={() => void activate(profile)} /> : <SecondaryButton destructive label={t('salary.archive')} onPress={() => void archive(profile)} />}
    </View>)}
  </AppScreen>;
}
const styles = StyleSheet.create({ card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.sm, padding: spacing.md }, title: { fontSize: typography.title, fontWeight: '800' }, choices: { flexWrap: 'wrap', gap: spacing.xs }, choice: { borderRadius: radius.pill, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md }, advancedToggle: { borderTopWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 44, paddingTop: spacing.sm }, advancedFields: { gap: spacing.md } });
function rangesOverlap(leftStart?: string, leftEnd?: string, rightStart?: string, rightEnd?: string) { return (leftStart ?? '') <= (rightEnd ?? '9999-12-31') && (rightStart ?? '') <= (leftEnd ?? '9999-12-31'); }
function previousLocalDate(value: string): string { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); }
function formatMinutesAsHours(minutes: number): string { return Number.isInteger(minutes / 60) ? String(minutes / 60) : String(Number((minutes / 60).toFixed(4))); }
const defaultWeeklySettings: WeeklyOvertimeSettingsValue = { enabled: false, workweekStartWeekday: 0, regularHours: '42', multiplierPercent: '125', basis: 'net' };
