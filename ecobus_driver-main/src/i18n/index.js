import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import en from './locales/en.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';

export const SUPPORTED_LANGUAGES = ['en', 'fr', 'ar'];
export const RTL_LANGUAGES = ['ar'];
export const LOCALE_STORAGE_KEY = '@ecobus-driver/locale';
const STORAGE_KEY = LOCALE_STORAGE_KEY;

function detectInitial(stored) {
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  const device = (Localization.getLocales?.()[0]?.languageCode) || 'fr';
  return SUPPORTED_LANGUAGES.includes(device) ? device : 'fr';
}

export async function setupI18n() {
  let stored = null;
  try { stored = await AsyncStorage.getItem(STORAGE_KEY); } catch {}
  const lng = detectInitial(stored);

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      ar: { translation: ar },
    },
    lng,
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    compatibilityJSON: 'v4',
  });

  const shouldRTL = RTL_LANGUAGES.includes(lng);
  if (I18nManager.isRTL !== shouldRTL) {
    try {
      I18nManager.allowRTL(shouldRTL);
      I18nManager.forceRTL(shouldRTL);
    } catch {}
  }
  return i18n;
}

export async function changeLanguage(lng) {
  if (!SUPPORTED_LANGUAGES.includes(lng)) return;
  await i18n.changeLanguage(lng);
  try { await AsyncStorage.setItem(STORAGE_KEY, lng); } catch {}
}

export default i18n;
