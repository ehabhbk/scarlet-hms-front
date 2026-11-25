import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Eye, Filter, ScrollText, Search, ShieldCheck, X } from 'lucide-react'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { api } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, AuditLog } from '@/lib/types'
import { formatDateTime, formatNumber } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const eventOptions = [
  { value: 'auth', labelKey: 'audit.login' },
  { value: 'created', labelKey: 'audit.created' },
  { value: 'updated', labelKey: 'audit.updated' },
  { value: 'deleted', labelKey: 'audit.deleted' },
  { value: 'viewed', labelKey: 'audit.viewed' },
]

function eventTone(event: string) {
  if (event.includes('deleted') || event.includes('fail') || event.includes('denied')) return 'danger' as const
  if (event.includes('created') || event.includes('login')) return 'success' as const
  if (event.includes('updated') || event.includes('changed')) return 'warning' as const
  if (event.includes('viewed')) return 'info' as const
  return 'neutral' as const
}

export function AuditPage() {
  const { t } = useTranslation()
  const locale = useLocale()

  const [search, setSearch] = useState('')
  const [event, setEvent] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<AuditLog | null>(null)
  const debouncedSearch = useDebouncedValue(search.trim(), 350)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, event, from, to])

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { page, search: debouncedSearch, event, from, to }],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<AuditLog[]>>('/audit-logs', {
        params: {
          page,
          per_page: 30,
          search: debouncedSearch || undefined,
          event: event || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
    placeholderData: (previous) => previous,
  })

  const pagination = data?.meta?.pagination
  const hasFilters = Boolean(search || event || from || to)

  const clearFilters = () => {
    setSearch('')
    setEvent('')
    setFrom('')
    setTo('')
  }

  return (
    <div>
      <PageHeader
        title={t('audit.title')}
        subtitle={t('audit.subtitle')}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1.5 text-[11px] font-bold text-success-700 ring-1 ring-inset ring-success-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('audit.subtitle')}
          </span>
        }
      />

      <div className="card mb-4 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(event_) => setSearch(event_.target.value)}
              placeholder={t('audit.searchPlaceholder')}
              className="field h-10 ps-9"
              aria-label={t('common.search')}
            />
          </div>
          <Select value={event} onChange={(event_) => setEvent(event_.target.value)} className="h-10">
            <option value="">{t('audit.allEvents')}</option>
            {eventOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={from}
            onChange={(event_) => setFrom(event_.target.value)}
            className="h-10"
            aria-label={t('audit.dateFrom')}
            title={t('audit.dateFrom')}
          />
          <Input
            type="date"
            value={to}
            onChange={(event_) => setTo(event_.target.value)}
            className="h-10"
            aria-label={t('audit.dateTo')}
            title={t('audit.dateTo')}
          />
          <Button variant="outline" onClick={clearFilters} disabled={!hasFilters} className="h-10">
            <X className="h-4 w-4" />
            {t('common.cancel')}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-subtle">
          <span className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            {hasFilters ? t('common.filters') : t('common.all')}
          </span>
          {pagination ? (
            <span>
              {formatNumber(pagination.total, locale)} {t('audit.event')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="table-shell">
        {isLoading ? (
          <TableSkeleton rows={10} />
        ) : data?.rows.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('audit.event')}</th>
                  <th>{t('audit.user')}</th>
                  <th>{t('audit.description')}</th>
                  <th>{t('audit.ip')}</th>
                  <th>{t('audit.time')}</th>
                  <th className="text-end">{t('common.details')}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((log) => (
                  <tr key={log.id} className="cursor-pointer" onClick={() => setDetail(log)}>
                    <td>
                      <Badge tone={eventTone(log.event)} dot>
                        {log.event}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap text-sm font-medium">{log.user ?? '—'}</td>
                    <td className="max-w-md">
                      <p className="truncate text-sm text-ink">{log.description ?? '—'}</p>
                      {log.auditable_type ? (
                        <p className="mt-0.5 truncate font-mono text-[10px] text-ink-subtle">
                          {log.auditable_type.split('\\').pop()}#{log.auditable_id ?? '—'}
                        </p>
                      ) : null}
                    </td>
                    <td dir="ltr" className="whitespace-nowrap text-start font-mono text-[11px] text-ink-muted">
                      {log.ip_address ?? '—'}
                    </td>
                    <td className="whitespace-nowrap text-xs text-ink-muted">
                      {formatDateTime(log.created_at, locale)}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event_) => {
                            event_.stopPropagation()
                            setDetail(log)
                          }}
                          title={t('common.details')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={ScrollText} title={t('audit.noLogs')} description={t('common.noResults')} />
        )}

        {pagination ? (
          <Pagination
            page={pagination.current_page}
            lastPage={pagination.last_page}
            total={pagination.total}
            from={pagination.from}
            to={pagination.to}
            onChange={setPage}
          />
        ) : null}
      </div>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={t('audit.details')}
        description={detail ? `${detail.event} · ${formatDateTime(detail.created_at, locale)}` : undefined}
        size="lg"
      >
        {detail ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { label: t('audit.event'), value: detail.event },
                { label: t('audit.user'), value: detail.user ?? '—' },
                { label: t('audit.ip'), value: detail.ip_address ?? '—' },
                { label: t('audit.time'), value: formatDateTime(detail.created_at, locale) },
                { label: t('audit.requestId'), value: detail.request_id ?? '—' },
                {
                  label: t('audit.description'),
                  value: detail.description ?? '—',
                },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-line bg-surface-muted/60 px-3.5 py-2.5">
                  <p className="text-[10px] font-semibold text-ink-subtle">{item.label}</p>
                  <p className="mt-0.5 break-words text-xs font-medium text-ink" dir="auto">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {detail.auditable_type ? (
              <div className="rounded-xl border border-line px-3.5 py-2.5">
                <p className="text-[10px] font-semibold text-ink-subtle">{t('common.details')}</p>
                <p className="mt-0.5 font-mono text-xs text-ink">
                  {detail.auditable_type}
                  {detail.auditable_id ? `#${detail.auditable_id}` : ''}
                </p>
              </div>
            ) : null}

            {detail.old_values && Object.keys(detail.old_values).length ? (
              <div>
                <p className="mb-1.5 text-xs font-bold text-ink">{t('audit.oldValues')}</p>
                <pre dir="ltr" className="max-h-56 overflow-auto rounded-xl bg-scarlet-950 p-3.5 text-[11px] leading-relaxed text-scarlet-100">
                  {JSON.stringify(detail.old_values, null, 2)}
                </pre>
              </div>
            ) : null}

            {detail.new_values && Object.keys(detail.new_values).length ? (
              <div>
                <p className="mb-1.5 text-xs font-bold text-ink">{t('audit.newValues')}</p>
                <pre dir="ltr" className="max-h-56 overflow-auto rounded-xl bg-scarlet-950 p-3.5 text-[11px] leading-relaxed text-scarlet-100">
                  {JSON.stringify(detail.new_values, null, 2)}
                </pre>
              </div>
            ) : null}

            {detail.user_agent ? (
              <div className="rounded-xl bg-surface-muted px-3.5 py-2.5">
                <p className="text-[10px] font-semibold text-ink-subtle">User agent</p>
                <p dir="ltr" className="mt-0.5 break-all text-[11px] text-ink-muted">
                  {detail.user_agent}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
