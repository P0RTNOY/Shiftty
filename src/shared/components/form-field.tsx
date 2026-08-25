import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';

export interface FormFieldProps extends TextInputProps { label: string; error?: string }

export function FormField({ label, error, style, ...props }: FormFieldProps) {
  const { colors } = useAppTheme();
  const { isRtl } = useTranslation();
  const textAlign = isRtl ? 'right' : 'left';
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text, textAlign }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border, color: colors.text, textAlign }, style]}
        {...props}
      />
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger, textAlign }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { fontSize: typography.body, fontWeight: '600' },
  input: { borderRadius: radius.md, borderWidth: 1, fontSize: typography.body, minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  error: { fontSize: typography.caption, lineHeight: 18 },
});
