import { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';

import type { Shift } from '@/domain/entities';
import { canMarkShiftMissed } from '@/domain/services';
import { PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';

interface Props {
  shift: Shift;
  now?: Date;
  onEdit: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
  onMarkMissed: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onStart: () => void;
  onManageBreaks: () => void;
  onCancelTracking: () => void;
}

export function ShiftActions({ shift, now = new Date(), ...actions }: Props) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const eligibleForMissed = canMarkShiftMissed(shift, now);
  const closeThen = (action: () => void) => () => { setOpen(false); action(); };
  const confirmDelete = () => {
    setOpen(false);
    Alert.alert(t('shift.deleteTitle'), t('shift.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: actions.onDelete },
    ]);
  };

  return <View style={styles.container} testID="shift-actions">
    {shift.status === 'scheduled' ? <>
      <PrimaryButton label={t('active.startScheduled')} onPress={actions.onStart} />
      <SecondaryButton label={t('common.edit')} onPress={actions.onEdit} />
    </> : null}
    {shift.status === 'active' ? <PrimaryButton label={t('active.endShift')} onPress={actions.onStart} /> : null}
    {shift.status === 'completed' || shift.status === 'cancelled' || shift.status === 'missed'
      ? <PrimaryButton label={t('common.edit')} onPress={actions.onEdit} /> : null}
    <SecondaryButton label={t('shift.moreActions')} onPress={() => setOpen(true)} testID="e2e-shift-more-actions" />
    <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]}>
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{t('shift.moreActions')}</Text>
          {shift.status !== 'active' ? <SecondaryButton label={t('common.duplicate')} onPress={closeThen(actions.onDuplicate)} /> : null}
          {shift.status === 'active' || shift.status === 'completed' ? <SecondaryButton label={t('active.manageBreaks')} onPress={closeThen(actions.onManageBreaks)} /> : null}
          {shift.status === 'active' ? <SecondaryButton destructive label={t('active.cancelTracking')} onPress={closeThen(actions.onCancelTracking)} /> : null}
          {shift.status === 'scheduled' ? <SecondaryButton destructive label={eligibleForMissed ? t('shift.markMissed') : t('shift.cancelAction')} onPress={closeThen(eligibleForMissed ? actions.onMarkMissed : actions.onCancel)} /> : null}
          {shift.status === 'cancelled' || shift.status === 'missed' ? <SecondaryButton label={t('shift.restore')} onPress={closeThen(actions.onRestore)} /> : null}
          {shift.status !== 'active' ? <SecondaryButton destructive label={t('common.delete')} onPress={confirmDelete} /> : null}
          <SecondaryButton label={t('common.close')} onPress={() => setOpen(false)} />
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  scrim: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, gap: spacing.sm, padding: spacing.lg },
  title: { fontSize: typography.title, fontWeight: '800', textAlign: 'center' },
});
