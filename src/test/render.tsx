import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { I18nProvider } from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme';

export function renderApp(ui: ReactElement, options?: RenderOptions) {
  return render(
    <I18nProvider>
      <ThemeProvider>{ui}</ThemeProvider>
    </I18nProvider>,
    options,
  );
}
