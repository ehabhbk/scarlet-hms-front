import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Baby } from 'lucide-react'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { api } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, MaternityRecord } from '@/lib/types'

export function MaternityPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['maternity-records', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<MaternityRecord[]>>('/maternity-records', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
  })
  const rows = data?.rows ?? []
  const pagination = data?.meta?.pagination
  return (
    <div>
      <PageHeader title="الولادة" subtitle="متابعة الحمل والولادة" />
      <div className="table-shell">
        {isLoading ? <TableSkeleton rows={8} /> : rows.length ? (
          <table className="data-table">
            <thead><tr><th>Patient</th><th>EDD</th><th>Status</th><th>Doctor</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.patient?.display_name ?? r.patient_id}</td>
                  <td>{r.edd ?? '—'}</td>
                  <td>{r.status}</td>
                  <td>{r.doctor?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={Baby} title={t('common.noData')} />}
        {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
      </div>
    </div>
  )
}
