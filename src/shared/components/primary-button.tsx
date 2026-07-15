import { Pressable, StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/shared/theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  disabled?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  accessibilityHint,
  disabled = false,
}: PrimaryButtonProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? colors.primaryPressed : colors.primary },
        disabled && styles.disabled,
      ]}
    >
      <Text allowFontScaling style={[styles.label, { color: colors.onPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 24,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: 18,
    fontWeight: '700',
  },
});
