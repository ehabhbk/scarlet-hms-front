import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { formatNumber } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'

export function Pagination({
  page,
  lastPage,
  total,
  from,
  to,
  onChange,
}: {
  page: number
  lastPage: number
  total: number
  from: number | null
  to: number | null
  onChange: (page: number) => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isRtl = locale === 'ar'

  if (total === 0) return null

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row">
      <p className="text-xs text-ink-muted">
        {t('common.showing')} <span className="font-bold text-ink">{formatNumber(from ?? 0, locale)}</span>–
        <span className="font-bold text-ink">{formatNumber(to ?? 0, locale)}</span> {t('common.of')}{' '}
        <span className="font-bold text-ink">{formatNumber(total, locale)}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label={t('common.previous')}
        >
          {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          <span className="hidden sm:inline">{t('common.previous')}</span>
        </Button>
        <span className="px-2 text-xs font-semibold text-ink-muted">
          {formatNumber(page, locale)} / {formatNumber(lastPage, locale)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= lastPage}
          aria-label={t('common.next')}
        >
          <span className="hidden sm:inline">{t('common.next')}</span>
          {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
