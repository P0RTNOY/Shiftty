import { create } from 'zustand';

import { DEFAULT_TIMEZONE } from '@/shared/constants/app';
import { formatLocalDateKey } from '@/shared/utils/zoned-time';

type CalendarMode = 'month' | 'week' | 'agenda';

interface CalendarState {
  selectedDate: string;
  mode: CalendarMode;
  setSelectedDate: (date: string) => void;
  setMode: (mode: CalendarMode) => void;
}

export function getCalendarToday(now = new Date()): string {
  return formatLocalDateKey(now, DEFAULT_TIMEZONE);
}

export const useCalendarStore = create<CalendarState>((set) => ({
  selectedDate: getCalendarToday(),
  mode: 'month',
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setMode: (mode) => set({ mode }),
}));
