import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CalendarEvidenceInterval, PayRule } from '@/domain/entities';
import { PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatLocalDateKey } from '@/shared/utils/zoned-time';

interface Props {
  interval: CalendarEvidenceInterval;
  rules: readonly PayRule[];
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onOpenRules: () => void;
}

export function SpecialPayIntervalCard({ interval, rules, onEdit, onArchive, onDelete, onOpenRules }: Props) {
  const { colors } = useAppTheme();
  const { formatDate, isRtl, t } = useTranslation();
  const align = isRtl ? 'right' : 'left';
  const targetingRules = rules.filter((rule) => ruleTargetsIntervalType(rule, interval));
  const sourceLabel = interval.sourceKind === 'manual'
    ? t('salary.specialIntervalManual')
    : interval.sourceKind === 'confirmed_preset'
      ? t('salary.specialIntervalConfirmedPreset')
      : t('salary.specialIntervalImported');

  return <View testID="special-pay-interval-card" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: interval.isArchived ? 0.7 : 1 }]}>
    <View style={[styles.headingRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
      <View style={styles.headingCopy}>
        <Text style={[styles.title, { color: colors.text, textAlign: align }]}>{interval.name}</Text>
        <Text style={[styles.meta, { color: colors.textMuted, textAlign: align }]}>{t(typeKey(interval.type))}{interval.isArchived ? ` · ${t('salary.intervalArchived')}` : ''}</Text>
        <Text style={[styles.meta, { color: colors.textMuted, textAlign: align }]}>{t(interval.salaryProfileId ? 'salary.intervalScopeProfile' : 'salary.intervalScopeWorkplace')}</Text>
      </View>
    </View>
    <View style={[styles.range, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <Text style={[styles.machineText, { color: colors.text, textAlign: align }]}>{formatInstant(interval.start, interval.timezone, formatDate)}</Text>
      <Text style={[styles.machineText, { color: colors.text, textAlign: align }]}>{formatInstant(interval.end, interval.timezone, formatDate)}</Text>
      <Text style={[styles.machineText, { color: colors.textMuted, textAlign: align }]}>{interval.timezone}</Text>
    </View>
    <Text style={[styles.meta, { color: colors.textMuted, textAlign: align }]}>{sourceLabel}</Text>
    {interval.sourceTitle ? <Text style={[styles.meta, { color: colors.text, textAlign: align }]}>{interval.sourceTitle}</Text> : null}
    {interval.sourceUrl ? <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(interval.sourceUrl!).catch(() => undefined)}
      style={styles.link}
    ><Text style={[styles.url, { color: colors.primary }]}>{t('salary.sourceOpen')}</Text></Pressable> : null}
    {targetingRules.length ? <View style={styles.rules}>
      <Text style={[styles.rulesTitle, { color: colors.text, textAlign: align }]}>{t('salary.intervalPayRules')}</Text>
      {targetingRules.map((rule) => <View key={rule.id} style={[styles.ruleRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <Text style={[styles.ruleName, { color: colors.text, textAlign: align }]}>{rule.name}</Text>
        {rule.effect.type === 'multiplier' ? <Text style={[styles.ruleValue, { color: colors.text }]}>{rule.effect.basisPoints / 100}%</Text> : null}
      </View>)}
      <Text style={[styles.meta, { color: colors.textMuted, textAlign: align }]}>{t('salary.intervalRulePotential')}</Text>
    </View> : null}
    {interval.isArchived || !targetingRules.length ? <View style={[styles.noEffect, { borderColor: colors.warning }]}>
      <Text style={[styles.meta, { color: colors.text, textAlign: align }]}>{t(interval.isArchived ? 'salary.intervalArchivedNoPayEffect' : 'salary.intervalNoPayEffect')}</Text>
      {!interval.isArchived ? <PrimaryButton label={t('salary.openIntervalRule')} onPress={onOpenRules} /> : null}
    </View> : null}
    <SecondaryButton label={t('common.edit')} onPress={onEdit} />
    <SecondaryButton label={interval.isArchived ? t('salary.intervalRestore') : t('salary.intervalArchive')} onPress={onArchive} />
    <SecondaryButton destructive label={t('salary.intervalDelete')} onPress={onDelete} />
    <Text style={[styles.history, { color: colors.textMuted, textAlign: align }]}>{t('salary.intervalArchivedHistory')}</Text>
  </View>;
}

function ruleTargetsIntervalType(rule: PayRule, interval: CalendarEvidenceInterval): boolean {
  if (!rule.isEnabled) return false;
  const startDate = formatLocalDateKey(interval.start, interval.timezone);
  const endDate = formatLocalDateKey(interval.end, interval.timezone);
  if (rule.effectiveFrom && endDate < rule.effectiveFrom) return false;
  if (rule.effectiveTo && startDate > rule.effectiveTo) return false;
  return rule.conditions.some((condition) => condition.type === 'specialInterval'
    ? condition.intervalTypes.includes(interval.type)
    : condition.type === 'holiday' && interval.type === 'holiday');
}

function typeKey(type: CalendarEvidenceInterval['type']) {
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

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: spacing.sm, padding: spacing.md },
  headingRow: { alignItems: 'flex-start', gap: spacing.sm },
  headingCopy: { flex: 1, gap: spacing.xxs },
  title: { fontSize: typography.title, fontWeight: '800' },
  meta: { flexShrink: 1, fontSize: typography.body, lineHeight: 22 },
  range: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.xxs, padding: spacing.sm },
  machineText: { fontVariant: ['tabular-nums'], lineHeight: 22, writingDirection: 'ltr' },
  link: { alignSelf: 'stretch', minHeight: 44, justifyContent: 'center' },
  url: { fontSize: typography.body, fontWeight: '700', textAlign: 'left', writingDirection: 'ltr' },
  rules: { gap: spacing.xs },
  rulesTitle: { fontWeight: '800' },
  ruleRow: { alignItems: 'flex-start', gap: spacing.sm, justifyContent: 'space-between' },
  ruleName: { flex: 1, flexShrink: 1, fontSize: typography.body, lineHeight: 22 },
  ruleValue: { flexShrink: 0, fontSize: typography.body, fontVariant: ['tabular-nums'], lineHeight: 22, writingDirection: 'ltr' },
  noEffect: { borderStartWidth: 3, gap: spacing.sm, paddingStart: spacing.sm },
  history: { fontSize: typography.caption, lineHeight: 18 },
});
