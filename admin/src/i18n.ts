import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import viTranslations from './locales/vi.json';
import enTranslations from './locales/en.json';

const resources = {
  vi: { translation: viTranslations },
  en: { translation: enTranslations },
};

// Get saved language preference from localStorage, default to 'vi'
const getSavedLanguage = () => {
  return localStorage.getItem('language') || 'vi';
};

i18next
  .use(initReactI18next)
  .init({
    resources,
    lng: getSavedLanguage(),
    fallbackLng: 'vi',
    interpolation: {
      escapeValue: false, // React already escapes content
    },
    ns: ['translation'],
    defaultNS: 'translation',
  });

// Save language preference to localStorage whenever it changes
i18next.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
});

export default i18next;
