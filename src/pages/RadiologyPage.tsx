import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Printer, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Modal } from '@/components/ui/Modal'
import { Field, Textarea } from '@/components/ui/Field'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, RadiologyOrder } from '@/lib/types'

const statusLabels: Record<string, string> = {
  ordered: 'بانتظار النتيجة',
  result_received: 'نتيجة من الجهاز',
  completed: 'معتمد وموقّع',
  cancelled: 'ملغي',
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\n/g, '<br />')

export function RadiologyPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<RadiologyOrder | null>(null)
  const [draft, setDraft] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['radiology-orders', { page, status }],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<RadiologyOrder[]>>('/radiology-orders', {
        params: { page, per_page: 15, status: status || undefined },
      })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
  })

  const confirmMutation = useMutation({
    mutationFn: async ({ order, report }: { order: RadiologyOrder; report: string }) => {
      await api.post(`/radiology-orders/${order.id}/confirm-result`, { report })
    },
    onSuccess: () => {
      toast.success('تم اعتماد النتيجة وتوقيعها')
      setSelected(null)
      void queryClient.invalidateQueries({ queryKey: ['radiology-orders'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الاعتماد'),
  })

  const orders = data?.rows ?? []
  const pagination = data?.meta?.pagination

  const openOrder = (order: RadiologyOrder) => {
    setSelected(order)
    setDraft(order.report ?? '')
  }

  const printReport = (order: RadiologyOrder) => {
    const windowPrint = window.open('', '_blank', 'width=900,height=700')
    if (!windowPrint) return

    windowPrint.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ${order.order_number}</title>
      <style>body{font-family:Tahoma,Arial,sans-serif;padding:32px;color:#111}h1{font-size:20px;border-bottom:2px solid #8b1230;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin:18px 0}td{padding:6px;border:1px solid #ddd}pre{white-space:pre-wrap;font-family:inherit;line-height:1.8}</style>
      </head><body><h1>سكارلت — تقرير الأشعة/الموجات</h1>
      <table><tr><td>رقم الطلب</td><td>${escapeHtml(order.order_number)}</td></tr>
      <tr><td>المريض</td><td>${escapeHtml(order.patient?.display_name ?? String(order.patient_id))}</td></tr>
      <tr><td>الدراسة</td><td>${escapeHtml(order.study_description)}</td></tr>
      <tr><td>الجهاز</td><td>${escapeHtml(order.source_device?.name ?? 'إدخال يدوي')}</td></tr>
      <tr><td>الموقّع</td><td>${escapeHtml(order.reporter?.name ?? '—')}</td></tr></table>
      <h3>التقرير</h3><pre>${escapeHtml(order.report ?? '')}</pre></body></html>`)
    windowPrint.document.close()
    windowPrint.focus()
    windowPrint.print()
  }

  return (
    <div>
      <PageHeader title={t('nav.radiology')} subtitle="نتائج الأشعة والموجات، بما في ذلك النتائج المستوردة تلقائيًا من الأجهزة" />
      <div className="card mb-4 p-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="field h-10">
          <option value="">{t('common.all')}</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="table-shell">
        {isLoading ? <TableSkeleton rows={8} /> : orders.length ? (
          <table className="data-table">
            <thead><tr><th>رقم الطلب</th><th>المريض</th><th>النوع</th><th>الدراسة</th><th>المصدر</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono text-xs">{o.order_number}</td>
                  <td>{o.patient?.display_name ?? o.patient_id}</td>
                  <td>{o.modality ?? '—'}</td>
                  <td>{o.study_description}</td>
                  <td>{o.source === 'device' ? (o.source_device?.name ?? 'جهاز') : 'يدوي'}</td>
                  <td>
                    <Badge
                      tone={o.status === 'completed' ? 'success' : o.status === 'cancelled' ? 'danger' : o.status === 'result_received' ? 'warning' : 'neutral'}
                      dot
                    >
                      {statusLabels[o.status] ?? o.status}
                    </Badge>
                  </td>
                  <td className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openOrder(o)}>
                      <Eye className="h-3.5 w-3.5" /> عرض
                    </Button>
                    {o.report && o.status === 'completed' ? (
                      <Button size="sm" variant="ghost" onClick={() => printReport(o)}>
                        <Printer className="h-3.5 w-3.5" /> طباعة
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={ScanLine} title={t('common.noData')} />}
        {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
      </div>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `نتيجة الطلب ${selected.order_number}` : ''}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>إغلاق</Button>
            <Button
              loading={confirmMutation.isPending}
              disabled={selected?.status === 'completed' || selected?.status === 'cancelled'}
              onClick={() => selected && confirmMutation.mutate({ order: selected, report: draft })}
            >
              توقيع واعتماد النتيجة
            </Button>
          </>
        }
      >
        {selected ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-line bg-surface-muted p-3 text-sm">
              <p><strong>الدراسة:</strong> {selected.study_description}</p>
              <p><strong>المصدر:</strong> {selected.source === 'device' ? selected.source_device?.name ?? 'جهاز متصل' : 'إدخال يدوي'}</p>
              <p><strong>وقت الاستلام:</strong> {selected.result_received_at ?? '—'}</p>
            </div>
            <Field label="نص التقرير">
              <Textarea rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="اكتب التقرير أو عدّل النتيجة المستوردة قبل التوقيع" />
            </Field>
            {selected.status === 'result_received' ? (
              <p className="text-xs text-ink-muted">هذه نتيجة مستوردة من الجهاز ولم تُعتمد بعد. توقيعك مطلوب لإكمال الطلب.</p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
