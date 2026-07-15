import { fireEvent, render, screen } from '@testing-library/react-native';

import { PrimaryButton } from '@/shared/components/primary-button';
import { I18nProvider } from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme';

describe('PrimaryButton', () => {
  it('provides an accessible touch action and press feedback path', () => {
    const onPress = jest.fn();
    render(
      <I18nProvider>
        <ThemeProvider>
          <PrimaryButton label="הוספת משמרת" onPress={onPress} />
        </ThemeProvider>
      </I18nProvider>,
    );

    const button = screen.getByRole('button', { name: 'הוספת משמרת' });
    fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(button).toHaveStyle({ minHeight: 56 });
  });
});
