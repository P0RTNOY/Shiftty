import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AppScreen, PrimaryButton, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { spacing, typography, useAppTheme } from '@/shared/theme';
import { useShiftPrediction } from '@/features/shifts/hooks/use-shift-prediction';
import { useWorkplaces } from '@/features/workplaces/hooks/use-workplaces';
import { useShiftTemplates } from '@/features/shifts/hooks/use-shift-templates';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { createScheduledShift } from '@/domain/services/shift-factory';
import { createId } from '@/shared/utils/id';
import { reportUnexpectedError } from '@/shared/utils/report-unexpected-error';

export default function ApplySuggestionScreen() {
  const { colors } = useAppTheme();
  const { t, isRtl } = useTranslation();
  const { result: prediction } = useShiftPrediction();
  const { workplaces } = useWorkplaces();
  const { templates } = useShiftTemplates();
  const repositories = useRepositories();

  const candidate = prediction?.recommended;

  // We can track which fields the user wants to keep. By default all are true.
  const [acceptWorkplace, setAcceptWorkplace] = useState(true);
  const [acceptTime, setAcceptTime] = useState(true);

  if (!candidate) {
    return (
      <AppScreen title={t('suggestion.title')}>
        <View style={styles.container}>
          <Text style={{ color: colors.textMuted }}>{t('suggestion.noSuggestion')}</Text>
          <SecondaryButton label={t('common.cancel')} onPress={() => router.back()} />
        </View>
      </AppScreen>
    );
  }

  const template = templates.find((t) => t.id === candidate.suggestedTemplateId);
  const workplace = workplaces.find((w) => w.id === candidate.suggestedWorkplaceId);

  const apply = async () => {
    try {
      const acceptedFields: string[] = [];
      const rejectedFields: string[] = [];

      if (acceptWorkplace) acceptedFields.push('workplaceId', 'roleId', 'shiftTemplateId');
      else rejectedFields.push('workplaceId', 'roleId', 'shiftTemplateId');

      if (acceptTime) acceptedFields.push('scheduledStart', 'scheduledEnd');
      else rejectedFields.push('scheduledStart', 'scheduledEnd');

      // Log feedback
      await repositories.predictionFeedback.record({
        feedbackType: acceptWorkplace && acceptTime ? 'accepted_all' : 'accepted_partial',
        engineVersion: prediction.engineVersion,
        candidateSource: candidate.source,
        candidateSourceId: candidate.sourceId,
        score: candidate.score,
        acceptedFields,
        rejectedFields,
      });

      // Create shift
      const nowString = new Date().toISOString();
      const shift = createScheduledShift({
        workplaceId: acceptWorkplace ? (candidate.suggestedWorkplaceId ?? workplaces[0]?.id ?? '') : workplaces[0]?.id ?? '',
        roleId: acceptWorkplace ? candidate.suggestedRoleId : undefined,
        shiftTemplateId: acceptWorkplace ? candidate.suggestedTemplateId : undefined,
        hourlyRateSnapshotMinor: 0, // Should be resolved properly in a full flow or left 0 until calculated
        date: candidate.suggestedScheduledStart ? candidate.suggestedScheduledStart.split('T')[0]! : new Date().toISOString().split('T')[0]!,
        startTime: acceptTime && candidate.suggestedScheduledStart ? new Date(candidate.suggestedScheduledStart).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : template?.defaultStartTime ?? '08:00',
        endTime: acceptTime && candidate.suggestedScheduledEnd ? new Date(candidate.suggestedScheduledEnd).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : template?.defaultEndTime ?? '16:00',
        expectedBreakMinutes: template?.expectedBreakMinutes ?? 0,
      }, {
        id: createId('shift'),
        now: nowString,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      await repositories.shifts.create(shift);
      
      // Navigate to edit the newly created shift to let them finalize it if partial, or just go back to home
      if (acceptWorkplace && acceptTime) {
        router.dismissAll();
        router.push('/');
      } else {
        router.replace(`/shifts/${shift.id}/edit`);
      }
    } catch (err) {
      reportUnexpectedError('suggestion.apply', err);
      Alert.alert(t('common.error'));
    }
  };

  const rejectAll = async () => {
    try {
      await repositories.predictionFeedback.record({
        feedbackType: 'rejected',
        engineVersion: prediction.engineVersion,
        candidateSource: candidate.source,
        candidateSourceId: candidate.sourceId,
        score: candidate.score,
        acceptedFields: [],
        rejectedFields: ['workplaceId', 'roleId', 'shiftTemplateId', 'scheduledStart', 'scheduledEnd'],
      });
      router.back();
    } catch (err) {
      reportUnexpectedError('suggestion.reject', err);
      Alert.alert(t('common.error'));
    }
  };

  const direction = isRtl ? 'row-reverse' : 'row';
  
  return (
    <AppScreen title={t('suggestion.title')}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>
          {t('suggestion.review')}
        </Text>
        
        <View style={styles.section}>
          <View style={[styles.row, { backgroundColor: colors.surface, flexDirection: direction }]}>
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: colors.text }]}>{t('suggestion.workplace')}</Text>
              <Text style={[styles.description, { color: colors.primary }]}>{workplace?.name ?? '—'}</Text>
            </View>
            <Switch accessibilityLabel={t('suggestion.workplace')} accessibilityRole="switch" accessibilityState={{ checked: acceptWorkplace }} value={acceptWorkplace} onValueChange={setAcceptWorkplace} trackColor={{ true: colors.primary, false: colors.border }} />
          </View>

          <View style={[styles.row, { backgroundColor: colors.surface, flexDirection: direction }]}>
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: colors.text }]}>{t('suggestion.time')}</Text>
              <Text style={[styles.description, { color: colors.primary }]}>{candidate.suggestedScheduledStart ? new Date(candidate.suggestedScheduledStart).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : ''} - {candidate.suggestedScheduledEnd ? new Date(candidate.suggestedScheduledEnd).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : ''}</Text>
            </View>
            <Switch accessibilityLabel={t('suggestion.time')} accessibilityRole="switch" accessibilityState={{ checked: acceptTime }} value={acceptTime} onValueChange={setAcceptTime} trackColor={{ true: colors.primary, false: colors.border }} />
          </View>
        </View>

        <View style={styles.actions}>
          <PrimaryButton label={t('suggestion.apply')} onPress={apply} />
          <SecondaryButton destructive label={t('suggestion.reject')} onPress={rejectAll} />
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.xl },
  title: { fontSize: typography.title, fontWeight: '800' },
  section: { gap: spacing.sm },
  row: { alignItems: 'center', borderRadius: 12, justifyContent: 'space-between', padding: spacing.md, gap: spacing.md },
  rowText: { flex: 1, gap: 4 },
  label: { fontSize: typography.body, fontWeight: '500' },
  description: { fontSize: typography.caption, fontWeight: '600' },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
});
