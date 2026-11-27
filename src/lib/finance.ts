import { useMeta } from '@/hooks/useMeta'
import { useLocale } from '@/hooks/useLocale'
import { formatDate, formatNumber } from '@/lib/format'
import type { AccountType, Locale } from '@/lib/types'

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: 'أصل',
  liability: 'التزام',
  equity: 'حقوق ملكية',
  revenue: 'إيراد',
  expense: 'مصروف',
}

export const ACCOUNT_TYPE_ORDER: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']

export function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPE_LABELS[type as AccountType] ?? type
}

export function financeDate(value: string | Date | null | undefined, locale: Locale): string {
  return formatDate(value, locale)
}

export function financeMoney(value: unknown, locale: Locale, currency: string): string {
  const amount = Number(value) || 0
  return currency ? `${formatNumber(amount, locale)} ${currency}` : formatNumber(amount, locale)
}

export function financeNumber(value: unknown, locale: Locale): string {
  return formatNumber(Number(value) || 0, locale)
}

export function periodLabel(from: string, to: string): string {
  if (from && to) return `من ${from} إلى ${to}`
  if (from) return `من ${from}`
  if (to) return `حتى ${to}`
  return 'جميع الفترات'
}

export function useFinance() {
  const locale = useLocale()
  const { data: meta } = useMeta()
  const settings = meta?.settings ?? []

  const settingValue = (key: string): string => {
    const setting = settings.find((item) => item.key === key)
    if (!setting) return ''
    return typeof setting.value === 'string' || typeof setting.value === 'number'
      ? String(setting.value)
      : ''
  }

  const currency = settingValue('currency') || 'SDG'
  const organization = {
    name:
      (locale === 'ar' ? settingValue('hospital_name_ar') : settingValue('hospital_name_en')) ||
      settingValue('hospital_name_ar') ||
      (locale === 'ar' ? 'مستشفى سكارلت العام' : 'Scarlet General Hospital'),
    address:
      (locale === 'ar' ? settingValue('hospital_address_ar') : settingValue('hospital_address_en')) ||
      settingValue('hospital_address_ar'),
    phone: settingValue('hospital_phone'),
  }

  return {
    locale,
    currency,
    organization,
    money: (value: unknown) => financeMoney(value, locale, currency),
    number: (value: unknown) => financeNumber(value, locale),
    date: (value: string | Date | null | undefined) => financeDate(value, locale),
  }
}
