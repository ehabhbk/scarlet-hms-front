import { useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import JsBarcode from 'jsbarcode'
import {
  BadgeCheck,
  CheckCircle2,
  CircleDot,
  Clock3,
  ListChecks,
  Plus,
  Printer,
  RefreshCw,
  Search,
  TestTubes,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/PageHeader'
import { api, parseApiError } from '@/lib/api'
import { useCurrentUser, usePermission } from '@/hooks/useMeta'
import { useLocale } from '@/hooks/useLocale'
import { formatDate, formatDateTime, patientDisplayName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ApiEnvelope, LabCollectionOrder, LabOrderItem } from '@/lib/types'

const fullAccessRoles = ['admin', 'super_admin', 'laboratory_supervisor']

function canCollectSamples(user: ReturnType<typeof useCurrentUser>): boolean {
  const roles = user?.role_names ?? []
  return !roles.includes('laboratory_technician') || roles.some((role) => fullAccessRoles.includes(role))
}

type CollectionFilter = 'all' | 'pending' | 'partial' | 'collected'

function collectionRingStyle(
  state: LabCollectionOrder['collection_status'],
): { shell: string; label: string; tone: BadgeTone; icon?: ComponentType<{ className?: string }> } {
  if (state === 'collected') {
    return {
      shell: 'border-emerald-700 bg-emerald-600 text-white shadow-emerald-200',
      label: 'مجموعة',
      tone: 'success',
      icon: BadgeCheck,
    }
  }

  if (state === 'partial') {
    return {
      shell: 'border-amber-500 bg-amber-400 text-amber-950 shadow-amber-100',
      label: 'جزئي',
      tone: 'warning',
      icon: Clock3,
    }
  }

  return {
    shell: 'border-slate-200 bg-white text-scarlet-800',
    label: 'بانتظار الجمع',
    tone: 'neutral',
    icon: CircleDot,
  }
}

function paymentBadge(payment: LabCollectionOrder['payment']): { label: string; tone: BadgeTone } {
  if (!payment) return { label: 'لا توجد فاتورة', tone: 'neutral' }
  if (payment.status === 'paid') return { label: 'مدفوع', tone: 'success' }
  if (payment.status === 'partial') return { label: `مدفوع جزئياً (${payment.balance})`, tone: 'warning' }
  return { label: 'غير مدفوع', tone: 'danger' }
}

function InfoTile({ label, value, dir }: { label: string; value?: string | null; dir?: 'ltr' | 'rtl' }) {
  return (
    <div className="rounded-2xl bg-surface-sunken/70 px-3 py-2.5">
      <p className="text-[11px] font-semibold text-ink-subtle">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-ink" dir={dir} title={value ?? ''}>
        {value || '—'}
      </p>
    </div>
  )
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function barcodeSvg(value: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, value, {
    format: 'CODE128',
    width: 2,
    height: 56,
    displayValue: false,
    margin: 0,
    lineColor: '#0f172a',
  })

  return new XMLSerializer().serializeToString(svg)
}

export function SampleCollectionWorkspace({ onNewOrder }: { onNewOrder?: () => void }) {
  const locale = useLocale()
  const canManage = usePermission('laboratory.manage')
  const canCollect = canManage && canCollectSamples(useCurrentUser())
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<CollectionFilter>('all')
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

  const worklistQuery = useQuery({
    queryKey: ['lab-collection-worklist'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<LabCollectionOrder[]>>('/lab-collection-worklist')
      return data.data
    },
  })

  const invalidateWorklist = () => {
    void queryClient.invalidateQueries({ queryKey: ['lab-collection-worklist'] })
    void queryClient.invalidateQueries({ queryKey: ['lab-worklist'] })
    void queryClient.invalidateQueries({ queryKey: ['lab-order-items'] })
    void queryClient.invalidateQueries({ queryKey: ['lab-orders'] })
  }

  const collectItemMutation = useMutation({
    mutationFn: async (item: LabOrderItem) => {
      await api.post(`/lab-order-items/${item.id}/collect`)
    },
    onSuccess: () => {
      toast.success('تم تسجيل جمع العينة')
      invalidateWorklist()
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر تسجيل العينة'),
  })

  const collectAllMutation = useMutation({
    mutationFn: async (order: LabCollectionOrder) => {
      const { data } = await api.post<ApiEnvelope<{ collected_count: number }>>(`/lab-orders/${order.id}/collect`)
      return data.data
    },
    onSuccess: (data) => {
      toast.success(`تم تسجيل ${data?.collected_count ?? 0} عينة`)
      invalidateWorklist()
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر تسجيل العينات'),
  })

  const orders = worklistQuery.data ?? []
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null

  const totals = useMemo(() => ({
    all: orders.length,
    pending: orders.filter((order) => order.collection_status === 'pending').length,
    partial: orders.filter((order) => order.collection_status === 'partial').length,
    collected: orders.filter((order) => order.collection_status === 'collected').length,
  }), [orders])

  const visibleOrders = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return orders.filter((order) => {
      if (filter !== 'all' && order.collection_status !== filter) return false
      if (!needle) return true

      const haystack = [
        order.order_number,
        patientDisplayName(order.patient, locale),
        order.patient?.mrn ?? '',
        order.doctor?.name ?? '',
        ...(order.items ?? []).map((item) => item.test?.name_ar ?? item.test?.name_en ?? item.test?.code ?? ''),
      ].join(' ').toLowerCase()

      return haystack.includes(needle)
    })
  }, [orders, search, filter, locale])

  const printBarcode = (order: LabCollectionOrder) => {
    const value = String(order.order_number)
    const patient = escapeHtml(patientDisplayName(order.patient, locale))
    const mrn = escapeHtml(order.patient?.mrn ?? '—')
    const items = order.items ?? []

    // One physical sample tube per ordered test: print one barcode per item.
    const labels = items.map((item, index) => {
      const testName = escapeHtml(item.test?.name_ar ?? item.test?.name_en ?? item.test?.code ?? '—')
      const testCode = escapeHtml(item.test?.code ?? '—')

      return `<div class="label">
    <div class="sample">عينة رقم ${value}</div>
    <div class="meta"><span>${patient}</span><span dir="ltr">${mrn}</span></div>
    <div class="tests">${testName} <span dir="ltr">(${testCode})</span></div>
    <div class="count">عينة ${index + 1} من ${items.length}</div>
    <div class="barcode">${barcodeSvg(value)}</div>
  </div>`
    }).join('\n')

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>باركود عينات رقم ${value} (${items.length})</title>
<style>
  @page { size: 80mm 50mm; margin: 3mm; }
  body { font-family: Tahoma, Arial, sans-serif; margin: 0; color: #0f172a; }
  .label { border: 1px dashed #94a3b8; border-radius: 8px; padding: 6px; text-align: center; break-after: page; page-break-after: always; }
  .label:last-child { break-after: auto; page-break-after: auto; }
  .sample { font-size: 20px; font-weight: 900; letter-spacing: 1px; }
  .meta { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; margin: 4px 0; }
  .tests { font-size: 10px; font-weight: 700; }
  .count { font-size: 9px; color: #64748b; margin: 3px 0 5px; }
  .barcode svg { width: 100%; height: 19mm; }
</style>
</head>
<body>
${labels}
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`

    const printWindow = window.open('', '_blank', 'width=420,height=320')
    if (!printWindow) {
      toast.error('اسمح للمتصفح بفتح نافذة الطباعة')
      return
    }

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
  }

  if (worklistQuery.isLoading) {
    return (
      <div className="card flex min-h-64 flex-col items-center justify-center gap-3">
        <RefreshCw className="h-7 w-7 animate-spin text-scarlet-700" />
        <p className="text-sm text-ink-muted">جارٍ تجهيز قائمة جمع العينات...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs text-ink-subtle">كل الطلبات</p>
          <p className="mt-1 text-2xl font-extrabold text-ink">{totals.all}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-subtle">بانتظار الجمع</p>
          <p className="mt-1 text-2xl font-extrabold text-scarlet-800">{totals.pending}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-subtle">تم جمع جزء منها</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">{totals.partial}</p>
        </div>
        <div className="card flex items-center justify-between gap-2 p-4">
          <div>
            <p className="text-xs text-ink-subtle">عينات مكتملة</p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-700">{totals.collected}</p>
          </div>
          {canManage && onNewOrder ? (
            <Button size="sm" onClick={onNewOrder}>
              <Plus className="h-3.5 w-3.5" /> طلب جديد
            </Button>
          ) : null}
        </div>
      </section>

      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-black text-ink">
            <ListChecks className="h-4 w-4 text-scarlet-700" /> حلقة طلبات العينات
            <span className="text-[11px] font-normal text-ink-subtle">رقم العينة = رقم الطلب</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-ink-muted">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-slate-200 bg-white" /> بانتظار</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> جزئي</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> مكتمل</span>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <Input
              className="ps-9"
              placeholder="بحث بالاسم أو رقم الملف أو العينة أو الفحص..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex gap-1 rounded-xl border border-line bg-surface-muted/40 p-1">
            {([
              { value: 'all', label: `الكل (${totals.all})` },
              { value: 'pending', label: `بانتظار (${totals.pending})` },
              { value: 'partial', label: `جزئي (${totals.partial})` },
              { value: 'collected', label: `مكتمل (${totals.collected})` },
            ] as { value: CollectionFilter; label: string }[]).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[11px] font-bold transition',
                  filter === item.value ? 'bg-scarlet-800 text-white' : 'text-ink-muted hover:bg-surface',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="ghost" loading={worklistQuery.isFetching} onClick={() => void worklistQuery.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> تحديث
          </Button>
        </div>

        {visibleOrders.length ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleOrders.map((order) => {
              const ring = collectionRingStyle(order.collection_status)
              const RingIcon = ring.icon

              return (
                <button
                  key={order.id}
                  type="button"
                  title={`عينة ${order.order_number} — ${ring.label}`}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={cn(
                    'relative flex w-24 shrink-0 flex-col items-center gap-1 rounded-xl border p-1.5 transition',
                    selectedOrderId === order.id
                      ? 'border-scarlet-300 bg-scarlet-50 ring-1 ring-scarlet-200'
                      : 'border-line/60 hover:border-scarlet-200 hover:bg-surface-muted',
                  )}
                >
                  <span
                    className={cn(
                      'relative grid h-9 w-9 place-items-center rounded-full border-2 text-[11px] font-black shadow-sm transition',
                      ring.shell,
                    )}
                    dir="ltr"
                  >
                    {order.order_number}
                    {RingIcon ? (
                      <span className="absolute -bottom-1 -end-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-white text-scarlet-700 shadow ring-1 ring-black/5">
                        <RingIcon className="h-2.5 w-2.5" />
                      </span>
                    ) : null}
                  </span>
                  <span className="max-w-20 truncate text-[10px] font-bold text-ink">
                    {patientDisplayName(order.patient, locale)}
                  </span>
                  <span className="text-[9px] font-bold text-ink-subtle">
                    {ring.label} · {order.collected_count}/{order.tests_count}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={TestTubes}
            title="لا توجد طلبات مطابقة"
            description={orders.length ? 'جرّب تعديل البحث أو الفلتر.' : 'أنشئ طلب فحص جديد لتبدأ سير العمل.'}
          />
        )}
      </section>

      <Modal
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrderId(null)}
        title={selectedOrder ? `سحب عينة رقم ${selectedOrder.order_number}` : ''}
        size="2xl"
        footer={selectedOrder ? (
          <>
            <Button variant="outline" onClick={() => setSelectedOrderId(null)}>إغلاق</Button>
            <Button
              variant="secondary"
              disabled={selectedOrder.pending_count > 0}
              title={selectedOrder.pending_count > 0 ? 'اجمع كل الفحوصات أولاً' : `طباعة ${selectedOrder.items.length} باركود`}
              onClick={() => printBarcode(selectedOrder)}
            >
              <Printer className="h-3.5 w-3.5" /> طباعة الباركود ({selectedOrder.items.length})
            </Button>
            <Button
              disabled={!canCollect || selectedOrder.pending_count === 0}
              loading={collectAllMutation.isPending && collectAllMutation.variables?.id === selectedOrder.id}
              onClick={() => collectAllMutation.mutate(selectedOrder)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> جمع كل العينات
            </Button>
          </>
        ) : null}
      >
        {selectedOrder ? (
          <div className="space-y-4">
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-slate-900 via-slate-800 to-slate-700 p-4 text-white">
              <div className="pointer-events-none absolute -start-10 -top-16 h-44 w-44 rounded-full border-[22px] border-white/5" />
              <div className="relative flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 border-white/30 bg-white/10 text-2xl font-black" dir="ltr">
                    {selectedOrder.order_number}
                  </div>
                  <div>
                    <p className="text-[10px] text-white/60">بطاقة المريض والعينة</p>
                    <h3 className="mt-0.5 text-lg font-black">{patientDisplayName(selectedOrder.patient, locale)}</h3>
                    <p className="mt-0.5 text-xs text-white/70" dir="ltr">{selectedOrder.patient?.mrn ?? '—'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={collectionRingStyle(selectedOrder.collection_status).tone} dot>
                    {collectionRingStyle(selectedOrder.collection_status).label}
                  </Badge>
                  <Badge tone={paymentBadge(selectedOrder.payment).tone} dot>
                    {paymentBadge(selectedOrder.payment).label}
                  </Badge>
                </div>
              </div>
            </section>

            <section className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <InfoTile label="الهاتف" value={selectedOrder.patient?.phone} dir="ltr" />
              <InfoTile label="رقم الهوية" value={selectedOrder.patient?.national_id} dir="ltr" />
              <InfoTile
                label="الجنس"
                value={selectedOrder.patient?.gender === 'female' ? 'أنثى' : selectedOrder.patient?.gender === 'male' ? 'ذكر' : null}
              />
              <InfoTile
                label="تاريخ الميلاد"
                value={selectedOrder.patient?.date_of_birth ? formatDate(selectedOrder.patient.date_of_birth, locale) : null}
              />
              <InfoTile
                label="فرع التسجيل"
                value={selectedOrder.registration_branch?.name_ar ?? selectedOrder.registration_branch?.name_en}
              />
              <InfoTile label="وقت الطلب" value={formatDateTime(selectedOrder.ordered_at, locale)} />
              <InfoTile
                label="التأمين"
                value={selectedOrder.insurance?.provider?.name ?? selectedOrder.insurance?.policy_number}
              />
              <InfoTile
                label="الفرع"
                value={selectedOrder.branch?.name_ar ?? selectedOrder.branch?.name_en}
              />
              <InfoTile label="الطبيب الطالب" value={selectedOrder.doctor?.name} />
              <InfoTile label="أول جمع" value={formatDateTime(selectedOrder.first_collected_at, locale)} />
            </section>

            {selectedOrder.notes ? (
              <div className="rounded-2xl border border-line bg-surface-muted/40 p-3 text-xs text-ink-muted">
                <span className="font-bold text-ink">ملاحظات الطلب: </span>{selectedOrder.notes}
              </div>
            ) : null}

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-black text-ink">
                  <TestTubes className="h-4 w-4 text-scarlet-700" /> الفحوصات المطلوبة
                </h4>
                <Badge tone="neutral">{selectedOrder.collected_count} من {selectedOrder.tests_count} مجموعة</Badge>
              </div>
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>الفحص</th><th>الحالة</th><th>وقت الجمع</th><th>جامع العينة</th><th>الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrder.items ?? []).map((item) => {
                      const collected = item.sample_collected_at !== null
                      return (
                        <tr key={item.id}>
                          <td>
                            <span className="font-semibold">{item.test?.name_ar ?? item.test?.name_en ?? '—'}</span>
                            <span className="ms-2 font-mono text-[10px] text-ink-subtle" dir="ltr">{item.test?.code}</span>
                          </td>
                          <td>
                            <Badge tone={collected ? 'success' : 'warning'} dot>
                              {collected ? 'مجموعة' : 'بانتظار الجمع'}
                            </Badge>
                          </td>
                          <td className="text-xs">{formatDateTime(item.sample_collected_at, locale)}</td>
                          <td className="text-xs">{item.sample_collector_user?.name ?? '—'}</td>
                          <td>
                            {collected ? (
                              <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                                <UserRound className="h-3.5 w-3.5" /> تم التسجيل
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                disabled={!canCollect}
                                loading={collectItemMutation.isPending && collectItemMutation.variables?.id === item.id}
                                onClick={() => collectItemMutation.mutate(item)}
                              >
                                <TestTubes className="h-3.5 w-3.5" /> سحب العينة
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {!canCollect ? (
                <p className="mt-2 text-[11px] text-ink-subtle">
                  سحب العينات مسموح لموظف استقبال العينات فقط.
                </p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-line bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 text-xs font-black text-ink">
                  <Printer className="h-3.5 w-3.5 text-scarlet-700" /> معاينة ملصقات الباركود
                </h4>
                <Badge tone="neutral">
                  {(selectedOrder.items ?? []).length} ملصق
                </Badge>
              </div>
              <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {(selectedOrder.items ?? []).map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-dashed border-slate-300 p-2.5 text-center"
                  >
                    <p className="truncate text-[11px] font-bold text-ink">
                      {item.test?.name_ar ?? item.test?.name_en ?? item.test?.code ?? '—'}
                    </p>
                    <p className="mb-1 text-[9px] text-ink-subtle">
                      عينة {index + 1} من {(selectedOrder.items ?? []).length}
                    </p>
                    <div
                      className="[&_svg]:mx-auto [&_svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: barcodeSvg(String(selectedOrder.order_number)) }}
                    />
                  </div>
                ))}
              </div>
              {selectedOrder.pending_count > 0 ? (
                <p className="mt-2 text-center text-[11px] text-ink-subtle">
                  سيُفعّل الطباعة بعد تسجيل كل الفحوصات.
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
