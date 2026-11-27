import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, DollarSign, Printer, TrendingDown, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, StatCard } from '@/components/ui/Card'
import { Field, Select } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { api } from '@/lib/api'
import { useFinance, periodLabel } from '@/lib/finance'
import type { ApiEnvelope } from '@/lib/types'
import { printReport } from '@/utils/printReport'

interface ProfitLoss {
  revenue: number
  expense: number
  purchase: number
  wages: number
  profit: number
}

interface PaymentMethodStat {
  payment_method: string
  total: number
  transactions?: number
}

const PAYMENT_LABELS: Record<string, { ar: string; en: string }> = {
  cash: { ar: 'نقداً', en: 'Cash' },
  bank: { ar: 'بنك', en: 'Bank' },
  card: { ar: 'بطاقة', en: 'Card' },
  insurance: { ar: 'تأمين', en: 'Insurance' },
}

export function FinancePage() {
  const { locale, money, organization, date } = useFinance()
  const [period, setPeriod] = useState('month')

  const range = useMemo(() => {
    const now = new Date()
    const fmt = (value: Date) =>
      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`

    let start = new Date(now)
    if (period === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (period === 'week') start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    if (period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1)
    if (period === 'year') start = new Date(now.getFullYear(), 0, 1)

    return { from: fmt(start), to: fmt(now) }
  }, [period])

  const profitLossQuery = useQuery({
    queryKey: ['finance', 'profit-loss', period],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<ProfitLoss>>('/reports/profit-loss', { params: range })
      return data.data
    },
  })

  const paymentMethodsQuery = useQuery({
    queryKey: ['finance', 'payment-methods', period],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<{ methods: PaymentMethodStat[] }>>('/reports/payment-methods', {
        params: range,
      })
      return data.data.methods
    },
  })

  const profitLoss = profitLossQuery.data
  const paymentMethods = paymentMethodsQuery.data ?? []

  const methodLabel = (method: string) => PAYMENT_LABELS[method]?.[locale] ?? method

  const paymentRows = paymentMethods.map((method) => [
    methodLabel(method.payment_method),
    money(method.total),
    String(method.transactions ?? 0),
  ])

  const handlePrint = () => {
    if (!profitLoss) {
      toast.error('لا توجد بيانات كافية لإنشاء التقرير')
      return
    }

    const opened = printReport({
      title: 'التقرير المالي',
      subtitle: 'نظرة عامة على الأداء المالي',
      organization,
      locale,
      meta: [
        { label: 'الفترة', value: periodLabel(range.from, range.to) },
        { label: 'العملة', value: locale === 'ar' ? 'الجنيه السوداني' : 'Sudanese pound' },
        { label: 'تاريخ الإصدار', value: date(new Date()) },
      ],
      kpis: [
        { label: 'الإيرادات', value: money(profitLoss.revenue), tone: 'green' },
        { label: 'المصروفات', value: money(profitLoss.expense), tone: 'red' },
        { label: 'المشتريات', value: money(profitLoss.purchase), tone: 'blue' },
        {
          label: 'صافي الربح',
          value: money(profitLoss.profit),
          tone: Number(profitLoss.profit) >= 0 ? 'green' : 'red',
        },
      ],
      sections: [
        {
          title: 'طرق الدفع',
          columns: [
            { label: 'طريقة الدفع' },
            { label: 'الإجمالي', align: 'left', nowrap: true },
            { label: 'عدد العمليات', align: 'left', nowrap: true },
          ],
          rows: paymentRows,
          emptyText: 'لا توجد عمليات دفع مسجلة',
        },
      ],
      summaryTitle: 'الملخص المالي',
      summary: [
        { label: 'الإيرادات', value: money(profitLoss.revenue), tone: 'green' },
        { label: 'المصروفات', value: money(profitLoss.expense), tone: 'red' },
        { label: 'منها أجور موظفين', value: money(profitLoss.wages) },
        { label: 'المشتريات', value: money(profitLoss.purchase) },
        {
          label: 'صافي الربح',
          value: money(profitLoss.profit),
          tone: Number(profitLoss.profit) >= 0 ? 'green' : 'red',
        },
      ],
      signatures: ['المحاسب', 'المدير المالي'],
      footerNote: 'التقرير المالي',
    })

    if (!opened) toast.error('تعذر فتح نافذة الطباعة؛ اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى')
  }

  const periodOptions = [
    { value: 'today', ar: 'اليوم', en: 'Today' },
    { value: 'week', ar: 'هذا الأسبوع', en: 'This week' },
    { value: 'month', ar: 'هذا الشهر', en: 'This month' },
    { value: 'year', ar: 'هذا العام', en: 'This year' },
  ]

  return (
    <div>
      <PageHeader
        title="المالية"
        subtitle="نظرة عامة على الإيرادات والمصروفات وطرق الدفع"
        actions={
          <>
            <Field className="w-40">
              <Select value={period} onChange={(event) => setPeriod(event.target.value)}>
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option[locale]}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="outline" onClick={handlePrint} disabled={!profitLoss}>
              <Printer className="h-4 w-4" />
              تصدير PDF
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="الإيرادات"
          value={money(profitLoss?.revenue ?? 0)}
          icon={TrendingUp}
          tone="success"
          loading={profitLossQuery.isLoading}
        />
        <StatCard
          label="المصروفات"
          value={money(profitLoss?.expense ?? 0)}
          icon={TrendingDown}
          tone="warning"
          loading={profitLossQuery.isLoading}
        />
        <StatCard
          label="المشتريات"
          value={money(profitLoss?.purchase ?? 0)}
          icon={CreditCard}
          tone="info"
          loading={profitLossQuery.isLoading}
        />
        <StatCard
          label="صافي الربح"
          value={money(profitLoss?.profit ?? 0)}
          icon={DollarSign}
          tone="scarlet"
          loading={profitLossQuery.isLoading}
        />
      </div>

      {Number(profitLoss?.wages ?? 0) > 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          تشمل المصروفات أجور موظفين محتسبة: {money(profitLoss?.wages ?? 0)}
        </p>
      ) : null}

      <Card className="mt-6 p-5">
        <h2 className="mb-4 text-base font-bold text-ink">طرق الدفع</h2>
        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <div
              key={method.payment_method}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-muted/60 px-4 py-3"
            >
              <span className="font-semibold text-ink">{methodLabel(method.payment_method)}</span>
              <div className="text-end">
                <p className="font-bold text-ink">{money(method.total)}</p>
                <p className="text-xs text-ink-muted">{method.transactions ?? 0} عملية</p>
              </div>
            </div>
          ))}
          {paymentMethods.length === 0 && !paymentMethodsQuery.isLoading ? (
            <p className="text-sm text-ink-muted">لا توجد عمليات دفع مسجلة.</p>
          ) : null}
        </div>
      </Card>
    </div>
  )
}
