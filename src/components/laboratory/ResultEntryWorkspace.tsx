import { useEffect, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  FlaskConical,
  Inbox,
  Info,
  ListChecks,
  PlugZap,
  Printer,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Stethoscope,
  Trash2,
  Undo2,
  UserRound,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { api, parseApiError } from '@/lib/api'
import { useCurrentUser, usePermission } from '@/hooks/useMeta'
import { useLocale } from '@/hooks/useLocale'
import { formatDate, formatDateTime, patientDisplayName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  ApiEnvelope,
  LabDevice,
  LabDeviceFetchResult,
  LabDeviceMessage,
  LabDeviceValue,
  LabOrderItem,
  LabWorklistOrder,
} from '@/lib/types'

const fullAccessRoles = ['admin', 'super_admin', 'laboratory_supervisor']

function canEnterResults(user: ReturnType<typeof useCurrentUser>): boolean {
  const roles = user?.role_names ?? []
  return !roles.includes('sample_collector') || roles.some((role) => fullAccessRoles.includes(role))
}

const flagOptions = [
  { value: '', label: 'طبيعية' },
  { value: 'low', label: 'منخفض' },
  { value: 'high', label: 'مرتفع' },
  { value: 'critical', label: 'حرج' },
  { value: 'H', label: 'مرتفع (H)' },
  { value: 'L', label: 'منخفض (L)' },
  { value: 'N', label: 'طبيعي (N)' },
]

type Tone = 'scarlet' | 'emerald' | 'sky' | 'amber' | 'violet' | 'slate' | 'rose'

const toneClasses: Record<Tone, string> = {
  scarlet: 'bg-scarlet-700 text-white hover:bg-scarlet-800 shadow-sm',
  emerald: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  sky: 'bg-sky-600 text-white hover:bg-sky-700 shadow-sm',
  amber: 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm',
  violet: 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm',
  slate: 'bg-slate-700 text-white hover:bg-slate-800 shadow-sm',
  rose: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
}

function ColorButton({
  tone,
  icon: Icon,
  children,
  onClick,
  disabled,
  loading,
  full,
  small,
  title,
  className,
}: {
  tone: Tone
  icon?: ComponentType<{ className?: string }>
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  full?: boolean
  small?: boolean
  title?: string
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition active:scale-[0.98]',
        small ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2.5 text-xs',
        full && 'w-full',
        className,
        toneClasses[tone],
        (disabled || loading) && 'cursor-not-allowed opacity-45 hover:opacity-45',
      )}
    >
      {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  )
}

function itemStatus(item: LabOrderItem): { label: string; tone: BadgeTone } {
  if (item.printed_at) return { label: 'مطبوعة', tone: 'success' }
  if (item.status === 'approved') return { label: 'معتمدة', tone: 'info' }
  if (item.status === 'entered') return { label: 'مدخلة', tone: 'warning' }
  return { label: 'بانتظار الإدخال', tone: 'neutral' }
}

function ringStyle(order: LabWorklistOrder): { shell: string; badge: string; label: string; icon?: ComponentType<{ className?: string }> } {
  const state = order.result_status ?? (order.all_approved ? 'approved' : 'empty')

  if (state === 'printed') {
    return {
      shell: 'border-emerald-700 bg-emerald-600 text-white shadow-emerald-200',
      badge: 'border-emerald-700 bg-emerald-600 text-white',
      label: 'مطبوعة',
      icon: Printer,
    }
  }

  if (state === 'approved') {
    return {
      shell: 'border-sky-700 bg-sky-600 text-white shadow-sky-200',
      badge: 'border-sky-700 bg-sky-600 text-white',
      label: 'معتمدة',
      icon: BadgeCheck,
    }
  }

  if (state === 'entered') {
    return {
      shell: 'border-amber-500 bg-amber-400 text-amber-950 shadow-amber-100',
      badge: 'border-amber-500 bg-amber-400 text-amber-950',
      label: 'مدخلة',
    }
  }

  return {
    shell: 'border-slate-200 bg-white text-scarlet-800',
    badge: 'border-slate-200 bg-white text-scarlet-800',
    label: 'فارغة',
  }
}

function paymentBadge(payment: LabWorklistOrder['payment']): { label: string; tone: BadgeTone } {
  if (!payment) return { label: 'لا توجد فاتورة', tone: 'neutral' }
  if (payment.status === 'paid') return { label: 'مدفوع', tone: 'success' }
  if (payment.status === 'partial') return { label: `مدفوع جزئياً (${payment.balance})`, tone: 'warning' }
  return { label: 'غير مدفوع', tone: 'danger' }
}

