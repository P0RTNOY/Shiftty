import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { I18nManager, Platform } from 'react-native';

import { en, he, type TranslationKey } from '@/shared/i18n/translations';

export type SupportedLocale = 'he' | 'en';

interface I18nValue {
  locale: SupportedLocale;
  isRtl: boolean;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: TranslationKey) => string;
  formatCurrency: (minorUnits: number, currency?: string) => string;
  formatDate: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<SupportedLocale>('he');
  const isRtl = locale === 'he';

  const value = useMemo<I18nValue>(() => {
    const intlLocale = locale === 'he' ? 'he-IL' : 'en-US';
    const messages = locale === 'he' ? he : en;

    return {
      locale,
      isRtl,
      setLocale(nextLocale) {
        configureNativeRtl(nextLocale);
        setLocaleState(nextLocale);
      },
      t: (key) => messages[key],
      formatCurrency: (minorUnits, currency = 'ILS') =>
        new Intl.NumberFormat(intlLocale, {
          style: 'currency',
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(minorUnits / 100),
      formatDate: (input, options) =>
        new Intl.DateTimeFormat(intlLocale, options).format(
          typeof input === 'string' ? new Date(input) : input,
        ),
    };
  }, [isRtl, locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useTranslation must be used within I18nProvider.');
  }
  return value;
}

export function configureNativeRtl(locale: SupportedLocale): boolean {
  const shouldUseRtl = locale === 'he';
  I18nManager.allowRTL(true);

  if (Platform.OS !== 'web' && I18nManager.isRTL !== shouldUseRtl) {
    I18nManager.forceRTL(shouldUseRtl);
    return true;
  }

  return false;
}
