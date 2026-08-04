import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import type { CreateShiftTemplateInput, UpdateShiftTemplateInput } from '@/domain/repositories';
import { FormField } from '@/shared/components/form-field';
import { PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, radius, typography, useAppTheme } from '@/shared/theme';

type FormValues = {
  name: string;
  defaultStartTime: string;
  defaultEndTime: string;
  expectedBreakMinutes: string;
  expectedBreakType: 'paid' | 'unpaid' | '';
  validWeekdays: boolean[];
  colorToken: string;
};

interface TemplateFormProps {
  initial?: Partial<FormValues>;
  loading?: boolean;
  onSubmit: (input: CreateShiftTemplateInput) => Promise<void>;
}

const WEEKDAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const LOCAL_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLOR_TOKENS = ['#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1'];

export function TemplateForm({ initial, loading, onSubmit }: TemplateFormProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: initial?.name ?? '',
      defaultStartTime: initial?.defaultStartTime ?? '08:00',
      defaultEndTime: initial?.defaultEndTime ?? '16:00',
      expectedBreakMinutes: String(initial?.expectedBreakMinutes ?? 30),
      expectedBreakType: initial?.expectedBreakType ?? '',
      validWeekdays: initial?.validWeekdays ?? Array(7).fill(false),
      colorToken: initial?.colorToken ?? '',
    },
  });

  async function submit(data: FormValues) {
    const weekdays = data.validWeekdays
      .map((active, idx) => (active ? idx : null))
      .filter((v): v is number => v !== null);

    const input: CreateShiftTemplateInput = {
      name: data.name.trim(),
      defaultStartTime: data.defaultStartTime,
      defaultEndTime: data.defaultEndTime,
      expectedBreakMinutes: parseInt(data.expectedBreakMinutes, 10) || 0,
      expectedBreakType: data.expectedBreakType || undefined,
      validWeekdays: weekdays.length > 0 ? weekdays : undefined,
      colorToken: data.colorToken || undefined,
    };
    await onSubmit(input);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Controller
        control={control}
        name="name"
        rules={{ required: true, minLength: 1, maxLength: 120 }}
        render={({ field }) => (
          <FormField label={t('templates.name')} error={errors.name?.message}>
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              placeholder={t('templates.name')}
              placeholderTextColor={colors.textMuted}
              maxLength={120}
            />
          </FormField>
        )}
      />

      <View style={styles.row}>
        <Controller
          control={control}
          name="defaultStartTime"
          rules={{ pattern: { value: LOCAL_TIME_RE, message: 'HH:mm' } }}
          render={({ field }) => (
            <FormField label={t('templates.startTime')} error={errors.defaultStartTime?.message} style={styles.half}>
              <TextInput
                value={field.value}
                onChangeText={field.onChange}
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                placeholder="08:00"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="defaultEndTime"
          rules={{ pattern: { value: LOCAL_TIME_RE, message: 'HH:mm' } }}
          render={({ field }) => (
            <FormField label={t('templates.endTime')} error={errors.defaultEndTime?.message} style={styles.half}>
              <TextInput
                value={field.value}
                onChangeText={field.onChange}
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                placeholder="16:00"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </FormField>
          )}
        />
      </View>

      <Controller
        control={control}
        name="expectedBreakMinutes"
        render={({ field }) => (
          <FormField label={t('templates.breakMinutes')}>
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              style={[styles.input, { borderColor: colors.border, color: colors.text }]}
              keyboardType="numeric"
              maxLength={4}
            />
          </FormField>
        )}
      />

      {/* Weekday selector */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('templates.weekdays')}</Text>
      <Controller
        control={control}
        name="validWeekdays"
        render={({ field }) => (
          <View style={styles.weekdays}>
            {WEEKDAY_LABELS.map((label, idx) => {
              const active = field.value[idx];
              return (
                <View
                  key={idx}
                  accessible
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: Boolean(active) }}
                  onTouchEnd={() => {
                    const next = [...field.value];
                    next[idx] = !next[idx];
                    field.onChange(next);
                  }}
                  style={[
                    styles.weekdayBubble,
                    {
                      backgroundColor: active ? colors.primary : colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text style={[styles.weekdayLabel, { color: active ? colors.onPrimary : colors.textMuted }]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      />

      {/* Color picker */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('templates.colorToken')}</Text>
      <Controller
        control={control}
        name="colorToken"
        render={({ field }) => (
          <View style={styles.colorRow}>
            {COLOR_TOKENS.map((token) => (
              <View
                key={token}
                accessible
                accessibilityRole="radio"
                accessibilityState={{ selected: field.value === token }}
                onTouchEnd={() => field.onChange(field.value === token ? '' : token)}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: token },
                  field.value === token && styles.colorSwatchSelected,
                ]}
              />
            ))}
          </View>
        )}
      />

      <PrimaryButton
        label={t('templates.create')}
        onPress={() => void handleSubmit(submit)()}
        disabled={loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, padding: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  input: { borderRadius: radius.sm, borderWidth: 1, fontSize: typography.body, padding: spacing.sm },
  sectionLabel: { fontSize: typography.caption, marginTop: spacing.md },
  weekdays: { flexDirection: 'row', gap: spacing.xs },
  weekdayBubble: { alignItems: 'center', borderRadius: radius.pill, height: 36, justifyContent: 'center', width: 36 },
  weekdayLabel: { fontSize: typography.caption, fontWeight: '700' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  colorSwatch: { borderRadius: radius.pill, height: 32, width: 32 },
  colorSwatchSelected: { borderColor: '#fff', borderWidth: 3 },
});
