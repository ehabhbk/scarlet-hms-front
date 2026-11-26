import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { api } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, Employee } from '@/lib/types'
import { formatNumber } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'

export function EmployeesPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['employees', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Employee[]>>('/employees', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
  })
  const rows = data?.rows ?? []
  const pagination = data?.meta?.pagination
  return (
    <div>
      <PageHeader title="الموظفون" subtitle="إدارة الموظفين والرواتب" />
      <div className="table-shell">
        {isLoading ? <TableSkeleton rows={8} /> : rows.length ? (
          <table className="data-table">
            <thead><tr><th>Number</th><th>Name</th><th>Department</th><th>Job title</th><th>Salary</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-xs">{e.employee_number}</td>
                  <td>{e.name}</td>
                  <td>{e.department ?? '—'}</td>
                  <td>{e.job_title ?? '—'}</td>
                  <td>{formatNumber(e.basic_salary, locale)}</td>
                  <td>{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={Users} title={t('common.noData')} />}
        {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
      </div>
    </div>
  )
}
