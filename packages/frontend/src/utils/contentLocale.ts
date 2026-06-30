import type { i18n as I18nInstance } from 'i18next';

const STORAGE_KEY = 'i18nextLng';

/** Normalize to UI locale codes used by i18next */
export function normalizeUiLocale(locale?: string | null): string {
  if (!locale) return 'en';
  return locale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

/** Locale string for UGC translation API (matches backend resolveRequestLocale). */
export function getContentLocale(): string {
  if (typeof window === 'undefined') return 'en';

  const urlLocale = new URLSearchParams(window.location.search).get('locale');
  if (urlLocale) return normalizeUiLocale(urlLocale);

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored?.startsWith('zh')) return 'zh-CN';
  return stored || 'en';
}

export function persistUiLocale(locale: string, i18n: I18nInstance): void {
  const lng = normalizeUiLocale(locale);
  if (!i18n.language.startsWith(lng === 'zh-CN' ? 'zh' : 'en')) {
    i18n.changeLanguage(lng);
  }
  localStorage.setItem(STORAGE_KEY, lng);
}

export function withContentLocale<T extends Record<string, unknown>>(params?: T): T & { locale: string } {
  return { ...(params ?? ({} as T)), locale: getContentLocale() };
}

export function appendLocaleToPath(path: string, locale?: string): string {
  const lng = normalizeUiLocale(locale ?? getContentLocale());
  const hashIndex = path.indexOf('#');
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : '';
  const base = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}locale=${encodeURIComponent(lng)}${hash}`;
}
