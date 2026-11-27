import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { api } from '@/lib/api'
import { useFinance } from '@/lib/finance'
import type { ApiEnvelope, BalanceSheet, StatementRow } from '@/lib/types'
import { printReport } from '@/utils/printReport'
import { todayInput } from '@/lib/format'

export function BalanceSheetPage() {
  const { money, organization, date, locale } = useFinance()
  const [asOf, setAsOf] = useState(todayInput())

  const balanceQuery = useQuery({
    queryKey: ['balance-sheet', asOf],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<BalanceSheet>>('/accounting/balance-sheet', {
        params: { as_of: asOf },
      })
      return data.data
    },
  })

  const balance = balanceQuery.data
  const balanced =
    balance != null &&
    Math.abs(Number(balance.total_assets) - Number(balance.total_liabilities_equity)) < 0.01

  const handlePrint = () => {
    if (!balance) return

    const toRows = (rows: StatementRow[]) =>
      rows.map((row) => [`${row.code} - ${row.name}`, money(row.amount)])

    printReport({
      title: 'الميزانية العمومية',
      subtitle: `كما في ${asOf}`,
      organization,
      locale,
      meta: [
        { label: 'كما في تاريخ', value: asOf },
        { label: 'العملة', value: locale === 'ar' ? 'الجنيه السوداني' : 'Sudanese pound' },
        { label: 'تاريخ الإصدار', value: date(new Date()) },
      ],
      kpis: [
        { label: 'إجمالي الأصول', value: money(balance.total_assets), tone: 'blue' },
        { label: 'إجمالي الالتزامات', value: money(balance.total_liabilities), tone: 'red' },
        { label: 'حقوق الملكية', value: money(balance.total_equity), tone: 'green' },
        {
          label: 'حالة الميزانية',
          value: balanced ? 'متوازنة' : 'غير متوازنة',
          tone: balanced ? 'green' : 'red',
        },
      ],
      sections: [
        {
          title: 'الأصول',
          columns: [
            { label: 'الحساب' },
            { label: 'المبلغ', align: 'left', nowrap: true },
          ],
          rows: toRows(balance.assets),
          footer: ['إجمالي الأصول', money(balance.total_assets)],
          emptyText: 'لا توجد أصول مسجلة',
        },
        {
          title: 'الالتزامات',
          columns: [
            { label: 'الحساب' },
            { label: 'المبلغ', align: 'left', nowrap: true },
          ],
          rows: toRows(balance.liabilities),
          footer: ['إجمالي الالتزامات', money(balance.total_liabilities)],
          emptyText: 'لا توجد التزامات مسجلة',
        },
        {
          title: 'حقوق الملكية',
          columns: [
            { label: 'الحساب' },
            { label: 'المبلغ', align: 'left', nowrap: true },
          ],
          rows: toRows(balance.equity),
          footer: ['إجمالي حقوق الملكية', money(balance.total_equity)],
          emptyText: 'لا توجد حقوق ملكية مسجلة',
        },
      ],
      summaryTitle: 'الملخص النهائي',
      summary: [
        { label: 'إجمالي الأصول', value: money(balance.total_assets) },
        { label: 'إجمالي الالتزامات', value: money(balance.total_liabilities) },
        { label: 'حقوق الملكية', value: money(balance.total_equity) },
        { label: 'الالتزامات + حقوق الملكية', value: money(balance.total_liabilities_equity) },
        {
          label: 'الفرق بين الأصول والالتزامات وحقوق الملكية',
          value: money(Number(balance.total_assets) - Number(balance.total_liabilities_equity)),
          tone: balanced ? 'green' : 'red',
        },
      ],
      signatures: ['المحاسب', 'المدير المالي'],
      footerNote: 'الميزانية العمومية',
    })
  }

  const renderSection = (title: string, rows: StatementRow[], total: number, tone: string) => (
    <div>
      <h2 className={`mb-2 text-base font-bold ${tone}`}>{title}</h2>
      <div className="table-shell">
        <table className="data-table">
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.code} - {row.name}
                </td>
                <td className="whitespace-nowrap text-end tabular-nums">{money(row.amount)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td>الإجمالي</td>
              <td className="whitespace-nowrap text-end tabular-nums">{money(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="الميزانية العمومية"
        subtitle="الأصول والالتزامات وحقوق الملكية"
        actions={
          <Button variant="outline" onClick={handlePrint} disabled={!balance}>
            <Printer className="h-4 w-4" />
            تصدير PDF
          </Button>
        }
      />

      <Card className="p-5">
        <div className="mb-5 max-w-xs">
          <Field label="كما في تاريخ">
            <Input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
          </Field>
        </div>

        {balanceQuery.isLoading ? (
          <p className="py-10 text-center text-sm text-ink-muted">جارٍ التحميل...</p>
        ) : balance ? (
          <div className="space-y-6">
            {renderSection('الأصول', balance.assets, balance.total_assets, 'text-info-700')}
            {renderSection('الالتزامات', balance.liabilities, balance.total_liabilities, 'text-danger-600')}
            {renderSection('حقوق الملكية', balance.equity, balance.total_equity, 'text-purple-600')}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-lg font-bold">
              <span>الالتزامات + حقوق الملكية</span>
              <span className="tabular-nums">{money(balance.total_liabilities_equity)}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-lg font-bold">
              <span>الأصول</span>
              <span className="tabular-nums">{money(balance.total_assets)}</span>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
