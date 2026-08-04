import { StyleSheet, Text, View } from 'react-native';
import { AppScreen, PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { router } from 'expo-router';

export default function OnboardingWelcomeScreen() {
  const { colors } = useAppTheme();
  const { isRtl } = useTranslation();

  const textStyle = [styles.text, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];
  const headingStyle = [styles.heading, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];

  return (
    <AppScreen title="ברוכים הבאים ל-Shiftty">
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={headingStyle}>העוזר האישי שלך למשמרות</Text>
          <Text style={textStyle}>
            מעקב אחר משמרות, חישוב שכר, דו&quot;חות חודשיים והכל עם דגש על פרטיות.
          </Text>
          
          <Text style={headingStyle}>פרטיות קודם כל</Text>
          <Text style={textStyle}>
            הנתונים שלך נשמרים רק על המכשיר הזה. אין ענן, אין שרתים חיצוניים, והנתונים שייכים אך ורק לך.
          </Text>
        </View>

        <View style={styles.footer}>
          <PrimaryButton 
            label="התחל עכשיו" 
            onPress={() => router.push('/onboarding/workplace')} 
          />
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md, justifyContent: 'space-between' },
  content: { gap: spacing.md, marginTop: spacing.xl },
  heading: { fontSize: typography.heading, fontWeight: '700' },
  text: { fontSize: typography.body, lineHeight: 24 },
  footer: { paddingBottom: spacing.xl },
});
