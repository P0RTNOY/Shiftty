import { Modal, StyleSheet, Text, View } from 'react-native';

import type { RecurrenceScope } from '@/domain/entities';
import { PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';

interface Props { visible: boolean; onChoose: (scope: RecurrenceScope) => void; onDismiss: () => void }

export function RecurrenceScopeChooser({ visible, onChoose, onDismiss }: Props) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  return (
    <Modal animationType="fade" onRequestClose={onDismiss} transparent visible={visible}>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{t('recurrence.scopeTitle')}</Text>
          <PrimaryButton label={t('recurrence.only')} onPress={() => onChoose('only')} />
          <SecondaryButton label={t('recurrence.future')} onPress={() => onChoose('future')} />
          <SecondaryButton label={t('recurrence.entire')} onPress={() => onChoose('entire')} />
          <SecondaryButton label={t('common.cancel')} onPress={onDismiss} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, gap: spacing.sm, padding: spacing.lg },
  title: { fontSize: typography.title, fontWeight: '800', marginBottom: spacing.xs, textAlign: 'center' },
});
