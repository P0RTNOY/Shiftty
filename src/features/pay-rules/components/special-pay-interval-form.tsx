import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CalendarEvidenceInterval, EvidenceSourceKind, PayRule, SpecialIntervalType } from '@/domain/entities';
import { DateField, FormField, PrimaryButton, TimeField } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { parsePercentageToBasisPoints } from '@/shared/utils/money';
import { formatLocalDateKey, resolveLocalDateTime } from '@/shared/utils/zoned-time';

export interface SpecialPayIntervalDraft {
  scope: 'profile' | 'workplace';
  type: SpecialIntervalType;
  name: string;
  start: string;
  end: string;
  timezone: string;
  sourceKind: EvidenceSourceKind;
  sourceTitle?: string;
  sourceUrl?: string;
  presetId?: string;
  presetVersion?: string;
  payChoice: { kind: 'managed_rate'; multiplierBasisPoints: number } | { kind: 'advanced_preserved' };
}

interface Props {
  timezone: string;
  interval?: CalendarEvidenceInterval;
  managedPayRule?: PayRule;
  managedRuleBlocked?: boolean;
  weeklyRestRateBasisPoints?: number;
  now?: string;
  onSave: (draft: SpecialPayIntervalDraft) => void | Promise<void>;
}

const intervalTypes: SpecialIntervalType[] = ['holiday', 'weekly_rest', 'custom'];
const baseSourceKinds: EvidenceSourceKind[] = ['manual', 'imported'];

