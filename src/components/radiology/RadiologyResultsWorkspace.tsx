import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  BadgeCheck,
  Cpu,
  Download,
  FileImage,
  Image as ImageIcon,
  Info,
  Inbox,
  PlugZap,
  Printer,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  ScanLine,
  Stethoscope,
  Undo2,
  UserRound,
  Waves,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/Card'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, PageHeader, TableSkeleton } from '@/components/ui/PageHeader'
import { api, parseApiError } from '@/lib/api'
import { useAnyPermission } from '@/hooks/useMeta'
import { useLocale } from '@/hooks/useLocale'
import { formatDate, formatDateTime, patientDisplayName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  ApiEnvelope,
  RadiologyDevice,
  RadiologyDeviceData,
  RadiologyDeviceMessage,
  RadiologyImage,
  RadiologyWorklistOrder,
} from '@/lib/types'

type Tone = 'scarlet' | 'emerald' | 'sky' | 'amber' | 'violet' | 'slate' | 'rose'
type Filter = 'all' | 'pending' | 'received' | 'approved' | 'printed'
type Translate = (key: string, options?: Record<string, string | number>) => string

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
}: {
  tone: Tone
  icon?: LucideIcon
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  full?: boolean
  small?: boolean
  title?: string
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
        toneClasses[tone],
        (disabled || loading) && 'cursor-not-allowed opacity-45 hover:opacity-45',
      )}
    >
      {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  )
}

function ringStyle(order: RadiologyWorklistOrder, tr: Translate): { shell: string; label: string; tone: BadgeTone; icon?: LucideIcon } {
  switch (order.result_status) {
    case 'printed':
      return {
        shell: 'border-emerald-700 bg-emerald-600 text-white shadow-emerald-200',
        label: tr('radiologyWorkspace.rings.printed'),
        tone: 'success',
        icon: Printer,
      }
    case 'approved':
      return {
        shell: 'border-sky-700 bg-sky-600 text-white shadow-sky-200',
        label: tr('radiologyWorkspace.rings.approved'),
        tone: 'info',
        icon: BadgeCheck,
      }
    case 'received':
      return {
        shell: 'border-amber-500 bg-amber-400 text-amber-950 shadow-amber-100',
        label: tr('radiologyWorkspace.rings.received'),
        tone: 'warning',
        icon: Activity,
      }
    case 'entered':
      return {
        shell: 'border-amber-500 bg-amber-400 text-amber-950 shadow-amber-100',
        label: tr('radiologyWorkspace.rings.entered'),
        tone: 'warning',
      }
    case 'cancelled':
      return {
        shell: 'border-slate-300 bg-slate-200 text-slate-600',
        label: tr('radiologyWorkspace.rings.cancelled'),
        tone: 'danger',
      }
    default:
      return {
        shell: 'border-slate-200 bg-white text-scarlet-800',
        label: tr('radiologyWorkspace.rings.empty'),
        tone: 'neutral',
      }
  }
}

