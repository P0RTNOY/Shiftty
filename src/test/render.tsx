import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { I18nProvider, type SupportedLocale } from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme';

interface AppRenderOptions extends RenderOptions {
  locale?: SupportedLocale;
}

export function renderApp(ui: ReactElement, options?: AppRenderOptions) {
  const { locale = 'he', ...renderOptions } = options ?? {};
  return render(
    <I18nProvider initialLocale={locale}>
      <ThemeProvider>{ui}</ThemeProvider>
    </I18nProvider>,
    renderOptions,
  );
}
