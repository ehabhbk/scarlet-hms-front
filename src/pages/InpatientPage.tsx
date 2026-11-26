import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BedDouble } from 'lucide-react'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Pagination } from '@/components/ui/Pagination'
import { api } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, Admission, Bed, Ward } from '@/lib/types'
import { useLocale } from '@/hooks/useLocale'

export function InpatientPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const [tab, setTab] = useState('wards')
  const [page, setPage] = useState(1)

  const wardsQuery = useQuery({
    queryKey: ['wards', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Ward[]>>('/wards', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
    enabled: tab === 'wards',
  })
  const bedsQuery = useQuery({
    queryKey: ['beds', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Bed[]>>('/beds', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
    enabled: tab === 'beds',
  })
  const admissionsQuery = useQuery({
    queryKey: ['admissions', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Admission[]>>('/admissions', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
    enabled: tab === 'admissions',
  })

  const current = tab === 'wards' ? wardsQuery : tab === 'beds' ? bedsQuery : admissionsQuery
  const rows = current.data?.rows ?? []
  const pagination = current.data?.meta?.pagination

  return (
    <div>
      <PageHeader title="التنويم" subtitle="الغرف والأسرة والتنويم" />
      <Tabs items={[{ id: 'wards', label: 'Wards' }, { id: 'beds', label: 'Beds' }, { id: 'admissions', label: 'Admissions' }]} value={tab} onChange={(v) => { setTab(v); setPage(1) }} />
      <div className="mt-4 table-shell">
        {current.isLoading ? <TableSkeleton rows={8} /> : rows.length ? (
          tab === 'wards' ? (
            <table className="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Type</th></tr></thead>
              <tbody>
                {(rows as Ward[]).map((w) => (
                  <tr key={w.id}>
                    <td className="font-mono text-xs">{w.code}</td>
                    <td>{locale === 'ar' ? w.name_ar : (w.name_en || w.name_ar)}</td>
                    <td>{w.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === 'beds' ? (
            <table className="data-table">
              <thead><tr><th>Code</th><th>Ward</th><th>Status</th></tr></thead>
              <tbody>
                {(rows as Bed[]).map((b) => (
                  <tr key={b.id}>
                    <td className="font-mono text-xs">{b.code}</td>
                    <td>{b.ward ? (locale === 'ar' ? b.ward.name_ar : (b.ward.name_en || b.ward.name_ar)) : b.ward_id}</td>
                    <td>{b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead><tr><th>Patient</th><th>Bed</th><th>Status</th><th>Admitted</th></tr></thead>
              <tbody>
                {(rows as Admission[]).map((a) => (
                  <tr key={a.id}>
                    <td>{a.patient?.display_name ?? a.patient_id}</td>
                    <td>{a.bed?.code ?? '—'}</td>
                    <td>{a.status}</td>
                    <td>{a.admitted_at ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : <EmptyState icon={BedDouble} title={t('common.noData')} />}
        {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
      </div>
    </div>
  )
}