function paymentBadge(payment: RadiologyWorklistOrder['payment'], tr: Translate): { label: string; tone: BadgeTone } {
  if (!payment) return { label: tr('radiologyWorkspace.payment.noInvoice'), tone: 'neutral' }
  if (payment.status === 'paid') return { label: tr('radiologyWorkspace.payment.paid'), tone: 'success' }
  if (payment.status === 'partial') {
    return {
      label: tr('radiologyWorkspace.payment.partial', { balance: payment.balance }),
      tone: 'warning',
    }
  }
  return { label: tr('radiologyWorkspace.payment.unpaid'), tone: 'danger' }
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

type FetchInput = { id: number; deviceId?: number }
type ReportInput = { id: number; report: string }

export function RadiologyResultsWorkspace() {
  const { t } = useTranslation()
  const tr: Translate = (key, options) =>
    options ? String(t(key, { defaultValue: key, ...options })) : String(t(key, { defaultValue: key }))
  const locale = useLocale()
  const queryClient = useQueryClient()
  const canManage = useAnyPermission(['radiology.manage', 'settings.manage'])

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [messagesOpen, setMessagesOpen] = useState(false)
  const [autoFetch, setAutoFetch] = useState(() => localStorage.getItem('scarlet-radiology-auto-fetch') === '1')
  const [testingAll, setTestingAll] = useState(false)
  const lastAutoFetched = useRef<number | null>(null)

  const filterOptions: { id: Filter; label: string }[] = [
    { id: 'all', label: tr('radiologyWorkspace.filters.all') },
    { id: 'pending', label: tr('radiologyWorkspace.filters.pending') },
    { id: 'received', label: tr('radiologyWorkspace.filters.received') },
    { id: 'approved', label: tr('radiologyWorkspace.filters.approved') },
    { id: 'printed', label: tr('radiologyWorkspace.filters.printed') },
  ]

  const worklistQuery = useQuery({
    queryKey: ['radiology-worklist'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<RadiologyWorklistOrder[]>>('/radiology-worklist')
      return data.data
    },
  })

  const deviceDataQuery = useQuery({
    queryKey: ['radiology-device-data', selectedId],
    enabled: selectedId !== null,
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<RadiologyDeviceData>>(`/radiology-orders/${selectedId}/device-data`)
      return data.data
    },
  })

  const orders = worklistQuery.data ?? []
  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null
  const deviceData = deviceDataQuery.data ?? null
  const devices: (RadiologyDevice & { mapped_reason?: string })[] = deviceData?.devices ?? []
  const messages: RadiologyDeviceMessage[] = deviceData?.messages ?? []
  const images: RadiologyImage[] = deviceData?.images ?? []
  const payment = paymentBadge(selectedOrder?.payment, tr)

  const invalidate = (id?: number) => {
    void queryClient.invalidateQueries({ queryKey: ['radiology-worklist'] })
    if (id) void queryClient.invalidateQueries({ queryKey: ['radiology-device-data', id] })
  }

  useEffect(() => {
    const order = worklistQuery.data?.find((item) => item.id === selectedId)
    setDraft(order?.report ?? '')
  }, [selectedId, worklistQuery.data])

  useEffect(() => {
    localStorage.setItem('scarlet-radiology-auto-fetch', autoFetch ? '1' : '0')
  }, [autoFetch])

  const saveMutation = useMutation({
    mutationFn: async ({ id, report }: ReportInput) => {
      const { data } = await api.post<ApiEnvelope<RadiologyWorklistOrder>>(`/radiology-orders/${id}/report`, { report })
      return data.data
    },
    onSuccess: (order) => {
      toast.success(tr('radiologyWorkspace.toasts.saved'))
      setDraft(order.report ?? '')
      invalidate(order.id)
    },
    onError: (error) => toast.error(parseApiError(error).message || tr('radiologyWorkspace.toasts.saveFailed')),
  })

  const signMutation = useMutation({
    mutationFn: async ({ id, report }: ReportInput) => {
      const { data } = await api.post<ApiEnvelope<RadiologyWorklistOrder>>(`/radiology-orders/${id}/confirm-result`, { report })
      return data.data
    },
    onSuccess: (order) => {
      toast.success(tr('radiologyWorkspace.toasts.signed'))
      setDraft(order.report ?? '')
      invalidate(order.id)
    },
    onError: (error) => toast.error(parseApiError(error).message || tr('radiologyWorkspace.toasts.signFailed')),
  })

  const reopenMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<ApiEnvelope<RadiologyWorklistOrder>>(`/radiology-orders/${id}/reopen`)
      return data.data
    },
    onSuccess: (order) => {
      toast.success(tr('radiologyWorkspace.toasts.reopened'))
      setDraft(order.report ?? '')
      invalidate(order.id)
    },
    onError: (error) => toast.error(parseApiError(error).message || tr('radiologyWorkspace.toasts.reopenFailed')),
  })

  const fetchMutation = useMutation({
    mutationFn: async ({ id, deviceId }: FetchInput) => {
      const { data } = await api.post<ApiEnvelope<RadiologyDeviceData>>(
        `/radiology-orders/${id}/fetch-devices`,
        deviceId ? { device_id: deviceId } : {},
      )
      return data.data
    },
    onSuccess: (data, variables) => {
      const frames = data.polls?.reduce((sum, poll) => sum + poll.result.frames, 0) ?? 0
      const imported = data.polls?.reduce((sum, poll) => sum + poll.result.imported, 0) ?? 0
      const errors = data.polls?.filter((poll) => poll.result.error).length ?? 0
      if (imported || data.images.length) {
        toast.success(tr('radiologyWorkspace.toasts.fetched', { imported, images: data.images.length }))
      } else if (frames || errors) {
        toast.info(tr('radiologyWorkspace.toasts.polled', { frames, errors }))
      } else {
        toast.info(tr('radiologyWorkspace.toasts.noNew'))
      }

      const report = data.order?.report
      if (report && !draft.trim()) setDraft(report)
      invalidate(variables.id)
    },
    onError: (error) => toast.error(parseApiError(error).message || tr('radiologyWorkspace.toasts.fetchFailed')),
  })

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<ApiEnvelope<{ ok: boolean; message: string }>>(`/radiology-devices/${id}/test-connection`)
      return data.data
    },
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message)
      else toast.warning(result.message)
    },
    onError: (error) => toast.error(parseApiError(error).message || tr('radiologyWorkspace.toasts.testFailed')),
  })

  const reprocessMutation = useMutation({
    mutationFn: async (message: RadiologyDeviceMessage) => {
      const { data } = await api.post<ApiEnvelope<RadiologyDeviceMessage>>(`/radiology-device-messages/${message.id}/reprocess`)
      return data.data
    },
    onSuccess: () => {
      toast.success(tr('radiologyWorkspace.toasts.reprocessed'))
      invalidate(selectedId ?? undefined)
    },
    onError: (error) => toast.error(parseApiError(error).message || tr('radiologyWorkspace.toasts.reprocessFailed')),
  })

  const printMutation = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<ApiEnvelope<RadiologyWorklistOrder>>(`/radiology-orders/${id}/print`)
      return data.data
    },
    onSuccess: (order) => invalidate(order.id),
    onError: (error) => toast.error(parseApiError(error).message || tr('radiologyWorkspace.toasts.printFailed')),
  })

  // Pull once per selected order when auto-fetch is switched on. Manual buttons
  // remain available and nothing is ever signed automatically.
  useEffect(() => {
    if (!autoFetch || !selectedOrder || lastAutoFetched.current === selectedOrder.id) return
    lastAutoFetched.current = selectedOrder.id
    fetchMutation.mutate({ id: selectedOrder.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, selectedOrder])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return orders.filter((order) => {
      const statusMatch =
        filter === 'all'
          || (filter === 'pending' && ['empty', 'entered', 'received'].includes(order.result_status))
          || (filter === 'received' && order.result_status === 'received')
          || (filter === 'approved' && order.result_status === 'approved')
          || (filter === 'printed' && order.result_status === 'printed')

      if (!statusMatch) return false
      if (!term) return true

      return [
        order.order_number,
        patientDisplayName(order.patient, locale),
        order.patient?.mrn,
        order.study?.code,
        order.study_description,
        order.modality,
      ].some((value) => String(value ?? '').toLowerCase().includes(term))
    })
  }, [orders, search, filter, locale])

  const pendingCount = orders.filter((order) => ['empty', 'entered', 'received'].includes(order.result_status)).length
  const signedCount = orders.filter((order) => ['approved', 'printed'].includes(order.result_status)).length
  const deviceCount = orders.filter((order) => order.source === 'device').length
  const isEditable = selectedOrder?.status !== 'completed' && selectedOrder?.status !== 'cancelled'
  const canPrint = selectedOrder?.status === 'completed' && Boolean(selectedOrder.report)
  const ring = selectedOrder ? ringStyle(selectedOrder, tr) : null

  const openOrder = (order: RadiologyWorklistOrder) => {
    setSelectedId(order.id)
    setDraft(order.report ?? '')
    setMessagesOpen(false)
  }

  const printReport = (order: RadiologyWorklistOrder) => {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) {
      toast.error(tr('radiologyWorkspace.toasts.popupBlocked'))
      return
    }

    const dir = locale === 'ar' ? 'rtl' : 'ltr'
    const align = locale === 'ar' ? 'right' : 'left'
    const studyName = locale === 'ar'
      ? order.study?.name_ar ?? order.study?.name_en ?? order.study_description
      : order.study?.name_en ?? order.study?.name_ar ?? order.study_description

    win.document.write(`<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><title>${escapeHtml(tr('radiologyWorkspace.printDoc.title', { order: order.order_number }))}</title>
      <style>body{font-family:Tahoma,Arial,sans-serif;padding:32px;color:#111;text-align:${align}}h1{font-size:20px;border-bottom:2px solid #8b1230;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin:18px 0}td,th{padding:7px;border:1px solid #ddd;text-align:${align}}pre{white-space:pre-wrap;font-family:inherit;line-height:1.9;font-size:15px}</style>
      </head><body><h1>${escapeHtml(tr('radiologyWorkspace.printDoc.heading'))}</h1>
      <table>
        <tr><th>${escapeHtml(tr('radiologyWorkspace.printDoc.orderNumber'))}</th><td dir="ltr">${escapeHtml(order.order_number)}</td><th>${escapeHtml(tr('radiologyWorkspace.printDoc.mrn'))}</th><td dir="ltr">${escapeHtml(order.patient?.mrn)}</td></tr>
        <tr><th>${escapeHtml(tr('radiologyWorkspace.printDoc.patient'))}</th><td>${escapeHtml(patientDisplayName(order.patient, locale))}</td><th>${escapeHtml(tr('radiologyWorkspace.printDoc.study'))}</th><td>${escapeHtml(studyName)}</td></tr>
        <tr><th>${escapeHtml(tr('radiologyWorkspace.printDoc.modality'))}</th><td>${escapeHtml(order.modality)}</td><th>${escapeHtml(tr('radiologyWorkspace.printDoc.device'))}</th><td>${escapeHtml(order.source_device?.name ?? tr('radiologyWorkspace.manualEntry'))}</td></tr>
        <tr><th>${escapeHtml(tr('radiologyWorkspace.printDoc.reporter'))}</th><td>${escapeHtml(order.reporter?.name)}</td><th>${escapeHtml(tr('radiologyWorkspace.printDoc.signedAt'))}</th><td>${escapeHtml(formatDateTime(order.completed_at, locale))}</td></tr>
      </table>
      <h3>${escapeHtml(tr('radiologyWorkspace.printDoc.reportText'))}</h3><pre>${escapeHtml(order.report)}</pre>
      <p style="margin-top:24px;font-size:11px;color:#666">${escapeHtml(tr('radiologyWorkspace.printDoc.footer'))}</p>
      </body></html>`)
    win.document.close()
    win.focus()
    win.print()
    printMutation.mutate(order.id)
  }

  const downloadImage = async (image: RadiologyImage) => {
    try {
      const { data } = await api.get<Blob>(`/radiology-images/${image.id}/download`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = image.path.split('/').pop() || `dicom-${image.id}.dcm`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(tr('radiologyWorkspace.toasts.downloadFailed'))
    }
  }

  const testAllDevices = async () => {
    if (!devices.length) {
      toast.warning(tr('radiologyWorkspace.toasts.noDevices'))
      return
    }

    setTestingAll(true)
    const results = await Promise.all(
      devices.map(async (device) => {
        try {
          const { data } = await api.post<ApiEnvelope<{ ok: boolean; message: string }>>(`/radiology-devices/${device.id}/test-connection`)
          return data.data.ok
        } catch {
          return false
        }
      }),
    )
    setTestingAll(false)
    const ok = results.filter(Boolean).length
    toast[ok === results.length ? 'success' : 'warning'](
      tr('radiologyWorkspace.toasts.connections', { ok, total: results.length }),
    )
  }

  if (worklistQuery.isLoading) return <TableSkeleton rows={8} />

  return (
    <div className="space-y-4">
      <PageHeader
        title={tr('nav.radiologyResults')}
        subtitle={tr('radiologyWorkspace.subtitle')}
        actions={
          <Button variant="outline" size="sm" loading={worklistQuery.isFetching} onClick={() => void worklistQuery.refetch()}>
            <RefreshCw className="h-4 w-4" /> {tr('common.refresh')}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={tr('radiologyWorkspace.stats.all')} value={orders.length} icon={ScanLine} tone="scarlet" />
        <StatCard label={tr('radiologyWorkspace.stats.pending')} value={pendingCount} icon={Inbox} tone="warning" />
        <StatCard label={tr('radiologyWorkspace.stats.signed')} value={signedCount} icon={BadgeCheck} tone="info" />
        <StatCard label={tr('radiologyWorkspace.stats.device')} value={deviceCount} icon={Radio} tone="success" />
      </div>

      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-black text-ink">
              <Activity className="h-4 w-4 text-scarlet-700" /> {tr('radiologyWorkspace.pathway')}
              <Badge tone="scarlet">{filtered.length}</Badge>
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-subtle">{tr('radiologyWorkspace.pathwayHint')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {filterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition',
                  filter === option.id ? 'bg-scarlet-800 text-white' : 'bg-surface-muted text-ink-muted hover:text-ink',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={tr('radiologyWorkspace.searchPlaceholder')}
          className="mb-3 max-w-md"
        />

        {filtered.length ? (
          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
            {filtered.map((order, index) => {
              const active = order.id === selectedId
              const orderRing = ringStyle(order, tr)
              const RingIcon = orderRing.icon

              return (
                <button
                  key={order.id}
                  type="button"
                  title={tr('radiologyWorkspace.orderRing', { order: order.order_number, status: orderRing.label })}
                  onClick={() => openOrder(order)}
                  className={cn(
                    'relative flex w-28 shrink-0 flex-col items-center gap-1 rounded-xl border p-1.5 transition',
                    active
                      ? 'border-scarlet-300 bg-scarlet-50 ring-1 ring-scarlet-200'
                      : 'border-line/60 hover:border-scarlet-200 hover:bg-surface-muted',
                  )}
                >
                  <span
                    className={cn(
                      'relative grid h-9 w-9 place-items-center rounded-full border-2 text-[10px] font-black shadow-sm',
                      orderRing.shell,
                    )}
                    dir="ltr"
                  >
                    {order.order_number.replace('RAD', 'R')}
                    {RingIcon ? (
                      <span className="absolute -bottom-1 -end-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-white text-scarlet-700 shadow ring-1 ring-black/5">
                        <RingIcon className="h-2.5 w-2.5" />
                      </span>
                    ) : null}
                  </span>
                  <span className={cn('max-w-24 truncate text-[10px] font-bold', active ? 'text-scarlet-900' : 'text-ink')}>
                    {patientDisplayName(order.patient, locale)}
                  </span>
                  <span className="text-[9px] font-bold text-ink-subtle">
                    {orderRing.label} · {order.modality ?? tr('radiologyWorkspace.studyFallback')}
                  </span>
                  <span className="sr-only">#{index + 1}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={ScanLine}
            title={tr('radiologyWorkspace.noOrdersTitle')}
            description={tr('radiologyWorkspace.noOrdersDesc')}
          />
        )}

        <div className="mt-3 flex flex-wrap gap-3 border-t border-line pt-3 text-[11px] text-ink-muted">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white ring-1 ring-slate-300" /> {tr('radiologyWorkspace.legend.empty')}</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> {tr('radiologyWorkspace.legend.received')}</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-600" /> {tr('radiologyWorkspace.legend.approved')}</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" /> {tr('radiologyWorkspace.legend.printed')}</span>
        </div>
      </section>

      {selectedOrder ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <section className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-l from-slate-900 via-slate-800 to-slate-700 px-5 py-3.5 text-white">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/60">{tr('radiologyWorkspace.patientCard')}</p>
                    <p className="text-base font-black">{patientDisplayName(selectedOrder.patient, locale)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-white/10 px-2.5 py-1" dir="ltr">{selectedOrder.patient?.mrn ?? '—'}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1" dir="ltr">{selectedOrder.order_number}</span>
                  {ring ? <Badge tone={ring.tone} dot>{ring.label}</Badge> : null}
                  <Badge tone={payment.tone} dot>{payment.label}</Badge>
                </div>
              </div>
              <div className="grid gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <InfoTile label={tr('radiologyWorkspace.phone')} value={selectedOrder.patient?.phone} dir="ltr" />
                <InfoTile label={tr('radiologyWorkspace.nationalId')} value={selectedOrder.patient?.national_id} dir="ltr" />
                <InfoTile
                  label={tr('radiologyWorkspace.gender')}
                  value={
                    selectedOrder.patient?.gender === 'female'
                      ? tr('radiologyWorkspace.female')
                      : selectedOrder.patient?.gender === 'male'
                        ? tr('radiologyWorkspace.male')
                        : null
                  }
                />
                <InfoTile
                  label={tr('radiologyWorkspace.dateOfBirth')}
                  value={selectedOrder.patient?.date_of_birth ? formatDate(selectedOrder.patient.date_of_birth, locale) : null}
                />
                <InfoTile
                  label={tr('radiologyWorkspace.registrationBranch')}
                  value={nameOfBranch(locale, selectedOrder.registration_branch?.name_ar, selectedOrder.registration_branch?.name_en)}
                />
                <InfoTile label={tr('radiologyWorkspace.orderedAt')} value={formatDateTime(selectedOrder.ordered_at, locale)} />
                <InfoTile
                  label={tr('radiologyWorkspace.insurance')}
                  value={selectedOrder.insurance?.provider?.name ?? selectedOrder.insurance?.policy_number}
                />
                <InfoTile
                  label={tr('radiologyWorkspace.branch')}
                  value={nameOfBranch(locale, selectedOrder.branch?.name_ar, selectedOrder.branch?.name_en)}
                />
                <InfoTile label={tr('radiologyWorkspace.requestingDoctor')} value={selectedOrder.doctor?.name} />
                <InfoTile label={tr('radiologyWorkspace.receivedAt')} value={formatDateTime(selectedOrder.result_received_at, locale)} />
                <InfoTile label={tr('radiologyWorkspace.reporter')} value={selectedOrder.reporter?.name} />
                <InfoTile label={tr('radiologyWorkspace.printedAt')} value={formatDateTime(selectedOrder.printed_at, locale)} />
              </div>
            </section>

            <section className="card p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-black text-ink">
                    <Stethoscope className="h-4 w-4 text-scarlet-700" /> {tr('radiologyWorkspace.studyReport')}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-ink-subtle">
                    {locale === 'ar'
                      ? selectedOrder.study?.name_ar ?? selectedOrder.study?.name_en ?? selectedOrder.study_description
                      : selectedOrder.study?.name_en ?? selectedOrder.study?.name_ar ?? selectedOrder.study_description}
                    {selectedOrder.study?.code ? ` · ${selectedOrder.study.code}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="neutral">{selectedOrder.modality ?? '—'}</Badge>
                  <Badge tone={selectedOrder.source === 'device' ? 'info' : 'neutral'}>
                    {selectedOrder.source === 'device'
                      ? selectedOrder.source_device?.name ?? tr('radiologyWorkspace.deviceShort')
                      : tr('radiologyWorkspace.manualEntry')}
                  </Badge>
                </div>
              </div>

              {selectedOrder.source === 'device' && selectedOrder.status === 'result_received' ? (
                <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900 ring-1 ring-amber-100">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{tr('radiologyWorkspace.deviceNotice')}</span>
                </div>
              ) : null}

              <Field label={tr('radiologyWorkspace.reportLabel')} hint={tr('radiologyWorkspace.reportHint')}>
                <Textarea
                  rows={10}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={!canManage || !isEditable}
                  placeholder={tr('radiologyWorkspace.reportPlaceholder')}
                />
              </Field>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <ColorButton
                  tone="slate"
                  icon={Save}
                  disabled={!canManage || !isEditable || !draft.trim()}
                  loading={saveMutation.isPending}
                  onClick={() => selectedOrder && saveMutation.mutate({ id: selectedOrder.id, report: draft })}
                >
                  {tr('radiologyWorkspace.saveDraft')}
                </ColorButton>
                <ColorButton
                  tone="emerald"
                  icon={BadgeCheck}
                  disabled={!canManage || !isEditable || !draft.trim()}
                  loading={signMutation.isPending}
                  onClick={() => selectedOrder && signMutation.mutate({ id: selectedOrder.id, report: draft })}
                >
                  {tr('radiologyWorkspace.sign')}
                </ColorButton>
                {selectedOrder.status === 'completed' && canManage ? (
                  <ColorButton
                    tone="rose"
                    icon={Undo2}
                    loading={reopenMutation.isPending}
                    onClick={() => reopenMutation.mutate(selectedOrder.id)}
                  >
                    {tr('radiologyWorkspace.reopen')}
                  </ColorButton>
                ) : null}
                <ColorButton
                  tone={canPrint ? 'emerald' : 'slate'}
                  icon={Printer}
                  disabled={!canPrint}
                  title={canPrint ? tr('radiologyWorkspace.printSigned') : tr('radiologyWorkspace.printLocked')}
                  onClick={() => printReport(selectedOrder)}
                >
                  {tr('radiologyWorkspace.print')}
                </ColorButton>
              </div>
            </section>

            <section className="card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-black text-ink">
                  <FileImage className="h-4 w-4 text-sky-600" /> {tr('radiologyWorkspace.receivedImages')}
                  <Badge tone={images.length ? 'info' : 'neutral'}>{images.length}</Badge>
                </h2>
                <ColorButton
                  tone="sky"
                  small
                  icon={Download}
                  loading={fetchMutation.isPending}
                  onClick={() => fetchMutation.mutate({ id: selectedOrder.id })}
                >
                  {tr('radiologyWorkspace.fetchImages')}
                </ColorButton>
              </div>

              {images.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {images.map((image) => (
                    <div key={image.id} className="rounded-2xl border border-line bg-surface-muted/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-sky-600" />
                          <span className="text-xs font-bold text-ink">{image.modality ?? 'DICOM'}</span>
                        </div>
                        <span className="text-[10px] text-ink-subtle">{formatDateTime(image.received_at, locale)}</span>
                      </div>
                      <p className="mt-2 truncate text-[10px] text-ink-subtle" dir="ltr" title={image.path}>
                        {image.sop_uid ?? image.path}
                      </p>
                      <p className="mt-1 text-[10px] text-ink-muted">{image.device?.name ?? tr('radiologyWorkspace.unknownDevice')}</p>
                      <Button size="sm" variant="ghost" className="mt-2" onClick={() => void downloadImage(image)}>
                        <Download className="h-3.5 w-3.5" /> {tr('radiologyWorkspace.download')}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl bg-surface-muted/50 p-3 text-[11px] leading-relaxed text-ink-subtle">
                  {tr('radiologyWorkspace.noImages')}
                </p>
              )}
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <section className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-black text-ink">
                    <Zap className="h-4 w-4 text-emerald-600" /> {tr('radiologyWorkspace.autoFetch')}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-subtle">{tr('radiologyWorkspace.autoFetchHint')}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoFetch}
                  aria-label={tr('radiologyWorkspace.autoFetch')}
                  onClick={() => setAutoFetch((value) => !value)}
                  className={cn('relative h-8 w-14 shrink-0 rounded-full transition', autoFetch ? 'bg-emerald-500' : 'bg-slate-300')}
                >
                  <span className={cn('absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all', autoFetch ? 'ms-7' : 'ms-1')} />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-surface-muted/60 px-3 py-2 text-[11px]">
                {autoFetch ? (
                  <>
                    <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="font-bold text-emerald-700">{tr('radiologyWorkspace.autoFetchOn')}</span>
                  </>
                ) : (
                  <>
                    <Info className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-ink-muted">{tr('radiologyWorkspace.autoFetchOff')}</span>
                  </>
                )}
              </div>
            </section>

            <section className="card p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-black text-ink">
                <Radio className="h-4 w-4 text-scarlet-700" /> {tr('radiologyWorkspace.studyDevices')}
              </h3>
              {devices.length ? (
                <div className="space-y-2">
                  {devices.map((device) => (
                    <div key={device.id} className="rounded-xl border border-line bg-surface-muted/40 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-bold text-ink">{device.name}</p>
                        <Badge tone="neutral">{device.protocol}</Badge>
                      </div>
                      <p className="mt-1 truncate text-[10px] text-ink-subtle" dir="ltr">
                        {device.code} · {device.host ?? '—'}:{device.port ?? '—'}
                      </p>
                      <p className="mt-1 text-[10px] text-ink-subtle">
                        {device.mapped_reason === 'study'
                          ? tr('radiologyWorkspace.mappedStudy')
                          : tr('radiologyWorkspace.mappedModality')} · {device.direction ?? 'push'}
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <ColorButton
                          tone="amber"
                          small
                          icon={PlugZap}
                          loading={testMutation.isPending && testMutation.variables === device.id}
                          onClick={() => testMutation.mutate(device.id)}
                        >
                          {tr('radiologyWorkspace.connection')}
                        </ColorButton>
                        <ColorButton
                          tone="sky"
                          small
                          icon={Zap}
                          loading={fetchMutation.isPending && fetchMutation.variables?.deviceId === device.id}
                          onClick={() => fetchMutation.mutate({ id: selectedOrder.id, deviceId: device.id })}
                        >
                          {tr('radiologyWorkspace.fetch')}
                        </ColorButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-3 text-center text-[11px] leading-relaxed text-ink-subtle">
                  {tr('radiologyWorkspace.noMappedDevices')}
                </p>
              )}
            </section>

            <section className="card p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-black text-ink">
                <Cpu className="h-4 w-4 text-violet-600" /> {tr('radiologyWorkspace.actionPanel')}
              </h3>
              <div className="grid gap-2">
                <ColorButton
                  tone="emerald"
                  full
                  icon={Zap}
                  loading={fetchMutation.isPending}
                  onClick={() => fetchMutation.mutate({ id: selectedOrder.id })}
                >
                  {tr('radiologyWorkspace.fetchAll')}
                </ColorButton>
                <ColorButton
                  tone="sky"
                  full
                  icon={Waves}
                  loading={fetchMutation.isPending}
                  onClick={() => fetchMutation.mutate({ id: selectedOrder.id })}
                >
                  {tr('radiologyWorkspace.fetchImages')}
                </ColorButton>
                <ColorButton tone="amber" full icon={PlugZap} loading={testingAll} onClick={() => void testAllDevices()}>
                  {tr('radiologyWorkspace.testConnections')}
                </ColorButton>
                <ColorButton tone="violet" full icon={Inbox} onClick={() => setMessagesOpen(true)}>
                  {tr('radiologyWorkspace.deviceMessages', { count: messages.length })}
                </ColorButton>
                <ColorButton
                  tone="slate"
                  full
                  icon={RefreshCw}
                  loading={deviceDataQuery.isFetching}
                  onClick={() => void deviceDataQuery.refetch()}
                >
                  {tr('radiologyWorkspace.refreshDeviceData')}
                </ColorButton>
              </div>
            </section>

            <section className="card p-4">
              <h3 className="mb-2 text-sm font-black text-ink">{tr('radiologyWorkspace.statusGuide')}</h3>
              <div className="space-y-2 text-[11px] text-ink-muted">
                <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400" /> {tr('radiologyWorkspace.guideAmber')}</p>
                <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-600" /> {tr('radiologyWorkspace.guideBlue')}</p>
                <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-600" /> {tr('radiologyWorkspace.guideGreen')}</p>
                <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-white ring-1 ring-slate-300" /> {tr('radiologyWorkspace.guideWhite')}</p>
              </div>
            </section>
          </aside>
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={ScanLine}
            title={tr('radiologyWorkspace.chooseOrderTitle')}
            description={tr('radiologyWorkspace.chooseOrderDesc')}
          />
        </div>
      )}

      <Modal
        open={messagesOpen}
        onClose={() => setMessagesOpen(false)}
        title={tr('radiologyWorkspace.messagesTitle')}
        description={selectedOrder ? tr('radiologyWorkspace.messagesDesc', { order: selectedOrder.order_number }) : undefined}
        size="lg"
        footer={<Button variant="outline" onClick={() => setMessagesOpen(false)}>{tr('common.close')}</Button>}
      >
        {messages.length ? (
          <div className="space-y-2">
            {messages.map((message) => (
              <div key={message.id} className="rounded-2xl border border-line bg-surface-muted/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-scarlet-700" />
                    <span className="text-sm font-bold text-ink">{message.device?.name ?? tr('radiologyWorkspace.unknownMessageDevice')}</span>
                    <Badge tone={messageTone(message.status)}>{message.status}</Badge>
                  </div>
                  <span className="text-[11px] text-ink-subtle">{formatDateTime(message.received_at, locale)}</span>
                </div>
                <p className="mt-2 break-words text-[11px] text-ink-muted" dir="ltr">
                  {message.parsed_summary ?? message.raw_message}
                </p>
                {message.status !== 'imported' ? (
                  <div className="mt-3">
                    <ColorButton
                      tone="amber"
                      small
                      icon={RotateCcw}
                      loading={reprocessMutation.isPending && reprocessMutation.variables?.id === message.id}
                      onClick={() => reprocessMutation.mutate(message)}
                    >
                      {tr('radiologyWorkspace.reprocess')}
                    </ColorButton>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-ink-muted">
            <p>{tr('radiologyWorkspace.noMessages')}</p>
            <p className="mt-2 text-xs">
              {tr('radiologyWorkspace.deviceSendHint', { order: selectedOrder?.order_number ?? '—' })}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
