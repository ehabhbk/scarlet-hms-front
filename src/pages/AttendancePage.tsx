import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck } from 'lucide-react'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { api } from '@/lib/api'
import type { ApiEnvelope, ApiMeta } from '@/lib/types'


interface AttendanceRow { id: number; employee_id: number; employee?: { name: string; employee_number: string }; date: string; check_in?: string | null; check_out?: string | null; hours_worked: number; status: string }

export function AttendancePage() {
  const { t } = useTranslation()

  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['attendance', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<AttendanceRow[]>>('/attendance', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
  })
  const rows = data?.rows ?? []
  const pagination = data?.meta?.pagination
  return (
    <div>
      <PageHeader title="الحضور والانصراف" subtitle="سجلات الموظفين" />
      <div className="table-shell">
        {isLoading ? <TableSkeleton rows={8} /> : rows.length ? (
          <table className="data-table">
            <thead><tr><th>Employee</th><th>Date</th><th>Check in</th><th>Check out</th><th>Hours</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.employee?.name ?? r.employee_id}</td>
                  <td>{r.date}</td>
                  <td>{r.check_in ?? '—'}</td>
                  <td>{r.check_out ?? '—'}</td>
                  <td>{r.hours_worked}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={ClipboardCheck} title={t('common.noData')} />}
        {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
      </div>
    </div>
  )
}
