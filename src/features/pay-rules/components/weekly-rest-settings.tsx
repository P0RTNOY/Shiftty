import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { resolveWeeklyRestOccurrences } from '@/domain/services';
import type { EvidenceSourceKind, PayRule, WeeklyRestSchedule } from '@/domain/entities';
import { FormField, PrimaryButton, SecondaryButton, TimeField } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { parsePercentageToBasisPoints } from '@/shared/utils/money';

import { WeekdayPicker } from './weekday-picker';

export interface WeeklyRestSettingsDraft {
  enabled: boolean;
  label: string;
  startWeekday: number;
  startTime: string;
  endWeekday: number;
  endTime: string;
  sourceKind: EvidenceSourceKind;
  sourceTitle?: string;
  sourceUrl?: string;
  confirmed: boolean;
}

interface Props {
  schedule?: WeeklyRestSchedule | null;
  managedPayRule?: PayRule;
  advancedPayRules?: readonly PayRule[];
  managedRuleBlocked?: boolean;
  timezone: string;
  workplaceId: string;
  salaryProfileId: string;
  previewFrom?: string;
  onSave: (draft: WeeklyRestSettingsDraft) => void | Promise<void>;
  onSavePayRule?: (multiplierBasisPoints: number) => void | Promise<void>;
  onOpenAdvancedRules?: () => void;
}