export function SpecialPayIntervalForm({ timezone, interval, managedPayRule, managedRuleBlocked = false, weeklyRestRateBasisPoints, now, onSave }: Props) {
  const { colors } = useAppTheme();
  const { formatDate, isRtl, t } = useTranslation();
  const current = now ?? new Date().toISOString();
  const initialDate = formatLocalDateKey(current, timezone);
  const [type, setType] = useState<SpecialIntervalType>(interval?.type ?? 'holiday');
  const [scope, setScope] = useState<'profile' | 'workplace'>(interval ? interval.salaryProfileId ? 'profile' : 'workplace' : 'workplace');
  const [name, setName] = useState(interval?.name ?? '');
  const [startDate, setStartDate] = useState(interval ? formatLocalDateKey(interval.start, timezone) : initialDate);
  const [startTime, setStartTime] = useState(interval ? formatLocalTime(interval.start, timezone) : '09:00');
  const [endDate, setEndDate] = useState(interval ? formatLocalDateKey(interval.end, timezone) : initialDate);
  const [endTime, setEndTime] = useState(interval ? formatLocalTime(interval.end, timezone) : '17:00');
  const [sourceKind, setSourceKind] = useState<EvidenceSourceKind>(interval?.sourceKind ?? 'manual');
  const [sourceTitle, setSourceTitle] = useState(interval?.sourceTitle ?? '');
  const [sourceUrl, setSourceUrl] = useState(interval?.sourceUrl ?? '');
  const [rate, setRate] = useState(String((managedPayRule?.effect.type === 'multiplier' ? managedPayRule.effect.basisPoints : 15_000) / 100));
  const [useWeeklyRestRate, setUseWeeklyRestRate] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const align = isRtl ? 'right' : 'left';
  const direction = isRtl ? 'row-reverse' : 'row';
  const sourceKinds = interval?.sourceKind === 'confirmed_preset' ? [...baseSourceKinds, 'confirmed_preset' as const] : baseSourceKinds;
  const resolved = useMemo(() => {
    try {
      const start = resolveLocalDateTime(startDate, startTime, timezone);
      const end = resolveLocalDateTime(endDate, endTime, timezone);
      return Date.parse(end) > Date.parse(start) ? { start, end } : undefined;
    } catch { return undefined; }
  }, [endDate, endTime, startDate, startTime, timezone]);
  let multiplierBasisPoints: number | undefined;
  try { multiplierBasisPoints = useWeeklyRestRate ? weeklyRestRateBasisPoints : parsePercentageToBasisPoints(rate); } catch { multiplierBasisPoints = undefined; }
  const canSave = Boolean(name.trim() && resolved && (managedRuleBlocked || (multiplierBasisPoints ?? 0) >= 10_000)) && !isSaving;

  const submit = async () => {
    if (!resolved || !canSave) return;
    setIsSaving(true);
    try {
      await onSave({
        scope, type, name: name.trim(), start: resolved.start, end: resolved.end, timezone, sourceKind,
        sourceTitle: sourceTitle.trim() || undefined, sourceUrl: sourceUrl.trim() || undefined,
        presetId: sourceKind === 'confirmed_preset' ? interval?.presetId : undefined,
        presetVersion: sourceKind === 'confirmed_preset' ? interval?.presetVersion : undefined,
        payChoice: managedRuleBlocked ? { kind: 'advanced_preserved' } : { kind: 'managed_rate', multiplierBasisPoints: multiplierBasisPoints! },
      });
    } finally { setIsSaving(false); }
  };

  return <View testID="special-pay-interval-form" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <FormField label={t('salary.intervalName')} maxLength={120} testID="e2e-evidence-name" value={name} onChangeText={setName} />
    <Text style={[styles.label, { color: colors.text, textAlign: align }]}>{t('salary.intervalType')}</Text>
    <View style={[styles.choices, { flexDirection: direction }]}>{intervalTypes.map((value) => <Choice key={value} checked={type === value} label={t(typeKey(value))} onPress={() => setType(value)} />)}</View>
    <DateField label={t('salary.intervalStartDate')} value={startDate} onChange={(value) => value && setStartDate(value)} />
    <TimeField label={t('salary.intervalStartTime')} value={startTime} onChange={(value) => value && setStartTime(value)} />
    <DateField label={t('salary.intervalEndDate')} value={endDate} onChange={(value) => value && setEndDate(value)} />
    <TimeField label={t('salary.intervalEndTime')} value={endTime} onChange={(value) => value && setEndTime(value)} />
    <View style={[styles.preview, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <Text style={[styles.previewTitle, { color: colors.text, textAlign: align }]}>{t('salary.intervalExactPreview')}</Text>
      <Text style={[styles.machineText, { color: colors.textMuted }]}>{timezone}</Text>
      {resolved ? <View testID="special-interval-preview"><Text style={[styles.machineText, { color: colors.text }]}>{formatInstant(resolved.start, timezone, formatDate)}</Text><Text style={[styles.machineText, { color: colors.text }]}>{formatInstant(resolved.end, timezone, formatDate)}</Text></View> : <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger, textAlign: align }]}>{t('salary.intervalInvalid')}</Text>}
    </View>
    {managedRuleBlocked ? <Text style={[styles.body, { color: colors.warning, textAlign: align }]}>{t('salary.intervalManagedConflict')}</Text> : <>
      <FormField accessibilityLabel={t('salary.intervalTotalRate')} keyboardType="decimal-pad" label={t('salary.intervalTotalRate')} onChangeText={(value) => { setRate(value); setUseWeeklyRestRate(false); }} value={rate} />
      {weeklyRestRateBasisPoints ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: useWeeklyRestRate }} onPress={() => setUseWeeklyRestRate((value) => !value)} style={[styles.checkRow, { flexDirection: direction }]}>
        <View style={[styles.check, { borderColor: colors.primary, backgroundColor: useWeeklyRestRate ? colors.primary : colors.surface }]}><Text accessible={false} style={{ color: colors.onPrimary, textAlign: 'center' }}>{useWeeklyRestRate ? '✓' : ''}</Text></View>
        <Text style={[styles.body, { color: colors.text, textAlign: align }]}>{t('salary.intervalUseWeeklyRestRate', { multiplier: String(weeklyRestRateBasisPoints / 100) })}</Text>
      </Pressable> : null}
      <Text style={[styles.body, { color: colors.textMuted, textAlign: align }]}>{t('salary.intervalTotalRateHelp')}</Text>
    </>}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: advanced }} onPress={() => setAdvanced((value) => !value)} style={[styles.advanced, { borderColor: colors.border }]}>
      <Text style={{ color: colors.primary, fontWeight: '800', textAlign: align }}>{t(advanced ? 'salary.intervalHideAdvanced' : 'salary.intervalShowAdvanced')}</Text>
    </Pressable>
    {advanced ? <View testID="special-interval-advanced" style={styles.advancedFields}>
      <Text style={[styles.label, { color: colors.text, textAlign: align }]}>{t('salary.intervalScope')}</Text>
      <View style={[styles.choices, { flexDirection: direction }]}>{(['profile', 'workplace'] as const).map((value) => <Choice key={value} checked={scope === value} label={t(value === 'profile' ? 'salary.intervalScopeProfile' : 'salary.intervalScopeWorkplace')} onPress={() => setScope(value)} />)}</View>
      <Text style={[styles.label, { color: colors.text, textAlign: align }]}>{t('salary.sourceKind')}</Text>
      <View style={[styles.choices, { flexDirection: direction }]}>{sourceKinds.map((value) => <Choice key={value} checked={sourceKind === value} label={t(value === 'manual' ? 'salary.sourceManual' : value === 'imported' ? 'salary.sourceImported' : 'salary.sourceConfirmedPreset')} onPress={() => setSourceKind(value)} />)}</View>
      <FormField label={t('salary.sourceTitle')} maxLength={240} value={sourceTitle} onChangeText={setSourceTitle} />
      <FormField autoCapitalize="none" autoCorrect={false} keyboardType="url" label={t('salary.sourceUrl')} maxLength={2_048} style={styles.machineInput} value={sourceUrl} onChangeText={setSourceUrl} />
    </View> : null}
    <PrimaryButton disabled={!canSave} label={t('salary.intervalSaveAndConfirm')} onPress={() => void submit()} testID="e2e-evidence-save" />
  </View>;
}

