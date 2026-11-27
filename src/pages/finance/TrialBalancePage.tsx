import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader, TableSkeleton } from '@/components/ui/PageHeader'
import { api } from '@/lib/api'
import { accountTypeLabel, useFinance } from '@/lib/finance'
import type { ApiEnvelope, ChartAccount } from '@/lib/types'
import { printReport } from '@/utils/printReport'

export function TrialBalancePage() {
  const { money, organization, date, locale } = useFinance()

  const accountsQuery = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<{ accounts: ChartAccount[] }>>('/accounting/chart-of-accounts')
      return data.data.accounts
    },
  })

  const accounts = accountsQuery.data ?? []
  const { totalDebit, totalCredit } = useMemo(() => {
    let debit = 0
    let credit = 0
    for (const account of accounts) {
      const balance = Number(account.balance) || 0
      if (balance >= 0) debit += balance
      else credit += -balance
    }
    return { totalDebit: debit, totalCredit: credit }
  }, [accounts])

  const handlePrint = () => {
    const rows = accounts.map((account) => {
      const balance = Number(account.balance) || 0
      return [
        account.code,
        account.name,
        accountTypeLabel(account.type),
        balance >= 0 ? money(balance) : '-',
        balance < 0 ? money(-balance) : '-',
      ]
    })

    printReport({
      title: 'ميزان المراجعة',
      organization,
      locale,
      meta: [{ label: 'تاريخ الإصدار', value: date(new Date()) }],
      sections: [
        {
          title: 'الحسابات',
          columns: [
            { label: 'الكود' },
            { label: 'اسم الحساب' },
            { label: 'النوع' },
            { label: 'مدين' },
            { label: 'دائن' },
          ],
          rows,
          footer: ['', 'الإجمالي', '', money(totalDebit), money(totalCredit)],
        },
      ],
      generatedAt: new Date(),
    })
  }

  return (
    <div>
      <PageHeader
        title="ميزان المراجعة"
        subtitle="أرصدة الحسابات مديناً ودائناً"
        actions={
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
            طباعة / PDF
          </Button>
        }
      />

      <Card>
        {accountsQuery.isLoading ? (
          <TableSkeleton rows={8} />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>اسم الحساب</th>
                  <th>النوع</th>
                  <th>مدين</th>
                  <th>دائن</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const balance = Number(account.balance) || 0
                  return (
                    <tr key={account.id}>
                      <td className="font-mono text-xs">{account.code}</td>
                      <td>{account.name}</td>
                      <td>{accountTypeLabel(account.type)}</td>
                      <td className="tabular-nums">{balance >= 0 ? money(balance) : '-'}</td>
                      <td className="tabular-nums">{balance < 0 ? money(-balance) : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="font-bold">
                <tr>
                  <td colSpan={3}>الإجمالي</td>
                  <td className="tabular-nums">{money(totalDebit)}</td>
                  <td className="tabular-nums">{money(totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
