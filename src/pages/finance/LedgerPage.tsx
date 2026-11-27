import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input, Select } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { api } from '@/lib/api'
import { accountTypeLabel, periodLabel, useFinance } from '@/lib/finance'
import type { ApiEnvelope, ChartAccount, LedgerLine, LedgerResponse } from '@/lib/types'
import { printReport } from '@/utils/printReport'

export function LedgerPage() {
  const { money, organization, number, date, locale } = useFinance()
  const [accountId, setAccountId] = useState<number | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')

  const accountsQuery = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<{ accounts: ChartAccount[] }>>('/accounting/chart-of-accounts')
      return data.data.accounts
    },
  })

  const ledgerQuery = useQuery({
    queryKey: ['ledger', accountId, from, to, search],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<LedgerResponse>>('/accounting/ledger', {
        params: { account_id: accountId, from: from || undefined, to: to || undefined, search: search || undefined },
      })
      return data.data
    },
    enabled: Boolean(accountId),
  })

  const lines: LedgerLine[] = (ledgerQuery.data?.lines ?? []).filter((line) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      String(line.entry_number || '').toLowerCase().includes(term) ||
      String(line.description || '').toLowerCase().includes(term) ||
      String(line.reference || '').toLowerCase().includes(term)
    )
  })

  const handlePrint = () => {
    const ledger = ledgerQuery.data
    if (!ledger?.account) return

    const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0)
    const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0)

    printReport({
      title: 'دفتر الأستاذ',
      subtitle: `الحساب: ${ledger.account.code} - ${ledger.account.name}`,
      organization,
      locale,
      meta: [
        { label: 'الحساب', value: `${ledger.account.code} - ${ledger.account.name}` },
        { label: 'نوع الحساب', value: accountTypeLabel(ledger.account.type) },
        { label: 'الفترة', value: periodLabel(from, to) },
        { label: 'الرصيد الافتتاحي', value: money(ledger.opening_balance) },
        { label: 'الرصيد الختامي', value: money(ledger.closing_balance) },
        { label: 'العملة', value: locale === 'ar' ? 'الجنيه السوداني' : 'Sudanese pound' },
      ],
      kpis: [
        { label: 'الرصيد الافتتاحي', value: money(ledger.opening_balance), tone: 'blue' },
        { label: 'إجمالي المدين', value: money(totalDebit) },
        { label: 'إجمالي الدائن', value: money(totalCredit) },
        {
          label: 'الرصيد الختامي',
          value: money(ledger.closing_balance),
          tone: Number(ledger.closing_balance) >= 0 ? 'green' : 'red',
        },
      ],
      sections: [
        {
          title: 'حركة الحساب',
          columns: [
            { label: 'التاريخ', nowrap: true },
            { label: 'رقم القيد', nowrap: true },
            { label: 'الوصف' },
            { label: 'مدين', align: 'left', nowrap: true },
            { label: 'دائن', align: 'left', nowrap: true },
            { label: 'الرصيد', align: 'left', nowrap: true },
          ],
          rows: lines.map((line) => [
            date(line.date),
            line.entry_number,
            line.description || '-',
            Number(line.debit) ? money(line.debit) : '',
            Number(line.credit) ? money(line.credit) : '',
            money(line.balance),
          ]),
          footer: ['الإجمالي', '', '', money(totalDebit), money(totalCredit), money(ledger.closing_balance)],
          emptyText: 'لا توجد حركات على هذا الحساب خلال الفترة المحددة',
        },
      ],
      summaryTitle: 'ملخص الحساب',
      summary: [
        { label: 'الرصيد الافتتاحي', value: money(ledger.opening_balance) },
        { label: 'إجمالي المدين', value: money(totalDebit) },
        { label: 'إجمالي الدائن', value: money(totalCredit) },
        {
          label: 'الرصيد الختامي',
          value: money(ledger.closing_balance),
          tone: Number(ledger.closing_balance) >= 0 ? 'green' : 'red',
        },
      ],
      signatures: ['المحاسب', 'المدير المالي'],
      footerNote: 'دفتر الأستاذ',
    })
  }

  return (
    <div>
      <PageHeader
        title="دفتر الأستاذ"
        subtitle="حركة الحساب يوماً بيوم"
        actions={
          <Button variant="outline" onClick={handlePrint} disabled={!ledgerQuery.data?.account}>
            <Printer className="h-4 w-4" />
            تصدير PDF
          </Button>
        }
      />

      <Card className="p-5">
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="الحساب">
            <Select
              value={accountId ?? ''}
              onChange={(event) => setAccountId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">اختر حساباً</option>
              {(accountsQuery.data ?? []).map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} - {account.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="من تاريخ">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field label="إلى تاريخ">
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
          <Field label="بحث برقم القيد أو الوصف">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث..." />
          </Field>
        </div>

        {!accountId ? (
          <p className="py-10 text-center text-sm text-ink-muted">اختر حساباً لعرض دفتر الأستاذ.</p>
        ) : ledgerQuery.isLoading ? (
          <p className="py-10 text-center text-sm text-ink-muted">جارٍ التحميل...</p>
        ) : ledgerQuery.data ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-ink">
                {ledgerQuery.data.account.code} - {ledgerQuery.data.account.name}
              </span>
              <span className="text-ink-muted">الرصيد الافتتاحي: {money(ledgerQuery.data.opening_balance)}</span>
            </div>
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>القيد</th>
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
                        لا توجد حركات مطابقة.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line, index) => (
                      <tr key={`${line.entry_number}-${index}`}>
                        <td className="whitespace-nowrap">{date(line.date)}</td>
                        <td className="font-mono text-xs">{line.entry_number}</td>
                        <td>{line.description || '-'}</td>
                        <td className="tabular-nums">{line.debit ? number(line.debit) : '—'}</td>
                        <td className="tabular-nums">{line.credit ? number(line.credit) : '—'}</td>
                        <td className="font-semibold tabular-nums">{money(line.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="text-end font-bold text-ink">
              الرصيد الختامي: {money(ledgerQuery.data.closing_balance)}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
