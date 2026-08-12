import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CreateShiftTemplateInput } from '@/domain/repositories';
import { FormField, PrimaryButton, TimeField } from '@/shared/components';
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
  submitLabel?: string;
  onSubmit: (input: CreateShiftTemplateInput) => Promise<void>;
}

const WEEKDAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const COLOR_TOKENS = ['#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1'];

export function TemplateForm({ initial, loading, submitLabel, onSubmit }: TemplateFormProps) {
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
          <FormField label={t('templates.name')} error={errors.name?.message} value={field.value} onChangeText={field.onChange} maxLength={120} />
        )}
      />

      <View style={styles.row}>
        <Controller
          control={control}
          name="defaultStartTime"
          rules={{ required: true }}
          render={({ field }) => (
            <View style={styles.half}><TimeField error={errors.defaultStartTime?.message} label={t('templates.startTime')} value={field.value} onChange={(value) => field.onChange(value ?? '')} /></View>
          )}
        />
        <Controller
          control={control}
          name="defaultEndTime"
          rules={{ required: true }}
          render={({ field }) => (
            <View style={styles.half}><TimeField error={errors.defaultEndTime?.message} label={t('templates.endTime')} value={field.value} onChange={(value) => field.onChange(value ?? '')} /></View>
          )}
        />
      </View>

      <Controller
        control={control}
        name="expectedBreakMinutes"
        render={({ field }) => (
          <FormField label={t('templates.breakMinutes')} value={field.value} onChangeText={field.onChange} keyboardType="numeric" maxLength={4} />
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
                <Pressable
                  key={idx}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: Boolean(active) }}
                  onPress={() => {
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
                </Pressable>
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
              <Pressable
                key={token}
                accessibilityRole="radio"
                accessibilityState={{ checked: field.value === token }}
                onPress={() => field.onChange(field.value === token ? '' : token)}
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
        label={submitLabel ?? t('templates.create')}
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
  sectionLabel: { fontSize: typography.caption, marginTop: spacing.md },
  weekdays: { flexDirection: 'row', gap: spacing.xs },
  weekdayBubble: { alignItems: 'center', borderRadius: radius.pill, height: 36, justifyContent: 'center', width: 36 },
  weekdayLabel: { fontSize: typography.caption, fontWeight: '700' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  colorSwatch: { borderRadius: radius.pill, height: 32, width: 32 },
  colorSwatchSelected: { borderColor: '#fff', borderWidth: 3 },
});
