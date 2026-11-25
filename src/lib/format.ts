import { format, parseISO } from 'date-fns'
import { ar as arDate, enUS } from 'date-fns/locale'
import type { Locale } from './types'

type EntityWithNames = {
  name_ar?: string
  name_en?: string
  name?: string
}

export function nameOf(entity: EntityWithNames | null | undefined, locale: Locale): string {
  if (!entity) return '—'
  return (locale === 'ar' ? entity.name_ar : entity.name_en) || entity.name || entity.name_en || entity.name_ar || '—'
}

const intlLocale = (locale: Locale) => (locale === 'ar' ? 'ar-SD-u-nu-latn' : 'en-GB')

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  try {
    return parseISO(value)
  } catch {
    return null
  }
}

export function formatDate(value: string | Date | null | undefined, locale: Locale, withTime = false): string {
  const date = toDate(value)
  if (!date) return '—'

  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime
      ? {
          hour: 'numeric',
          minute: '2-digit',
        }
      : {}),
  }).format(date)
}

export function formatTime(value: string | Date | null | undefined, locale: Locale): string {
  const date = toDate(value)
  if (!date) return '—'

  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatDateTime(value: string | Date | null | undefined, locale: Locale): string {
  return formatDate(value, locale, true)
}

export function formatRelative(value: string | Date | null | undefined, locale: Locale): string {
  const date = toDate(value)
  if (!date) return '—'

  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60000)
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' })

  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute')

  const hours = Math.round(diffMinutes / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')

  const days = Math.round(hours / 24)
  if (Math.abs(days) < 31) return rtf.format(days, 'day')

  return formatDate(date, locale)
}

export function formatDayLabel(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

export function toDateInput(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, 'yyyy-MM-dd') : ''
}

export function toDateTimeInput(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? format(date, "yyyy-MM-dd'T'HH:mm") : ''
}

export function todayInput(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function startOfTodayInput(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function patientDisplayName(
  patient: { first_name_ar?: string | null; last_name_ar?: string | null; first_name_en?: string | null; last_name_en?: string | null; display_name?: string | null } | null | undefined,
  locale: Locale,
): string {
  if (!patient) return '—'

  if (locale === 'ar') {
    return `${patient.first_name_ar ?? ''} ${patient.last_name_ar ?? ''}`.trim() || patient.display_name || '—'
  }

  return (
    `${patient.first_name_en ?? patient.first_name_ar ?? ''} ${patient.last_name_en ?? patient.last_name_ar ?? ''}`.trim() ||
    patient.display_name ||
    '—'
  )
}

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value)
}

export function dateFnsLocale(locale: Locale) {
  return locale === 'ar' ? arDate : enUS
}

export function ageLabel(age: number | null | undefined): string {
  return age === null || age === undefined ? '—' : String(age)
}
