import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import translationDE from '../locales/de/translation.json';
import translationEN from '../locales/en/translation.json';

const resources = {
  de: {
    translation: translationDE,
  },
  en: {
    translation: translationEN,
  },
};

// Browsersprache ermitteln oder aus localStorage laden
const getBrowserLanguage = (): string => {
  const savedLanguage = localStorage.getItem('language');
  if (savedLanguage && ['de', 'en'].includes(savedLanguage)) {
    return savedLanguage;
  }

  const browserLang = navigator.language.split('-')[0];
  return ['de', 'en'].includes(browserLang) ? browserLang : 'de';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getBrowserLanguage(),
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false,
    },
  });

// Sprache im localStorage speichern bei Änderung
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
});

export default i18n;
