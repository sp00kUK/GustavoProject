import { createContext, useContext } from 'react';
import { en, type Dictionary, type TranslationKey } from './en';
import { es } from './es';

export type Locale = 'en' | 'es';

export const LOCALES: Array<{ id: Locale; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

const DICTIONARIES: Record<Locale, Dictionary> = { en, es };

export type Translate = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

export function createTranslator(locale: Locale): Translate {
  const dictionary = DICTIONARIES[locale] ?? en;
  return (key, vars) => {
    const template = dictionary[key] ?? en[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}

/** Best-effort match of the browser's language to a locale we ship. */
export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag?.toLowerCase().split('-')[0];
    if (base === 'es') return 'es';
    if (base === 'en') return 'en';
  }
  return 'en';
}

export interface I18nValue {
  locale: Locale;
  t: Translate;
  /** Locale-aware number formatting - Spanish uses a comma decimal separator. */
  n: (value: number, decimals?: number) => string;
}

export const I18nContext = createContext<I18nValue>({
  locale: 'en',
  t: createTranslator('en'),
  n: (value, decimals = 2) => value.toFixed(decimals),
});

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export function createI18n(locale: Locale): I18nValue {
  const formatters = new Map<number, Intl.NumberFormat>();
  const tag = locale === 'es' ? 'es-ES' : 'en-GB';
  return {
    locale,
    t: createTranslator(locale),
    n: (value, decimals = 2) => {
      if (!Number.isFinite(value)) return '—';
      let formatter = formatters.get(decimals);
      if (!formatter) {
        formatter = new Intl.NumberFormat(tag, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
        formatters.set(decimals, formatter);
      }
      return formatter.format(value);
    },
  };
}

export type { TranslationKey, Dictionary };
