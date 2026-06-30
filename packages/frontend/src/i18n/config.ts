import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslations from './en.json';
import zhCNTranslations from './zh-CN.json';

function getInitialLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('locale');
  if (fromUrl?.toLowerCase().startsWith('zh')) return 'zh-CN';
  if (fromUrl) return 'en';
  const saved = localStorage.getItem('i18nextLng');
  if (saved?.startsWith('zh')) return 'zh-CN';
  if (saved) return saved;
  return 'en';
}

// Initialize i18next
i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    resources: {
      en: {
        translation: enTranslations,
      },
      'zh-CN': {
        translation: zhCNTranslations,
      },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // Only use explicit user choice (LanguageSwitcher); do not auto-detect browser locale
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

export default i18n;
