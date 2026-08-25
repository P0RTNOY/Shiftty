import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CalendarEvidenceInterval, EvidenceSourceKind, SpecialIntervalType } from '@/domain/entities';
import { DateField, FormField, PrimaryButton, TimeField } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
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
}

interface Props {
  timezone: string;
  interval?: CalendarEvidenceInterval;
  now?: string;
  onSave: (draft: SpecialPayIntervalDraft) => void | Promise<void>;
}

const intervalTypes: SpecialIntervalType[] = ['holiday', 'weekly_rest', 'custom'];
const baseSourceKinds: EvidenceSourceKind[] = ['manual', 'imported'];

export function SpecialPayIntervalForm({ timezone, interval, now, onSave }: Props) {
  const { colors } = useAppTheme();
  const { formatDate, isRtl, t } = useTranslation();
  const current = now ?? new Date().toISOString();
  const initialDate = formatLocalDateKey(current, timezone);
  const [type, setType] = useState<SpecialIntervalType>(interval?.type ?? 'holiday');
  const [scope, setScope] = useState<'profile' | 'workplace'>(interval && !interval.salaryProfileId ? 'workplace' : 'profile');
  const [name, setName] = useState(interval?.name ?? '');
  const [startDate, setStartDate] = useState(interval ? formatLocalDateKey(interval.start, timezone) : initialDate);
  const [startTime, setStartTime] = useState(interval ? formatLocalTime(interval.start, timezone) : '09:00');
  const [endDate, setEndDate] = useState(interval ? formatLocalDateKey(interval.end, timezone) : initialDate);
  const [endTime, setEndTime] = useState(interval ? formatLocalTime(interval.end, timezone) : '17:00');
  const [sourceKind, setSourceKind] = useState<EvidenceSourceKind>(interval?.sourceKind ?? 'manual');
  const [sourceTitle, setSourceTitle] = useState(interval?.sourceTitle ?? '');
  const [sourceUrl, setSourceUrl] = useState(interval?.sourceUrl ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const align = isRtl ? 'right' : 'left';
  const direction = isRtl ? 'row-reverse' : 'row';
  const sourceKinds = interval?.sourceKind === 'confirmed_preset' ? [...baseSourceKinds, 'confirmed_preset' as const] : baseSourceKinds;
  const update = (operation: () => void) => { operation(); setConfirmed(false); };
  const resolved = useMemo(() => {
    try {
      const start = resolveLocalDateTime(startDate, startTime, timezone);
      const end = resolveLocalDateTime(endDate, endTime, timezone);
      return Date.parse(end) > Date.parse(start) ? { start, end } : undefined;
    } catch {
      return undefined;
    }
  }, [endDate, endTime, startDate, startTime, timezone]);
  const canSave = Boolean(name.trim() && resolved && confirmed);

  return <View testID="special-pay-interval-form" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Text style={[styles.label, { color: colors.text, textAlign: align }]}>{t('salary.intervalType')}</Text>
    <View style={[styles.choices, { flexDirection: direction }]}>{intervalTypes.map((value) => <Pressable
      accessibilityLabel={t(typeKey(value))}
      accessibilityRole="radio"
      accessibilityState={{ checked: type === value }}
      key={value}
      onPress={() => update(() => setType(value))}
      style={[styles.choice, { backgroundColor: colors.surface, borderColor: type === value ? colors.primary : colors.border }]}
    ><Text accessible={false} style={{ color: colors.text }}>{type === value ? '✓ ' : ''}{t(typeKey(value))}</Text></Pressable>)}</View>
    <Text style={[styles.label, { color: colors.text, textAlign: align }]}>{t('salary.intervalScope')}</Text>
    <View style={[styles.choices, { flexDirection: direction }]}>{(['profile', 'workplace'] as const).map((value) => <Pressable
      accessibilityLabel={t(value === 'profile' ? 'salary.intervalScopeProfile' : 'salary.intervalScopeWorkplace')}
      accessibilityRole="radio"
      accessibilityState={{ checked: scope === value }}
      key={value}
      onPress={() => update(() => setScope(value))}
      style={[styles.choice, { backgroundColor: colors.surface, borderColor: scope === value ? colors.primary : colors.border }]}
    ><Text accessible={false} style={{ color: colors.text }}>{scope === value ? '✓ ' : ''}{t(value === 'profile' ? 'salary.intervalScopeProfile' : 'salary.intervalScopeWorkplace')}</Text></Pressable>)}</View>
    <FormField label={t('salary.intervalName')} maxLength={120} testID="e2e-evidence-name" value={name} onChangeText={(value) => update(() => setName(value))} />
    <DateField label={t('salary.intervalStartDate')} value={startDate} onChange={(value) => value && update(() => setStartDate(value))} />
    <TimeField label={t('salary.intervalStartTime')} value={startTime} onChange={(value) => value && update(() => setStartTime(value))} />
    <DateField label={t('salary.intervalEndDate')} value={endDate} onChange={(value) => value && update(() => setEndDate(value))} />
    <TimeField label={t('salary.intervalEndTime')} value={endTime} onChange={(value) => value && update(() => setEndTime(value))} />
    <View style={[styles.preview, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <Text style={[styles.previewTitle, { color: colors.text, textAlign: align }]}>{t('salary.intervalExactPreview')}</Text>
      <Text style={[styles.machineText, { color: colors.textMuted, textAlign: align }]}>{timezone}</Text>
      {resolved ? <View testID="special-interval-preview">
        <Text style={[styles.machineText, { color: colors.text, textAlign: align }]}>{formatInstant(resolved.start, timezone, formatDate)}</Text>
        <Text style={[styles.machineText, { color: colors.text, textAlign: align }]}>{formatInstant(resolved.end, timezone, formatDate)}</Text>
      </View> : <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger, textAlign: align }]}>{t('salary.intervalInvalid')}</Text>}
    </View>
    <Text style={[styles.label, { color: colors.text, textAlign: align }]}>{t('salary.sourceKind')}</Text>
    <View style={[styles.choices, { flexDirection: direction }]}>{sourceKinds.map((value) => <Pressable
      accessibilityLabel={t(value === 'manual' ? 'salary.sourceManual' : value === 'imported' ? 'salary.sourceImported' : 'salary.sourceConfirmedPreset')}
      accessibilityRole="radio"
      accessibilityState={{ checked: sourceKind === value }}
      key={value}
      onPress={() => update(() => setSourceKind(value))}
      style={[styles.choice, { backgroundColor: colors.surface, borderColor: sourceKind === value ? colors.primary : colors.border }]}
    ><Text accessible={false} style={{ color: colors.text }}>{sourceKind === value ? '✓ ' : ''}{t(value === 'manual' ? 'salary.sourceManual' : value === 'imported' ? 'salary.sourceImported' : 'salary.sourceConfirmedPreset')}</Text></Pressable>)}</View>
    <FormField label={t('salary.sourceTitle')} maxLength={240} value={sourceTitle} onChangeText={(value) => update(() => setSourceTitle(value))} />
    <FormField
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="url"
      label={t('salary.sourceUrl')}
      maxLength={2_048}
      style={styles.machineInput}
      value={sourceUrl}
      onChangeText={(value) => update(() => setSourceUrl(value))}
    />
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: confirmed }}
      onPress={() => setConfirmed((value) => !value)}
      style={[styles.checkRow, { flexDirection: direction }]}
      testID="e2e-evidence-confirm-edit"
    >
      <View style={[styles.check, { borderColor: colors.primary, backgroundColor: confirmed ? colors.primary : colors.surface }]}>
        <Text accessible={false} testID="special-interval-confirmation-mark" style={[styles.checkMark, { color: colors.onPrimary }]}>{confirmed ? '✓' : ''}</Text>
      </View>
      <Text style={[styles.checkText, { color: colors.text, textAlign: align }]}>{t('salary.intervalConfirm')}</Text>
    </Pressable>
    <PrimaryButton
      disabled={!canSave}
      label={t('salary.intervalSave')}
      onPress={() => resolved && void onSave({
        scope, type, name: name.trim(), start: resolved.start, end: resolved.end, timezone, sourceKind,
        sourceTitle: sourceTitle.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        presetId: sourceKind === 'confirmed_preset' ? interval?.presetId : undefined,
        presetVersion: sourceKind === 'confirmed_preset' ? interval?.presetVersion : undefined,
      })}
      testID="e2e-evidence-save"
    />
  </View>;
}

