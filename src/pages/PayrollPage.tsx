import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { api } from '@/lib/api'
import type { ApiEnvelope, ApiMeta } from '@/lib/types'
import { formatNumber } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'

interface PayrollRow { id: number; period: string; total_amount: number; status: string; paid_at?: string | null }

export function PayrollPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['payroll-runs', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<PayrollRow[]>>('/payroll-runs', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
  })
  const rows = data?.rows ?? []
  const pagination = data?.meta?.pagination
  return (
    <div>
      <PageHeader title="الرواتب" subtitle="مسيرات الرواتب" />
      <div className="table-shell">
        {isLoading ? <TableSkeleton rows={8} /> : rows.length ? (
          <table className="data-table">
            <thead><tr><th>Period</th><th>Total</th><th>Status</th><th>Paid at</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.period}</td>
                  <td>{formatNumber(r.total_amount, locale)}</td>
                  <td>{r.status}</td>
                  <td>{r.paid_at ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={Wallet} title={t('common.noData')} />}
        {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
      </div>
    </div>
  )
}
