import { useTranslation } from 'react-i18next'
import type { Locale } from '@/lib/types'

export function useLocale(): Locale {
  const { i18n } = useTranslation()
  return i18n.language.startsWith('en') ? 'en' : 'ar'
}

export function useIsRtl(): boolean {
  return useLocale() === 'ar'
}

export function useFormatLocale(): string {
  return useLocale() === 'ar' ? 'ar-SD-u-nu-latn' : 'en-GB'
}
