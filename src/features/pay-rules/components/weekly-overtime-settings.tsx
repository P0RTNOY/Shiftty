import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { WeekdayPicker } from '@/features/pay-rules/components/weekday-picker';
import { FormField } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, useAppTheme } from '@/shared/theme';

export interface WeeklyOvertimeSettingsValue {
  enabled: boolean;
  workweekStartWeekday: number;
  regularHours: string;
  multiplierPercent: string;
  basis: 'net' | 'gross';
}

interface WeeklyOvertimeSettingsProps {
  value: WeeklyOvertimeSettingsValue;
  onChange: (value: WeeklyOvertimeSettingsValue) => void;
}

export function WeeklyOvertimeSettings({ value, onChange }: WeeklyOvertimeSettingsProps) {
  const { colors } = useAppTheme();
  const { isRtl, t } = useTranslation();
  const align = isRtl ? 'right' : 'left';

  return <View
    testID="weekly-overtime-settings"
    style={[styles.container, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
  >
    <View testID="weekly-overtime-switch-row" style={[styles.switchRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
      <View style={styles.switchCopy}>
        <Text style={[styles.title, { color: colors.text, textAlign: align }]}>{t('salary.weeklyOvertime')}</Text>
        <Text style={{ color: colors.textMuted, textAlign: align }}>{t('salary.weeklyOvertimeSummary')}</Text>
      </View>
      <Switch
        accessibilityLabel={t('salary.weeklyOvertimeEnabled')}
        accessibilityRole="switch"
        accessibilityState={{ checked: value.enabled }}
        testID="e2e-weekly-overtime-enabled"
        value={value.enabled}
        onValueChange={(enabled) => onChange({ ...value, enabled })}
      />
    </View>

    {value.enabled ? <View style={styles.fields}>
      <WeekdayPicker
        label={t('salary.workweekStart')}
        value={value.workweekStartWeekday}
        onChange={(workweekStartWeekday) => onChange({ ...value, workweekStartWeekday })}
      />
      <FormField
        accessibilityHint={t('salary.weeklyThresholdHint')}
        keyboardType="decimal-pad"
        label={t('salary.weeklyThresholdHours')}
        value={value.regularHours}
        onChangeText={(regularHours) => onChange({ ...value, regularHours })}
        testID="e2e-weekly-overtime-hours"
      />
      <FormField
        accessibilityHint={t('salary.weeklyMultiplierHint')}
        keyboardType="decimal-pad"
        label={t('salary.weeklyMultiplier')}
        value={value.multiplierPercent}
        onChangeText={(multiplierPercent) => onChange({ ...value, multiplierPercent })}
        testID="e2e-weekly-overtime-multiplier"
      />
      <Text style={[styles.label, { color: colors.text, textAlign: align }]}>{t('salary.weeklyBasis')}</Text>
      <View style={[styles.choices, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
        {(['net', 'gross'] as const).map((basis) => <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: value.basis === basis }}
          key={basis}
          onPress={() => onChange({ ...value, basis })}
          style={[styles.choice, { backgroundColor: colors.surface, borderColor: value.basis === basis ? colors.primary : colors.border }]}
        >
          <Text style={{ color: colors.text }}>{t(basis === 'net' ? 'rules.basisNet' : 'rules.basisGross')}</Text>
        </Pressable>)}
      </View>
      <Text style={{ color: colors.textMuted, textAlign: align }}>{t('salary.weeklyConfigurableNotice')}</Text>
      <Text style={{ color: colors.textMuted, textAlign: align }}>{t('salary.weeklyFrozenNotice')}</Text>
    </View> : null}
  </View>;
}

export function weeklyHoursToMinutes(value: string): number | undefined {
  const hours = Number(value);
  const minutes = hours * 60;
  return Number.isFinite(hours) && hours > 0 && Number.isInteger(minutes) ? minutes : undefined;
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md, padding: spacing.md },
  switchRow: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, minHeight: 48 },
  switchCopy: { flex: 1, gap: spacing.xs },
  title: { fontWeight: '800' },
  fields: { gap: spacing.md },
  label: { fontWeight: '700' },
  choices: { flexWrap: 'wrap', gap: spacing.xs },
  choice: { borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.md },
});
