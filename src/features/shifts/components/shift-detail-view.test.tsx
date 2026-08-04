import { Alert } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { ShiftDetailView } from '@/features/shifts/components/shift-detail-view';
import { createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

describe('ShiftDetailView', () => {
  it('shows separate ranges and only valid scheduled-shift actions', () => {
    renderApp(<ShiftDetailView now={new Date('2026-07-16T12:00:00+03:00')} onCancel={jest.fn()} onDelete={jest.fn()} onDuplicate={jest.fn()} onEdit={jest.fn()} onMarkMissed={jest.fn()} onRestore={jest.fn()} shift={createShift()} workplaceName="בית קפה" />);
    expect(screen.getByText('מתוכנן')).toBeTruthy();
    expect(screen.getByText('בפועל')).toBeTruthy();
    expect(screen.getByText('לדיווח')).toBeTruthy();
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
