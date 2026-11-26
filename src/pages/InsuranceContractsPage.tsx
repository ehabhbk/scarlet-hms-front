import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { api } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, InsuranceContract } from '@/lib/types'


export function InsuranceContractsPage() {
  const { t } = useTranslation()

  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['insurance-contracts', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<InsuranceContract[]>>('/insurance-contracts', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
  })
  const rows = data?.rows ?? []
  const pagination = data?.meta?.pagination
  return (
    <div>
      <PageHeader title="عقود التأمين" subtitle="العقود والخدمات" />
      <div className="table-shell">
        {isLoading ? <TableSkeleton rows={8} /> : rows.length ? (
          <table className="data-table">
            <thead><tr><th>Contract #</th><th>Provider</th><th>Patient share</th><th>Company share</th><th>Status</th><th>Period</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-xs">{c.contract_number}</td>
                  <td>{c.provider?.name ?? c.insurance_provider_id}</td>
                  <td>{c.patient_share_percent}%</td>
                  <td>{c.company_share_percent}%</td>
                  <td>{c.status}</td>
                  <td>{c.start_date ?? '—'} → {c.end_date ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={FileText} title={t('common.noData')} />}
        {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
      </div>
    </div>
  )
}
