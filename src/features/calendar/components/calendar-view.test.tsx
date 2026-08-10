import { fireEvent, screen } from '@testing-library/react-native';

import { CalendarView } from '@/features/calendar/components/calendar-view';
import { createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

describe('CalendarView', () => {
  it('shows a Hebrew empty state and lets the selected date start shift creation', () => {
    const onCreateShift = jest.fn();
    renderApp(<CalendarView mode="month" monthDate="2026-07-01" onCreateShift={onCreateShift} onModeChange={jest.fn()} onNextMonth={jest.fn()} onOpenShift={jest.fn()} onPreviousMonth={jest.fn()} onSelectDate={jest.fn()} selectedDate="2026-07-15" shifts={[]} workplaces={[]} />);

    expect(screen.getByText('עדיין אין משמרות ביומן')).toBeTruthy();
    fireEvent.press(screen.getByText('15'));
    fireEvent.press(screen.getByRole('button', { name: 'הוספת משמרת' }));
    expect(onCreateShift).toHaveBeenCalledWith('2026-07-15');
  });

  it.each(['week', 'agenda'] as const)('keeps contextual shift creation available in %s mode', (mode) => {
    const onCreateShift = jest.fn();
    renderApp(<CalendarView mode={mode} monthDate="2026-07-01" onCreateShift={onCreateShift} onModeChange={jest.fn()} onNextMonth={jest.fn()} onOpenShift={jest.fn()} onPreviousMonth={jest.fn()} onSelectDate={jest.fn()} selectedDate="2026-07-15" shifts={[]} workplaces={[]} />);

    fireEvent.press(screen.getByRole('button', { name: 'הוספת משמרת' }));
    expect(onCreateShift).toHaveBeenCalledWith('2026-07-15');
  });

  it('exposes week navigation and compact shifts as accessible controls', () => {
    const onOpenShift = jest.fn();
    const shift = createShift({
      id: 'short-shift',
      title: 'משמרת קצרה',
      scheduledStart: '2026-07-15T09:00:00+03:00',
      scheduledEnd: '2026-07-15T09:15:00+03:00',
    });
    renderApp(<CalendarView mode="week" monthDate="2026-07-01" onCreateShift={jest.fn()} onModeChange={jest.fn()} onNextMonth={jest.fn()} onOpenShift={onOpenShift} onPreviousMonth={jest.fn()} onSelectDate={jest.fn()} selectedDate="2026-07-15" shifts={[shift]} workplaces={[{ id: 'workplace-1', name: 'העבודה' }]} />);

    expect(screen.getByRole('button', { name: 'שבוע קודם' })).toHaveStyle({ minHeight: 44, minWidth: 44 });
    expect(screen.getByRole('button', { name: 'היום' })).toHaveStyle({ minHeight: 44 });
    expect(screen.getByRole('button', { name: 'שבוע הבא' })).toHaveStyle({ minHeight: 44, minWidth: 44 });
    fireEvent.press(screen.getByRole('button', { name: 'משמרת קצרה' }));
    expect(onOpenShift).toHaveBeenCalledWith(shift);
  });

  it('renders multiple shifts for one day with distinct statuses', () => {
    const shifts = [
      createShift({ id: 'one', title: 'בוקר' }),
      createShift({ id: 'two', title: 'ערב', status: 'cancelled', cancelledAt: '2026-07-10T10:00:00+03:00' }),
    ];
    renderApp(<CalendarView mode="month" monthDate="2026-07-01" onCreateShift={jest.fn()} onModeChange={jest.fn()} onNextMonth={jest.fn()} onOpenShift={jest.fn()} onPreviousMonth={jest.fn()} onSelectDate={jest.fn()} selectedDate="2026-07-15" shifts={shifts} workplaces={[{ id: 'workplace-1', name: 'העבודה' }]} />);
    expect(screen.getByText('בוקר')).toBeTruthy();
    expect(screen.getByText('ערב')).toBeTruthy();
    expect(screen.getByText('מתוכננת')).toBeTruthy();
    expect(screen.getByText('בוטלה')).toBeTruthy();
  });

  it('labels selected-day details with the localized weekday and date', () => {
    renderApp(<CalendarView mode="month" monthDate="2026-08-01" onCreateShift={jest.fn()} onModeChange={jest.fn()} onNextMonth={jest.fn()} onOpenShift={jest.fn()} onPreviousMonth={jest.fn()} onSelectDate={jest.fn()} selectedDate="2026-08-08" shifts={[]} workplaces={[]} />);

    expect(screen.getByRole('header', { name: /שבת/ })).toBeTruthy();
  });
});
