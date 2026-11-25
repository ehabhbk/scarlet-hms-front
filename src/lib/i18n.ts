import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Locale } from './types'
import { ar } from '@/locales/ar'
import { en } from '@/locales/en'

export const LOCALE_KEY = 'scarlet_locale'

export function readStoredLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_KEY)
  return stored === 'en' ? 'en' : 'ar'
}

export function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
}

const initialLocale = readStoredLocale()

void i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: initialLocale,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
})

applyDocumentLocale(initialLocale)

export function changeAppLocale(locale: Locale) {
  localStorage.setItem(LOCALE_KEY, locale)
  applyDocumentLocale(locale)
  void i18n.changeLanguage(locale)
}

export function currentLocale(): Locale {
  return i18n.language.startsWith('en') ? 'en' : 'ar'
}

export default i18n
