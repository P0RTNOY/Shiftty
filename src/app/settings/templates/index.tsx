import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';

import { useTemplates } from '@/features/templates';
import { TemplateCard } from '@/features/templates/components/template-card';
import { AppScreen } from '@/shared/components/app-screen';
import { PrimaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import type { ShiftTemplate } from '@/domain/entities';

export default function TemplatesListScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [showArchived, setShowArchived] = useState(false);
  const { templates, loading, refresh, archive, restore, duplicate } = useTemplates(showArchived);

  function handlePress(template: ShiftTemplate) {
    router.push({ pathname: '/settings/templates/[id]', params: { id: template.id } });
  }

  return (
    <AppScreen
      footer={<View style={[styles.footer, { borderTopColor: colors.border }]}><PrimaryButton label={t('templates.add')} onPress={() => router.push('/settings/templates/new')} /></View>}
      scrollable={false}
      title={t('settings.templates')}
    >
      <Stack.Screen options={{ title: t('templates.title') }} />
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity
            accessibilityLabel={showArchived ? t('templates.hideArchived') : t('templates.showArchived')}
            accessibilityRole="switch"
            accessibilityState={{ checked: showArchived }}
            style={styles.archiveToggle}
            onPress={() => setShowArchived((v) => !v)}
          >
            <Text style={[styles.archiveToggleText, { color: colors.primary }]}>
              {showArchived ? t('templates.hideArchived') : t('templates.showArchived')}
            </Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('templates.empty')}</Text>
              <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{t('templates.emptyBody')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TemplateCard
            template={item}
            onPress={handlePress}
            onArchive={archive}
            onRestore={restore}
            onDuplicate={async (id, newName) => {
              await duplicate(id, newName);
            }}
          />
        )}
        onRefresh={refresh}
        refreshing={loading}
        style={styles.virtualizedList}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md },
  archiveToggle: { alignItems: 'center', alignSelf: 'flex-end', justifyContent: 'center', marginBottom: spacing.sm, minHeight: 44 },
  archiveToggleText: { fontSize: typography.caption },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl },
  emptyTitle: { fontSize: typography.title, fontWeight: '700' },
  emptyBody: { fontSize: typography.body, textAlign: 'center' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  virtualizedList: { flex: 1 },
});
