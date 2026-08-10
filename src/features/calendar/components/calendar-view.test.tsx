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
    fireEvent.press(screen.getByRole('button', { name: 'הוספת משמרת עתידית' }));
    expect(onCreateShift).toHaveBeenCalledWith('2026-07-15');
  });

  it.each(['week', 'agenda'] as const)('keeps contextual shift creation available in %s mode', (mode) => {
    const onCreateShift = jest.fn();
    renderApp(<CalendarView mode={mode} monthDate="2026-07-01" onCreateShift={onCreateShift} onModeChange={jest.fn()} onNextMonth={jest.fn()} onOpenShift={jest.fn()} onPreviousMonth={jest.fn()} onSelectDate={jest.fn()} selectedDate="2026-07-15" shifts={[]} workplaces={[]} />);

    fireEvent.press(screen.getByRole('button', { name: 'הוספת משמרת עתידית' }));
    expect(onCreateShift).toHaveBeenCalledWith('2026-07-15');
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
});
