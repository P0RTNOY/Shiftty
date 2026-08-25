import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  calendarEvidenceIntervalSchema,
  weeklyRestScheduleSchema,
  type CalendarEvidenceInterval,
  type PayRule,
  type SalaryProfile,
  type WeeklyRestSchedule,
} from '@/domain/entities';
import {
  acceptCalendarEvidencePreset,
  IL_CIVIL_SERVICE_INDEPENDENCE_DAY_2026_PRESET,
} from '@/domain/services';
import { CalendarEvidencePresetPreview } from '@/features/pay-rules/components/calendar-evidence-preset-preview';
import { SpecialPayIntervalCard } from '@/features/pay-rules/components/special-pay-interval-card';
import { SpecialPayIntervalForm, type SpecialPayIntervalDraft } from '@/features/pay-rules/components/special-pay-interval-form';
import { WeeklyRestSettings, type WeeklyRestSettingsDraft } from '@/features/pay-rules/components/weekly-rest-settings';
import { useRepositories } from '@/features/shifts/hooks/use-repositories';
import { AppScreen, EmptyState, SecondaryButton } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { createId } from '@/shared/utils/id';

export default function HolidaysRestScreen() {
  const { profileId = '' } = useLocalSearchParams<{ profileId: string }>();
  const repositories = useRepositories();
  const { colors } = useAppTheme();
  const { isRtl, locale, t } = useTranslation();
  const [profile, setProfile] = useState<ScopedSalaryProfile | null>();
  const [intervals, setIntervals] = useState<CalendarEvidenceInterval[]>([]);
  const [schedule, setSchedule] = useState<WeeklyRestSchedule | null>(null);
  const [rules, setRules] = useState<PayRule[]>([]);
  const [formExpanded, setFormExpanded] = useState(false);
  const [editing, setEditing] = useState<CalendarEvidenceInterval>();
  const [error, setError] = useState(false);
  const align = isRtl ? 'right' : 'left';

  const refresh = useCallback(async () => {
    if (!profileId) { setProfile(null); return; }
    try {
      const nextProfile = await repositories.salaryProfiles.getById(profileId);
      if (!nextProfile?.workplaceId) { setProfile(null); return; }
      setProfile(nextProfile as ScopedSalaryProfile);
      const [nextIntervals, nextSchedule, nextRules] = await Promise.all([
        repositories.calendarEvidenceIntervals.listForScope({
          workplaceId: nextProfile.workplaceId,
          salaryProfileId: nextProfile.id,
          includeArchived: true,
        }),
        repositories.weeklyRestSchedules.getForProfile(nextProfile.id),
        repositories.payRules.listForProfile(nextProfile.id),
      ]);
      setIntervals(nextIntervals);
      setSchedule(nextSchedule);
      setRules(nextRules);
      setError(false);
    } catch {
      setError(true);
    }
  }, [profileId, repositories.calendarEvidenceIntervals, repositories.payRules, repositories.salaryProfiles, repositories.weeklyRestSchedules]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const saveInterval = async (draft: SpecialPayIntervalDraft) => {
    if (!profile) return;
    const timestamp = new Date().toISOString();
    try {
      const interval = calendarEvidenceIntervalSchema.parse({
        id: editing?.id ?? createId('calendar-evidence'),
        workplaceId: profile.workplaceId,
        salaryProfileId: draft.scope === 'profile' ? profile.id : undefined,
        ...draft,
        confirmedAt: timestamp,
        isArchived: editing?.isArchived ?? false,
        archivedAt: editing?.archivedAt,
        createdAt: editing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      });
      await repositories.calendarEvidenceIntervals.save(interval);
      setEditing(undefined);
      setFormExpanded(false);
      await refresh();
    } catch {
      setError(true);
    }
  };

  const saveSchedule = async (draft: WeeklyRestSettingsDraft) => {
    if (!profile) return;
    const timestamp = new Date().toISOString();
    try {
      await repositories.weeklyRestSchedules.save(weeklyRestScheduleSchema.parse({
        id: schedule?.id ?? createId('weekly-rest'),
        workplaceId: profile.workplaceId,
        salaryProfileId: profile.id,
        label: draft.label,
        startWeekday: draft.startWeekday,
        startTime: draft.startTime,
        endWeekday: draft.endWeekday,
        endTime: draft.endTime,
        enabled: draft.enabled,
        confirmedAt: draft.enabled ? timestamp : schedule?.confirmedAt,
        sourceKind: draft.sourceKind,
        sourceTitle: draft.sourceTitle,
        sourceUrl: draft.sourceUrl,
        presetId: schedule?.presetId,
        presetVersion: schedule?.presetVersion,
        isArchived: false,
        createdAt: schedule?.createdAt ?? timestamp,
        updatedAt: timestamp,
      }));
      await refresh();
    } catch {
      setError(true);
    }
  };

  const applyPreset = async () => {
    if (!profile) return;
    const timestamp = new Date().toISOString();
    try {
      await repositories.calendarEvidenceIntervals.save(acceptCalendarEvidencePreset({
        preset: IL_CIVIL_SERVICE_INDEPENDENCE_DAY_2026_PRESET,
        intervalId: createId('calendar-evidence'),
        workplaceId: profile.workplaceId,
        salaryProfileId: profile.id,
        locale,
        confirmedAt: timestamp,
      }));
      await refresh();
    } catch {
      setError(true);
    }
  };

  const toggleArchive = async (interval: CalendarEvidenceInterval) => {
    const timestamp = new Date().toISOString();
    if (interval.isArchived) await repositories.calendarEvidenceIntervals.save({ ...interval, isArchived: false, archivedAt: undefined, updatedAt: timestamp });
    else await repositories.calendarEvidenceIntervals.archive(interval.id, timestamp);
    await refresh();
  };

  const confirmDelete = (interval: CalendarEvidenceInterval) => Alert.alert(
    t('salary.intervalDeleteTitle'),
    t('salary.intervalDeleteBody'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('salary.intervalDelete'), style: 'destructive', onPress: () => void repositories.calendarEvidenceIntervals.delete(interval.id).then(refresh).catch(() => setError(true)) },
    ],
  );

  if (profile === undefined) return <AppScreen title={t('salary.holidaysRestTitle')}><Text style={{ color: colors.textMuted, textAlign: align }}>{t('common.loading')}</Text></AppScreen>;
  if (!profile) return <AppScreen title={t('salary.holidaysRestTitle')}><SecondaryButton label={t('common.back')} onPress={() => router.back()} /><EmptyState title={t('salary.holidaysRestProfileMissing')} body={t('salary.holidaysRestIntro')} /></AppScreen>;

  return <AppScreen title={t('salary.holidaysRestTitle')}>
    <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
    <View style={[styles.intro, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <Text style={[styles.profileName, { color: colors.text, textAlign: align }]}>{profile.name}</Text>
      <Text style={[styles.body, { color: colors.textMuted, textAlign: align }]}>{t('salary.holidaysRestIntro')}</Text>
    </View>
    {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, textAlign: align }}>{t('common.error')}</Text> : null}
    <WeeklyRestSettings
      key={schedule?.updatedAt ?? 'new-weekly-rest'}
      salaryProfileId={profile.id}
      schedule={schedule}
      timezone={profile.timezone}
      workplaceId={profile.workplaceId}
      onSave={saveSchedule}
    />
    <CalendarEvidencePresetPreview preset={IL_CIVIL_SERVICE_INDEPENDENCE_DAY_2026_PRESET} onApply={applyPreset} />
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, textAlign: align }]}>{t('salary.intervalsTitle')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: formExpanded }}
        onPress={() => { setEditing(undefined); setFormExpanded((value) => !value); }}
        style={({ pressed }) => [styles.disclosure, { borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
      ><Text style={[styles.disclosureText, { color: colors.primary, textAlign: align }]}>{t(formExpanded ? 'salary.hideIntervalForm' : 'salary.addInterval')}</Text></Pressable>
      {formExpanded ? <SpecialPayIntervalForm key={editing?.id ?? 'new'} interval={editing} timezone={profile.timezone} onSave={saveInterval} /> : null}
      {!intervals.length ? <Text style={[styles.body, { color: colors.textMuted, textAlign: align }]}>{t('salary.intervalsEmpty')}</Text> : intervals.map((interval) => <SpecialPayIntervalCard
        interval={interval}
        key={interval.id}
        rules={rules}
        onArchive={() => void toggleArchive(interval).catch(() => setError(true))}
        onDelete={() => confirmDelete(interval)}
        onEdit={() => { setEditing(interval); setFormExpanded(true); }}
        onOpenRules={() => router.push(`/settings/salary/rules?profileId=${profile.id}&kind=specialInterval&intervalType=${interval.type}`)}
      />)}
    </View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  intro: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.xs, padding: spacing.md },
  profileName: { fontSize: typography.title, fontWeight: '800' },
  body: { flexShrink: 1, fontSize: typography.body, lineHeight: 22 },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: typography.title, fontWeight: '800' },
  disclosure: { borderBottomWidth: StyleSheet.hairlineWidth, borderTopWidth: StyleSheet.hairlineWidth, justifyContent: 'center', minHeight: 48, paddingVertical: spacing.sm },
  disclosureText: { flexShrink: 1, fontSize: typography.body, fontWeight: '800' },
});

type ScopedSalaryProfile = SalaryProfile & { workplaceId: string };
