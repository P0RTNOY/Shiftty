import { StyleSheet, Text, View } from 'react-native';

import type { BreakSession, Shift } from '@/domain/entities';
import { calculateLiveShiftMetrics, resolveExpectedEnd } from '@/domain/services';
import { PrimaryButton, SecondaryButton } from '@/shared/components';
import { useLiveNow } from '@/shared/hooks/use-live-now';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';
import { systemClock } from '@/shared/utils/clock';
import { formatTimer } from '@/shared/utils/duration-format';

interface Props {
  shift: Shift;
  breaks: readonly BreakSession[];
  workplaceName: string;
  roleName?: string;
  now: Date;
  busy?: boolean;
  provisionalPay?: string;
  expectedPay?: string;
  salaryIncomplete?: boolean;
  onStartBreak: (paid: boolean) => void;
  onEndBreak?: () => void;
  onEndShift: () => void;
  onOpenDetails: () => void;
  onManageBreaks: () => void;
  onChangeExpectedEnd?: () => void;
}

function ActiveShiftTimer({ shift }: { shift: Shift }) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const now = useLiveNow(systemClock, 1000);
  const elapsedMs = Math.max(0, now.getTime() - Date.parse(shift.actualStart!));

  return (
    <Text accessibilityLabel={`${t('active.elapsed')} ${formatTimer(elapsedMs)}`} style={[styles.timer, { color: colors.text }]}>
      {formatTimer(elapsedMs)}
    </Text>
  );
}

function ActiveBreakTimer({ session }: { session: BreakSession }) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const now = useLiveNow(systemClock, 1000);
  const elapsedMs = Math.max(0, now.getTime() - Date.parse(session.start));

  return (
    <Text accessibilityLabel={`${t('active.breakDuration')} ${formatTimer(elapsedMs)}`} style={[styles.breakTimer, { color: colors.warning }]}>
      {formatTimer(elapsedMs)}
    </Text>
  );
}

export function ActiveShiftPanel({
  shift,
  breaks,
  workplaceName,
  roleName,
  now,
  busy = false,
  provisionalPay,
  expectedPay,
  salaryIncomplete,
  ...actions
}: Props) {
  const { colors } = useAppTheme();
  const { formatDate, isRtl, t } = useTranslation();
  const metrics = calculateLiveShiftMetrics(shift, breaks, now);
  const expectedEnd = resolveExpectedEnd(shift);
  const activeBreak = breaks.find((item) => !item.end);
  const align = isRtl ? 'right' : 'left';

  return (
    <View style={styles.container}>
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: metrics.isOnBreak ? colors.warning : colors.primary }]}>
        <Text style={[styles.eyebrow, { color: colors.textMuted, textAlign: align }]}>{t('active.title')}</Text>
        <Text accessibilityRole="header" style={[styles.state, { color: metrics.isOnBreak ? colors.warning : colors.success, textAlign: align }]}>
          {metrics.isOnBreak ? t('active.onBreak') : t('active.working')}
        </Text>
        <Text style={[styles.title, { color: colors.text, textAlign: align }]}>{shift.title || workplaceName}</Text>
        {roleName ? <Text style={[styles.meta, { color: colors.textMuted, textAlign: align }]}>{roleName}</Text> : null}
        <ActiveShiftTimer shift={shift} />
        {activeBreak ? <ActiveBreakTimer session={activeBreak} /> : null}
        <Text style={[styles.meta, { color: colors.textMuted, textAlign: align }]}>
          {t('active.actualStart')}: {formatDate(shift.actualStart!, { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone })}
        </Text>
        {provisionalPay ? <Text style={[styles.provisional, { color: colors.primary, textAlign: align }]}>{provisionalPay}</Text> : null}
        {expectedPay ? <Text style={[styles.meta, { color: colors.primary, textAlign: align }]}>{t('salary.provisionalEnd')}: {expectedPay}</Text> : null}
        {salaryIncomplete ? <Text accessibilityRole="alert" style={[styles.meta, { color: colors.warning, textAlign: align }]}>{t('salary.missingConfig')}</Text> : null}
        {expectedEnd ? <Text style={[styles.meta, { color: colors.textMuted, textAlign: align }]}>
          {t('active.expectedEnd')}: {formatDate(expectedEnd, { hour: '2-digit', minute: '2-digit', timeZone: shift.timezone })}
        </Text> : null}
      </View>
      {metrics.isOnBreak
        ? <PrimaryButton disabled={busy} label={t('active.resumeWork')} onPress={() => actions.onEndBreak?.()} />
        : <PrimaryButton disabled={busy} label={t('active.breakAction')} onPress={() => actions.onStartBreak(false)} />}
      <SecondaryButton disabled={busy} label={t('active.clockOut')} onPress={actions.onEndShift} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  hero: { borderRadius: radius.lg, borderWidth: 2, gap: spacing.sm, padding: spacing.lg },
  eyebrow: { fontSize: typography.body, fontWeight: '700' },
  state: { fontSize: typography.title, fontWeight: '800' },
  title: { fontSize: typography.heading, fontWeight: '800' },
  meta: { fontSize: typography.body },
  provisional: { fontSize: typography.title, fontWeight: '800' },
  timer: { fontSize: 46, fontVariant: ['tabular-nums'], fontWeight: '800', textAlign: 'center' },
  breakTimer: { fontSize: typography.heading, fontVariant: ['tabular-nums'], fontWeight: '800', textAlign: 'center' },
});
