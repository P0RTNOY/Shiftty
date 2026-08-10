import { fireEvent, screen } from '@testing-library/react-native';
import { ActiveShiftPanel } from '@/features/shifts/components/active-shift-panel';
import { renderApp } from '@/test/render';
import { createBreak, createShift } from '@/test/fixtures';

describe('ActiveShiftPanel', () => {
  const shift = createShift({ status: 'active', actualStart: '2026-07-15T13:00:00+03:00', expectedEnd: '2026-07-15T22:00:00+03:00', activeOrigin: 'scheduled' });

  it('renders timestamp-derived Hebrew live metrics and accessible actions', () => {
    const onStartBreak = jest.fn();
    renderApp(<ActiveShiftPanel breaks={[]} now={new Date('2026-07-15T17:00:00+03:00')} onEndShift={jest.fn()} onManageBreaks={jest.fn()} onOpenDetails={jest.fn()} onStartBreak={onStartBreak} shift={shift} workplaceName="קפה העיר" />);
    expect(screen.getByText('משמרת פעילה')).toBeTruthy();
    expect(screen.getByText('עובדים')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'הפסקה' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'יציאה' })).toBeTruthy();
    expect(screen.queryByText('הפסקות ללא תשלום')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'הפסקה' }));
    expect(onStartBreak).toHaveBeenCalledWith(false);
  });

  it('shows the running break and only offers returning from it', () => {
    const onEndBreak = jest.fn();
    renderApp(<ActiveShiftPanel breaks={[createBreak({ end: undefined, start: '2026-07-15T16:52:00+03:00' })]} now={new Date('2026-07-15T17:00:00+03:00')} onEndBreak={onEndBreak} onEndShift={jest.fn()} onManageBreaks={jest.fn()} onOpenDetails={jest.fn()} onStartBreak={jest.fn()} shift={shift} workplaceName="קפה העיר" />);
    expect(screen.getByText('בהפסקה')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'חזרה לעבודה' }));
    expect(onEndBreak).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'הפסקה' })).toBeNull();
  });
});
