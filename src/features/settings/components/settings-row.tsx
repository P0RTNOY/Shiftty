import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface SettingsRowProps {
  icon: IconName;
  label: string;
  onPress?: () => void;
}

export function SettingsRow({ icon, label, onPress }: SettingsRowProps) {
  const { colors } = useAppTheme();
  const { isRtl } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderColor: colors.border,
          flexDirection: isRtl ? 'row-reverse' : 'row',
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons color={colors.primary} name={icon} size={22} />
      </View>
      <Text style={[styles.label, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>
        {label}
      </Text>
      <Ionicons
        color={colors.textMuted}
        name={isRtl ? 'chevron-back' : 'chevron-forward'}
        size={20}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  icon: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  label: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: '600',
  },
});
