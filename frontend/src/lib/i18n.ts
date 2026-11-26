'use client';

import { useState, useEffect, useCallback } from 'react';
import en from '@/locales/en.json';
import es from '@/locales/es.json';
import pt from '@/locales/pt.json';

export type SupportedLocale = 'en' | 'es' | 'pt';

export const SUPPORTED_LOCALES: { code: SupportedLocale; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
];

const dictionaries: Record<SupportedLocale, any> = {
  en,
  es,
  pt,
};

export const STORAGE_KEY_LOCALE = 'trustpay_locale';

export function detectBrowserLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LOCALE) as SupportedLocale | null;
    if (saved && ['en', 'es', 'pt'].includes(saved)) {
      return saved;
    }
    const navLang = (navigator.language || (navigator as any).userLanguage || 'en').toLowerCase();
    if (navLang.startsWith('es')) return 'es';
    if (navLang.startsWith('pt')) return 'pt';
    return 'en';
  } catch {
    return 'en';
  }
}

export function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export function translate(key: string, locale: SupportedLocale = 'en', params?: Record<string, string | number>): string {
  const currentDict = dictionaries[locale] || dictionaries.en;
  let text = getNestedValue(currentDict, key);

  // Fallback to English if not found
  if (text === undefined && locale !== 'en') {
    text = getNestedValue(dictionaries.en, key);
  }

  // Fallback to key itself if not found anywhere
  if (text === undefined) {
    return key;
  }

  if (params) {
    Object.entries(params).forEach(([paramKey, val]) => {
      text = text!.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
    });
  }

  return text;
}

export function formatTokenAmount(amount: number | bigint | string, locale: SupportedLocale = 'en', tokenSymbol?: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) return `0 ${tokenSymbol || ''}`.trim();

  const localeMap: Record<SupportedLocale, string> = {
    en: 'en-US',
    es: 'es-ES',
    pt: 'pt-BR',
  };

  const formatted = new Intl.NumberFormat(localeMap[locale] || 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  }).format(num);

  return tokenSymbol ? `${formatted} ${tokenSymbol}` : formatted;
}

export function formatDate(dateInput: string | number | Date, locale: SupportedLocale = 'en', options?: Intl.DateTimeFormatOptions): string {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    const localeMap: Record<SupportedLocale, string> = {
      en: 'en-US',
      es: 'es-ES',
      pt: 'pt-BR',
    };

    const defaultOptions: Intl.DateTimeFormatOptions = options || {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };

    return new Intl.DateTimeFormat(localeMap[locale] || 'en-US', defaultOptions).format(d);
  } catch {
    return String(dateInput);
  }
}

// React Hook for internationalization
export function useI18n() {
  const [locale, setLocaleState] = useState<SupportedLocale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const initial = detectBrowserLocale();
    setLocaleState(initial);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = initial;
    }

    const handleStorageChange = () => {
      const next = detectBrowserLocale();
      setLocaleState(next);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = next;
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('trustpay-locale-change', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('trustpay-locale-change', handleStorageChange);
    };
  }, []);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
    }
    try {
      localStorage.setItem(STORAGE_KEY_LOCALE, newLocale);
      window.dispatchEvent(new Event('trustpay-locale-change'));
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(key, locale, params),
    [locale]
  );

  return {
    locale,
    setLocale,
    t,
    formatAmount: (amount: number | string, token?: string) => formatTokenAmount(amount, locale, token),
    formatDate: (date: string | number | Date, options?: Intl.DateTimeFormatOptions) => formatDate(date, locale, options),
    isMounted: mounted,
    supportedLocales: SUPPORTED_LOCALES,
  };
}
