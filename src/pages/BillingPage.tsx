import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { api } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, Invoice } from '@/lib/types'
import { formatNumber } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'

export function BillingPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', { page, status }],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Invoice[]>>('/invoices', { params: { page, per_page: 15, status: status || undefined } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
  })

  const invoices = data?.rows ?? []
  const pagination = data?.meta?.pagination

  return (
    <div>
      <PageHeader title={t('nav.billing')} subtitle={t('dashboard.subtitle')} />
      <div className="card mb-4 p-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="field h-10">
          <option value="">{t('common.all')}</option>
          {['draft','issued','partial','paid','cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="table-shell">
        {isLoading ? <TableSkeleton rows={8} /> : invoices.length ? (
          <table className="data-table">
            <thead><tr><th>Invoice</th><th>Patient</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-mono text-xs">{inv.invoice_number}</td>
                  <td>{inv.patient?.display_name ?? inv.patient_id}</td>
                  <td>{formatNumber(inv.total, locale)}</td>
                  <td>{formatNumber(inv.paid, locale)}</td>
                  <td>{formatNumber(inv.balance, locale)}</td>
                  <td><Badge tone={inv.status === 'paid' ? 'success' : inv.status === 'cancelled' ? 'danger' : 'warning'} dot>{inv.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={Receipt} title={t('common.noData')} />}
        {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
      </div>
    </div>
  )
}
