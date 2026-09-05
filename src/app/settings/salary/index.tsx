import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { salaryProfileSchema, type MoneyRoundingMode, type SalaryProfile } from '@/domain/entities';
import { SalaryTrustDisclosure } from '@/features/pay-rules/components/salary-trust-disclosure';
import { SalaryWorkplaceOverview } from '@/features/pay-rules/components/salary-workplace-overview';
import { WeeklyOvertimeSettings, weeklyHoursToMinutes, type WeeklyOvertimeSettingsValue } from '@/features/pay-rules/components/weekly-overtime-settings';
import { buildSalarySettingsOverview, localDateInTimeZone, type SalarySettingsOverview } from '@/features/pay-rules/services/salary-settings-overview';
import { hasCalculationProfileChange } from '@/features/pay-rules/services/salary-profile-versioning';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { useWorkplaces } from '@/features/workplaces/hooks/use-workplaces';
import { AppScreen, DateField, EmptyState, FormField, PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { createId } from '@/shared/utils/id';
import { formatMinorUnits, parseCurrencyToMinor, parsePercentageToBasisPoints } from '@/shared/utils/money';

export default function SalaryProfilesScreen() {
  const repositories = useRepositories();
  const { workplaces, refresh: refreshWorkplaces } = useWorkplaces();
  const { colors } = useAppTheme();
  const { isRtl, locale, t } = useTranslation();
  const [workplaceId, setWorkplaceId] = useState('');
  const [profiles, setProfiles] = useState<SalaryProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<SalaryProfile | null>();
  const [overview, setOverview] = useState<SalarySettingsOverview>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [travel, setTravel] = useState('0');
  const [bonus, setBonus] = useState('0');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [error, setError] = useState<string>();
  const [breakPolicy, setBreakPolicy] = useState<SalaryProfile['breakPolicy']>('perBreak');
  const [roundingMode, setRoundingMode] = useState<MoneyRoundingMode>('half_up');
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [weekly, setWeekly] = useState<WeeklyOvertimeSettingsValue>(defaultWeeklySettings);
  const selectedWorkplace = workplaceId || workplaces[0]?.id || '';
  const selectedWorkplaceEntity = workplaces.find((item) => item.id === selectedWorkplace);

  const refresh = useCallback(async () => {
    if (!selectedWorkplace) return;
    const nextProfiles = await repositories.salaryProfiles.listByWorkplace(selectedWorkplace);
    const timezone = nextProfiles.find((item) => item.isActive && !item.isArchived)?.timezone ?? 'Asia/Jerusalem';
    const resolved = await repositories.salaryProfiles.resolveForDate(selectedWorkplace, localDateInTimeZone(timezone));
    setProfiles(nextProfiles);
    setCurrentProfile(resolved);
    if (!resolved) {
      setOverview(undefined);
      return;
    }
    const [rules, weeklyRest, intervals] = await Promise.all([
      repositories.payRules.listForProfile(resolved.id),
      repositories.weeklyRestSchedules.getForProfile(resolved.id),
      repositories.calendarEvidenceIntervals.listForScope({ workplaceId: selectedWorkplace, salaryProfileId: resolved.id }),
    ]);
    setOverview(buildSalarySettingsOverview({ intervals, profile: resolved, rules, weeklyRest }));
  }, [repositories.calendarEvidenceIntervals, repositories.payRules, repositories.salaryProfiles, repositories.weeklyRestSchedules, selectedWorkplace]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const resetFields = () => {
    setEditingId(undefined); setName(''); setRate(''); setTravel('0'); setBonus('0');
    setEffectiveFrom(''); setEffectiveTo(''); setBreakPolicy('perBreak'); setRoundingMode('half_up');
    setAdvancedExpanded(false); setWeekly(defaultWeeklySettings); setError(undefined);
  };
  const closeEditor = () => { resetFields(); setEditorOpen(false); };
  const edit = (profile: SalaryProfile) => {
    setEditingId(profile.id); setName(profile.name); setRate(String(profile.baseHourlyRateMinor / 100));
    setTravel(String(profile.defaultTravelReimbursementMinor / 100)); setBonus(String(profile.defaultShiftBonusMinor / 100));
    setEffectiveFrom(profile.effectiveFrom ?? ''); setEffectiveTo(profile.effectiveTo ?? ''); setBreakPolicy(profile.breakPolicy);
    setRoundingMode(profile.calculationRoundingMode); setAdvancedExpanded(false);
    setWeekly({ enabled: profile.weeklyOvertimeEnabled, workweekStartWeekday: profile.workweekStartWeekday, regularHours: formatMinutesAsHours(profile.weeklyRegularMinutes ?? 2_520), multiplierPercent: String((profile.weeklyOvertimeMultiplierBasisPoints ?? 12_500) / 100), basis: profile.weeklyOvertimeBasis });
    setError(undefined); setEditorOpen(true);
  };
  const add = () => { resetFields(); setEditorOpen(true); };

  const save = async () => {
    try {
      const now = new Date().toISOString();
      const existing = profiles.find((item) => item.id === editingId);
      const nextRate = parseCurrencyToMinor(rate);
      const enteredWeeklyRegularMinutes = weeklyHoursToMinutes(weekly.regularHours);
      if (weekly.enabled && enteredWeeklyRegularMinutes === undefined) throw new Error(t('salary.invalidWeeklyHours'));
      const enteredWeeklyMultiplier = weekly.enabled ? parsePercentageToBasisPoints(weekly.multiplierPercent) : undefined;
      if (weekly.enabled && (enteredWeeklyMultiplier ?? 0) < 10_000) throw new Error(t('rules.invalidMultiplier'));
      const weeklyRegularMinutes = weekly.enabled ? enteredWeeklyRegularMinutes : existing?.weeklyRegularMinutes;
      const weeklyOvertimeMultiplierBasisPoints = weekly.enabled ? enteredWeeklyMultiplier : existing?.weeklyOvertimeMultiplierBasisPoints;
      const nextCalculationSettings = { baseHourlyRateMinor: nextRate, workweekStartWeekday: weekly.workweekStartWeekday, weeklyOvertimeEnabled: weekly.enabled, weeklyRegularMinutes, weeklyOvertimeMultiplierBasisPoints, weeklyOvertimeBasis: weekly.basis };
      const salaryConfigChanged = Boolean(existing && hasCalculationProfileChange(existing, nextCalculationSettings));
      if (salaryConfigChanged && (!effectiveFrom || effectiveFrom === existing?.effectiveFrom)) throw new Error(t('salary.versionDateRequired'));
      const profile = salaryProfileSchema.parse({ id: salaryConfigChanged ? createId('salary-profile') : editingId ?? createId('salary-profile'), workplaceId: selectedWorkplace, name, currency: 'ILS', timezone: 'Asia/Jerusalem', ...nextCalculationSettings, defaultTravelReimbursementMinor: parseCurrencyToMinor(travel), defaultShiftBonusMinor: parseCurrencyToMinor(bonus), calculationRoundingMode: roundingMode, breakPolicy, effectiveFrom: effectiveFrom || undefined, effectiveTo: effectiveTo || undefined, isActive: true, isArchived: false, createdAt: salaryConfigChanged ? now : existing?.createdAt ?? now, updatedAt: now });
      if (profile.baseHourlyRateMinor <= 0) throw new Error(t('salary.invalidMoney'));
      if (profiles.some((item) => item.id !== existing?.id && item.isActive && !item.isArchived && rangesOverlap(profile.effectiveFrom, profile.effectiveTo, item.effectiveFrom, item.effectiveTo))) throw new Error(t('salary.profileConflict'));
      if (salaryConfigChanged && existing) await repositories.salaryProfiles.createVersion({ ...existing, effectiveTo: previousLocalDate(effectiveFrom), updatedAt: now }, profile);
      else if (editingId) await repositories.salaryProfiles.update(profile);
      else await repositories.salaryProfiles.create(profile);
      closeEditor();
      await Promise.all([refresh(), refreshWorkplaces()]);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError([t('salary.invalidMoney'), t('salary.profileConflict'), t('salary.versionDateRequired'), t('salary.invalidWeeklyHours'), t('rules.invalidMultiplier')].includes(message) ? message : t('salary.invalidForm'));
    }
  };
  const duplicate = async (profile: SalaryProfile) => { const now = new Date().toISOString(); await repositories.salaryProfiles.create({ ...profile, id: createId('salary-profile'), name: `${profile.name} · ${t('salary.duplicate')}`, isActive: false, createdAt: now, updatedAt: now }); await refresh(); };
  const archive = async (profile: SalaryProfile) => { await repositories.salaryProfiles.update({ ...profile, isActive: false, isArchived: true, updatedAt: new Date().toISOString() }); const workplace = workplaces.find((item) => item.id === profile.workplaceId); if (workplace?.salaryProfileId === profile.id) await repositories.workplaces.save({ ...workplace, salaryProfileId: undefined, updatedAt: new Date().toISOString() }); await Promise.all([refresh(), refreshWorkplaces()]); };
  const activate = async (profile: SalaryProfile) => { if (profiles.some((item) => item.id !== profile.id && item.isActive && !item.isArchived && rangesOverlap(profile.effectiveFrom, profile.effectiveTo, item.effectiveFrom, item.effectiveTo))) { setError(t('salary.profileConflict')); return; } await repositories.salaryProfiles.update({ ...profile, isActive: true, isArchived: false, updatedAt: new Date().toISOString() }); await refresh(); };
  const setDefault = async (profile: SalaryProfile) => { const workplace = workplaces.find((item) => item.id === profile.workplaceId); if (!workplace) return; await repositories.workplaces.save({ ...workplace, salaryProfileId: profile.id, updatedAt: new Date().toISOString() }); await refreshWorkplaces(); };

  return <AppScreen title={t('salary.settingsTitle')}>
    <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
    <Text style={{ color: colors.textMuted, textAlign: isRtl ? 'right' : 'left' }}>{t('salary.disclaimer')}</Text>
    {workplaces.length > 1 ? <View style={[styles.choices, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>{workplaces.map((workplace) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: selectedWorkplace === workplace.id }} key={workplace.id} onPress={() => { setWorkplaceId(workplace.id); closeEditor(); }} style={[styles.choice, { borderColor: selectedWorkplace === workplace.id ? colors.primary : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.text }}>{workplace.name}</Text></Pressable>)}</View> : null}

    {currentProfile && overview && selectedWorkplaceEntity ? <SalaryWorkplaceOverview
      onEdit={() => edit(currentProfile)}
      onOpenSpecialPay={() => router.push(`/settings/salary/holidays-rest?profileId=${currentProfile.id}` as Href)}
      overview={overview}
      profile={currentProfile}
      workplaceName={selectedWorkplaceEntity.name}
    /> : currentProfile === null ? <View style={styles.card}><EmptyState title={t('salary.noProfiles')} body={t('salary.noProfilesBody')} /><PrimaryButton label={t('salary.setupSalary')} onPress={add} /></View> : <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text>}

    {editorOpen ? <SalaryEditor
      advancedExpanded={advancedExpanded} bonus={bonus} breakPolicy={breakPolicy} effectiveFrom={effectiveFrom} effectiveTo={effectiveTo}
      editing={Boolean(editingId)} error={error} isRtl={isRtl} name={name} rate={rate} roundingMode={roundingMode}
      setAdvancedExpanded={setAdvancedExpanded} setBonus={setBonus} setBreakPolicy={setBreakPolicy} setEffectiveFrom={setEffectiveFrom}
      setEffectiveTo={setEffectiveTo} setName={setName} setRate={setRate} setRoundingMode={setRoundingMode} setTravel={setTravel}
      setWeekly={setWeekly} travel={travel} weekly={weekly} onCancel={closeEditor} onSave={() => void save()}
    /> : null}

    <Pressable accessibilityRole="button" accessibilityState={{ expanded: managementOpen }} onPress={() => setManagementOpen((value) => !value)} style={[styles.disclosure, { borderColor: colors.border }]} testID="salary-profile-management-toggle">
      <Text style={{ color: colors.primary, fontWeight: '800', textAlign: isRtl ? 'right' : 'left' }}>{t(managementOpen ? 'salary.hideProfileManagement' : 'salary.showProfileManagement')}</Text>
    </Pressable>
    {managementOpen ? <View testID="salary-profile-management" style={styles.management}>
      <SecondaryButton label={t('salary.addAnotherProfile')} onPress={add} />
      {profiles.map((profile) => <View key={profile.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: profile.isArchived ? 0.6 : 1 }]}>
        <Text style={[styles.title, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{profile.name}</Text>
        <Text style={{ color: colors.textMuted, textAlign: isRtl ? 'right' : 'left' }}>{formatMinorUnits(profile.baseHourlyRateMinor, profile.currency, locale)} · {profile.effectiveFrom ?? '—'}</Text>
        <SecondaryButton label={t('salary.editSettings')} onPress={() => edit(profile)} />
        <SecondaryButton label={t('salary.rules')} onPress={() => router.push(`/settings/salary/rules?profileId=${profile.id}`)} testID="e2e-salary-rules" />
        <SecondaryButton label={t('salary.duplicate')} onPress={() => void duplicate(profile)} />
        {!profile.isArchived && workplaces.find((item) => item.id === profile.workplaceId)?.salaryProfileId !== profile.id ? <SecondaryButton label={t('salary.setDefault')} onPress={() => void setDefault(profile)} /> : null}
        {profile.isArchived ? <SecondaryButton label={t('salary.activate')} onPress={() => void activate(profile)} /> : <SecondaryButton destructive label={t('salary.archive')} onPress={() => void archive(profile)} />}
      </View>)}
    </View> : null}
    <SalaryTrustDisclosure mode="generic" />
  </AppScreen>;
}

interface SalaryEditorProps {
  advancedExpanded: boolean; bonus: string; breakPolicy: SalaryProfile['breakPolicy']; effectiveFrom: string; effectiveTo: string;
  editing: boolean; error?: string; isRtl: boolean; name: string; rate: string; roundingMode: MoneyRoundingMode; travel: string;
  weekly: WeeklyOvertimeSettingsValue; onCancel: () => void; onSave: () => void;
  setAdvancedExpanded: (value: boolean | ((current: boolean) => boolean)) => void; setBonus: (value: string) => void;
  setBreakPolicy: (value: SalaryProfile['breakPolicy']) => void; setEffectiveFrom: (value: string) => void; setEffectiveTo: (value: string) => void;
  setName: (value: string) => void; setRate: (value: string) => void; setRoundingMode: (value: MoneyRoundingMode) => void;
  setTravel: (value: string) => void; setWeekly: (value: WeeklyOvertimeSettingsValue) => void;
}

function SalaryEditor(props: SalaryEditorProps) {
  const { colors } = useAppTheme(); const { t } = useTranslation();
  return <View testID="salary-settings-editor" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text, textAlign: props.isRtl ? 'right' : 'left' }]}>{t(props.editing ? 'salary.editSettings' : 'salary.setupSalary')}</Text>
    <FormField label={t('salary.profileName')} onChangeText={props.setName} value={props.name} />
    <FormField accessibilityLabel={t('salary.hourlyRate')} keyboardType="decimal-pad" label={t('salary.hourlyRate')} onChangeText={props.setRate} value={props.rate} />
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: props.advancedExpanded }} onPress={() => props.setAdvancedExpanded((value) => !value)} testID="e2e-salary-advanced-toggle" style={({ pressed }) => [styles.disclosure, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}>
      <Text style={{ color: colors.primary, fontWeight: '800', textAlign: props.isRtl ? 'right' : 'left' }}>{t(props.advancedExpanded ? 'salary.hideAdvancedRules' : 'salary.showAdvancedRules')}</Text>
    </Pressable>
    {props.advancedExpanded ? <View testID="advanced-salary-settings" style={styles.management}>
      <WeeklyOvertimeSettings value={props.weekly} onChange={props.setWeekly} />
      <FormField keyboardType="decimal-pad" label={t('salary.travel')} onChangeText={props.setTravel} value={props.travel} />
      <FormField keyboardType="decimal-pad" label={t('salary.shiftBonus')} onChangeText={props.setBonus} value={props.bonus} />
      <DateField label={t('salary.effectiveFrom')} onChange={(value) => props.setEffectiveFrom(value ?? '')} optional testID="e2e-salary-effective-from" value={props.effectiveFrom || undefined} />
      <DateField label={t('salary.effectiveTo')} onChange={(value) => props.setEffectiveTo(value ?? '')} optional value={props.effectiveTo || undefined} />
      <ChoiceGroup label={t('salary.breakPolicy')} values={['paid', 'unpaid', 'perBreak']} selected={props.breakPolicy} onSelect={props.setBreakPolicy} labels={[t('salary.breakPaid'), t('salary.breakUnpaid'), t('salary.breakPerSession')]} />
      <ChoiceGroup label={t('salary.roundingMode')} values={['half_up', 'floor', 'ceiling']} selected={props.roundingMode} onSelect={props.setRoundingMode} labels={[t('salary.roundHalfUp'), t('salary.roundFloor'), t('salary.roundCeiling')]} />
    </View> : null}
    {props.error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{props.error}</Text> : null}
    <PrimaryButton disabled={!props.name.trim() || !props.rate} label={props.editing ? t('salary.updateProfile') : t('salary.addProfile')} onPress={props.onSave} testID="e2e-salary-profile-save" />
    <SecondaryButton label={t('common.cancel')} onPress={props.onCancel} />
  </View>;
}

