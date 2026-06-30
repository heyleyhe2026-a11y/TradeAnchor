import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { tokenStorage } from '../store/authApi';
import { useGetPreferencesQuery } from '../store/preferencesApi';
import { getContentLocale, normalizeUiLocale, persistUiLocale } from '../utils/contentLocale';

/**
 * Keeps UI + UGC locale in sync across full page loads and new tabs.
 * Priority: /zh route → ?locale= URL → localStorage → server preferences → default en
 */
export default function ContentLocaleInit() {
  const { i18n } = useTranslation();
  const { pathname, search } = useLocation();
  const isLoggedIn = !!tokenStorage.getAccessToken();
  const { data: prefs } = useGetPreferencesQuery(undefined, { skip: !isLoggedIn });

  useEffect(() => {
    if (pathname === '/zh' || pathname.startsWith('/zh/')) {
      persistUiLocale('zh-CN', i18n);
      return;
    }

    const urlLocale = new URLSearchParams(search).get('locale');
    if (urlLocale) {
      persistUiLocale(normalizeUiLocale(urlLocale), i18n);
      return;
    }

    const saved = localStorage.getItem('i18nextLng');
    if (saved) {
      persistUiLocale(normalizeUiLocale(saved), i18n);
      return;
    }

    if (prefs?.locale) {
      persistUiLocale(normalizeUiLocale(prefs.locale), i18n);
      return;
    }

    persistUiLocale(getContentLocale(), i18n);
  }, [pathname, search, prefs?.locale, i18n]);

  return null;
}
