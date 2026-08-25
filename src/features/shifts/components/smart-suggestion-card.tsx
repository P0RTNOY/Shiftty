import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { ShiftPredictionCandidate } from '@/domain/entities/prediction';
import { useTranslation } from '@/shared/i18n';
import { DEFAULT_TIMEZONE } from '@/shared/constants/app';
import { spacing, radius, typography, useAppTheme } from '@/shared/theme';
import { formatTime } from '@/shared/utils/date-time-format';

interface SmartSuggestionCardProps {
  candidate: ShiftPredictionCandidate;
  onApplyAll: (candidate: ShiftPredictionCandidate) => void;
  onApplySelected: (candidate: ShiftPredictionCandidate) => void;
  onReject: () => void;
}

const CONFIDENCE_CONFIG = {
  high: { icon: '🎯' as const, colorKey: 'success' as const },
  medium: { icon: '💡' as const, colorKey: 'warning' as const },
  low: { icon: '🔍' as const, colorKey: 'textMuted' as const },
} as const;

export function SmartSuggestionCard({ candidate, onApplyAll, onApplySelected, onReject }: SmartSuggestionCardProps) {
  const { isRtl, locale, t } = useTranslation();
  const { colors } = useAppTheme();
  const [showReasons, setShowReasons] = useState(false);

  const config = CONFIDENCE_CONFIG[candidate.confidence];
  const confidenceColor = colors[config.colorKey];

  function toggleReasons() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowReasons((v) => !v);
  }

  const sourceKey = `prediction.source.${
    candidate.source === 'nearby_scheduled_shift' ? 'nearby' :
    candidate.source === 'template' ? 'template' : 'historical'
  }` as const;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.text,
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <Text style={styles.icon}>{config.icon}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>{t('prediction.title')}</Text>
          <Text style={[styles.confidence, { color: confidenceColor }]}>
            {t(`prediction.confidence.${candidate.confidence}`)} ({Math.round(candidate.score)}/100)
          </Text>
        </View>
        <Text style={[styles.sourceLabel, { color: colors.textMuted, textAlign: isRtl ? 'right' : 'left' }]}>
          {t(sourceKey)}
        </Text>
      </View>

      {/* Suggested times */}
      {(candidate.suggestedScheduledStart || candidate.suggestedScheduledEnd) && (
        <View style={[styles.timeRow, { backgroundColor: colors.surfaceMuted, flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
          {candidate.suggestedScheduledStart && (
            <View style={styles.timeItem}>
              <Text style={[styles.timeLabel, { color: colors.textMuted }]}>
                {t('prediction.field.scheduledStart')}
              </Text>
              <Text style={[styles.timeValue, { color: colors.text }]}>
                {formatTime(candidate.suggestedScheduledStart, locale, DEFAULT_TIMEZONE)}
              </Text>
            </View>
          )}
          {candidate.suggestedScheduledEnd && (
            <View style={styles.timeItem}>
              <Text style={[styles.timeLabel, { color: colors.textMuted }]}>
                {t('prediction.field.scheduledEnd')}
              </Text>
              <Text style={[styles.timeValue, { color: colors.text }]}>
                {formatTime(candidate.suggestedScheduledEnd, locale, DEFAULT_TIMEZONE)}
              </Text>
            </View>
          )}
          {candidate.suggestedBreakMinutes != null && (
            <View style={styles.timeItem}>
              <Text style={[styles.timeLabel, { color: colors.textMuted }]}>
                {t('prediction.field.breakMinutes')}
              </Text>
              <Text style={[styles.timeValue, { color: colors.text }]}>
                {candidate.suggestedBreakMinutes}′
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Why section */}
      <TouchableOpacity accessibilityLabel={t('prediction.whyTitle')} accessibilityRole="button" accessibilityState={{ expanded: showReasons }} onPress={toggleReasons} style={[styles.whyRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <Text style={[styles.whyLabel, { color: colors.primary }]}>
          {t('prediction.whyTitle')}
        </Text>
        <Ionicons
          name={showReasons ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.primary}
        />
      </TouchableOpacity>

      {showReasons && (
        <View style={styles.reasonsList}>
          {candidate.reasons.map((reason) => (
            <View key={reason.code} style={[styles.reasonRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.reasonBullet, { color: colors.primary }]}>·</Text>
              <Text style={[styles.reasonText, { color: colors.textMuted }]}>
                {t(reason.messageKey as never)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Action buttons */}
      <View style={[styles.actions, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity
          style={[styles.applyBtn, { backgroundColor: colors.primary }]}
          onPress={() => onApplyAll(candidate)}
          accessibilityRole="button"
          accessibilityLabel={t('prediction.applyAll')}
        >
          <Text style={[styles.applyBtnText, { color: colors.onPrimary }]}>
            {t('prediction.applyAll')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.selectBtn, { borderColor: colors.primary }]}
          onPress={() => onApplySelected(candidate)}
          accessibilityRole="button"
          accessibilityLabel={t('prediction.applySelected')}
        >
          <Text style={[styles.selectBtnText, { color: colors.primary }]}>
            {t('prediction.applySelected')}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity accessibilityLabel={t('prediction.reject')} accessibilityRole="button" onPress={onReject} style={styles.rejectRow}>
        <Text style={[styles.rejectText, { color: colors.textMuted }]}>{t('prediction.reject')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    elevation: 3,
    margin: spacing.md,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  icon: { fontSize: 28 },
  headerText: { flex: 1 },
  title: { fontSize: typography.body, fontWeight: '700' },
  confidence: { fontSize: typography.caption },
  sourceLabel: { fontSize: typography.caption },
  timeRow: { gap: spacing.md, padding: spacing.md },
  timeItem: { flex: 1 },
  timeLabel: { fontSize: typography.caption },
  timeValue: { fontSize: typography.title, fontWeight: '700' },
  whyRow: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  whyLabel: { flex: 1, fontSize: typography.caption },
  reasonsList: { gap: 4, paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  reasonRow: { alignItems: 'flex-start', gap: spacing.xs },
  reasonBullet: { fontSize: 20, lineHeight: 20 },
  reasonText: { flex: 1, fontSize: typography.caption, lineHeight: 18 },
  actions: { gap: spacing.sm, padding: spacing.md },
  applyBtn: { alignItems: 'center', borderRadius: radius.md, flex: 1, justifyContent: 'center', minHeight: 44, padding: spacing.sm },
  applyBtnText: { fontSize: typography.body, fontWeight: '600' },
  selectBtn: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 44, padding: spacing.sm },
  selectBtnText: { fontSize: typography.body, fontWeight: '600' },
  rejectRow: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
  rejectText: { fontSize: typography.caption },
});
