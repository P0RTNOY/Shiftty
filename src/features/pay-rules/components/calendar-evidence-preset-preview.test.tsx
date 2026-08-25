import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { IL_CIVIL_SERVICE_INDEPENDENCE_DAY_2026_PRESET } from '@/domain/services';
import { CalendarEvidencePresetPreview } from '@/features/pay-rules/components/calendar-evidence-preset-preview';
import { renderApp } from '@/test/render';

describe('CalendarEvidencePresetPreview', () => {
  it('shows exact, versioned source details before separately confirmed application', () => {
    const onApply = jest.fn();
    renderApp(<CalendarEvidencePresetPreview preset={IL_CIVIL_SERVICE_INDEPENDENCE_DAY_2026_PRESET} onApply={onApply} />);

    const disclosure = screen.getByRole('button', { name: 'הצגת פרטי התבנית' });
    expect(disclosure.props.accessibilityState).toEqual({ expanded: false });
    expect(screen.queryByText('יום העצמאות — 2026')).toBeNull();
    fireEvent.press(disclosure);

    expect(screen.getByText('יום העצמאות — 2026')).toBeTruthy();
    const version = screen.getByText(/גרסה.*1/);
    expect(version.props.children).toContain('\u20661\u2069');
    expect(StyleSheet.flatten(screen.getByText('Asia/Jerusalem').props.style).writingDirection).toBe('ltr');
    expect(screen.getByText(IL_CIVIL_SERVICE_INDEPENDENCE_DAY_2026_PRESET.sourceTitle)).toBeTruthy();
    const apply = screen.getByRole('button', { name: 'העתקת התבנית להגדרות שלי' });
    expect(apply.props.accessibilityState).toEqual({ disabled: true });
    expect(screen.getByTestId('preset-confirmation-mark').props.children).toBe('');
    fireEvent.press(screen.getByRole('checkbox', { name: /בדקתי את הזמנים/ }));
    expect(screen.getByTestId('preset-confirmation-mark').props.children).toBe('✓');
    fireEvent.press(apply);
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
