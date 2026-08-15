import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { PrimaryButton } from '@/shared/components/primary-button';
import { SecondaryButton } from '@/shared/components/secondary-button';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { formatLocalDateValue } from '@/shared/utils/date-time-format';

interface BasePickerProps {
  mode: 'date' | 'time';
  label?: string;
  error?: string;
  disabled?: boolean;
}

interface StringPickerProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  optional?: boolean;
}

type PickerProps = BasePickerProps & StringPickerProps;

export function DateTimeField({ value, onChange, mode, label, error, disabled, optional }: PickerProps) {
  const { colors } = useAppTheme();
  const { isRtl, t, locale } = useTranslation();
  const intlLocale = locale === 'he' ? 'he-IL' : 'en-US';
  const [show, setShow] = useState(false);
  const [tempValue, setTempValue] = useState(() => pickerDate(value, mode));
  const displayValue = value === undefined
    ? t('common.notSet')
    : mode === 'date'
      ? formatLocalDateValue(value, locale)
      : value;

  const commit = (selectedDate: Date) => {
    onChange(formatPickerValue(selectedDate, mode));
  };

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (event.type === 'set' && selectedDate) commit(selectedDate);
    } else {
      if (selectedDate) setTempValue(selectedDate);
    }
  };

  const handleConfirm = () => {
    setShow(false);
    commit(tempValue);
  };

  const align = isRtl ? 'right' : 'left';

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.textMuted, textAlign: align }]}>{label}</Text>}
      
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        accessibilityValue={{ text: displayValue }}
        disabled={disabled} 
        onPress={() => {
          setTempValue(pickerDate(value, mode));
          setShow(true);
        }}
        style={({ pressed }) => [styles.input, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}
      >
        <Text style={[styles.inputValue, { color: colors.text, textAlign: align }]}>{displayValue}</Text>
      </Pressable>

      {optional && value !== undefined && !disabled ? (
        <Pressable
          accessibilityLabel={`${t('common.clear')} ${label ?? ''}`.trim()}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onChange(undefined)}
          style={styles.clear}
        >
          <Text style={[styles.clearText, { color: colors.primary, textAlign: align }]}>{t('common.clear')}</Text>
        </Pressable>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger, textAlign: align }]}>{error}</Text> : null}

      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerDate(value, mode)}
          mode={mode}
          display="default"
          is24Hour={true}
          onChange={handleChange}
        />
      )}

      {show && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={show}>
          <Pressable accessibilityRole="button" style={styles.modalOverlay} onPress={() => setShow(false)}>
            <Pressable accessibilityRole="none" onPress={(event) => event.stopPropagation()} style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={tempValue}
                  mode={mode}
                  display="spinner"
                  is24Hour={true}
                  locale={intlLocale}
                  onChange={handleChange}
                  textColor={colors.text}
                />
              </View>
              <View style={[styles.actions, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
                <View style={{ flex: 1 }}><SecondaryButton label={t('common.cancel')} onPress={() => setShow(false)} /></View>
                <View style={{ flex: 1 }}><PrimaryButton label={t('common.confirm')} onPress={handleConfirm} /></View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

export function DateField(props: StringPickerProps & Omit<BasePickerProps, 'mode'>) {
  return <DateTimeField {...props} mode="date" />;
}

export function TimeField(props: StringPickerProps & Omit<BasePickerProps, 'mode'>) {
  return <DateTimeField {...props} mode="time" />;
}

const styles = StyleSheet.create({
  container: { gap: spacing.xxs },
  label: { fontSize: typography.caption, fontWeight: '700' },
  input: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  inputValue: { fontSize: typography.body, fontWeight: '500' },
  clear: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.xs },
  clearText: { fontSize: typography.caption, fontWeight: '700' },
  error: { fontSize: typography.caption },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  pickerContainer: { alignItems: 'center', justifyContent: 'center' },
  actions: { gap: spacing.sm },
});

function pickerDate(value: string | undefined, mode: 'date' | 'time'): Date {
  if (mode === 'date' && value) {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  }
  const date = new Date();
  if (mode === 'time' && value) {
    const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (match) date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  }
  return date;
}

function formatPickerValue(date: Date, mode: 'date' | 'time'): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return mode === 'date'
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
