import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import viTranslations from './locales/vi.json';
import enTranslations from './locales/en.json';

const getSavedLanguage = () => {
  return localStorage.getItem('language') || 'vi';
};

i18next
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: viTranslations },
      en: { translation: enTranslations },
    },
    lng: getSavedLanguage(),
    fallbackLng: 'vi',
    interpolation: {
      escapeValue: false,
    },
    ns: ['translation'],
    defaultNS: 'translation',
    react: {
      useSuspense: true,
    },
  });

i18next.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
});

export default i18next;