function typeKey(type: SpecialIntervalType) {
  return type === 'holiday' ? 'salary.specialIntervalTypeHoliday' as const
    : type === 'weekly_rest' ? 'salary.specialIntervalTypeWeeklyRest' as const
      : 'salary.specialIntervalTypeCustom' as const;
}

type FormatDate = ReturnType<typeof useTranslation>['formatDate'];
function formatInstant(value: string, timezone: string, formatDate: FormatDate): string {
  return formatDate(value, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: timezone,
  });
}

function formatLocalTime(value: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone,
  }).formatToParts(new Date(value));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md, padding: spacing.md },
  label: { fontSize: typography.body, fontWeight: '700' },
  body: { fontSize: typography.body, lineHeight: 22 },
  choices: { flexWrap: 'wrap', gap: spacing.xs },
  choice: { borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  preview: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.xs, padding: spacing.md },
  previewTitle: { fontWeight: '800' },
  machineText: { fontVariant: ['tabular-nums'], lineHeight: 22, writingDirection: 'ltr' },
  machineInput: { textAlign: 'left', writingDirection: 'ltr' },
  checkRow: { alignItems: 'flex-start', gap: spacing.sm, minHeight: 48, paddingVertical: spacing.xs },
  check: { borderRadius: radius.sm, borderWidth: 2, height: 24, marginTop: 1, width: 24 },
  checkMark: { fontSize: 16, fontWeight: '900', lineHeight: 20, textAlign: 'center' },
  checkText: { flex: 1, flexShrink: 1, fontSize: typography.body, lineHeight: 22 },
});
