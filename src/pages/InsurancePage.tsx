import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Shield } from 'lucide-react'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { Tabs } from '@/components/ui/Tabs'
import { api } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, InsuranceClaim, InsuranceProvider, PatientInsurance } from '@/lib/types'


export function InsurancePage() {
  const { t } = useTranslation()

  const [tab, setTab] = useState('providers')
  const [page, setPage] = useState(1)

  const providersQuery = useQuery({
    queryKey: ['insurance-providers', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<InsuranceProvider[]>>('/insurance-providers', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
    enabled: tab === 'providers',
  })
  const policiesQuery = useQuery({
    queryKey: ['patient-insurances', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<PatientInsurance[]>>('/patient-insurances', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
    enabled: tab === 'policies',
  })
  const claimsQuery = useQuery({
    queryKey: ['insurance-claims', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<InsuranceClaim[]>>('/insurance-claims', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
    enabled: tab === 'claims',
  })

  const current = tab === 'providers' ? providersQuery : tab === 'policies' ? policiesQuery : claimsQuery
  const rows = current.data?.rows ?? []
  const pagination = current.data?.meta?.pagination

  return (
    <div>
      <PageHeader title={t('nav.insurance')} subtitle={t('dashboard.subtitle')} />
      <Tabs items={[{ id: 'providers', label: 'Providers' }, { id: 'policies', label: 'Policies' }, { id: 'claims', label: 'Claims' }]} value={tab} onChange={(v) => { setTab(v); setPage(1) }} />
      <div className="mt-4 table-shell">
        {current.isLoading ? <TableSkeleton rows={8} /> : rows.length ? (
          tab === 'providers' ? (
            <table className="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Coverage</th><th>Status</th></tr></thead>
              <tbody>
                {(rows as InsuranceProvider[]).map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.code}</td>
                    <td>{p.name}</td>
                    <td>{p.coverage_percent}%</td>
                    <td><Badge tone={p.is_active ? 'success' : 'neutral'} dot>{p.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === 'policies' ? (
            <table className="data-table">
              <thead><tr><th>Patient</th><th>Provider</th><th>Policy #</th><th>Status</th></tr></thead>
              <tbody>
                {(rows as PatientInsurance[]).map((p) => (
                  <tr key={p.id}>
                    <td>{p.patient?.display_name ?? p.patient_id}</td>
                    <td>{p.provider?.name ?? p.insurance_provider_id}</td>
                    <td className="font-mono text-xs">{p.policy_number}</td>
                    <td><Badge tone="info" dot>{p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead><tr><th>Claim #</th><th>Patient</th><th>Claimed</th><th>Approved</th><th>Status</th></tr></thead>
              <tbody>
                {(rows as InsuranceClaim[]).map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono text-xs">{c.claim_number}</td>
                    <td>{c.patient?.display_name ?? c.patient_id}</td>
                    <td>{c.claimed_amount}</td>
                    <td>{c.approved_amount}</td>
                    <td><Badge tone={c.status === 'approved' ? 'success' : c.status === 'rejected' ? 'danger' : 'warning'} dot>{c.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : <EmptyState icon={Shield} title={t('common.noData')} />}
        {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
      </div>
    </div>
  )
}
