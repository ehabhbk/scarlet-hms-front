import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Compass } from 'lucide-react'
import { BrandMark } from '@/components/brand/Brand'
import { useLocale } from '@/hooks/useLocale'

export function NotFoundPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-muted px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-soft ring-1 ring-line">
        <BrandMark className="h-11 w-auto" />
      </span>
      <p className="mt-6 text-7xl font-black tracking-tight text-scarlet-900">404</p>
      <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink-muted">
        <Compass className="h-4 w-4" />
        {t('errors.notFound')}
      </p>
      <Link
        to="/dashboard"
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-scarlet-800 px-4 text-sm font-semibold text-white transition hover:bg-scarlet-900"
      >
        {t('nav.dashboard')}
        <Arrow className="h-4 w-4" />
      </Link>
      <p className="mt-8 text-[11px] text-ink-subtle">Scarlet Care · Scarlet HMS</p>
    </div>
  )
}
