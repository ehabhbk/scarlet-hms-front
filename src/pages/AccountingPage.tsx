import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { Pagination } from '@/components/ui/Pagination'
import { api } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, Account, JournalEntry } from '@/lib/types'
import { formatNumber } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'

export function AccountingPage() {
  const locale = useLocale()
  const [tab, setTab] = useState('accounts')
  const [page, setPage] = useState(1)

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Account[]>>('/accounts')
      return data.data
    },
    enabled: tab === 'accounts' || tab === 'ledger',
  })

  const entriesQuery = useQuery({
    queryKey: ['journal-entries', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<JournalEntry[]>>('/journal-entries', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
    enabled: tab === 'entries',
  })

  const trialQuery = useQuery({
    queryKey: ['trial-balance'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<any[]>>('/accounting/trial-balance')
      return data.data
    },
    enabled: tab === 'trial',
  })

  const incomeQuery = useQuery({
    queryKey: ['income-statement'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<any>>('/accounting/income-statement')
      return data.data
    },
    enabled: tab === 'income',
  })

  const balanceQuery = useQuery({
    queryKey: ['balance-sheet'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<any>>('/accounting/balance-sheet')
      return data.data
    },
    enabled: tab === 'balance',
  })

  const accounts = accountsQuery.data ?? []
  const entries = entriesQuery.data?.rows ?? []
  const pagination = entriesQuery.data?.meta?.pagination

  return (
    <div>
      <PageHeader title="المحاسبة" subtitle="شجرة الحسابات والقيود والتقارير" />
      <Tabs items={[
        { id: 'accounts', label: 'شجرة الحسابات' },
        { id: 'entries', label: 'قيود اليومية' },
        { id: 'trial', label: 'ميزان المراجعة' },
        { id: 'income', label: 'قائمة الدخل' },
        { id: 'balance', label: 'الميزانية' },
      ]} value={tab} onChange={(v) => { setTab(v); setPage(1) }} />

      <div className="mt-4">
        {tab === 'accounts' && (
          accountsQuery.isLoading ? <TableSkeleton rows={8} /> : accounts.length ? (
            <div className="table-shell">
              <table className="data-table">
                <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Parent</th></tr></thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id}>
                      <td className="font-mono text-xs">{a.code}</td>
                      <td>{locale === 'ar' ? a.name_ar : (a.name_en || a.name_ar)}</td>
                      <td>{a.type}</td>
                      <td>{a.parent?.code ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={BookOpen} title="No accounts" />
        )}

        {tab === 'entries' && (
          entriesQuery.isLoading ? <TableSkeleton rows={8} /> : entries.length ? (
            <div className="table-shell">
              <table className="data-table">
                <thead><tr><th>Entry #</th><th>Date</th><th>Description</th><th>Lines</th></tr></thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="font-mono text-xs">{e.entry_number}</td>
                      <td>{e.entry_date}</td>
                      <td>{e.description}</td>
                      <td>{e.lines?.length ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
            </div>
          ) : <EmptyState icon={BookOpen} title="No entries" />
        )}

        {tab === 'trial' && (
          trialQuery.isLoading ? <TableSkeleton rows={8} /> : (
            <div className="table-shell">
              <table className="data-table">
                <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
                <tbody>
                  {(trialQuery.data ?? []).map((r: any) => (
                    <tr key={r.account_id}>
                      <td className="font-mono text-xs">{r.code}</td>
                      <td>{locale === 'ar' ? r.name_ar : (r.name_en || r.name_ar)}</td>
                      <td>{r.type}</td>
                      <td>{formatNumber(r.debit, locale)}</td>
                      <td>{formatNumber(r.credit, locale)}</td>
                      <td>{formatNumber(r.balance, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'income' && (
          incomeQuery.isLoading ? <TableSkeleton rows={4} /> : (
            <div className="card p-5 space-y-3">
              <div className="flex justify-between"><span>Revenue</span><span className="font-bold">{formatNumber(incomeQuery.data?.revenue ?? 0, locale)}</span></div>
              <div className="flex justify-between"><span>Expense</span><span className="font-bold">{formatNumber(incomeQuery.data?.expense ?? 0, locale)}</span></div>
              <div className="flex justify-between border-t border-line pt-3"><span className="font-bold">Net income</span><span className="font-extrabold">{formatNumber(incomeQuery.data?.net_income ?? 0, locale)}</span></div>
            </div>
          )
        )}

        {tab === 'balance' && (
          balanceQuery.isLoading ? <TableSkeleton rows={4} /> : (
            <div className="card p-5 space-y-3">
              <div className="flex justify-between"><span>Assets</span><span className="font-bold">{formatNumber(balanceQuery.data?.assets ?? 0, locale)}</span></div>
              <div className="flex justify-between"><span>Liabilities</span><span className="font-bold">{formatNumber(balanceQuery.data?.liabilities ?? 0, locale)}</span></div>
              <div className="flex justify-between"><span>Equity</span><span className="font-bold">{formatNumber(balanceQuery.data?.equity ?? 0, locale)}</span></div>
              <div className="flex justify-between border-t border-line pt-3"><span className="font-bold">Balanced</span><span className="font-extrabold">{balanceQuery.data?.balanced ? 'Yes' : 'No'}</span></div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