function ChoiceGroup<T extends string>({ label, labels, onSelect, selected, values }: { label: string; labels: string[]; onSelect: (value: T) => void; selected: T; values: readonly T[] }) {
  const { colors } = useAppTheme(); const { isRtl } = useTranslation();
  return <><Text style={{ color: colors.text, textAlign: isRtl ? 'right' : 'left' }}>{label}</Text><View style={[styles.choices, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>{values.map((value, index) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected === value }} key={value} onPress={() => onSelect(value)} style={[styles.choice, { borderColor: selected === value ? colors.primary : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: colors.text }}>{labels[index]}</Text></Pressable>)}</View></>;
}

const styles = StyleSheet.create({ card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.sm, padding: spacing.md }, title: { fontSize: typography.title, fontWeight: '800' }, choices: { flexWrap: 'wrap', gap: spacing.xs }, choice: { borderRadius: radius.pill, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md }, disclosure: { borderTopWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 48, paddingVertical: spacing.sm }, management: { gap: spacing.md } });
function rangesOverlap(leftStart?: string, leftEnd?: string, rightStart?: string, rightEnd?: string) { return (leftStart ?? '') <= (rightEnd ?? '9999-12-31') && (rightStart ?? '') <= (leftEnd ?? '9999-12-31'); }
function previousLocalDate(value: string): string { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); }
function formatMinutesAsHours(minutes: number): string { return Number.isInteger(minutes / 60) ? String(minutes / 60) : String(Number((minutes / 60).toFixed(4))); }
const defaultWeeklySettings: WeeklyOvertimeSettingsValue = { enabled: false, workweekStartWeekday: 0, regularHours: '42', multiplierPercent: '125', basis: 'net' };
