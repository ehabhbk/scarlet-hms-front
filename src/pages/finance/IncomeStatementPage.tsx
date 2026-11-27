import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { api } from '@/lib/api'
import { periodLabel, useFinance } from '@/lib/finance'
import type { ApiEnvelope, IncomeStatement, StatementRow } from '@/lib/types'
import { printReport } from '@/utils/printReport'

export function IncomeStatementPage() {
  const { money, organization, number, date, locale } = useFinance()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const statementQuery = useQuery({
    queryKey: ['income-statement', from, to],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<IncomeStatement>>('/accounting/income-statement', {
        params: { from: from || undefined, to: to || undefined },
      })
      return data.data
    },
  })

  const statement = statementQuery.data
  const range = periodLabel(from, to)

  const handlePrint = () => {
    if (!statement) return

    const toRows = (rows: StatementRow[]) =>
      rows.map((row) => [`${row.code} - ${row.name}`, money(row.amount)])
    const margin =
      Number(statement.total_revenue) > 0
        ? `${number((Number(statement.net_income) / Number(statement.total_revenue)) * 100).replace(/,/g, '')}%`
        : '0%'

    printReport({
      title: 'قائمة الدخل',
      subtitle: `الفترة: ${range}`,
      organization,
      locale,
      meta: [
        { label: 'الفترة', value: range },
        { label: 'العملة', value: locale === 'ar' ? 'الجنيه السوداني' : 'Sudanese pound' },
        { label: 'تاريخ الإصدار', value: date(new Date()) },
      ],
      kpis: [
        { label: 'إجمالي الإيرادات', value: money(statement.total_revenue), tone: 'green' },
        { label: 'إجمالي المصروفات', value: money(statement.total_expense), tone: 'red' },
        {
          label: 'صافي الدخل',
          value: money(statement.net_income),
          tone: Number(statement.net_income) >= 0 ? 'green' : 'red',
        },
        { label: 'هامش الربح', value: margin },
      ],
      sections: [
        {
          title: 'الإيرادات',
          columns: [
            { label: 'الحساب' },
            { label: 'المبلغ', align: 'left', nowrap: true },
          ],
          rows: toRows(statement.revenue),
          footer: ['إجمالي الإيرادات', money(statement.total_revenue)],
          emptyText: 'لا توجد إيرادات مسجلة',
        },
        {
          title: 'المصروفات',
          columns: [
            { label: 'الحساب' },
            { label: 'المبلغ', align: 'left', nowrap: true },
          ],
          rows: toRows(statement.expense),
          footer: ['إجمالي المصروفات', money(statement.total_expense)],
          emptyText: 'لا توجد مصروفات مسجلة',
        },
      ],
      summaryTitle: 'الملخص النهائي',
      summary: [
        { label: 'إجمالي الإيرادات', value: money(statement.total_revenue), tone: 'green' },
        { label: 'إجمالي المصروفات', value: money(statement.total_expense), tone: 'red' },
        {
          label: 'صافي الدخل',
          value: money(statement.net_income),
          tone: Number(statement.net_income) >= 0 ? 'green' : 'red',
        },
      ],
      signatures: ['المحاسب', 'المدير المالي'],
      footerNote: 'قائمة الدخل',
    })
  }

  const renderTable = (title: string, rows: StatementRow[], total: number, tone: string) => (
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
              <td>إجمالي {title}</td>
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
        title="قائمة الدخل"
        subtitle="الإيرادات والمصروفات وصافي الدخل"
        actions={
          <Button variant="outline" onClick={handlePrint} disabled={!statement}>
            <Printer className="h-4 w-4" />
            تصدير PDF
          </Button>
        }
      />

      <Card className="p-5">
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="من تاريخ">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="إلى تاريخ">
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
        </div>

        {statementQuery.isLoading ? (
          <p className="py-10 text-center text-sm text-ink-muted">جارٍ التحميل...</p>
        ) : statement ? (
          <div className="space-y-6">
            {renderTable('الإيرادات', statement.revenue, statement.total_revenue, 'text-success-700')}
            {renderTable('المصروفات', statement.expense, statement.total_expense, 'text-danger-600')}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-lg font-bold">
              <span>صافي الدخل</span>
              <span className={Number(statement.net_income) >= 0 ? 'text-success-700' : 'text-danger-600'}>
                {money(statement.net_income)}
              </span>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