function Choice({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityLabel={label} accessibilityRole="radio" accessibilityState={{ checked }} onPress={onPress} style={[styles.choice, { backgroundColor: colors.surface, borderColor: checked ? colors.primary : colors.border }]}><Text accessible={false} style={{ color: colors.text }}>{checked ? '✓ ' : ''}{label}</Text></Pressable>;
}
function typeKey(type: SpecialIntervalType) { return type === 'holiday' ? 'salary.specialIntervalTypeHoliday' as const : type === 'weekly_rest' ? 'salary.specialIntervalTypeWeeklyRest' as const : 'salary.specialIntervalTypeCustom' as const; }
type FormatDate = ReturnType<typeof useTranslation>['formatDate'];
function formatInstant(value: string, timezone: string, formatDate: FormatDate): string { return formatDate(value, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: timezone }); }
function formatLocalTime(value: string, timezone: string): string { const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone }).formatToParts(new Date(value)); return `${parts.find((part) => part.type === 'hour')?.value ?? '00'}:${parts.find((part) => part.type === 'minute')?.value ?? '00'}`; }

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md, padding: spacing.md },
  label: { fontSize: typography.body, fontWeight: '700' }, body: { fontSize: typography.body, lineHeight: 22 },
  choices: { flexWrap: 'wrap', gap: spacing.xs }, choice: { borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  preview: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.xs, padding: spacing.md }, previewTitle: { fontWeight: '800' },
  machineText: { fontVariant: ['tabular-nums'], lineHeight: 22, textAlign: 'left', writingDirection: 'ltr' }, machineInput: { textAlign: 'left', writingDirection: 'ltr' },
  checkRow: { alignItems: 'flex-start', gap: spacing.sm, minHeight: 44 }, check: { borderRadius: radius.sm, borderWidth: 2, height: 24, width: 24 },
  advanced: { borderTopWidth: StyleSheet.hairlineWidth, minHeight: 44, justifyContent: 'center' }, advancedFields: { gap: spacing.md },
});