function messageTone(status: string): BadgeTone {
  if (status === 'imported') return 'success'
  if (status === 'unmatched') return 'warning'
  if (status === 'error') return 'danger'
  return 'info'
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

type ItemDraft = {
  values: Record<number, string>
  flags: Record<number, string>
  resultValue: string
  resultFlag: string
  notes: string
  deviceValues: LabDeviceValue[]
  device: LabDevice | null
  message: LabDeviceFetchResult['message'] | null
  fetched: boolean
}

function emptyDraft(): ItemDraft {
  return {
    values: {},
    flags: {},
    resultValue: '',
    resultFlag: '',
    notes: '',
    deviceValues: [],
    device: null,
    message: null,
    fetched: false,
  }
}

function draftFromItem(item: LabOrderItem): ItemDraft {
  return {
    values: Object.fromEntries(
      (item.values ?? []).map((value) => [value.lab_test_parameter_id, value.value ?? '']),
    ),
    flags: Object.fromEntries(
      (item.values ?? []).map((value) => [value.lab_test_parameter_id, value.flag ?? '']),
    ),
    resultValue: item.result_value ?? '',
    resultFlag: item.flag ?? '',
    notes: item.notes ?? '',
    deviceValues: [],
    device: item.assigned_device ?? null,
    message: null,
    fetched: false,
  }
}

function devicesForOrder(order: LabWorklistOrder): LabDevice[] {
  const devices = new Map<number, LabDevice>()
  for (const item of order.items) {
    if (item.assigned_device) devices.set(item.assigned_device.id, item.assigned_device)
  }
  return [...devices.values()]
}

/* -------------------------------------------------------------------------- */
/* Result entry workspace                                                     */
/* -------------------------------------------------------------------------- */

export function ResultEntryWorkspace() {
  const locale = useLocale()
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const canManage = usePermission('laboratory.manage')
  const canApprove = usePermission('laboratory.approve')
  const canEnter = canManage && canEnterResults(user)

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [itemId, setItemId] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<number, ItemDraft>>({})
  const [showRanges, setShowRanges] = useState(true)
  const [autoFetch, setAutoFetch] = useState(() => {
    try {
      return localStorage.getItem('scarlet-lab-auto-fetch') === '1'
    } catch {
      return false
    }
  })
  const [autoFetching, setAutoFetching] = useState(false)
  const [fetchingItemId, setFetchingItemId] = useState<number | null>(null)
  const [testingDevices, setTestingDevices] = useState(false)
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [messages, setMessages] = useState<LabDeviceMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [busyMessageId, setBusyMessageId] = useState<number | null>(null)

  const worklistQuery = useQuery({
    queryKey: ['lab-worklist'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<LabWorklistOrder[]>>('/lab-worklist')
      return data.data
    },
  })

  const orders = worklistQuery.data ?? []
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? orders[0] ?? null
  const items = selectedOrder?.items ?? []
  const selectedItem = items.find((item) => item.id === itemId) ?? items[0] ?? null
  const parameters = selectedItem?.test?.parameters ?? []
  const draft = selectedItem ? (drafts[selectedItem.id] ?? draftFromItem(selectedItem)) : emptyDraft()
  const mappedDevices = selectedOrder ? devicesForOrder(selectedOrder) : []
  const payment = paymentBadge(selectedOrder?.payment)
  const status = selectedItem ? itemStatus(selectedItem) : { label: 'فارغة', tone: 'neutral' as BadgeTone }
  const canPrint = Boolean(selectedOrder?.all_approved && selectedOrder.items.length)
  const remainingApprovals = selectedOrder?.items.filter((item) => item.status !== 'approved') ?? []
  const selectedIsApproved = selectedItem?.status === 'approved'

  useEffect(() => {
    setDrafts((prev) => {
      let changed = false
      const next = { ...prev }

      for (const order of orders) {
        for (const item of order.items) {
          if (!next[item.id]) {
            next[item.id] = draftFromItem(item)
            changed = true
          }
        }
      }

      return changed ? next : prev
    })
  }, [worklistQuery.data])

  useEffect(() => {
    try {
      localStorage.setItem('scarlet-lab-auto-fetch', autoFetch ? '1' : '0')
    } catch {
      // Local storage may be disabled; the toggle still works for this session.
    }
  }, [autoFetch])

  function invalidateWorklist() {
    void queryClient.invalidateQueries({ queryKey: ['lab-worklist'] })
    void queryClient.invalidateQueries({ queryKey: ['lab-order-items'] })
  }

  function applyResults(
    results: LabDeviceFetchResult[],
    overwrite: boolean,
    orderItems: LabOrderItem[],
  ): number {
    setDrafts((prev) => {
      const next = { ...prev }

      for (const result of results) {
        const item = orderItems.find((entry) => entry.id === result.lab_order_item_id)
        if (!item) continue

        const current = next[item.id] ?? draftFromItem(item)
        const values = { ...current.values }
        const flags = { ...current.flags }
        let resultValue = current.resultValue
        let resultFlag = current.resultFlag

        for (const value of result.values) {
          if (value.parameter_id === 0) {
            if (overwrite || !resultValue) resultValue = value.value
            if (value.flag && (overwrite || !resultFlag)) resultFlag = value.flag
          } else {
            if (overwrite || !values[value.parameter_id]) values[value.parameter_id] = value.value
            if (value.flag && (overwrite || !flags[value.parameter_id])) flags[value.parameter_id] = value.flag
          }
        }

        next[item.id] = {
          ...current,
          values,
          flags,
          resultValue,
          resultFlag,
          deviceValues: result.values,
          device: result.device ?? current.device,
          message: result.message,
          fetched: true,
        }
      }

      return next
    })

    return results.reduce((total, result) => total + result.values.length, 0)
  }

  async function fetchAll(order: LabWorklistOrder, overwrite = false, silent = false) {
    setAutoFetching(true)

    try {
      const { data } = await api.get<ApiEnvelope<LabDeviceFetchResult[]>>(
        `/lab-orders/${order.id}/device-values`,
      )
      const count = applyResults(data.data, overwrite, order.items)

      if (!silent) {
        if (data.data.length) {
          toast.success(`تم جلب ${count} قيمة من ${data.data.length} فحص جاهز`)
        } else {
          toast.info('لا توجد نتائج جاهزة من الأجهزة لهذه العينة')
        }
      }
    } catch (error) {
      if (!silent) toast.error(parseApiError(error).message || 'تعذر جلب نتائج الأجهزة')
    } finally {
      setAutoFetching(false)
    }
  }

  useEffect(() => {
    if (autoFetch && selectedOrder) void fetchAll(selectedOrder, false, true)
    // The sample id is the trigger; manual refreshes are handled by the buttons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, selectedOrder?.id])

  async function fetchOne(item: LabOrderItem) {
    setFetchingItemId(item.id)

    try {
      const { data } = await api.get<ApiEnvelope<LabDeviceFetchResult | null>>(
        `/lab-order-items/${item.id}/device-values`,
      )

      if (!data.data) {
        toast.info(`لا توجد نتيجة جاهزة لـ ${item.test?.name_ar ?? 'هذا الفحص'}`)
        return
      }

      const count = applyResults([data.data], true, items)
      toast.success(`تم جلب ${count} قيمة من ${data.data.device?.name ?? 'الجهاز'} للمراجعة`)
    } catch (error) {
      toast.error(parseApiError(error).message || 'تعذر جلب نتيجة الفحص')
    } finally {
      setFetchingItemId(null)
    }
  }

  async function testMappedDevices() {
    if (!mappedDevices.length) {
      toast.info('لا توجد أجهزة مرتبطة بفحوص هذه العينة')
      return
    }

    setTestingDevices(true)

    const checks = await Promise.all(
      mappedDevices.map(async (device) => {
        try {
          const { data } = await api.post<ApiEnvelope<{ ok: boolean; message: string }>>(
            `/lab-devices/${device.id}/test-connection`,
          )
          return { device, ok: data.data.ok }
        } catch (error) {
          return { device, ok: false, message: parseApiError(error).message }
        }
      }),
    )

    const connected = checks.filter((check) => check.ok).length
    const summary = checks.map((check) => `${check.device.code}: ${check.ok ? 'متصل' : 'غير متصل'}`).join(' | ')

    if (connected === checks.length) toast.success(`كل الأجهزة متصلة — ${summary}`)
    else toast.error(`${connected}/${checks.length} أجهزة متصلة — ${summary}`)

    setTestingDevices(false)
  }

  async function loadMessages(showModal = true): Promise<LabDeviceMessage[]> {
    if (!selectedOrder) return []
    setLoadingMessages(true)

    try {
      const searches = [selectedOrder.order_number]
      if (selectedOrder.patient?.mrn) searches.push(selectedOrder.patient.mrn)

      const responses = await Promise.all(
        searches.map((search) =>
          api.get<ApiEnvelope<LabDeviceMessage[]>>('/lab-device-messages', {
            params: { search, per_page: 20 },
          }),
        ),
      )

      const unique = new Map<number, LabDeviceMessage>()
      for (const response of responses) {
        for (const message of response.data.data) unique.set(message.id, message)
      }

      const sorted = [...unique.values()].sort(
        (a, b) => new Date(b.received_at ?? 0).getTime() - new Date(a.received_at ?? 0).getTime(),
      )
      setMessages(sorted)
      if (showModal) setMessagesOpen(true)
      if (showModal && sorted.length === 0) toast.info('لا توجد رسائل جهاز مرتبطة بهذا الرقم')
      return sorted
    } catch (error) {
      toast.error(parseApiError(error).message || 'تعذر جلب رسائل الأجهزة')
      return []
    } finally {
      setLoadingMessages(false)
    }
  }

  async function reprocessMessage(message: LabDeviceMessage) {
    setBusyMessageId(message.id)

    try {
      const { data } = await api.post<ApiEnvelope<LabDeviceMessage>>(
        `/lab-device-messages/${message.id}/reprocess`,
      )
      setMessages((prev) => prev.map((entry) => (entry.id === message.id ? data.data : entry)))
      toast.success('تمت إعادة معالجة الرسالة')
      invalidateWorklist()
    } catch (error) {
      toast.error(parseApiError(error).message || 'تعذر إعادة المعالجة')
    } finally {
      setBusyMessageId(null)
    }
  }

  async function persistResult() {
    if (!selectedItem) return

    if (parameters.length) {
      await api.post(`/lab-order-items/${selectedItem.id}/values`, {
        values: parameters.map((parameter) => ({
          parameter_id: parameter.id,
          value: draft.values[parameter.id] ?? '',
          flag: draft.flags[parameter.id] || null,
        })),
      })
    } else {
      await api.post(`/lab-order-items/${selectedItem.id}/result`, {
        result_value: draft.resultValue,
        flag: draft.resultFlag || null,
        notes: draft.notes || null,
      })
    }
  }

  const saveMutation = useMutation({
    mutationFn: persistResult,
    onSuccess: () => {
      toast.success('تم حفظ النتيجة، وهي بانتظار التوقيع')
      invalidateWorklist()
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر حفظ النتيجة'),
  })

  const saveAndNextMutation = useMutation({
    mutationFn: persistResult,
    onSuccess: () => {
      toast.success('تم الحفظ — انتقل إلى الفحص التالي')
      invalidateWorklist()

      if (items.length > 1 && selectedItem) {
        const current = items.findIndex((item) => item.id === selectedItem.id)
        setItemId(items[(current + 1) % items.length]?.id ?? null)
      }
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر حفظ النتيجة'),
  })

  const approveMutation = useMutation({
    mutationFn: async (item: LabOrderItem) => {
      await api.post(`/lab-order-items/${item.id}/approve`)
    },
    onSuccess: () => {
      toast.success('تم توقيع واعتماد النتيجة')
      invalidateWorklist()
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر اعتماد النتيجة'),
  })

  const unapproveMutation = useMutation({
    mutationFn: async (item: LabOrderItem) => {
      await api.post(`/lab-order-items/${item.id}/unapprove`)
    },
    onSuccess: () => {
      toast.success('تم إلغاء الاعتماد — يمكنك تعديل النتيجة الآن')
      invalidateWorklist()
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر إلغاء الاعتماد'),
  })

  const printMutation = useMutation({
    mutationFn: async (order: LabWorklistOrder) => {
      await api.post(`/lab-orders/${order.id}/print`)
    },
    onSuccess: () => invalidateWorklist(),
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر تسجيل الطباعة'),
  })

  function clearFields() {
    if (!selectedItem) return

    setDrafts((prev) => ({
      ...prev,
      [selectedItem.id]: {
        ...(prev[selectedItem.id] ?? draftFromItem(selectedItem)),
        values: {},
        flags: {},
        resultValue: '',
        resultFlag: '',
        notes: '',
        deviceValues: [],
        message: null,
        fetched: false,
      },
    }))
    toast.success('تم تفريغ حقول الإدخال')
  }

  function printResult() {
    if (!selectedOrder || !canPrint) return
    const order = selectedOrder

    const sections = order.items
      .map((item, itemIndex) => {
        const parameters = item.test?.parameters ?? []
        const storedValues = item.values ?? []

        const rows = parameters.length
          ? parameters
              .map((parameter, index) => {
                const value = storedValues.find((entry) => entry.lab_test_parameter_id === parameter.id)
                return `<tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(parameter.name_ar)}</td>
                  <td>${escapeHtml(value?.value ?? '—')}</td>
                  <td>${escapeHtml(parameter.unit ?? '—')}</td>
                  <td>${escapeHtml(parameter.reference_range ?? '—')}</td>
                  <td>${escapeHtml(value?.flag ?? '—')}</td>
                </tr>`
              })
              .join('')
          : `<tr><td>1</td><td>النتيجة</td><td>${escapeHtml(item.result_value ?? '—')}</td><td>${escapeHtml(item.result_unit ?? '—')}</td><td>—</td><td>${escapeHtml(item.flag ?? '—')}</td></tr>`

        return `<section class="report-block">
  <h2>${itemIndex + 1}. ${escapeHtml(item.test?.name_ar ?? '—')} <small>${escapeHtml(item.test?.code ?? '')}</small></h2>
  <div class="meta">المُدخل: ${escapeHtml(item.entered_by_user?.name ?? '—')} &nbsp;|&nbsp; المُعتمد: ${escapeHtml(item.approved_by_user?.name ?? '—')}</div>
  <table><thead><tr><th>#</th><th>البراميتر</th><th>القيمة</th><th>الوحدة</th><th>المدى الطبيعي</th><th>العلامة</th></tr></thead><tbody>${rows}</tbody></table>
</section>`
      })
      .join('')

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>نتيجة مختبر شاملة — عينة ${escapeHtml(order.order_number)}</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; color: #1a1a1a; margin: 28px; }
  header { display: flex; justify-content: space-between; border-bottom: 3px solid #7a1028; padding-bottom: 12px; margin-bottom: 18px; }
  h1 { font-size: 22px; margin: 0; color: #7a1028; }
  h2 { font-size: 16px; margin: 0 0 6px; color: #7a1028; }
  small { font-size: 11px; color: #666; font-weight: normal; }
  .meta { font-size: 12px; line-height: 1.8; }
  .patient { background: #f8f4f5; border: 1px solid #e3d5d9; padding: 10px 14px; border-radius: 6px; margin-bottom: 18px; }
  .report-block { margin-bottom: 20px; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #bbb; padding: 7px; text-align: right; }
  th { background: #f3e9ec; }
  footer { margin-top: 26px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 11px; display: flex; justify-content: space-between; }
  @page { margin: 18mm; }
</style>
</head>
<body>
<header>
  <div><h1>Scarlet Care — تقرير نتيجة مختبر شامل</h1><div class="meta">مستشفى سكارلت العام</div></div>
  <div class="meta">رقم العينة: <strong>${escapeHtml(order.order_number)}</strong><br />التاريخ: ${escapeHtml(new Date().toLocaleString('ar-SD'))}<br />عدد الفحوصات: ${order.items.length}</div>
</header>
<div class="patient meta">
  <strong>المريض:</strong> ${escapeHtml(patientDisplayName(order.patient, 'ar'))} &nbsp;|&nbsp;
  <strong>رقم الملف:</strong> ${escapeHtml(order.patient?.mrn ?? '—')} &nbsp;|&nbsp;
  <strong>الطبيب:</strong> ${escapeHtml(order.doctor?.name ?? '—')}<br />
  <strong>الفرع:</strong> ${escapeHtml(order.branch?.name_ar ?? '—')}
</div>
${sections}
<footer>
  <div>إجمالي الفحوصات: ${order.items.length} — جميع النتائج مدخلة ومعتمدة</div>
  <div>توقيع المُعتمد: ${escapeHtml(order.items[0]?.approved_by_user?.name ?? '—')}</div>
</footer>
<script>window.onload = function () { window.print(); };</script>
</body>
</html>`

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      toast.error('اسمح للمتصفح بفتح نافذة الطباعة')
      return
    }

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()

    printMutation.mutate(order)
  }

  if (worklistQuery.isLoading) {
    return (
      <div className="card flex min-h-64 flex-col items-center justify-center gap-3">
        <RefreshCw className="h-7 w-7 animate-spin text-scarlet-700" />
        <p className="text-sm text-ink-muted">جارٍ تجهيز قائمة العينات...</p>
      </div>
    )
  }

  if (!selectedOrder || !selectedItem) {
    return (
      <div className="card flex min-h-72 flex-col items-center justify-center gap-3 p-12 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-scarlet-50">
          <FlaskConical className="h-8 w-8 text-scarlet-700" />
        </div>
        <div>
          <p className="text-lg font-black text-ink">لا توجد عينات بانتظار إدخال النتائج</p>
          <p className="mt-1 text-sm text-ink-muted">اجمع العينات أولاً من قسم «جمع العينات» ليظهر المرضى هنا.</p>
        </div>
        <Button variant="secondary" onClick={() => void worklistQuery.refetch()}>
          <RefreshCw className="h-4 w-4" /> تحديث القائمة
        </Button>
      </div>
    )
  }

  const insuranceLabel = selectedOrder.insurance
    ? `تأمين: ${selectedOrder.insurance.provider?.name ?? selectedOrder.insurance.policy_number}`
    : 'بدون تأمين'

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-scarlet-950 via-scarlet-900 to-scarlet-700 p-5 text-white shadow-lift">
        <div className="pointer-events-none absolute -start-16 -top-24 h-64 w-64 rounded-full border-[30px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-24 end-16 h-56 w-56 rounded-full bg-white/5 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div
              className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-4 border-white/30 bg-white/10 text-3xl font-black shadow-inner"
              dir="ltr"
            >
              {selectedOrder.order_number}
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-white/60">
                <Sparkles className="h-3.5 w-3.5" /> Scarlet Care · Result Workspace
              </p>
              <h1 className="mt-1 text-2xl font-black">عينة رقم {selectedOrder.order_number}</h1>
              <p className="mt-1 text-sm text-white/70">كل فحص يُجلب من جهازه المخصص تلقائياً برقم العينة</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold ring-1 ring-white/20">
              {patientDisplayName(selectedOrder.patient, locale)}
            </span>
            <Badge tone={status.tone} dot>{status.label}</Badge>
            <Badge tone={payment.tone} dot>{payment.label}</Badge>
          </div>
        </div>
      </section>

      {/* Sample orbit */}
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-black text-ink">
            <ListChecks className="h-4 w-4 text-scarlet-700" /> مسار العينات
            <span className="text-[11px] font-normal text-ink-subtle">رقم العينة = رقم الطلب</span>
          </h2>
          <Badge tone="scarlet">{orders.length} عينة</Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {orders.map((order, index) => {
            const active = order.id === selectedOrder.id
            const ring = ringStyle(order)
            const RingIcon = ring.icon

            return (
              <button
                key={order.id}
                type="button"
                title={`عينة ${order.order_number} — ${ring.label}`}
                onClick={() => {
                  setSelectedOrderId(order.id)
                  setItemId(order.items[0]?.id ?? null)
                }}
                className={cn(
                  'relative flex w-24 shrink-0 flex-col items-center gap-1 rounded-xl border p-1.5 transition',
                  active
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
                <span className={cn('max-w-20 truncate text-[10px] font-bold', active ? 'text-scarlet-900' : 'text-ink')}>
                  {patientDisplayName(order.patient, locale)}
                </span>
                <span className={cn('text-[9px] font-bold', ring.label === 'مطبوعة' ? 'text-emerald-700' : ring.label === 'معتمدة' ? 'text-sky-700' : ring.label === 'مدخلة' ? 'text-amber-700' : 'text-ink-subtle')}>
                  {ring.label} · {order.tests_count} فحص
                </span>
                <span className="sr-only">#{index + 1}</span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0 space-y-4">
          {/* Patient */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-l from-slate-900 via-slate-800 to-slate-700 px-5 py-3.5 text-white">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] text-white/60">بطاقة المريض والتسجيل</p>
                  <p className="text-base font-black">{patientDisplayName(selectedOrder.patient, locale)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-white/10 px-2.5 py-1" dir="ltr">{selectedOrder.patient?.mrn ?? '—'}</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1">{selectedOrder.doctor?.name ?? '—'}</span>
              </div>
            </div>

            <div className="grid gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
                value={nameOfBranch(locale, selectedOrder.registration_branch?.name_ar, selectedOrder.registration_branch?.name_en)}
              />
              <InfoTile label="وقت الطلب" value={formatDateTime(selectedOrder.ordered_at, locale)} />
              <InfoTile label="التأمين" value={insuranceLabel} />
              <InfoTile
                label="الفرع"
                value={nameOfBranch(locale, selectedOrder.branch?.name_ar, selectedOrder.branch?.name_en)}
              />
            </div>
          </section>

          {/* Tests */}
          <section className="card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-black text-ink">
                  <Activity className="h-4 w-4 text-scarlet-700" /> فحوصات العينة
                  <Badge tone="neutral">{items.length}</Badge>
                </h2>
                <p className="mt-0.5 text-[11px] text-ink-subtle">الجهاز المخصص ظاهر تحت كل فحص — لا حاجة لاختياره يدوياً</p>
              </div>
              <div className="flex items-center gap-1.5">
                <ColorButton
                  tone="slate"
                  small
                  icon={ChevronRight}
                  onClick={() => {
                    const current = items.findIndex((item) => item.id === selectedItem.id)
                    setItemId(items[(current - 1 + items.length) % items.length]?.id ?? null)
                  }}
                >
                  السابق
                </ColorButton>
                <ColorButton
                  tone="slate"
                  small
                  icon={ChevronLeft}
                  onClick={() => {
                    const current = items.findIndex((item) => item.id === selectedItem.id)
                    setItemId(items[(current + 1) % items.length]?.id ?? null)
                  }}
                >
                  التالي
                </ColorButton>
              </div>
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-2">
              {items.map((item, index) => {
                const itemState = itemStatus(item)
                const active = item.id === selectedItem.id
                const device = item.assigned_device
                const isFetched = drafts[item.id]?.fetched

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'min-w-56 shrink-0 rounded-2xl border p-3 transition',
                      active
                        ? 'border-scarlet-400 bg-scarlet-50 ring-2 ring-scarlet-100'
                        : 'border-line bg-surface hover:border-scarlet-200',
                    )}
                  >
                    <button type="button" onClick={() => setItemId(item.id)} className="w-full text-start">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-sunken text-[10px] font-black text-ink-subtle">
                          {index + 1}
                        </span>
                        <Badge tone={itemState.tone}>{itemState.label}</Badge>
                      </div>
                      <p className="truncate text-sm font-bold text-ink">{item.test?.name_ar ?? '—'}</p>
                      <p className="mt-0.5 truncate text-[10px] text-ink-subtle" dir="ltr">{item.test?.code}</p>
                      <div className="mt-2 flex items-center gap-1 text-[10px]">
                        {device ? <Wifi className="h-3 w-3 text-emerald-600" /> : <WifiOff className="h-3 w-3 text-slate-400" />}
                        <span className="truncate font-semibold text-ink-muted">{device?.code ?? 'لا يوجد جهاز مرتبط'}</span>
                        {isFetched ? <BadgeCheck className="h-3 w-3 text-emerald-600" /> : null}
                      </div>
                    </button>

                    {item.status === 'approved' ? (
                      <div className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-sky-50 py-1.5 text-[10px] font-bold text-sky-700">
                        <BadgeCheck className="h-3 w-3" /> معتمدة — جاهزة للطباعة
                      </div>
                    ) : (
                      <ColorButton
                        tone="sky"
                        small
                        full
                        className="mt-2"
                        icon={Download}
                        loading={fetchingItemId === item.id}
                        onClick={() => void fetchOne(item)}
                      >
                        جلب كل قيم الفحص
                      </ColorButton>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Result entry */}
          <section className="card p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-black text-ink">إدخال النتيجة — {selectedItem.test?.name_ar ?? '—'}</h2>
                  {selectedItem.source === 'device' ? (
                    <Badge tone="info" dot>مستوردة — بانتظار التوقيع</Badge>
                  ) : null}
                  {draft.fetched ? <Badge tone="success" dot>مُجلّبة للمراجعة</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {draft.device
                    ? `الجهاز المخصص: ${draft.device.name} (${draft.device.protocol}) — ${draft.device.host ?? '—'}:${draft.device.port ?? '—'}`
                    : 'لا يوجد جهاز مرتبط بهذا الفحص في إعدادات الأجهزة.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ColorButton
                  tone="emerald"
                  icon={Zap}
                  loading={autoFetching}
                  onClick={() => void fetchAll(selectedOrder, true)}
                >
                  جلب كل النتائج الجاهزة
                </ColorButton>
                <ColorButton
                  tone={showRanges ? 'violet' : 'slate'}
                  icon={Info}
                  onClick={() => setShowRanges((value) => !value)}
                >
                  {showRanges ? 'إخفاء المدى الطبيعي' : 'إظهار المدى الطبيعي'}
                </ColorButton>
              </div>
            </div>

            {selectedIsApproved ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
                <p className="flex items-center gap-2 text-xs font-bold text-sky-800">
                  <BadgeCheck className="h-4 w-4" />
                  النتيجة معتمدة ولا يمكن تعديلها. يمكنك سحب الاعتماد لإعادة التعديل ثم إعادة التوقيع.
                </p>
                {canApprove ? (
                  <ColorButton
                    tone="rose"
                    small
                    icon={Undo2}
                    loading={unapproveMutation.isPending && unapproveMutation.variables?.id === selectedItem.id}
                    onClick={() => unapproveMutation.mutate(selectedItem)}
                  >
                    إلغاء الاعتماد والتعديل
                  </ColorButton>
                ) : null}
              </div>
            ) : null}

            {parameters.length ? (
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>البراميتر</th>
                      <th>الوحدة</th>
                      <th>المدى الطبيعي</th>
                      <th>القيمة</th>
                      <th>العلامة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parameters.map((parameter, index) => {
                      const fromDevice = draft.deviceValues.some((value) => value.parameter_id === parameter.id)

                      return (
                        <tr key={parameter.id}>
                          <td className="text-xs text-ink-subtle">{index + 1}</td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-ink">{parameter.name_ar}</p>
                              {fromDevice ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="من الجهاز" /> : null}
                            </div>
                            <p className="text-[10px] text-ink-subtle" dir="ltr">{parameter.code}</p>
                          </td>
                          <td className="text-xs">{parameter.unit ?? '—'}</td>
                          <td className="text-xs">
                            {showRanges ? (parameter.reference_range ?? '—') : <span className="text-ink-subtle">مخفي</span>}
                          </td>
                          <td>
                            <Input
                              className="w-28"
                              disabled={selectedIsApproved}
                              value={draft.values[parameter.id] ?? ''}
                              onChange={(event) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [selectedItem.id]: {
                                    ...(prev[selectedItem.id] ?? draftFromItem(selectedItem)),
                                    values: { ...(prev[selectedItem.id] ?? draftFromItem(selectedItem)).values, [parameter.id]: event.target.value },
                                  },
                                }))
                              }
                              placeholder="القيمة"
                            />
                          </td>
                          <td>
                            <Select
                              className="w-28"
                              disabled={selectedIsApproved}
                              value={draft.flags[parameter.id] ?? ''}
                              onChange={(event) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [selectedItem.id]: {
                                    ...(prev[selectedItem.id] ?? draftFromItem(selectedItem)),
                                    flags: { ...(prev[selectedItem.id] ?? draftFromItem(selectedItem)).flags, [parameter.id]: event.target.value },
                                  },
                                }))
                              }
                            >
                              {flagOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </Select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-bold text-ink">قيمة النتيجة</p>
                  <Input
                    disabled={selectedIsApproved}
                    value={draft.resultValue}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [selectedItem.id]: {
                          ...(prev[selectedItem.id] ?? draftFromItem(selectedItem)),
                          resultValue: event.target.value,
                        },
                      }))
                    }
                    placeholder="مثال: 13.5"
                    dir="ltr"
                  />
                  {showRanges && selectedItem.test?.reference_range ? (
                    <p className="mt-1 text-[11px] text-ink-subtle">المدى الطبيعي: {selectedItem.test.reference_range}</p>
                  ) : null}
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold text-ink">العلامة</p>
                  <Select
                    disabled={selectedIsApproved}
                    value={draft.resultFlag}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [selectedItem.id]: {
                          ...(prev[selectedItem.id] ?? draftFromItem(selectedItem)),
                          resultFlag: event.target.value,
                        },
                      }))
                    }
                  >
                    {flagOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <p className="mb-1 text-xs font-bold text-ink">ملاحظات</p>
                  <Input
                    disabled={selectedIsApproved}
                    value={draft.notes}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [selectedItem.id]: {
                          ...(prev[selectedItem.id] ?? draftFromItem(selectedItem)),
                          notes: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="sticky bottom-3 z-10 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-lift backdrop-blur">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                <Stethoscope className="h-4 w-4" />
                <span>{selectedOrder.doctor?.name ?? '—'}</span>
                <span>•</span>
                <Building2 className="h-4 w-4" />
                <span>{nameOfBranch(locale, selectedOrder.branch?.name_ar, selectedOrder.branch?.name_en)}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedItem.status !== 'approved' ? (
                  <>
                    <ColorButton
                      tone="sky"
                      icon={Save}
                      disabled={!canEnter}
                      loading={saveMutation.isPending}
                      onClick={() => saveMutation.mutate()}
                    >
                      حفظ
                    </ColorButton>
                    <ColorButton
                      tone="violet"
                      icon={Save}
                      disabled={!canEnter}
                      loading={saveAndNextMutation.isPending}
                      onClick={() => saveAndNextMutation.mutate()}
                    >
                      حفظ والتالي
                    </ColorButton>
                  </>
                ) : null}

                {canApprove && selectedItem.status === 'entered' ? (
                  <ColorButton
                    tone="emerald"
                    icon={CheckCircle2}
                    loading={approveMutation.isPending && approveMutation.variables?.id === selectedItem.id}
                    onClick={() => approveMutation.mutate(selectedItem)}
                  >
                    توقيع واعتماد
                  </ColorButton>
                ) : null}

                {canPrint ? (
                  <ColorButton
                    tone="emerald"
                    icon={Printer}
                    loading={printMutation.isPending}
                    onClick={printResult}
                  >
                    طباعة النتيجة كاملة ({selectedOrder.items.length} فحوصات)
                  </ColorButton>
                ) : remainingApprovals.length ? (
                  <ColorButton
                    tone="amber"
                    icon={CheckCircle2}
                    onClick={() => setItemId(remainingApprovals[0]?.id ?? null)}
                  >
                    تبقّى {remainingApprovals.length} فحص للاعتماد
                  </ColorButton>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-500">
                    <Info className="h-3.5 w-3.5" /> الطباعة بعد إدخال واعتماد كل الفحوصات
                  </span>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Control rail */}
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-black text-ink">
                  <Zap className="h-4 w-4 text-emerald-600" /> الجلب التلقائي
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-subtle">
                  يجلب كل النتائج الجاهزة من أجهزتها فور فتح العينة، دون اختيار جهاز.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoFetch}
                aria-label="الجلب التلقائي"
                onClick={() => setAutoFetch((value) => !value)}
                className={cn(
                  'relative h-8 w-14 shrink-0 rounded-full transition',
                  autoFetch ? 'bg-emerald-500' : 'bg-slate-300',
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all',
                    autoFetch ? 'ms-7' : 'ms-1',
                  )}
                />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-surface-muted/60 px-3 py-2 text-[11px]">
              {autoFetch ? (
                <>
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-bold text-emerald-700">مفعّل — يُحدَّث عند تغيير العينة</span>
                </>
              ) : (
                <>
                  <Info className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-ink-muted">متوقف — استخدم أزرار الجلب يدوياً</span>
                </>
              )}
            </div>
          </section>

          <section className="card p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-black text-ink">
              <Radio className="h-4 w-4 text-scarlet-700" /> أجهزة هذه العينة
            </h3>

            {mappedDevices.length ? (
              <div className="space-y-2">
                {mappedDevices.map((device) => (
                  <div key={device.id} className="rounded-xl border border-line bg-surface-muted/40 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-bold text-ink">{device.name}</p>
                      <Badge tone="neutral">{device.protocol}</Badge>
                    </div>
                    <p className="mt-1 truncate text-[10px] text-ink-subtle" dir="ltr">
                      {device.code} · {device.host ?? '—'}:{device.port ?? '—'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-[11px] text-ink-subtle">لا توجد أجهزة مرتبطة بالفحوصات.</p>
            )}

            <ColorButton
              tone="amber"
              full
              className="mt-3"
              icon={PlugZap}
              loading={testingDevices}
              onClick={() => void testMappedDevices()}
            >
              فحص اتصال الأجهزة
            </ColorButton>
          </section>

          <section className="card p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-black text-ink">
              <Cpu className="h-4 w-4 text-violet-600" /> لوحة الإجراءات
            </h3>
            <div className="grid gap-2">
              <ColorButton
                tone="emerald"
                full
                icon={Zap}
                loading={autoFetching}
                onClick={() => void fetchAll(selectedOrder, true)}
              >
                جلب كل النتائج
              </ColorButton>
              <ColorButton tone="violet" full icon={Inbox} loading={loadingMessages} onClick={() => void loadMessages()}>
                رسائل الأجهزة
              </ColorButton>
              <ColorButton tone="rose" full icon={Trash2} onClick={clearFields}>
                تفريغ الحقول
              </ColorButton>
              <ColorButton
                tone="slate"
                full
                icon={RefreshCw}
                loading={worklistQuery.isFetching}
                onClick={() => void worklistQuery.refetch()}
              >
                تحديث القائمة
              </ColorButton>
            </div>
          </section>

          <section className="card p-4">
            <h3 className="mb-2 text-sm font-black text-ink">دليل الحالات</h3>
            <div className="space-y-2 text-[11px] text-ink-muted">
              <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> أخضر: جاهز/معتمد</p>
              <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-500" /> أزرق: جلب نتيجة فحص</p>
              <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> برتقالي: فحص الاتصال</p>
              <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-500" /> أحمر: تفريغ الحقول</p>
            </div>
          </section>
        </aside>
      </div>

      <Modal
        open={messagesOpen}
        onClose={() => setMessagesOpen(false)}
        title="رسائل أجهزة المختبر"
        description={`الرسائل المرتبطة بالعينة رقم ${selectedOrder.order_number}`}
        size="lg"
        footer={<Button variant="outline" onClick={() => setMessagesOpen(false)}>إغلاق</Button>}
      >
        {messages.length ? (
          <div className="space-y-2">
            {messages.map((message) => (
              <div key={message.id} className="rounded-2xl border border-line bg-surface-muted/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-scarlet-700" />
                    <span className="text-sm font-bold text-ink">{message.device?.name ?? 'جهاز غير معروف'}</span>
                    <Badge tone={messageTone(message.status)}>{message.status}</Badge>
                  </div>
                  <span className="text-[11px] text-ink-subtle">{formatDateTime(message.received_at, locale)}</span>
                </div>
                <p className="mt-2 break-words text-[11px] text-ink-muted" dir="ltr">
                  {message.parsed_summary ?? message.raw_message}
                </p>
                {(message.status === 'unmatched' || message.status === 'error' || message.status === 'received') ? (
                  <div className="mt-3">
                    <ColorButton
                      tone="amber"
                      small
                      icon={RotateCcw}
                      loading={busyMessageId === message.id}
                      onClick={() => void reprocessMessage(message)}
                    >
                      إعادة المعالجة
                    </ColorButton>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-ink-muted">
            <p>لا توجد رسائل جهاز مرتبطة بهذا الرقم.</p>
            <p className="mt-2 text-xs">
              الجلب يقرأ ما أرسله الجهاز إلى خادم النظام فقط. تأكد أن الجهاز يرسل النتيجة إلى الخادم عبر HL7 على المنفذ 2575 أو ASTM على المنفذ 2576، وأن رقم العينة في الرسالة هو {selectedOrder.order_number}.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

function nameOfBranch(locale: 'ar' | 'en', ar?: string | null, en?: string | null): string {
  return (locale === 'ar' ? ar : en) || ar || en || '—'
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
