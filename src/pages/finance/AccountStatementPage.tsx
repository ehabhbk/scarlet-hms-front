import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input, Select } from '@/components/ui/Field'
import { PageHeader, TableSkeleton } from '@/components/ui/PageHeader'
import { api } from '@/lib/api'
import { useFinance } from '@/lib/finance'
import type { ApiEnvelope, ChartAccount, LedgerResponse } from '@/lib/types'
import { printReport } from '@/utils/printReport'

export function AccountStatementPage() {
  const { money, organization, date, locale } = useFinance()
  const [accountId, setAccountId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [includeChildren, setIncludeChildren] = useState(true)

  const accountsQuery = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<{ accounts: ChartAccount[] }>>('/accounting/chart-of-accounts')
      return data.data.accounts
    },
  })

  const statementQuery = useQuery({
    queryKey: ['account-statement', accountId, fromDate, toDate, includeChildren],
    queryFn: async () => {
      if (!accountId) return null
      const params = new URLSearchParams()
      params.set('account_id', accountId)
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      if (includeChildren) params.set('include_children', '1')
      const { data } = await api.get<ApiEnvelope<LedgerResponse>>(`/accounting/ledger?${params.toString()}`)
      return data.data
    },
    enabled: Boolean(accountId),
  })

  const statement = statementQuery.data
  const lines = statement?.lines ?? []
  const perAccount = statement?.per_account ?? []

  const totalDebit = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0),
    [lines],
  )
  const totalCredit = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0),
    [lines],
  )

  const handlePrint = () => {
    if (!statement) return

    printReport({
      title: 'كشف حساب',
      subtitle: `${statement.account.code} - ${statement.account.name}`,
      organization,
      locale,
      meta: [
        { label: 'الفترة', value: `${fromDate || 'البداية'} — ${toDate || date(new Date())}` },
        { label: 'يشمل الحسابات الفرعية', value: includeChildren ? 'نعم' : 'لا' },
      ],
      sections: [
        {
          title: 'الحركات',
          columns: [
            { label: 'التاريخ' },
            { label: 'كود الحساب' },
            { label: 'اسم الحساب' },
            { label: 'الوصف' },
            { label: 'مدين' },
            { label: 'دائن' },
            { label: 'الرصيد' },
          ],
          rows: lines.map((line) => [
            date(line.date),
            line.account_code ?? '-',
            line.account_name ?? '-',
            line.description || '-',
            money(line.debit),
            money(line.credit),
            money(line.balance),
          ]),
          footer: [
            'الإجمالي',
            '',
            '',
            '',
            money(totalDebit),
            money(totalCredit),
            money(statement.closing_balance),
          ],
        },
      ],
      summaryTitle: 'ملخص الحسابات',
      summary: perAccount.map((account) => ({
        label: `${account.code} - ${account.name}`,
        value: `مدين ${money(account.debit)} | دائن ${money(account.credit)} | رصيد ${money(account.closing)}`,
      })),
      generatedAt: new Date(),
    })
  }

  const handleExportExcel = () => {
    if (!statement) return

    const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const csvRows = [['التاريخ', 'كود الحساب', 'اسم الحساب', 'الوصف', 'مدين', 'دائن', 'الرصيد'].map(cell).join(',')]

    for (const line of lines) {
      csvRows.push(
        [
          line.date,
          line.account_code,
          cell(line.account_name),
          cell(line.description),
          line.debit,
          line.credit,
          line.balance,
        ].join(','),
      )
    }
    csvRows.push(['الإجمالي', '', '', '', totalDebit, totalCredit, statement.closing_balance].join(','))

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `account-statement-${statement.account.code || 'account'}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('تم تصدير كشف الحساب')
  }

  return (
    <div>
      <PageHeader
        title="كشف حساب"
        subtitle="حركات الحساب ورصيده خلال الفترة"
        actions={
          <>
            <Button variant="outline" onClick={handlePrint} disabled={!statement}>
              <Printer className="h-4 w-4" />
              طباعة / PDF
            </Button>
            <Button variant="outline" onClick={handleExportExcel} disabled={!statement}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
          </>
        }
      />

      <Card className="p-5">
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="الحساب">
            <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">اختر حساباً</option>
              {(accountsQuery.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="من تاريخ">
            <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </Field>
          <Field label="إلى تاريخ">
            <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={includeChildren}
              onChange={(event) => setIncludeChildren(event.target.checked)}
            />
            تضمين الحسابات الفرعية
          </label>
        </div>

        {statementQuery.isLoading ? (
          <TableSkeleton rows={6} />
        ) : !statement ? (
          <p className="py-10 text-center text-sm text-ink-muted">اختر حساباً لعرض كشفه</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-line bg-surface-muted/60 p-3">
                <p className="text-xs text-ink-muted">الرصيد الافتتاحي</p>
                <p className="font-bold tabular-nums text-ink">{money(statement.opening_balance)}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface-muted/60 p-3">
                <p className="text-xs text-ink-muted">إجمالي المدين</p>
                <p className="font-bold tabular-nums text-ink">{money(totalDebit)}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface-muted/60 p-3">
                <p className="text-xs text-ink-muted">إجمالي الدائن</p>
                <p className="font-bold tabular-nums text-ink">{money(totalCredit)}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface-muted/60 p-3">
                <p className="text-xs text-ink-muted">الرصيد الختامي</p>
                <p className="font-bold tabular-nums text-ink">{money(statement.closing_balance)}</p>
              </div>
            </div>

            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>الحساب</th>
                    <th>الوصف</th>
                    <th>مدين</th>
                    <th>دائن</th>
                    <th>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-ink-muted">
                        لا توجد حركات
                      </td>
                    </tr>
                  ) : (
                    lines.map((line, index) => (
                      <tr key={`${line.entry_number}-${index}`}>
                        <td className="whitespace-nowrap">{date(line.date)}</td>
                        <td>
                          {line.account_code} - {line.account_name}
                        </td>
                        <td className="text-xs text-ink-muted">{line.description || '-'}</td>
                        <td className="tabular-nums">{line.debit ? money(line.debit) : '-'}</td>
                        <td className="tabular-nums">{line.credit ? money(line.credit) : '-'}</td>
                        <td className="font-semibold tabular-nums">{money(line.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="font-bold">
                  <tr>
                    <td colSpan={3}>الإجمالي</td>
                    <td className="tabular-nums">{money(totalDebit)}</td>
                    <td className="tabular-nums">{money(totalCredit)}</td>
                    <td className="tabular-nums">{money(statement.closing_balance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {includeChildren && perAccount.length > 1 ? (
              <div>
                <h2 className="mb-2 text-base font-bold text-ink">ملخص الحسابات الفرعية</h2>
                <div className="table-shell">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>الكود</th>
                        <th>الاسم</th>
                        <th>مدين</th>
                        <th>دائن</th>
                        <th>الرصيد الافتتاحي</th>
                        <th>الرصيد الختامي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perAccount.map((account) => (
                        <tr key={account.id}>
                          <td className="font-mono text-xs">{account.code}</td>
                          <td>{account.name}</td>
                          <td className="tabular-nums">{money(account.debit)}</td>
                          <td className="tabular-nums">{money(account.credit)}</td>
                          <td className="tabular-nums">{money(account.opening)}</td>
                          <td className="font-semibold tabular-nums">{money(account.closing)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  )
}
