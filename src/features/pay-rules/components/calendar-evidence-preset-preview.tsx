import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CalendarEvidencePreset } from '@/domain/services';
import { PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';

interface Props {
  preset: CalendarEvidencePreset;
  onApply: () => void | Promise<void>;
}

export function CalendarEvidencePresetPreview({ preset, onApply }: Props) {
  const { colors } = useAppTheme();
  const { formatDate, isRtl, locale, t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const align = isRtl ? 'right' : 'left';
  const direction = isRtl ? 'row-reverse' : 'row';
  return <View testID="calendar-evidence-preset" style={[styles.card, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
    <Text style={[styles.title, { color: colors.text, textAlign: align }]}>{t('salary.presetTitle')}</Text>
    <Text style={[styles.body, { color: colors.textMuted, textAlign: align }]}>{t('salary.presetSummary')}</Text>
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((value) => !value)}
      style={({ pressed }) => [styles.disclosure, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
    ><Text style={[styles.disclosureText, { color: colors.primary, textAlign: align }]}>{t(expanded ? 'salary.presetHide' : 'salary.presetPreview')}</Text></Pressable>
    {expanded ? <View style={styles.details}>
      <Text style={[styles.name, { color: colors.text, textAlign: align }]}>{preset.name[locale]}</Text>
      <Text style={[styles.machineText, { color: colors.text, textAlign: align }]}>{formatInstant(preset.start, preset.timezone, formatDate)}</Text>
      <Text style={[styles.machineText, { color: colors.text, textAlign: align }]}>{formatInstant(preset.end, preset.timezone, formatDate)}</Text>
      <Text style={[styles.machineText, { color: colors.textMuted, textAlign: align }]}>{preset.timezone}</Text>
      <Text style={[styles.body, { color: colors.text, textAlign: align }]}>{preset.sourceTitle}</Text>
      <Text style={[styles.body, { color: colors.textMuted, textAlign: align }]}>{t('salary.presetVersion', { version: isolateLtr(preset.version) })}</Text>
      <Text style={[styles.body, { color: colors.textMuted, textAlign: align }]}>{t('salary.presetRetrieved', { date: isolateLtr(preset.retrievedAt) })}</Text>
      <Text style={[styles.assumptionTitle, { color: colors.text, textAlign: align }]}>{t('salary.presetAssumption')}</Text>
      <Text style={[styles.body, { color: colors.textMuted, textAlign: align }]}>{preset.assumption[locale]}</Text>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(preset.sourceUrl).catch(() => undefined)} style={styles.link}>
        <Text style={[styles.url, { color: colors.primary }]}>{t('salary.sourceOpen')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        onPress={() => setConfirmed((value) => !value)}
        style={[styles.checkRow, { flexDirection: direction }]}
      >
        <View style={[styles.check, { borderColor: colors.primary, backgroundColor: confirmed ? colors.primary : colors.surface }]}>
          <Text accessible={false} testID="preset-confirmation-mark" style={[styles.checkMark, { color: colors.onPrimary }]}>{confirmed ? '✓' : ''}</Text>
        </View>
        <Text style={[styles.checkText, { color: colors.text, textAlign: align }]}>{t('salary.presetConfirm')}</Text>
      </Pressable>
      <PrimaryButton disabled={!confirmed} label={t('salary.presetApply')} onPress={() => void onApply()} />
    </View> : null}
  </View>;
}

type FormatDate = ReturnType<typeof useTranslation>['formatDate'];
function formatInstant(value: string, timezone: string, formatDate: FormatDate): string {
  return formatDate(value, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone: timezone,
  });
}

function isolateLtr(value: string): string {
  return `\u2066${value}\u2069`;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.sm, padding: spacing.md },
  title: { fontSize: typography.title, fontWeight: '800' },
  body: { flexShrink: 1, fontSize: typography.body, lineHeight: 22 },
  disclosure: { borderTopWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 44, paddingTop: spacing.sm },
  disclosureText: { fontSize: typography.body, fontWeight: '800' },
  details: { gap: spacing.sm },
  name: { fontSize: typography.body, fontWeight: '800' },
  assumptionTitle: { fontSize: typography.body, fontWeight: '800' },
  machineText: { fontVariant: ['tabular-nums'], lineHeight: 22, writingDirection: 'ltr' },
  link: { minHeight: 44, justifyContent: 'center' },
  url: { fontSize: typography.body, fontWeight: '700', textAlign: 'left', writingDirection: 'ltr' },
  checkRow: { alignItems: 'flex-start', gap: spacing.sm, minHeight: 48, paddingVertical: spacing.xs },
  check: { borderRadius: radius.sm, borderWidth: 2, height: 24, marginTop: 1, width: 24 },
  checkMark: { fontSize: 16, fontWeight: '900', lineHeight: 20, textAlign: 'center' },
  checkText: { flex: 1, flexShrink: 1, fontSize: typography.body, lineHeight: 22 },
});
