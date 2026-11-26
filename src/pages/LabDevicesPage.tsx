import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Cpu } from 'lucide-react'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { api } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, LabDevice } from '@/lib/types'


export function LabDevicesPage() {
  const { t } = useTranslation()

  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['lab-devices', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<LabDevice[]>>('/lab-devices', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
  })
  const rows = data?.rows ?? []
  const pagination = data?.meta?.pagination
  return (
    <div>
      <PageHeader title="أجهزة المختبر" subtitle="ربط الأجهزة والبروتوكولات" />
      <div className="table-shell">
        {isLoading ? <TableSkeleton rows={8} /> : rows.length ? (
          <table className="data-table">
            <thead><tr><th>Code</th><th>Name</th><th>Manufacturer</th><th>Model</th><th>Protocol</th><th>Status</th><th>Last sync</th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-xs">{d.code}</td>
                  <td>{d.name}</td>
                  <td>{d.manufacturer ?? '—'}</td>
                  <td>{d.model ?? '—'}</td>
                  <td>{d.protocol}</td>
                  <td>{d.status}</td>
                  <td>{d.last_sync_at ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={Cpu} title={t('common.noData')} />}
        {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
      </div>
    </div>
  )
}
