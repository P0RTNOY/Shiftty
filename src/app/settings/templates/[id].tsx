import React, { useState , useCallback } from 'react';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { View, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import type { ShiftTemplate } from '@/domain/entities';
import { SqliteShiftTemplateRepository } from '@/data/repositories';
import { TemplateForm } from '@/features/templates/components/template-form';
import { AppScreen } from '@/shared/components/app-screen';
import { EmptyState } from '@/shared/components';
import { SettingsBackButton } from '@/features/settings/components/settings-back-button';
import { useTranslation } from '@/shared/i18n';
import { spacing, useAppTheme } from '@/shared/theme';
import type { CreateShiftTemplateInput } from '@/domain/repositories';

export default function TemplateEditScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const database = useSQLiteContext();
  const repo = new SqliteShiftTemplateRepository(database);
  const isNew = id === 'new';

  const [template, setTemplate] = useState<ShiftTemplate | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    if (isNew) return;
    let mounted = true;
    setLoading(true);
    repo.getById(id).then((t) => {
      if (mounted) { setTemplate(t); setLoading(false); }
    }).catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]));

  async function handleSubmit(input: CreateShiftTemplateInput) {
    setSaving(true);
    try {
      if (isNew) {
        await repo.create(input);
      } else if (template) {
        await repo.update(template.id, input);
      }
      Alert.alert(t('templates.savedMessage'));
      router.back();
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!template) return;
    Alert.alert(t('templates.deleteTitle'), t('templates.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('templates.delete'), style: 'destructive', onPress: () => {
        setSaving(true);
        void repo.delete(template.id)
          .then(() => router.back())
          .catch(() => Alert.alert(t('common.error')))
          .finally(() => setSaving(false));
      } },
    ]);
  }

  const title = isNew ? t('templates.create') : t('templates.edit');

  if (loading) {
    return (
          <AppScreen title={title}>
            <Stack.Screen options={{ title }} />
            <SettingsBackButton />
            <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  if (!isNew && !template) {
    return <AppScreen title={title}>
      <Stack.Screen options={{ title }} />
      <SettingsBackButton />
      <EmptyState body={t('templates.notFound')} title={t('common.error')} />
    </AppScreen>;
  }

  const initial = template ? {
    name: template.name,
    defaultStartTime: template.defaultStartTime,
    defaultEndTime: template.defaultEndTime,
    payMultiplierPercent: String((template.payMultiplierBasisPoints ?? 10_000) / 100),
    expectedBreakMinutes: String(template.expectedBreakMinutes),
    expectedBreakType: template.expectedBreakType,
    validWeekdays: Array(7).fill(false).map((_, i) => template.validWeekdays?.includes(i) ?? false),
    colorToken: template.colorToken,
  } : undefined;

  return (
      <AppScreen title={title}>
        <Stack.Screen options={{ title }} />
      <SettingsBackButton />
      <TemplateForm initial={initial} loading={saving} onDelete={isNew ? undefined : handleDelete} onSubmit={handleSubmit} submitLabel={title} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.lg },
});
