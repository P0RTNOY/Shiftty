import { addDays, addMonths, format } from 'date-fns';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { buildMonthGrid } from '@/domain/services';
import { CalendarView } from '@/features/calendar/components/calendar-view';
import { useCalendarStore } from '@/features/calendar/store/calendar-store';
import { useShifts } from '@/features/shifts/hooks/use-shifts';
import { useShiftTemplates } from '@/features/shifts/hooks/use-shift-templates';
import { useWorkplaces } from '@/features/workplaces/hooks/use-workplaces';
import { AppScreen } from '@/shared/components';
import { useTranslation } from '@/shared/i18n';
import { resolveLocalShiftRange } from '@/shared/utils/zoned-time';
import { useAppTheme } from '@/shared/theme';

export default function CalendarScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { selectedDate, mode, setSelectedDate, setMode } = useCalendarStore();
  const monthDate = `${selectedDate.slice(0, 7)}-01`;
  const grid = buildMonthGrid(monthDate, 0);
  const starts = resolveLocalShiftRange(grid[0]!.localDate, '00:00', '23:59').start;
  const lastNext = format(addDays(new Date(`${grid[41]!.localDate}T12:00:00`), 1), 'yyyy-MM-dd');
  const ends = resolveLocalShiftRange(lastNext, '00:00', '23:59').start;
  const { shifts, loading, error } = useShifts({ endsAfter: starts, startsBefore: ends });
  const { workplaces, roles } = useWorkplaces();
  const { templates } = useShiftTemplates();
  const moveMonth = (amount: number) => setSelectedDate(format(addMonths(new Date(`${monthDate}T12:00:00`), amount), 'yyyy-MM-dd'));

  return (
    <AppScreen title={t('calendar.title')}>
      {loading ? <Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{t('common.error')}</Text> : null}
      <CalendarView mode={mode} monthDate={monthDate} onCreateShift={(date) => router.push(`/shifts/new?mode=scheduled&date=${date}`)} onModeChange={setMode} onNextMonth={() => moveMonth(1)} onOpenShift={(shift) => router.push(`/shifts/${shift.id}`)} onStartShift={(shift) => router.push(`/shifts/start?shiftId=${shift.id}`)} onPreviousMonth={() => moveMonth(-1)} onSelectDate={setSelectedDate} roles={roles} selectedDate={selectedDate} shifts={shifts} templates={templates} workplaces={workplaces} />
    </AppScreen>
  );
}
