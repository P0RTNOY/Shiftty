import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { ShiftTemplate } from '@/domain/entities';
import { useTranslation } from '@/shared/i18n';
import { spacing, radius, typography, useAppTheme } from '@/shared/theme';

interface TemplateCardProps {
  template: ShiftTemplate;
  onPress: (template: ShiftTemplate) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onDuplicate?: (id: string, newName: string) => void;
}

const WEEKDAY_LABELS_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

export function TemplateCard({ template, onPress, onArchive, onRestore, onDuplicate }: TemplateCardProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const crossesMidnight = template.defaultEndTime < template.defaultStartTime;

  function handleLongPress() {
    const options = [];
    if (!template.isArchived && onArchive) {
      options.push({ text: t('templates.archive'), onPress: () => onArchive(template.id) });
    }
    if (template.isArchived && onRestore) {
      options.push({ text: t('templates.restore'), onPress: () => onRestore(template.id) });
    }
    if (onDuplicate) {
      options.push({ text: t('templates.duplicate'), onPress: () => promptDuplicate() });
    }
    options.push({ text: t('common.cancel'), style: 'cancel' as const, onPress: () => undefined });
    Alert.alert(template.name, undefined, options);
  }

  function promptDuplicate() {
    Alert.prompt(
      t('templates.duplicate'),
      undefined,
      (newName) => {
            if (newName?.trim() && onDuplicate) {
              onDuplicate(template.id, newName.trim());
        }
      },
      'plain-text',
          `${template.name} (${t('templates.copySuffix')})`,
    );
  }

  const borderColor = template.colorToken ?? colors.border;

  return (
    <TouchableOpacity
      accessible
      accessibilityLabel={template.name}
      accessibilityRole="button"
      activeOpacity={0.78}
      onPress={() => onPress(template)}
      onLongPress={handleLongPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor,
          borderLeftWidth: 4,
          opacity: template.isArchived ? 0.55 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {template.name}
        </Text>
        {template.isArchived && (
          <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.badgeText, { color: colors.textMuted }]}>{t('templates.archived')}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.time, { color: colors.textMuted }]}>
        {template.defaultStartTime} – {template.defaultEndTime}
        {crossesMidnight ? ` (${t('templates.crossMidnight')})` : ''}
      </Text>
      {template.validWeekdays && template.validWeekdays.length > 0 && (
        <View style={styles.weekdays}>
          {WEEKDAY_LABELS_HE.map((label, idx) => {
            const active = template.validWeekdays!.includes(idx);
            return (
              <View
                key={idx}
                style={[
                  styles.weekdayBubble,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceMuted,
                  },
                ]}
              >
                <Text style={[styles.weekdayLabel, { color: active ? colors.onPrimary : colors.textMuted }]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    padding: spacing.md,
  },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xxs },
  name: { flex: 1, fontSize: typography.body, fontWeight: '600' },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  badgeText: { fontSize: typography.caption },
  time: { fontSize: typography.caption },
  weekdays: { flexDirection: 'row', gap: 4, marginTop: spacing.xs },
  weekdayBubble: { alignItems: 'center', borderRadius: radius.pill, height: 24, justifyContent: 'center', width: 24 },
  weekdayLabel: { fontSize: 10, fontWeight: '700' },
});
