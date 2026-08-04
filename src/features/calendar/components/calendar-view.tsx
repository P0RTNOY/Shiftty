import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Shift } from '@/domain/entities';
import { buildMonthGrid, groupShiftsByLocalDate } from '@/domain/services';
import { ShiftCard } from '@/features/shifts/components/shift-card';
import { EmptyState, PrimaryButton } from '@/shared/components';
import { DEFAULT_TIMEZONE } from '@/shared/constants/app';
import { useTranslation } from '@/shared/i18n';
import { radius, spacing, typography, useAppTheme } from '@/shared/theme';

import { WeekCalendarView } from '@/features/calendar/components/week-calendar-view';
import { getPreviousWeek, getNextWeek } from '@/domain/services/week-calendar-service';

export type CalendarDisplayMode = 'month' | 'week' | 'agenda';

interface WorkplaceSummary { id: string; name: string }
interface RoleSummary { id: string; name: string }
interface TemplateSummary { id: string; name: string }

interface Props {
  mode: CalendarDisplayMode;
  monthDate: string;
  selectedDate: string;
  shifts: readonly Shift[];
  workplaces: readonly WorkplaceSummary[];
  roles?: readonly RoleSummary[];
  templates?: readonly TemplateSummary[];
  onModeChange: (mode: CalendarDisplayMode) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: string) => void;
  onCreateShift: (date: string) => void;
  onOpenShift: (shift: Shift) => void;
  onStartShift?: (shift: Shift) => void;
}

const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function CalendarView(props: Props) {
  const { colors } = useAppTheme();
  const { formatDate, isRtl, locale, t } = useTranslation();
  const timezone = props.shifts[0]?.timezone ?? DEFAULT_TIMEZONE;
  const grouped = groupShiftsByLocalDate(props.shifts, timezone);
  const grid = buildMonthGrid(props.monthDate, locale === 'he' ? 0 : 0);
  const direction = isRtl ? 'row-reverse' : 'row';
  const monthLabel = formatDate(new Date(`${props.monthDate.slice(0, 7)}-01T12:00:00`), { month: 'long', year: 'numeric' });
  const selectedShifts = grouped.get(props.selectedDate) ?? [];
  const agendaShifts = [...props.shifts].sort((left, right) => effectiveStart(left).localeCompare(effectiveStart(right)));

  return <View style={styles.container}>
    <View style={[styles.modeBar, { backgroundColor: colors.surfaceMuted, flexDirection: direction }]}>
      <ModeButton active={props.mode === 'month'} label={t('calendar.month')} onPress={() => props.onModeChange('month')} />
      <ModeButton active={props.mode === 'week'} label={t('calendar.week')} onPress={() => props.onModeChange('week')} />
      <ModeButton active={props.mode === 'agenda'} label={t('calendar.agenda')} onPress={() => props.onModeChange('agenda')} />
    </View>
    <View style={[styles.monthHeader, { flexDirection: direction }]}>
      <Pressable accessibilityLabel={t('calendar.previousMonth')} accessibilityRole="button" hitSlop={8} onPress={props.onPreviousMonth} style={styles.navButton}><Text style={[styles.navText, { color: colors.primary }]}>{isRtl ? '‹' : '‹'}</Text></Pressable>
      <Text accessibilityRole="header" style={[styles.monthTitle, { color: colors.text }]}>{monthLabel}</Text>
      <Pressable accessibilityLabel={t('calendar.nextMonth')} accessibilityRole="button" hitSlop={8} onPress={props.onNextMonth} style={styles.navButton}><Text style={[styles.navText, { color: colors.primary }]}>›</Text></Pressable>
    </View>

    {props.mode === 'week' ? (
      <WeekCalendarView
        weekOf={new Date(`${props.selectedDate}T12:00:00`)}
        shifts={props.shifts}
        timezone={timezone}
        locale={locale}
        isRtl={isRtl}
        onNavigatePrev={() => props.onSelectDate(getPreviousWeek(new Date(`${props.selectedDate}T12:00:00`)).toISOString().slice(0, 10))}
        onNavigateNext={() => props.onSelectDate(getNextWeek(new Date(`${props.selectedDate}T12:00:00`)).toISOString().slice(0, 10))}
        onNavigateToday={() => props.onSelectDate(new Date().toISOString().slice(0, 10))}
        onPressShift={props.onOpenShift}
      />
    ) : props.mode === 'month' ? <>
      <View style={[styles.weekRow, { flexDirection: direction }]}>{weekdayKeys.map((key) => <Text key={key} style={[styles.weekday, { color: colors.textMuted }]}>{t(`calendar.day.${key}`)}</Text>)}</View>
      {Array.from({ length: 6 }, (_, row) => <View key={row} style={[styles.weekRow, { flexDirection: direction }]}>
        {grid.slice(row * 7, row * 7 + 7).map((day) => {
          const shifts = grouped.get(day.localDate) ?? [];
          const selected = day.localDate === props.selectedDate;
          return <Pressable
            accessibilityLabel={formatDate(new Date(`${day.localDate}T12:00:00`), { weekday: 'long', day: 'numeric', month: 'long' })}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={day.localDate}
            onPress={() => props.onSelectDate(day.localDate)}
            style={[styles.day, { backgroundColor: selected ? colors.surfaceMuted : colors.surface, borderColor: selected ? colors.primary : colors.border, opacity: day.isCurrentMonth ? 1 : 0.48 }]}
          >
            <Text style={[styles.dayNumber, { color: colors.text }]}>{Number(day.localDate.slice(-2))}</Text>
            <View style={[styles.indicators, { flexDirection: direction }]}>{shifts.slice(0, 3).map((shift) => <View key={shift.id} style={[styles.indicator, { backgroundColor: statusColor(shift, colors) }]} />)}</View>
          </Pressable>;
        })}
      </View>)}
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text, textAlign: isRtl ? 'right' : 'left' }]}>{t('calendar.selectedDay')}</Text>
      <ShiftList roles={props.roles ?? []} shifts={selectedShifts} templates={props.templates ?? []} workplaces={props.workplaces} onOpenShift={props.onOpenShift} onStartShift={props.onStartShift} />
      {!props.shifts.length ? <EmptyState body={t('calendar.emptyBody')} title={t('calendar.empty')} /> : null}
      <PrimaryButton label={t('home.addFuture')} onPress={() => props.onCreateShift(props.selectedDate)} />
    </> : <>
      <ShiftList roles={props.roles ?? []} shifts={agendaShifts} templates={props.templates ?? []} workplaces={props.workplaces} onOpenShift={props.onOpenShift} onStartShift={props.onStartShift} />
      {!agendaShifts.length ? <EmptyState body={t('calendar.emptyBody')} title={t('calendar.empty')} /> : null}
    </>}
  </View>;
}

