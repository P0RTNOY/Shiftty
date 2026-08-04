import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { Shift } from '@/domain/entities';
import {
  buildWeekCalendarData,
  getPreviousWeek,
  getNextWeek,
  type ShiftTimeBlock,
  type WeekDayData,
} from '@/domain/services/week-calendar-service';
import { useTranslation } from '@/shared/i18n';
import { spacing, radius, typography, useAppTheme } from '@/shared/theme';

const HOUR_HEIGHT = 48; // px per hour
const DAY_HEADER_HEIGHT = 52;
const TIME_LABEL_WIDTH = 44;
const TOTAL_HEIGHT = 24 * HOUR_HEIGHT;

interface WeekCalendarViewProps {
  weekOf: Date;
  shifts: readonly Shift[];
  timezone: string;
  locale: string;
  isRtl?: boolean;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onNavigateToday: () => void;
  onPressShift?: (shift: Shift) => void;
}

export function WeekCalendarView({
  weekOf,
  shifts,
  timezone,
  locale,
  isRtl = false,
  onNavigatePrev,
  onNavigateNext,
  onNavigateToday,
  onPressShift,
}: WeekCalendarViewProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);

  const data = buildWeekCalendarData(weekOf, shifts, timezone, locale, isRtl);
  const displayDays = isRtl ? [...data.days].reverse() : data.days;

  // Scroll to 7am on mount
  React.useEffect(() => {
    const offset = 7 * HOUR_HEIGHT;
    scrollRef.current?.scrollTo({ y: offset, animated: false });
  }, []);

  function getStatusColor(shift: Shift): string {
    switch (shift.status) {
      case 'active': return colors.success;
      case 'completed': return colors.primary;
      case 'cancelled': return colors.textMuted;
      default: return colors.warning;
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Navigation bar */}
      <View style={[styles.nav, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onNavigatePrev} accessibilityLabel={t('calendar.previousWeek')} style={styles.navBtn}>
          <Ionicons name={isRtl ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onNavigateToday} style={styles.navToday}>
          <Text style={[styles.navTodayText, { color: colors.primary }]}>{t('calendar.today')}</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>
          {new Date(data.weekStart).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
          {' – '}
          {new Date(data.weekEnd).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={onNavigateNext} accessibilityLabel={t('calendar.nextWeek')} style={styles.navBtn}>
          <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={[styles.dayHeaders, { marginLeft: TIME_LABEL_WIDTH, borderBottomColor: colors.border }]}>
        {displayDays.map(({ day }) => (
          <View key={day.localDate} style={[styles.dayHeaderCell, day.isToday && { backgroundColor: colors.primary + '22' }]}>
            <Text style={[styles.dayHeaderLabel, { color: day.isToday ? colors.primary : colors.textMuted }]}>
              {day.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      <ScrollView ref={scrollRef} style={styles.gridScroll} contentContainerStyle={{ height: TOTAL_HEIGHT }}>
        <View style={styles.gridRow}>
          {/* Time labels */}
          <View style={[styles.timeLabels, { width: TIME_LABEL_WIDTH }]}>
            {Array.from({ length: 24 }, (_, h) => (
              <View key={h} style={[styles.timeLabel, { height: HOUR_HEIGHT, borderTopColor: colors.border }]}>
                <Text style={[styles.timeLabelText, { color: colors.textMuted }]}>
                  {String(h).padStart(2, '0')}:00
                </Text>
              </View>
            ))}
          </View>

          {/* Day columns */}
          {displayDays.map(({ day, blocks }) => (
            <View key={day.localDate} style={styles.dayColumn}>
              {/* Hour lines */}
              {Array.from({ length: 24 }, (_, h) => (
                <View
                  key={h}
                  style={[styles.hourLine, { height: HOUR_HEIGHT, borderTopColor: colors.border + '66' }]}
                />
              ))}
              {/* Today highlight */}
              {day.isToday && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: colors.primary + '0A' },
                  ]}
                />
              )}
              {/* Shift blocks */}
              {blocks.map((block) => (
                <ShiftBlock
                  key={block.shift.id}
                  block={block}
                  color={getStatusColor(block.shift)}
                  onPress={onPressShift ? () => onPressShift(block.shift) : undefined}
                  colors={colors}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

interface ShiftBlockProps {
  block: ShiftTimeBlock;
  color: string;
  onPress?: () => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
}

function ShiftBlock({ block, color, onPress, colors }: ShiftBlockProps) {
  const top = (block.startMinutes / 60) * HOUR_HEIGHT;
  const height = Math.max(20, (block.durationMinutes / 60) * HOUR_HEIGHT);
  const widthFraction = 1 / block.totalColumns;
  const leftFraction = block.column * widthFraction;

  return (
    <TouchableOpacity
      accessible
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.shiftBlock,
        {
          top,
          height,
          left: `${leftFraction * 100}%`,
          right: `${(1 - leftFraction - widthFraction) * 100}%`,
          backgroundColor: color + 'DD',
          borderColor: color,
        },
      ]}
    >
      <Text style={[styles.shiftBlockText, { color: colors.onPrimary }]} numberOfLines={2}>
        {block.shift.title ?? formatBlockTime(block.startMinutes)}
      </Text>
    </TouchableOpacity>
  );
}

function formatBlockTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  nav: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  navBtn: { padding: spacing.xs },
  navToday: { padding: spacing.xs },
  navTodayText: { fontSize: typography.caption, fontWeight: '600' },
  navTitle: { flex: 1, fontSize: typography.caption, textAlign: 'center' },
  dayHeaders: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: DAY_HEADER_HEIGHT,
  },
  dayHeaderCell: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: 'center',
    margin: 2,
  },
  dayHeaderLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  gridScroll: { flex: 1 },
  gridRow: { flexDirection: 'row' },
  timeLabels: {},
  timeLabel: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 2 },
  timeLabelText: { fontSize: 9, paddingHorizontal: 2, textAlign: 'right' },
  dayColumn: { borderLeftWidth: StyleSheet.hairlineWidth, flex: 1, position: 'relative' },
  hourLine: { borderTopWidth: StyleSheet.hairlineWidth },
  shiftBlock: {
    borderLeftWidth: 3,
    borderRadius: 4,
    overflow: 'hidden',
    padding: 3,
    position: 'absolute',
  },
  shiftBlockText: { fontSize: 10, fontWeight: '600' },
});
