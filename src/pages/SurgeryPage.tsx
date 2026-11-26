import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Scissors } from 'lucide-react'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { api } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, Surgery } from '@/lib/types'

export function SurgeryPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['surgeries', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Surgery[]>>('/surgeries', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
  })
  const rows = data?.rows ?? []
  const pagination = data?.meta?.pagination
  return (
    <div>
      <PageHeader title="الجراحة" subtitle="جدولة وإدارة العمليات" />
      <div className="table-shell">
        {isLoading ? <TableSkeleton rows={8} /> : rows.length ? (
          <table className="data-table">
            <thead><tr><th>Patient</th><th>Procedure</th><th>Doctor</th><th>Scheduled</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>{s.patient?.display_name ?? s.patient_id}</td>
                  <td>{s.procedure_name}</td>
                  <td>{s.doctor?.name ?? '—'}</td>
                  <td>{s.scheduled_at ?? '—'}</td>
                  <td>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={Scissors} title={t('common.noData')} />}
        {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
      </div>
    </div>
  )
}
