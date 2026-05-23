import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Only English ships in the initial bundle. Other locales are lazy-loaded
// on demand via ensureLanguage() (called by LanguageSwitcher before switching).
import en from './locales/en.json';

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'ja';

const localeLoaders: Record<Exclude<SupportedLanguage, 'en'>, () => Promise<{ default: Record<string, unknown> }>> = {
  es: () => import('./locales/es.json'),
  fr: () => import('./locales/fr.json'),
  ja: () => import('./locales/ja.json'),
};

const loadedLanguages = new Set<string>(['en']);

/** Lazy-load a translation bundle on demand and register it with i18next. */
export async function ensureLanguage(lang: SupportedLanguage): Promise<void> {
  if (loadedLanguages.has(lang)) return;
  const loader = localeLoaders[lang as Exclude<SupportedLanguage, 'en'>];
  if (!loader) return;
  const mod = await loader();
  i18n.addResourceBundle(lang, 'translation', mod.default, true, true);
  loadedLanguages.add(lang);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    fallbackLng: 'en',
    // English is the only bundle initially; others load on switch via ensureLanguage().
    // partialBundledLanguages tells i18next not to warn about missing pre-bundled resources.
    partialBundledLanguages: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })
  .then(() => {
    // If a non-English language was detected/persisted at boot, fetch its bundle now.
    const detected = i18n.language?.split('-')[0] as SupportedLanguage | undefined;
    if (detected && detected !== 'en' && detected in localeLoaders) {
      void ensureLanguage(detected);
    }
  });

export default i18n;
