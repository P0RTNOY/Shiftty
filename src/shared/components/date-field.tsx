import { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { PrimaryButton } from '@/shared/components/primary-button';
import { SecondaryButton } from '@/shared/components/secondary-button';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';

interface PickerProps {
  value: Date;
  onChange: (date: Date) => void;
  mode: 'date' | 'time';
  label?: string;
  disabled?: boolean;
}

export function DateTimeField({ value, onChange, mode, label, disabled }: PickerProps) {
  const { colors } = useAppTheme();
  const { isRtl, t, locale } = useTranslation();
  const intlLocale = locale === 'he' ? 'he-IL' : 'en-US';
  const [show, setShow] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const displayValue = mode === 'date' 
    ? new Intl.DateTimeFormat(intlLocale, { dateStyle: 'long' }).format(value)
    : new Intl.DateTimeFormat(intlLocale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(value);

  const handleChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (selectedDate) onChange(selectedDate);
    } else {
      if (selectedDate) setTempValue(selectedDate);
    }
  };

  const handleConfirm = () => {
    setShow(false);
    onChange(tempValue);
  };

  const align = isRtl ? 'right' : 'left';

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.textMuted, textAlign: align }]}>{label}</Text>}
      
      <TouchableOpacity 
        accessibilityLabel={label}
        accessibilityRole="button"
        disabled={disabled} 
        onPress={() => {
          setTempValue(value);
          setShow(true);
        }}
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}
      >
        <Text style={[styles.inputValue, { color: colors.text, textAlign: align }]}>{displayValue}</Text>
      </TouchableOpacity>

      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={value}
          mode={mode}
          display="default"
          is24Hour={true}
          onChange={handleChange}
        />
      )}

      {show && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide" visible={show}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShow(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: colors.surface }]}>
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
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

export function DateField(props: Omit<PickerProps, 'mode'>) {
  return <DateTimeField {...props} mode="date" />;
}

export function TimeField(props: Omit<PickerProps, 'mode'>) {
  return <DateTimeField {...props} mode="time" />;
}

const styles = StyleSheet.create({
  container: { gap: spacing.xxs },
  label: { fontSize: typography.caption, fontWeight: '700' },
  input: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  inputValue: { fontSize: typography.body, fontWeight: '500' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  pickerContainer: { alignItems: 'center', justifyContent: 'center' },
  actions: { gap: spacing.sm },
});