function ShiftList({ shifts, workplaces, roles, templates, onOpenShift, onStartShift }: { shifts: readonly Shift[]; workplaces: readonly WorkplaceSummary[]; roles: readonly RoleSummary[]; templates: readonly TemplateSummary[]; onOpenShift: (shift: Shift) => void; onStartShift?: (shift: Shift) => void }) {
  const { t } = useTranslation();
  return <View style={styles.list}>{shifts.map((shift) => <View key={shift.id} style={styles.list}><ShiftCard onPress={() => onOpenShift(shift)} roleName={roles.find((item) => item.id === shift.roleId)?.name} shift={shift} templateName={templates.find((item) => item.id === shift.shiftTemplateId)?.name} workplaceName={workplaces.find((item) => item.id === shift.workplaceId)?.name ?? '—'} />{shift.status === 'scheduled' && onStartShift ? <PrimaryButton label={t('active.startScheduled')} onPress={() => onStartShift(shift)} /> : null}</View>)}</View>;
}

function ModeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.modeButton, { backgroundColor: active ? colors.surface : 'transparent' }]}><Text style={{ color: active ? colors.primary : colors.textMuted, fontWeight: '700' }}>{label}</Text></Pressable>;
}

function effectiveStart(shift: Shift): string { return shift.scheduledStart ?? shift.actualStart ?? shift.payableStart ?? ''; }
function statusColor(shift: Shift, colors: ReturnType<typeof useAppTheme>['colors']): string {
  if (shift.status === 'missed') return colors.danger;
  if (shift.status === 'cancelled') return colors.textMuted;
  if (shift.status === 'active') return colors.warning;
  return colors.success;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md }, modeBar: { borderRadius: radius.md, padding: spacing.xxs },
  modeButton: { alignItems: 'center', borderRadius: radius.sm, flex: 1, justifyContent: 'center', minHeight: 44 },
  monthHeader: { alignItems: 'center', justifyContent: 'space-between' }, monthTitle: { fontSize: typography.title, fontWeight: '800' },
  navButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 }, navText: { fontSize: 32, lineHeight: 36 },
  weekRow: { gap: spacing.xxs }, weekday: { flex: 1, fontSize: typography.caption, fontWeight: '700', textAlign: 'center' },
  day: { alignItems: 'center', borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, flex: 1, gap: spacing.xxs, minHeight: 52, paddingVertical: spacing.xs },
  dayNumber: { fontSize: typography.caption, fontWeight: '700' }, indicators: { gap: 3, minHeight: 5 }, indicator: { borderRadius: radius.pill, height: 5, width: 5 },
  sectionTitle: { fontSize: typography.title, fontWeight: '800' }, list: { gap: spacing.sm },
});