export function WeeklyRestSettings({
  schedule,
  managedPayRule,
  advancedPayRules = [],
  managedRuleBlocked = false,
  timezone,
  workplaceId,
  salaryProfileId,
  previewFrom,
  onSave,
  onSavePayRule,
  onOpenAdvancedRules,
}: Props) {
  const { colors } = useAppTheme();
  const { formatDate, isRtl, locale, t } = useTranslation();
  const [enabled, setEnabled] = useState(schedule?.enabled ?? false);
  const [label, setLabel] = useState(schedule?.label ?? t('salary.weeklyRestDefaultLabel'));
  const [startWeekday, setStartWeekday] = useState(schedule?.startWeekday ?? 5);
  const [startTime, setStartTime] = useState(schedule?.startTime ?? '18:00');
  const [endWeekday, setEndWeekday] = useState(schedule?.endWeekday ?? 6);
  const [endTime, setEndTime] = useState(schedule?.endTime ?? '18:00');
  const [sourceTitle, setSourceTitle] = useState(schedule?.sourceTitle ?? '');
  const [sourceUrl, setSourceUrl] = useState(schedule?.sourceUrl ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [multiplierPercent, setMultiplierPercent] = useState(
    managedPayRule?.effect.type === 'multiplier' ? String(managedPayRule.effect.basisPoints / 100) : '',
  );
  const align = isRtl ? 'right' : 'left';
  const direction = isRtl ? 'row-reverse' : 'row';
  const invalidateConfirmation = () => setConfirmed(false);
  const update = (operation: () => void) => { operation(); setScheduleDirty(true); invalidateConfirmation(); };
  const preview = useMemo(() => {
    if (!enabled || !label.trim()) return undefined;
    const now = previewFrom ?? new Date().toISOString();
    try {
      const temporary: WeeklyRestSchedule = {
        id: schedule?.id ?? 'weekly-rest-preview', workplaceId, salaryProfileId,
        label: label.trim(), startWeekday, startTime, endWeekday, endTime, enabled: true,
        confirmedAt: now, sourceKind: 'manual', isArchived: false,
        createdAt: schedule?.createdAt ?? now, updatedAt: now,
      };
      return resolveWeeklyRestOccurrences(
        temporary,
        now,
        new Date(Date.parse(now) + 21 * 24 * 60 * 60_000).toISOString(),
        timezone,
      )[0];
    } catch {
      return undefined;
    }
  }, [enabled, endTime, endWeekday, label, previewFrom, salaryProfileId, schedule, startTime, startWeekday, timezone, workplaceId]);
  const canSave = !enabled || Boolean(preview && confirmed);
  const payMultiplierBasisPoints = parsePayMultiplier(multiplierPercent);
  const canSavePayRule = Boolean(schedule?.enabled
    && !scheduleDirty
    && !managedRuleBlocked
    && payMultiplierBasisPoints !== undefined
    && onSavePayRule);

  return <View testID="weekly-rest-settings" style={[styles.card, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
    <View testID="weekly-rest-switch-row" style={[styles.switchRow, { flexDirection: direction }]}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text, textAlign: align }]}>{t('salary.weeklyRestTitle')}</Text>
        <Text style={[styles.body, { color: colors.textMuted, textAlign: align }]}>{t('salary.weeklyRestSummary')}</Text>
      </View>
      <Switch
        accessibilityLabel={t('salary.weeklyRestEnabled')}
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
        testID="e2e-weekly-rest-enabled"
        value={enabled}
        onValueChange={(value) => update(() => setEnabled(value))}
      />
    </View>

    {enabled ? <View testID="weekly-rest-fields" style={styles.fields}>
      <FormField label={t('salary.weeklyRestLabel')} maxLength={120} value={label} onChangeText={(value) => update(() => setLabel(value))} />
      <WeekdayPicker label={t('salary.weeklyRestStartWeekday')} value={startWeekday} onChange={(value) => update(() => setStartWeekday(value))} />
      <TimeField label={t('salary.weeklyRestStartTime')} value={startTime} onChange={(value) => value && update(() => setStartTime(value))} />
      <WeekdayPicker label={t('salary.weeklyRestEndWeekday')} value={endWeekday} onChange={(value) => update(() => setEndWeekday(value))} />
      <TimeField label={t('salary.weeklyRestEndTime')} value={endTime} onChange={(value) => value && update(() => setEndTime(value))} />
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
      <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.previewTitle, { color: colors.text, textAlign: align }]}>{t('salary.weeklyRestPreview')}</Text>
        {preview ? <Text testID="weekly-rest-preview" style={[styles.machineText, { color: colors.text, textAlign: align }]}>
          {formatExactRange(preview.start, preview.end, timezone, locale, formatDate)}
        </Text> : <Text accessibilityRole="alert" style={[styles.body, { color: colors.warning, textAlign: align }]}>{t('salary.weeklyRestPreviewUnavailable')}</Text>}
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        onPress={() => setConfirmed((value) => !value)}
        testID="e2e-weekly-rest-confirm"
        style={[styles.checkRow, { flexDirection: direction }]}
      >
        <View style={[styles.check, { borderColor: colors.primary, backgroundColor: confirmed ? colors.primary : colors.surface }]}>
          <Text accessible={false} testID="weekly-rest-confirmation-mark" style={[styles.checkMark, { color: colors.onPrimary }]}>{confirmed ? '✓' : ''}</Text>
        </View>
        <Text style={[styles.checkText, { color: colors.text, textAlign: align }]}>{t('salary.weeklyRestConfirmed')}</Text>
      </Pressable>
    </View> : null}

    <PrimaryButton
      disabled={!canSave}
      label={enabled ? t('salary.weeklyRestSave') : t('salary.weeklyRestDisable')}
      onPress={() => void onSave({
        enabled, label: label.trim(), startWeekday, startTime, endWeekday, endTime,
        sourceKind: schedule?.sourceKind ?? 'manual',
        sourceTitle: sourceTitle.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        confirmed,
      })}
      testID="e2e-weekly-rest-save"
    />

    {schedule?.enabled ? <View testID="weekly-rest-pay-settings" style={[styles.payCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text, textAlign: align }]}>{t('salary.weeklyRestPayTitle')}</Text>
      <Text style={[styles.body, { color: colors.textMuted, textAlign: align }]}>{t('salary.weeklyRestPaySummary')}</Text>
      {managedRuleBlocked ? <Text accessibilityRole="alert" style={[styles.body, { color: colors.warning, textAlign: align }]}>{t('salary.weeklyRestPayManagedConflict')}</Text> : <>
        <FormField
          accessibilityLabel={t('salary.weeklyRestPayMultiplier')}
          keyboardType="decimal-pad"
          label={t('salary.weeklyRestPayMultiplier')}
          onChangeText={setMultiplierPercent}
          selectTextOnFocus
          style={styles.machineInput}
          testID="e2e-weekly-rest-pay-multiplier"
          value={multiplierPercent}
        />
        <Text style={[styles.body, { color: colors.textMuted, textAlign: align }]}>{t('salary.weeklyRestPayMultiplierHelp')}</Text>
        {!managedPayRule ? <Text accessibilityRole="alert" style={[styles.body, { color: colors.warning, textAlign: align }]}>{t('salary.weeklyRestPayMissing')}</Text> : null}
        {scheduleDirty ? <Text accessibilityRole="alert" style={[styles.body, { color: colors.warning, textAlign: align }]}>{t('salary.weeklyRestPayUnsavedWindow')}</Text> : null}
        <PrimaryButton
          disabled={!canSavePayRule}
          label={managedPayRule ? t('salary.weeklyRestPayUpdate') : t('salary.weeklyRestPaySave')}
          onPress={() => payMultiplierBasisPoints !== undefined && onSavePayRule ? void onSavePayRule(payMultiplierBasisPoints) : undefined}
          testID="e2e-weekly-rest-pay-save"
        />
      </>}
      {advancedPayRules.length > 0 ? <View style={styles.advancedRules}>
        <Text style={[styles.previewTitle, { color: colors.text, textAlign: align }]}>{t('salary.weeklyRestAdvancedRules')}</Text>
        {advancedPayRules.map((rule) => <Text key={rule.id} style={[styles.body, { color: colors.textMuted, textAlign: align }]}>{formatRuleSummary(rule, t('rules.enabled'), t('rules.disabled'))}</Text>)}
        <Text style={[styles.body, { color: colors.warning, textAlign: align }]}>{t('salary.weeklyRestAdvancedRulesWarning')}</Text>
      </View> : null}
      {onOpenAdvancedRules ? <SecondaryButton label={t('salary.weeklyRestOpenAdvancedRules')} onPress={onOpenAdvancedRules} /> : null}
    </View> : null}
  </View>;
}

