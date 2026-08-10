import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { Workplace } from '@/domain/entities';
import { ShiftForm } from '@/features/shifts/components/shift-form';
import { renderApp } from '@/test/render';

const workplace: Workplace = {
  id: 'work-1', name: 'בית קפה', defaultHourlyRateMinor: 4_000, defaultBreakMinutes: 30,
  createdAt: '2026-07-01T10:00:00+03:00', updatedAt: '2026-07-01T10:00:00+03:00',
};

jest.mock('@/shared/components/date-field', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { TextInput } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    DateField: ({ onChange, label, value }: any) => React.createElement(TextInput, { accessibilityLabel: label, value: value?.toISOString().split('T')[0], onChangeText: (text: string) => onChange(text) }),
    TimeField: ({ onChange, label, value }: any) => React.createElement(TextInput, { accessibilityLabel: label, value: value ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}` : '', onChangeText: (text: string) => {
      const [h, m] = text.split(':').map(Number);
      const d = new Date(); d.setHours(h || 0, m || 0, 0, 0);
      onChange(d);
    } }),
  };
});

describe('ShiftForm', () => {
  const inferenceNow = new Date('2026-08-10T12:00:00+03:00');

  it('renders Hebrew labels and validates that a workplace exists', async () => {
    const onSave = jest.fn();
    renderApp(<ShiftForm mode="scheduled" workplaces={[]} onSave={onSave} />);

    expect(screen.getByLabelText('תאריך')).toBeTruthy();
    expect(screen.getByText('יש להוסיף מקום עבודה לפחות.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'שמירה' })).toBeDisabled();
  });

  it('creates a scheduled cross-midnight shift and explains the following-day end', async () => {
    const onSave = jest.fn();
    renderApp(<ShiftForm initialDate="2026-08-10" mode="scheduled" workplaces={[workplace]} onSave={onSave} />);

    fireEvent.press(screen.getByRole('radio', { name: 'בית קפה' }));
    fireEvent.changeText(screen.getByLabelText('התחלה'), '22:00');
    fireEvent.changeText(screen.getByLabelText('סיום'), '06:00');
    expect(screen.getByText('המשמרת מסתיימת ביום הבא.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({ status: 'scheduled', workplaceId: 'work-1' });
    expect(onSave.mock.calls[0][0].scheduledEnd).toContain('2026-08-11');
  });

  it('keeps recurrence controls behind advanced options', () => {
    renderApp(<ShiftForm initialDate="2026-08-10" mode="scheduled" workplaces={[workplace]} onSave={jest.fn()} />);

    expect(screen.queryByText('משמרת חוזרת')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'אפשרויות נוספות' }));
    expect(screen.getByText('משמרת חוזרת')).toBeTruthy();
  });

  it('starts a new shift with zero break minutes even when the workplace has a legacy default', () => {
    renderApp(<ShiftForm initialDate="2026-08-10" mode="scheduled" workplaces={[workplace]} onSave={jest.fn()} />);

    fireEvent.press(screen.getByRole('button', { name: 'אפשרויות נוספות' }));
    expect(screen.getByLabelText('הפסקה מתוכננת בדקות')).toHaveProp('value', '0');
  });

  it('mirrors actual times into payable values until the user edits payable time', async () => {
    const onSave = jest.fn();
    renderApp(<ShiftForm initialDate="2026-07-10" mode="completed" workplaces={[workplace]} onSave={onSave} />);

    expect(screen.queryByLabelText('התחלה')).toBeNull();
    expect(screen.queryByLabelText('שעת התחלה לדיווח')).toBeNull();
    expect(screen.queryByText('התאמות שכר למשמרת (אופציונלי)')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'אפשרויות נוספות' }));
    expect(screen.getByLabelText('התחלה')).toBeTruthy();
    expect(screen.getByText('התאמות שכר למשמרת (אופציונלי)')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'בית קפה' }));
    fireEvent.changeText(screen.getByLabelText('כניסה'), '09:15');
    await waitFor(() => expect(screen.getByLabelText('שעת התחלה לדיווח')).toHaveProp('value', '09:15'));
    fireEvent.changeText(screen.getByLabelText('שעת התחלה לדיווח'), '09:30');
    fireEvent.changeText(screen.getByLabelText('כניסה'), '09:20');
    expect(screen.getByLabelText('שעת התחלה לדיווח')).toHaveProp('value', '09:30');
  });

  it('applies an existing shift template without coupling it to salary logic', () => {
    renderApp(<ShiftForm initialDate="2026-08-10" mode="scheduled" onSave={jest.fn()} templates={[{ id: 'night', name: 'לילה', defaultStartTime: '22:00', defaultEndTime: '06:00', expectedBreakMinutes: 45, isArchived: false, workplaceId: 'work-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }]} workplaces={[workplace]} />);
    fireEvent.press(screen.getByRole('button', { name: 'אפשרויות נוספות' }));
    fireEvent.press(screen.getByRole('radio', { name: 'לילה' }));
    expect(screen.getByLabelText('התחלה')).toHaveProp('value', '22:00');
    expect(screen.getByLabelText('סיום')).toHaveProp('value', '06:00');
    expect(screen.getByLabelText('הפסקה מתוכננת בדקות')).toHaveProp('value', '45');
  });

  it('infers a past ordinary shift as completed with actual/payable values and no automatic break', async () => {
    const onSave = jest.fn();
    renderApp(<ShiftForm initialDate="2026-08-08" mode="auto" now={inferenceNow} onSave={onSave} workplaces={[workplace]} />);
    fireEvent.press(screen.getByRole('radio', { name: 'בית קפה' }));
    fireEvent.changeText(screen.getByLabelText('התחלה'), '05:30');
    fireEvent.changeText(screen.getByLabelText('סיום'), '14:00');
    fireEvent.press(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({ status: 'completed', expectedBreakMinutes: 0, actualBreakMinutes: 0, payableBreakMinutes: 0 });
    expect(onSave.mock.calls[0][0].actualStart).toContain('2026-08-08');
    expect(onSave.mock.calls[0][0].scheduledStart).toBeUndefined();
  });

  it('infers a future ordinary shift as scheduled without actual/payable timestamps', async () => {
    const onSave = jest.fn();
    renderApp(<ShiftForm initialDate="2026-08-11" mode="auto" now={inferenceNow} onSave={onSave} workplaces={[workplace]} />);
    fireEvent.press(screen.getByRole('radio', { name: 'בית קפה' }));
    fireEvent.press(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({ status: 'scheduled', expectedBreakMinutes: 0 });
    expect(onSave.mock.calls[0][0].actualStart).toBeUndefined();
    expect(onSave.mock.calls[0][0].payableStart).toBeUndefined();
  });

  it('defers an overlapping current range to the live-tracking prompt', async () => {
    const onCurrentShift = jest.fn(); const onSave = jest.fn();
    renderApp(<ShiftForm initialDate="2026-08-10" mode="auto" now={inferenceNow} onCurrentShift={onCurrentShift} onSave={onSave} workplaces={[workplace]} />);
    fireEvent.press(screen.getByRole('radio', { name: 'בית קפה' }));
    fireEvent.changeText(screen.getByLabelText('התחלה'), '11:00');
    fireEvent.changeText(screen.getByLabelText('סיום'), '13:00');
    fireEvent.press(screen.getByRole('button', { name: 'שמירה' }));

    await waitFor(() => expect(onCurrentShift).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', workplaceId: 'work-1' })));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('offers recurrence only while the inferred range is in the future', () => {
    const future = renderApp(<ShiftForm initialDate="2026-08-11" mode="auto" now={inferenceNow} onSave={jest.fn()} workplaces={[workplace]} />);
    fireEvent.press(screen.getByRole('button', { name: 'אפשרויות נוספות' }));
    expect(screen.getByText('משמרת חוזרת')).toBeTruthy();
    future.unmount();

    renderApp(<ShiftForm initialDate="2026-08-08" mode="auto" now={inferenceNow} onSave={jest.fn()} workplaces={[workplace]} />);
    fireEvent.press(screen.getByRole('button', { name: 'אפשרויות נוספות' }));
    expect(screen.queryByText('משמרת חוזרת')).toBeNull();
  });

  it('keeps a template break expected-only for future shifts and never turns it into an actual past break', async () => {
    const template = { id: 'night', name: 'לילה', defaultStartTime: '22:00', defaultEndTime: '06:00', expectedBreakMinutes: 45, isArchived: false, workplaceId: 'work-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
    const futureSave = jest.fn();
    const future = renderApp(<ShiftForm initialDate="2026-08-11" mode="auto" now={inferenceNow} onSave={futureSave} templates={[template]} workplaces={[workplace]} />);
    fireEvent.press(screen.getByRole('button', { name: 'אפשרויות נוספות' }));
    fireEvent.press(screen.getByRole('radio', { name: 'לילה' }));
    fireEvent.press(screen.getByRole('button', { name: 'שמירה' }));
    await waitFor(() => expect(futureSave).toHaveBeenCalledTimes(1));
    expect(futureSave.mock.calls[0][0]).toMatchObject({ status: 'scheduled', expectedBreakMinutes: 45 });
    expect(futureSave.mock.calls[0][0].actualBreakMinutes).toBeUndefined();
    future.unmount();

    const pastSave = jest.fn();
    renderApp(<ShiftForm initialDate="2026-08-08" mode="auto" now={inferenceNow} onSave={pastSave} templates={[template]} workplaces={[workplace]} />);
    fireEvent.press(screen.getByRole('button', { name: 'אפשרויות נוספות' }));
    fireEvent.press(screen.getByRole('radio', { name: 'לילה' }));
    fireEvent.press(screen.getByRole('button', { name: 'שמירה' }));
    await waitFor(() => expect(pastSave).toHaveBeenCalledTimes(1));
    expect(pastSave.mock.calls[0][0]).toMatchObject({ status: 'completed', expectedBreakMinutes: 0, actualBreakMinutes: 0, payableBreakMinutes: 0 });
  });
});
