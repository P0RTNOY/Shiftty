import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '@/shared/i18n';
import { radius, spacing, useAppTheme } from '@/shared/theme';

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const accessibleDays = {
  he: ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
} as const;

export function WeekdayPicker({ label, value, onChange }: Props) {
  const { colors } = useAppTheme();
  const { isRtl, locale, t } = useTranslation();
  return <View style={styles.container}>
    <Text style={{ color: colors.text, fontWeight: '700', textAlign: isRtl ? 'right' : 'left' }}>{label}</Text>
    <View style={[styles.options, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
      {days.map((day, index) => {
        const dayLabel = t(`calendar.day.${day}`);
        return <Pressable
          accessibilityLabel={accessibleDays[locale][index]}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === index }}
          key={day}
          onPress={() => onChange(index)}
          style={[styles.day, { backgroundColor: colors.surface, borderColor: value === index ? colors.primary : colors.border }]}
        ><Text style={{ color: colors.text }}>{dayLabel}</Text></Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  options: { flexWrap: 'wrap', gap: spacing.xs },
  day: { alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, height: 44, justifyContent: 'center', minWidth: 44, paddingHorizontal: spacing.xs },
});
