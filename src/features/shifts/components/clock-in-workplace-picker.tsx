import { StyleSheet, Text, View } from 'react-native';

import type { Workplace } from '@/domain/entities';
import { SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';

interface ClockInWorkplacePickerProps {
  workplaces: readonly Workplace[];
  busy: boolean;
  onChoose: (workplaceId: string) => void;
  onCancel: () => void;
}

export function ClockInWorkplacePicker({ workplaces, busy, onChoose, onCancel }: ClockInWorkplacePickerProps) {
  const { colors } = useAppTheme();
  const { t, isRtl } = useTranslation();
  const align = isRtl ? 'right' : 'left';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text, textAlign: align }]}>
        {t('active.chooseWorkplaceNow')}
      </Text>
      {workplaces.map((workplace) => (
        <SecondaryButton
          disabled={busy}
          key={workplace.id}
          label={workplace.name}
          onPress={() => onChoose(workplace.id)}
        />
      ))}
      <SecondaryButton disabled={busy} label={t('common.cancel')} onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  title: { fontSize: typography.title, fontWeight: '800' },
});
