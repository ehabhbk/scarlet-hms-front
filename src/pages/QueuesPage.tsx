import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Armchair,
  CheckCircle2,
  Clock,
  ListOrdered,
  Loader2,
  Megaphone,
  MonitorPlay,
  Plus,
  RefreshCw,
  SkipForward,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { PriorityBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { PatientPicker } from '@/components/patients/PatientPicker'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, Patient, QueueBoard, QueueTicket } from '@/lib/types'
import { formatNumber, nameOf, patientDisplayName } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'
import { useAuthStore } from '@/stores/auth'
import { useMeta, usePermission } from '@/hooks/useMeta'
import { cn } from '@/lib/utils'

interface TicketForm {
  patient: Patient | null
  branch_id: string
  department_id: string
  doctor_id: string
  priority: string
}

export function QueuesPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const { data: meta } = useMeta()
  const canManage = usePermission('queues.manage')

  const [branchId, setBranchId] = useState(user?.branch_id ? String(user.branch_id) : '')
  const [departmentId, setDepartmentId] = useState(user?.department_id ? String(user.department_id) : '')
  const [issueOpen, setIssueOpen] = useState(false)
  const [skipTarget, setSkipTarget] = useState<QueueTicket | null>(null)
  const [skipReason, setSkipReason] = useState('')
  const [form, setForm] = useState<TicketForm>({
    patient: null,
    branch_id: user?.branch_id ? String(user.branch_id) : '',
    department_id: user?.department_id ? String(user.department_id) : '',
    doctor_id: '',
    priority: 'normal',
  })

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['queues', { branchId, departmentId }],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<QueueBoard>>('/queues', {
        params: {
          branch_id: branchId || undefined,
          department_id: departmentId || undefined,
        },
      })
      return data.data
    },
    enabled: Boolean(branchId),
    refetchInterval: 10_000,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['queues'] })
    void queryClient.invalidateQueries({ queryKey: ['appointments'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const callNext = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiEnvelope<QueueTicket | null>>('/queues/next', {
        branch_id: Number(branchId),
        department_id: Number(departmentId),
      })
      return data.data
    },
    onSuccess: (ticket) => {
      toast.success(ticket ? `${t('queues.calledSuccess')} · ${ticket.display_number}` : t('queues.empty'))
      invalidate()
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const actionMutation = useMutation({
    mutationFn: async ({ ticket, action }: { ticket: QueueTicket; action: 'call' | 'start' | 'complete' | 'recall' | 'no-show' }) => {
      await api.post(`/queues/${ticket.id}/${action}`)
    },
    onSuccess: (_, variables) => {
      const messages = {
        call: t('queues.calledSuccess'),
        start: t('queues.startedSuccess'),
        complete: t('queues.completedSuccess'),
        recall: t('queues.recallSuccess'),
        'no-show': t('queues.noShowSuccess'),
      } as const
      toast.success(messages[variables.action])
      invalidate()
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const skipMutation = useMutation({
    mutationFn: async ({ ticket, reason }: { ticket: QueueTicket; reason: string }) => {
      await api.post(`/queues/${ticket.id}/skip`, { reason })
    },
    onSuccess: () => {
      toast.success(t('queues.skippedSuccess'))
      setSkipTarget(null)
      setSkipReason('')
      invalidate()
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const issueMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiEnvelope<QueueTicket>>('/queues', {
        patient_id: form.patient?.id,
        branch_id: Number(form.branch_id),
        department_id: Number(form.department_id),
        doctor_id: form.doctor_id ? Number(form.doctor_id) : null,
        priority: form.priority,
      })
      return data.data
    },
    onSuccess: (ticket) => {
      toast.success(`${t('queues.issued')} · ${ticket.display_number}`)
      setIssueOpen(false)
      setForm((current) => ({ ...current, patient: null, doctor_id: '', priority: 'normal' }))
      invalidate()
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const departments = useMemo(() => {
    if (!meta) return []
    return branchId ? meta.departments.filter((department) => department.branch_id === Number(branchId)) : meta.departments
  }, [meta, branchId])

  const formDepartments = useMemo(() => {
    if (!meta) return []
    return form.branch_id
      ? meta.departments.filter((department) => department.branch_id === Number(form.branch_id))
      : meta.departments
  }, [meta, form.branch_id])

  const activeTickets = data?.tickets ?? []
  const waiting = activeTickets.filter((ticket) => ticket.status === 'waiting')
  const called = activeTickets.filter((ticket) => ticket.status === 'called')
  const inProgress = activeTickets.filter((ticket) => ticket.status === 'in_progress')
  const finished = activeTickets.filter((ticket) => ['completed', 'skipped', 'no_show'].includes(ticket.status))

  const columns = [
    { key: 'waiting', label: t('queues.waiting'), tickets: waiting, tone: 'border-t-amber-400', count: data?.counts?.waiting ?? 0 },
    { key: 'called', label: t('queues.called'), tickets: called, tone: 'border-t-orange-500', count: data?.counts?.called ?? 0 },
    { key: 'in_progress', label: t('queues.inProgress'), tickets: inProgress, tone: 'border-t-emerald-500', count: data?.counts?.in_progress ?? 0 },
  ]

  return (
    <div>
      <PageHeader
        title={t('queues.title')}
        subtitle={t('queues.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              {t('common.refresh')}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(branchId ? `/display/${branchId}` : '/display', '_blank')}
            >
              <MonitorPlay className="h-4 w-4" />
              {t('queues.display')}
            </Button>
            {canManage ? (
              <Button onClick={() => setIssueOpen(true)}>
                <Plus className="h-4 w-4" />
                {t('queues.issueTicket')}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="card mb-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value)
              setDepartmentId('')
              setForm((current) => ({ ...current, branch_id: event.target.value, department_id: '' }))
            }}
            className="h-10 w-auto min-w-[160px]"
            aria-label={t('queues.branch')}
          >
            <option value="">{t('queues.branch')}</option>
            {(meta?.branches ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>{nameOf(branch, locale)}</option>
            ))}
          </Select>
          <Select
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            className="h-10 w-auto min-w-[160px]"
            aria-label={t('queues.department')}
          >
            <option value="">{t('queues.allDepartments')}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{nameOf(department, locale)}</option>
            ))}
          </Select>

          <div className="ms-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-muted px-2.5 py-1.5 text-[11px] font-semibold text-ink-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {t('queues.autoRefresh')}
            </div>
            {canManage ? (
              <Button
                onClick={() => callNext.mutate()}
                loading={callNext.isPending}
                disabled={!branchId || !departmentId}
                title={!departmentId ? t('queues.allDepartments') : undefined}
              >
                <Megaphone className="h-4 w-4" />
                {t('queues.callNext')}
              </Button>
            ) : null}
          </div>
        </div>
        {!departmentId && canManage ? (
          <p className="mt-2 text-[11px] font-medium text-warning-700">{t('queues.filterDepartment')}</p>
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: t('queues.waiting'), value: data?.counts?.waiting ?? 0, tone: 'text-amber-700' },
          { label: t('queues.called'), value: data?.counts?.called ?? 0, tone: 'text-orange-700' },
          { label: t('queues.inProgress'), value: data?.counts?.in_progress ?? 0, tone: 'text-emerald-700' },
          { label: t('queues.completed'), value: data?.counts?.completed ?? 0, tone: 'text-ink' },
          { label: t('queues.skipped'), value: data?.counts?.skipped ?? 0, tone: 'text-ink' },
          { label: t('queues.noShow'), value: data?.counts?.no_show ?? 0, tone: 'text-ink' },
        ].map((stat) => (
          <div key={stat.label} className="card px-4 py-3">
            <p className="text-[10px] font-semibold text-ink-muted">{stat.label}</p>
            <p className={cn('mt-0.5 text-xl font-extrabold', stat.tone)}>{formatNumber(stat.value, locale)}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin text-scarlet-700" />
          {t('common.loading')}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {columns.map((column) => (
            <div key={column.key} className={cn('card border-t-4', column.tone)}>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-ink">{column.label}</h2>
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-bold text-ink-muted">
                    {column.count}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 p-3">
                {column.tickets.length ? (
                  column.tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className={cn(
                        'rounded-xl border bg-surface p-3.5 transition',
                        ticket.status === 'called'
                          ? 'border-orange-200 bg-orange-50/40 shadow-sm'
                          : ticket.status === 'in_progress'
                            ? 'border-emerald-200 bg-emerald-50/30'
                            : 'border-line',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-scarlet-800 text-sm font-extrabold text-white">
                            {ticket.display_number}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-ink">
                              {patientDisplayName(ticket.patient, locale)}
                            </p>
                            <p className="truncate text-[11px] text-ink-muted">
                              {ticket.patient?.mrn}
                              {ticket.department ? ` · ${nameOf(ticket.department, locale)}` : ''}
                            </p>
                          </div>
                        </div>
                        <PriorityBadge priority={ticket.priority} />
                      </div>

                      <div className="mt-2 flex items-center gap-2 text-[10px] text-ink-subtle">
                        <Clock className="h-3 w-3" />
                        {ticket.waiting_since !== null && ticket.waiting_since !== undefined
                          ? t('queues.minutesAgo', { count: ticket.waiting_since })
                          : t('queues.justNow')}
                        {ticket.doctor ? <span>· {ticket.doctor.name}</span> : null}
                      </div>

                      {canManage ? (
                        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
                          {ticket.status === 'waiting' ? (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={actionMutation.isPending && actionMutation.variables?.ticket.id === ticket.id && actionMutation.variables.action === 'call'}
                                onClick={() => actionMutation.mutate({ ticket, action: 'call' })}
                              >
                                <Megaphone className="h-3.5 w-3.5" />
                                {t('queues.call')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setSkipTarget(ticket); setSkipReason('') }}>
                                <SkipForward className="h-3.5 w-3.5" />
                                {t('queues.skip')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => actionMutation.mutate({ ticket, action: 'no-show' })}
                                title={t('queues.markNoShow')}
                              >
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : null}
                          {ticket.status === 'called' ? (
                            <>
                              <Button
                                size="sm"
                                loading={actionMutation.isPending && actionMutation.variables?.ticket.id === ticket.id && actionMutation.variables.action === 'start'}
                                onClick={() => actionMutation.mutate({ ticket, action: 'start' })}
                              >
                                <Armchair className="h-3.5 w-3.5" />
                                {t('queues.start')}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => actionMutation.mutate({ ticket, action: 'recall' })}>
                                <Megaphone className="h-3.5 w-3.5" />
                                {t('queues.recall')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setSkipTarget(ticket); setSkipReason('') }}>
                                <SkipForward className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : null}
                          {ticket.status === 'in_progress' ? (
                            <>
                              <Button
                                size="sm"
                                loading={actionMutation.isPending && actionMutation.variables?.ticket.id === ticket.id && actionMutation.variables.action === 'complete'}
                                onClick={() => actionMutation.mutate({ ticket, action: 'complete' })}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {t('queues.complete')}
                              </Button>
                              {ticket.encounter_id ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.location.assign(`/encounters/${ticket.encounter_id}`)}
                                >
                                  {t('encounters.viewEncounter')}
                                </Button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <EmptyState icon={ListOrdered} title={t('queues.empty')} className="py-8" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {finished.length ? (
        <div className="card mt-4">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-bold text-ink">{t('queues.completed')}</h2>
          </div>
          <div className="divide-y divide-line">
            {finished.map((ticket) => (
              <div key={ticket.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-sunken text-xs font-bold text-ink-muted">
                  {ticket.display_number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{patientDisplayName(ticket.patient, locale)}</p>
                  <p className="text-[10px] text-ink-subtle">
                    {ticket.patient?.mrn}
                    {ticket.department ? ` · ${nameOf(ticket.department, locale)}` : ''}
                  </p>
                </div>
                <Badge tone={ticket.status === 'completed' ? 'success' : 'neutral'} dot>
                  {t(`status.${ticket.status}`, { defaultValue: ticket.status })}
                </Badge>
                {ticket.skip_reason ? <span className="text-[10px] text-ink-subtle">{ticket.skip_reason}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Modal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title={t('queues.issueTitle')}
        description={t('queues.walkInTicket')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>{t('common.cancel')}</Button>
            <Button
              loading={issueMutation.isPending}
              disabled={!form.patient || !form.branch_id || !form.department_id}
              onClick={() => issueMutation.mutate()}
            >
              <Plus className="h-4 w-4" />
              {t('queues.issueTicket')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('queues.selectPatient')} required>
            <PatientPicker value={form.patient} onChange={(patient) => setForm({ ...form, patient })} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('queues.branch')} required>
              <Select
                value={form.branch_id}
                onChange={(event) => setForm({ ...form, branch_id: event.target.value, department_id: '', doctor_id: '' })}
              >
                <option value="">{t('queues.branch')}</option>
                {(meta?.branches ?? []).map((branch) => (
                  <option key={branch.id} value={branch.id}>{nameOf(branch, locale)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('queues.department')} required>
              <Select
                value={form.department_id}
                onChange={(event) => setForm({ ...form, department_id: event.target.value, doctor_id: '' })}
              >
                <option value="">{t('queues.allDepartments')}</option>
                {formDepartments.map((department) => (
                  <option key={department.id} value={department.id}>{nameOf(department, locale)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('queues.priority')}>
              <Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                <option value="normal">{t('queues.normal')}</option>
                <option value="urgent">{t('queues.urgent')}</option>
                <option value="emergency">{t('queues.emergency')}</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(skipTarget)}
        onClose={() => { setSkipTarget(null); setSkipReason('') }}
        title={t('queues.skip')}
        description={t('queues.skipPrompt')}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => { setSkipTarget(null); setSkipReason('') }}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              loading={skipMutation.isPending}
              disabled={!skipReason.trim()}
              onClick={() => skipTarget && skipMutation.mutate({ ticket: skipTarget, reason: skipReason })}
            >
              {t('queues.skip')}
            </Button>
          </>
        }
      >
        <Field label={t('queues.skipReason')} required>
          <Input value={skipReason} onChange={(event) => setSkipReason(event.target.value)} autoFocus />
        </Field>
        {skipTarget ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
            <Avatar name={patientDisplayName(skipTarget.patient, locale)} size="sm" tone="neutral" />
            {patientDisplayName(skipTarget.patient, locale)} · {skipTarget.display_number}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
