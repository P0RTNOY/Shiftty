import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';

interface AppScreenProps extends PropsWithChildren {
  title: string;
  eyebrow?: string;
  footer?: ReactNode;
  scrollable?: boolean;
}

export function AppScreen({ title, eyebrow, children, footer, scrollable = true }: AppScreenProps) {
  const { colors } = useAppTheme();
  const { isRtl } = useTranslation();
  const textAlignment = isRtl ? 'right' : 'left';

  const content = (
    <>
        <View style={styles.header}>
          {eyebrow ? (
            <Text style={[styles.eyebrow, { color: colors.primary, textAlign: textAlignment }]}>
              {eyebrow}
            </Text>
          ) : null}
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text, textAlign: textAlignment }]}>
            {title}
          </Text>
        </View>
        {children}
    </>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {scrollable ? (
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.staticContent]}>{content}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  staticContent: { flex: 1 },
  header: {
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  eyebrow: {
    fontSize: typography.body,
    fontWeight: '600',
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '800',
    lineHeight: 36,
  },
});
