import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CreateShiftTemplateInput } from '@/domain/repositories';
import { FormField, PrimaryButton, SecondaryButton, TimeField } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, radius, typography, useAppTheme } from '@/shared/theme';
import { assertDefaultShiftDurationWithinLimit } from '@/domain/services';

type FormValues = {
  name: string;
  defaultStartTime: string;
  defaultEndTime: string;
  payMultiplierPercent: string;
  expectedBreakMinutes: string;
  expectedBreakType: 'paid' | 'unpaid' | '';
  validWeekdays: boolean[];
  colorToken: string;
};

interface TemplateFormProps {
  initial?: Partial<FormValues>;
  loading?: boolean;
  submitLabel?: string;
  onDelete?: () => void;
  onSubmit: (input: CreateShiftTemplateInput) => Promise<void>;
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const COLOR_TOKENS = ['#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1'];

export function TemplateForm({ initial, loading, submitLabel, onDelete, onSubmit }: TemplateFormProps) {
  const { t, isRtl } = useTranslation();
  const { colors } = useAppTheme();

  const { control, getValues, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: initial?.name ?? '',
      defaultStartTime: initial?.defaultStartTime ?? '08:00',
      defaultEndTime: initial?.defaultEndTime ?? '16:00',
      payMultiplierPercent: initial?.payMultiplierPercent ?? '100',
      expectedBreakMinutes: String(initial?.expectedBreakMinutes ?? 0),
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
      payMultiplierBasisPoints: Math.round(Number(data.payMultiplierPercent) * 100),
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
          <FormField label={t('templates.name')} error={errors.name?.message} value={field.value} onChangeText={field.onChange} maxLength={120} testID="e2e-shift-type-name" />
        )}
      />

      <View style={[styles.row, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
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
          rules={{
            required: true,
            validate: (value) => {
              try {
                assertDefaultShiftDurationWithinLimit(getValues('defaultStartTime'), value);
                return true;
              } catch {
                return t('form.shiftTooLong');
              }
            },
          }}
          render={({ field }) => (
            <View style={styles.half}><TimeField error={errors.defaultEndTime?.message} label={t('templates.endTime')} value={field.value} onChange={(value) => field.onChange(value ?? '')} /></View>
          )}
        />
      </View>

      <Controller
        control={control}
        name="payMultiplierPercent"
        rules={{
          required: t('form.required'),
          validate: (value) => /^\d{1,4}(\.\d{1,2})?$/.test(value)
            && Number(value) >= 100
            && Number(value) <= 1000
            || t('templates.invalidMultiplier'),
        }}
        render={({ field }) => (
          <FormField
            label={t('templates.payMultiplier')}
            error={errors.payMultiplierPercent?.message}
            value={field.value}
            onChangeText={field.onChange}
            keyboardType="decimal-pad"
            maxLength={7}
            testID="e2e-shift-type-multiplier"
          />
        )}
      />
      <Text style={[styles.hint, { color: colors.textMuted, textAlign: isRtl ? 'right' : 'left' }]}>{t('templates.payMultiplierHint')}</Text>

      <Controller
        control={control}
        name="expectedBreakMinutes"
        render={({ field }) => (
          <FormField label={t('templates.breakMinutes')} value={field.value} onChangeText={field.onChange} keyboardType="numeric" maxLength={4} testID="e2e-shift-type-break" />
        )}
      />

      <Text style={[styles.sectionLabel, { color: colors.textMuted, textAlign: isRtl ? 'right' : 'left' }]}>{t('templates.breakType')}</Text>
      <Controller
        control={control}
        name="expectedBreakType"
        render={({ field }) => (
          <View style={[styles.breakTypes, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            {(['', 'paid', 'unpaid'] as const).map((value) => (
              <Pressable
                key={value || 'default'}
                accessibilityRole="radio"
                accessibilityState={{ checked: field.value === value }}
                onPress={() => field.onChange(value)}
                style={[styles.breakType, { borderColor: field.value === value ? colors.primary : colors.border, backgroundColor: colors.surface }]}
              >
                <Text style={{ color: colors.text }}>{value === 'paid' ? t('templates.breakPaid') : value === 'unpaid' ? t('templates.breakUnpaid') : t('templates.breakDefault')}</Text>
              </Pressable>
            ))}
          </View>
        )}
      />

      {/* Weekday selector */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('templates.weekdays')}</Text>
      <Controller
        control={control}
        name="validWeekdays"
        render={({ field }) => (
          <View style={[styles.weekdays, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            {WEEKDAY_KEYS.map((key, idx) => {
              const active = field.value[idx];
              return (
                <Pressable
                  key={key}
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
                    {t(`calendar.day.${key}`)}
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
          <View style={[styles.colorRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
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
        testID="e2e-shift-type-save"
      />
      {onDelete ? <SecondaryButton destructive label={t('templates.delete')} onPress={onDelete} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, padding: spacing.md },
  row: { gap: spacing.sm },
  half: { flex: 1 },
  hint: { fontSize: typography.caption },
  breakTypes: { flexWrap: 'wrap', gap: spacing.xs },
  breakType: { borderRadius: radius.pill, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  sectionLabel: { fontSize: typography.caption, marginTop: spacing.md },
  weekdays: { gap: spacing.xs },
  weekdayBubble: { alignItems: 'center', borderRadius: radius.pill, height: 36, justifyContent: 'center', width: 36 },
  weekdayLabel: { fontSize: typography.caption, fontWeight: '700' },
  colorRow: { flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  colorSwatch: { borderRadius: radius.pill, height: 32, width: 32 },
  colorSwatchSelected: { borderColor: '#fff', borderWidth: 3 },
});
