import { fireEvent, screen } from '@testing-library/react-native';
import { Alert, Pressable, Text } from 'react-native';

import { ShiftActions } from '@/features/shifts/components/shift-actions';
import { useTranslation } from '@/shared/i18n';
import { createShift } from '@/test/fixtures';
import { renderApp } from '@/test/render';

const actions = () => ({
  onCancel: jest.fn(), onCancelTracking: jest.fn(), onDelete: jest.fn(), onDuplicate: jest.fn(),
  onEdit: jest.fn(), onManageBreaks: jest.fn(), onMarkMissed: jest.fn(), onRestore: jest.fn(), onStart: jest.fn(),
});

function LocaleButton() {
  const { setLocale } = useTranslation();
  return <Pressable accessibilityRole="button" onPress={() => setLocale('en')}><Text>English</Text></Pressable>;
}

describe('ShiftActions', () => {
  it('keeps scheduled primary actions visible and secondary/destructive actions in one menu', () => {
    const callbacks = actions();
    renderApp(<ShiftActions {...callbacks} now={new Date('2026-07-16T12:00:00+03:00')} shift={createShift()} />);
    expect(screen.getByRole('button', { name: 'התחלת המשמרת' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'עריכה' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'מחיקה' })).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'פעולות נוספות' }));
    expect(screen.getByRole('button', { name: 'שכפול' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'סימון כלא בוצעה' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'מחיקה' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'שחזור כמתוכננת' })).toBeNull();
  });

  it('shows the active-shift action matrix without a destructive delete', () => {
    renderApp(<ShiftActions {...actions()} shift={createShift({ status: 'active', actualStart: '2026-07-15T13:30:00+03:00' })} />);
    expect(screen.getByRole('button', { name: 'סיום משמרת' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'פעולות נוספות' }));
    expect(screen.getByRole('button', { name: 'ניהול היסטוריית הפסקות' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ביטול המעקב' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'מחיקה' })).toBeNull();
  });

  it('requires confirmation before permanent deletion', () => {
    const callbacks = actions();
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _body, buttons) => buttons?.[1]?.onPress?.());
    renderApp(<ShiftActions {...callbacks} shift={createShift()} />);
    fireEvent.press(screen.getByRole('button', { name: 'פעולות נוספות' }));
    fireEvent.press(screen.getByRole('button', { name: 'מחיקה' }));
    expect(callbacks.onDelete).toHaveBeenCalledTimes(1);
  });

  it('keeps the primary and overflow action hierarchy usable in English', () => {
    renderApp(<>
      <LocaleButton />
      <ShiftActions {...actions()} now={new Date('2026-07-16T12:00:00+03:00')} shift={createShift()} />
    </>);

    fireEvent.press(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('button', { name: 'Start shift' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });
});
