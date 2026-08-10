import { Alert } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { ShiftDetailView } from '@/features/shifts/components/shift-detail-view';
import { createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

describe('ShiftDetailView', () => {
  it('shows a simple completed summary and discloses the full comparison on request', () => {
    const shift = createShift({
      status: 'completed',
      actualStart: '2026-07-15T13:30:00+03:00',
      actualEnd: '2026-07-15T21:30:00+03:00',
      payableStart: '2026-07-15T13:30:00+03:00',
      payableEnd: '2026-07-15T21:30:00+03:00',
      actualBreakMinutes: 30,
      payableBreakMinutes: 30,
      payableSource: 'actual',
      completedAt: '2026-07-15T21:30:00+03:00',
    });
    renderApp(<ShiftDetailView onCancel={jest.fn()} onDelete={jest.fn()} onDuplicate={jest.fn()} onEdit={jest.fn()} onMarkMissed={jest.fn()} onRestore={jest.fn()} shift={shift} workplaceName="בית קפה" />);

    expect(screen.getByText('כניסה')).toBeTruthy();
    expect(screen.getByText('יציאה')).toBeTruthy();
    expect(screen.getByText('סה״כ')).toBeTruthy();
    expect(screen.getByText('הפסקה')).toBeTruthy();
    expect(screen.getByText('בית קפה')).toBeTruthy();
    expect(screen.queryByText('מתוכנן')).toBeNull();
    expect(screen.queryByText('לדיווח')).toBeNull();
    expect(screen.queryByText(/^נוצרה:/)).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'פרטים נוספים' }));
    expect(screen.getByText('מתוכנן')).toBeTruthy();
    expect(screen.getByText('לדיווח')).toBeTruthy();
    expect(screen.getByText(/^נוצרה:/)).toBeTruthy();
    expect(screen.getByText(/^עודכנה:/)).toBeTruthy();
  });

  it('surfaces reporting hours only when they differ from actual hours', () => {
    const shift = createShift({
      status: 'completed',
      actualStart: '2026-07-15T13:30:00+03:00',
      actualEnd: '2026-07-15T21:30:00+03:00',
      payableStart: '2026-07-15T14:00:00+03:00',
      payableEnd: '2026-07-15T21:00:00+03:00',
      actualBreakMinutes: 30,
      payableBreakMinutes: 20,
      payableSource: 'manual',
      completedAt: '2026-07-15T21:30:00+03:00',
    });
    renderApp(<ShiftDetailView onCancel={jest.fn()} onDelete={jest.fn()} onDuplicate={jest.fn()} onEdit={jest.fn()} onMarkMissed={jest.fn()} onRestore={jest.fn()} shift={shift} workplaceName="בית קפה" />);

    expect(screen.getByText('שעות לדיווח')).toBeTruthy();
  });

  it('shows only valid scheduled-shift actions', () => {
    renderApp(<ShiftDetailView now={new Date('2026-07-16T12:00:00+03:00')} onCancel={jest.fn()} onDelete={jest.fn()} onDuplicate={jest.fn()} onEdit={jest.fn()} onMarkMissed={jest.fn()} onRestore={jest.fn()} shift={createShift()} workplaceName="בית קפה" />);
    expect(screen.getByRole('button', { name: 'סימון כלא בוצעה' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'שחזור כמתוכננת' })).toBeNull();
  });

  it('requires confirmation before permanent deletion', () => {
    const onDelete = jest.fn();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => buttons?.[1]?.onPress?.());
    renderApp(<ShiftDetailView onCancel={jest.fn()} onDelete={onDelete} onDuplicate={jest.fn()} onEdit={jest.fn()} onMarkMissed={jest.fn()} onRestore={jest.fn()} shift={createShift()} workplaceName="בית קפה" />);
    fireEvent.press(screen.getByRole('button', { name: 'מחיקה' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
