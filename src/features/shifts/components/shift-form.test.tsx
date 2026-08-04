import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Workplace } from '@/domain/entities';
import { ShiftForm } from '@/features/shifts/components/shift-form';
import { renderApp } from '@/test/render';

const workplace: Workplace = {
  id: 'work-1', name: 'בית קפה', defaultHourlyRateMinor: 4_000, defaultBreakMinutes: 30,
  createdAt: '2026-07-01T10:00:00+03:00', updatedAt: '2026-07-01T10:00:00+03:00',
};

describe('ShiftForm', () => {
  it('renders Hebrew labels and validates that a workplace exists', async () => {
    const onSave = jest.fn();
    renderApp(<ShiftForm mode="scheduled" workplaces={[]} onSave={onSave} />);

    expect(screen.getByLabelText('תאריך')).toBeTruthy();
    expect(screen.getByText('כדי להוסיף משמרת צריך להגדיר מקום עבודה.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'שמירה' })).toBeDisabled();
  });

  it('creates a scheduled cross-midnight shift and explains the following-day end', async () => {
    const onSave = jest.fn();
    renderApp(<ShiftForm initialDate="2026-08-10" mode="scheduled" workplaces={[workplace]} onSave={onSave} />);

    fireEvent.press(screen.getByRole('radio', { name: 'בית קפה' }));
    fireEvent.changeText(screen.getByLabelText('שעת התחלה מתוכננת'), '22:00');
    fireEvent.changeText(screen.getByLabelText('שעת סיום מתוכננת'), '06:00');
    expect(screen.getByText('המשמרת מסתיימת ביום הבא.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({ status: 'scheduled', workplaceId: 'work-1' });
    expect(onSave.mock.calls[0][0].scheduledEnd).toContain('2026-08-11');
  });

  it('mirrors actual times into payable values until the user edits payable time', async () => {
    const onSave = jest.fn();
    renderApp(<ShiftForm initialDate="2026-07-10" mode="completed" workplaces={[workplace]} onSave={onSave} />);

    fireEvent.press(screen.getByRole('radio', { name: 'בית קפה' }));
    fireEvent.changeText(screen.getByLabelText('שעת התחלה בפועל'), '09:15');
    await waitFor(() => expect(screen.getByLabelText('שעת התחלה לדיווח')).toHaveProp('value', '09:15'));
    fireEvent.changeText(screen.getByLabelText('שעת התחלה לדיווח'), '09:30');
    fireEvent.changeText(screen.getByLabelText('שעת התחלה בפועל'), '09:20');
    expect(screen.getByLabelText('שעת התחלה לדיווח')).toHaveProp('value', '09:30');
  });

  it('applies an existing shift template without coupling it to salary logic', () => {
    renderApp(<ShiftForm initialDate="2026-08-10" mode="scheduled" onSave={jest.fn()} templates={[{ id: 'night', name: 'לילה', defaultStartTime: '22:00', defaultEndTime: '06:00', expectedBreakMinutes: 45, isArchived: false, workplaceId: 'work-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }]} workplaces={[workplace]} />);
    fireEvent.press(screen.getByRole('radio', { name: 'לילה' }));
    expect(screen.getByLabelText('שעת התחלה מתוכננת')).toHaveProp('value', '22:00');
    expect(screen.getByLabelText('שעת סיום מתוכננת')).toHaveProp('value', '06:00');
    expect(screen.getByLabelText('הפסקה מתוכננת בדקות')).toHaveProp('value', '45');
  });
});