type FormatDate = ReturnType<typeof useTranslation>['formatDate'];

function formatExactRange(start: string, end: string, timezone: string, _locale: 'he' | 'en', formatDate: FormatDate): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: timezone,
  };
  return `${formatDate(start, options)} – ${formatDate(end, options)}`;
}

function parsePayMultiplier(value: string): number | undefined {
  try {
    const basisPoints = parsePercentageToBasisPoints(value);
    return basisPoints >= 10_000 ? basisPoints : undefined;
  } catch {
    return undefined;
  }
}

function formatRuleSummary(rule: PayRule, enabled: string, disabled: string): string {
  const multiplier = rule.effect.type === 'multiplier' ? ` · ${rule.effect.basisPoints / 100}%` : '';
  return `${rule.name}${multiplier} · ${rule.isEnabled ? enabled : disabled}`;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md, padding: spacing.md },
  switchRow: { alignItems: 'center', gap: spacing.md, justifyContent: 'space-between', minHeight: 48 },
  copy: { flex: 1, gap: spacing.xs },
  title: { fontSize: typography.title, fontWeight: '800' },
  body: { fontSize: typography.body, lineHeight: 22 },
  fields: { gap: spacing.md },
  preview: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.xs, padding: spacing.md },
  payCard: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.sm, padding: spacing.md },
  advancedRules: { gap: spacing.xs },
  previewTitle: { fontWeight: '800' },
  machineText: { fontVariant: ['tabular-nums'], lineHeight: 22, writingDirection: 'ltr' },
  machineInput: { textAlign: 'left', writingDirection: 'ltr' },
  checkRow: { alignItems: 'flex-start', gap: spacing.sm, minHeight: 48, paddingVertical: spacing.xs },
  check: { borderRadius: radius.sm, borderWidth: 2, height: 24, marginTop: 1, width: 24 },
  checkMark: { fontSize: 16, fontWeight: '900', lineHeight: 20, textAlign: 'center' },
  checkText: { flex: 1, flexShrink: 1, fontSize: typography.body, lineHeight: 22 },
});
