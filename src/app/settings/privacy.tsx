import { StyleSheet, Text, ScrollView } from 'react-native';
import { AppScreen } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';

export default function PrivacyScreen() {
  const { colors } = useAppTheme();
  const { t, isRtl } = useTranslation();

  const textStyle = [styles.text, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];
  const headingStyle = [styles.heading, { color: colors.text, textAlign: isRtl ? ('right' as const) : ('left' as const) }];

  return (
    <AppScreen title={t('settings.privacy' as any)}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={headingStyle}>הפרטיות שלך במקום הראשון</Text>
        <Text style={textStyle}>
          אפליקציית Shiftty נבנתה במטרה אחת: לתת לך שליטה מלאה על הנתונים שלך.
        </Text>
        <Text style={textStyle}>
          כל המידע שאתה מזין באפליקציה (משמרות, שכר, הערות, מקומות עבודה) נשמר אך ורק על המכשיר שלך. 
          אנחנו לא מעלים את הנתונים שלך לשום שרת, לא מוכרים אותם לצד שלישי, ולא משתמשים בהם לאף מטרה אחרת.
        </Text>
        
        <Text style={headingStyle}>גיבוי נתונים</Text>
        <Text style={textStyle}>
          מכיוון שהנתונים נשמרים רק אצלך, באחריותך לגבות אותם. מומלץ להשתמש באפשרות ייצוא הגיבוי במסך ניהול נתונים כדי לשמור עותק בטוח בענן הפרטי שלך (למשל iCloud או Google Drive).
        </Text>

        <Text style={headingStyle}>מחיקת נתונים</Text>
        <Text style={textStyle}>
          אתה יכול למחוק את כל הנתונים שלך מהאפליקציה בכל עת דרך מסך ניהול נתונים. הפעולה הזו היא בלתי הפיכה ותמחק הכל מהמכשיר שלך לתמיד.
        </Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  heading: {
    fontSize: typography.heading,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  text: {
    fontSize: typography.body,
    lineHeight: 24,
  }
});
