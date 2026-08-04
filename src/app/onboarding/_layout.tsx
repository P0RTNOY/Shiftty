import { Stack } from 'expo-router';
import { useTranslation } from '@/shared/i18n';
import { useAppTheme } from '@/shared/theme';

export default function OnboardingLayout() {
  const { colors } = useAppTheme();
  const { isRtl } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: isRtl ? 'slide_from_left' : 'slide_from_right',
      }}
    />
  );
}
