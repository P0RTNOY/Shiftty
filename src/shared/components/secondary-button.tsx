import { Pressable, StyleSheet, Text } from 'react-native';

import { radius, spacing, typography, useAppTheme } from '@/shared/theme';

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function SecondaryButton({ label, onPress, destructive = false, disabled = false, testID }: SecondaryButtonProps) {
  const { colors } = useAppTheme();
  const color = destructive ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.button, { borderColor: color, backgroundColor: pressed ? colors.surfaceMuted : colors.surface }, disabled && styles.disabled]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  disabled: { opacity: 0.45 },
  label: { flexShrink: 1, fontSize: typography.body, fontWeight: '700', textAlign: 'center' },
});
