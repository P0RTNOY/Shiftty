import { create } from 'zustand';

type CalendarMode = 'month' | 'week' | 'agenda';

interface CalendarState {
  selectedDate: string;
  mode: CalendarMode;
  setSelectedDate: (date: string) => void;
  setMode: (mode: CalendarMode) => void;
}

const today = new Date().toISOString().slice(0, 10);

export const useCalendarStore = create<CalendarState>((set) => ({
  selectedDate: today,
  mode: 'month',
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setMode: (mode) => set({ mode }),
}));
