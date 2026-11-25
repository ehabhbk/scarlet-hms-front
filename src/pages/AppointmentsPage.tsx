import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Ban,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ListOrdered,
  Search,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { PatientPicker } from '@/components/patients/PatientPicker'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, Appointment, AppointmentSummary, Patient, PatientDetail } from '@/lib/types'
import { formatDateTime, formatNumber, nameOf, patientDisplayName, toDateTimeInput, todayInput } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useAuthStore } from '@/stores/auth'
import { useMeta, usePermission } from '@/hooks/useMeta'

interface BookingForm {
  patient: Patient | null
  branch_id: string
  department_id: string
  doctor_id: string
  scheduled_at: string
  duration_minutes: string
  type: string
  reason: string
  notes: string
}

export function AppointmentsPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const { data: meta } = useMeta()
  const canCreate = usePermission('appointments.create')
  const canManage = usePermission('appointments.manage')

  const [date, setDate] = useState(searchParams.get('date') ?? todayInput())
  const [status, setStatus] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 350)
  const [bookingOpen, setBookingOpen] = useState(searchParams.get('new') === '1')
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const [booking, setBooking] = useState<BookingForm>(() => ({
    patient: null,
    branch_id: user?.branch_id ? String(user.branch_id) : '',
    department_id: '',
    doctor_id: '',
    scheduled_at: toDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)),
    duration_minutes: '20',
    type: 'new',
    reason: '',
    notes: '',
  }))

  const initialPatientId = searchParams.get('patient_id') ? Number(searchParams.get('patient_id')) : null

  const { data: initialPatient } = useQuery({
    queryKey: ['patient', initialPatientId, 'booking-summary'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<PatientDetail>>(`/patients/${initialPatientId}`)
      return data.data.patient
    },
    enabled: Boolean(initialPatientId) && bookingOpen && !booking.patient,
  })

  useEffect(() => {
    if (initialPatient && !booking.patient) {
      setBooking((current) => ({ ...current, patient: initialPatient }))
    }
  }, [initialPatient, booking.patient])

  const { data: list, isLoading } = useQuery({
    queryKey: ['appointments', { date, status, doctorId, departmentId, search: debouncedSearch }],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Appointment[]>>('/appointments', {
        params: {
          date,
          status: status || undefined,
          doctor_id: doctorId || undefined,
          department_id: departmentId || undefined,
          search: debouncedSearch || undefined,
          per_page: 50,
        },
      })
      return data.data
    },
    placeholderData: (previous) => previous,
  })

  const { data: summary } = useQuery({
    queryKey: ['appointments-summary', { date }],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<AppointmentSummary>>('/appointments/summary', {
        params: { date },
      })
      return data.data
    },
  })

  const bookingDoctors = useMemo(() => {
    if (!meta) return []
    return meta.doctors.filter((doctor) => {
      if (booking.department_id && doctor.department_id !== Number(booking.department_id)) return false
      if (booking.branch_id && doctor.branch_id && doctor.branch_id !== Number(booking.branch_id)) return false
      return true
    })
  }, [meta, booking.department_id, booking.branch_id])

  const bookMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiEnvelope<Appointment>>('/appointments', {
        patient_id: booking.patient?.id,
        branch_id: Number(booking.branch_id),
        department_id: Number(booking.department_id),
        doctor_id: booking.doctor_id ? Number(booking.doctor_id) : null,
        scheduled_at: booking.scheduled_at.replace('T', ' '),
        duration_minutes: Number(booking.duration_minutes),
        type: booking.type,
        reason: booking.reason || null,
        notes: booking.notes || null,
      })
      return data.data
    },
    onSuccess: (appointment) => {
      toast.success(t('appointments.bookedSuccess'))
      setBookingOpen(false)
      setBooking((current) => ({
        ...current,
        patient: null,
        department_id: '',
        doctor_id: '',
        reason: '',
        notes: '',
      }))
      if (appointment.scheduled_date) setDate(appointment.scheduled_date)
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      void queryClient.invalidateQueries({ queryKey: ['appointments-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      next.delete('patient_id')
      setSearchParams(next, { replace: true })
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const checkInMutation = useMutation({
    mutationFn: async (appointment: Appointment) => {
      const { data } = await api.post<ApiEnvelope<Appointment>>(`/appointments/${appointment.id}/check-in`)
      return data.data
    },
    onSuccess: (appointment) => {
      const number = appointment.queue_ticket?.display_number
      toast.success(number ? `${t('appointments.checkInSuccess')} · ${number}` : t('appointments.checkInSuccess'))
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      void queryClient.invalidateQueries({ queryKey: ['appointments-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['queues'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const cancelMutation = useMutation({
    mutationFn: async (payload: { appointment: Appointment; reason: string }) => {
      await api.post(`/appointments/${payload.appointment.id}/cancel`, { reason: payload.reason || null })
    },
    onSuccess: () => {
      toast.success(t('appointments.cancelSuccess'))
      setCancelTarget(null)
      setCancelReason('')
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      void queryClient.invalidateQueries({ queryKey: ['appointments-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const noShowMutation = useMutation({
    mutationFn: async (appointment: Appointment) => {
      await api.post(`/appointments/${appointment.id}/no-show`)
    },
    onSuccess: () => {
      toast.success(t('appointments.noShowSuccess'))
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      void queryClient.invalidateQueries({ queryKey: ['appointments-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const closeBooking = () => {
    setBookingOpen(false)
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    next.delete('patient_id')
    setSearchParams(next, { replace: true })
  }

  const bookingValid =
    booking.patient && booking.branch_id && booking.department_id && booking.scheduled_at

  const statusOptions = ['booked', 'checked_in', 'completed', 'cancelled', 'no_show'] as const
  const statusLabels: Record<string, string> = {
    booked: 'appointments.statusBooked',
    checked_in: 'appointments.statusCheckedIn',
    completed: 'appointments.statusCompleted',
    cancelled: 'appointments.statusCancelled',
    no_show: 'appointments.statusNoShow',
  }
  const typeLabels: Record<string, string> = {
    new: 'appointments.typeNew',
    follow_up: 'appointments.typeFollowUp',
    walk_in: 'appointments.typeWalkIn',
    consultation: 'appointments.typeConsultation',
  }

  return (
    <div>
      <PageHeader
        title={t('appointments.title')}
        subtitle={t('appointments.subtitle')}
        actions={
          canCreate ? (
            <Button onClick={() => setBookingOpen(true)}>
              <CalendarPlus className="h-4 w-4" />
              {t('appointments.new')}
            </Button>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <div className="card px-4 py-3">
          <p className="text-[10px] font-semibold text-ink-muted">{t('appointments.total')}</p>
          <p className="mt-0.5 text-xl font-extrabold text-ink">{formatNumber(summary?.total ?? 0, locale)}</p>
        </div>
        {statusOptions.slice(0, 5).map((option) => (
          <div key={option} className="card px-4 py-3">
            <p className="text-[10px] font-semibold text-ink-muted">{t(`status.${option}`)}</p>
            <p className="mt-0.5 text-xl font-extrabold text-ink">
              {formatNumber(summary?.counts?.[option] ?? 0, locale)}
            </p>
          </div>
        ))}
      </div>

      <div className="card mb-4 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('appointments.searchPlaceholder')}
              className="field h-10 ps-9"
              aria-label={t('common.search')}
            />
          </div>
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10" aria-label={t('appointments.date')} />
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10">
            <option value="">{t('appointments.allStatuses')}</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>{t(statusLabels[option])}</option>
            ))}
          </Select>
          <Select value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setDoctorId('') }} className="h-10">
            <option value="">{t('appointments.allDepartments')}</option>
            {(meta?.departments ?? []).map((department) => (
              <option key={department.id} value={department.id}>{nameOf(department, locale)}</option>
            ))}
          </Select>
          <Select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} className="h-10">
            <option value="">{t('appointments.allDoctors')}</option>
            {(meta?.doctors ?? []).map((doctor) => (
              <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
            ))}
          </Select>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-subtle">
          <CalendarDays className="h-3.5 w-3.5" />
          {date}
        </p>
      </div>

      <div className="table-shell">
        {isLoading ? (
          <TableSkeleton rows={7} />
        ) : list?.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('appointments.time')}</th>
                  <th>{t('appointments.patient')}</th>
                  <th>{t('appointments.department')} / {t('appointments.doctor')}</th>
                  <th>{t('appointments.type')}</th>
                  <th>{t('common.status')}</th>
                  <th className="text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((appointment) => (
                  <tr key={appointment.id}>
                    <td className="whitespace-nowrap">
                      <p className="text-sm font-extrabold text-ink">{appointment.scheduled_time}</p>
                      <p className="font-mono text-[10px] text-ink-subtle">{appointment.appointment_number}</p>
                      {appointment.queue_ticket ? (
                        <Badge tone="scarlet" className="mt-1">
                          <ListOrdered className="h-3 w-3" />
                          {appointment.queue_ticket.display_number}
                        </Badge>
                      ) : null}
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={patientDisplayName(appointment.patient, locale)} size="sm" tone="neutral" />
                        <div className="min-w-0">
                          <Link
                            to={appointment.patient_id ? `/patients/${appointment.patient_id}` : '/patients'}
                            className="block truncate text-sm font-semibold text-ink hover:text-scarlet-800"
                          >
                            {patientDisplayName(appointment.patient, locale)}
                          </Link>
                          <p className="text-[10px] text-ink-muted">{appointment.patient?.mrn}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">
                      <p className="font-medium text-ink">{appointment.department ? nameOf(appointment.department, locale) : '—'}</p>
                      <p className="text-[11px] text-ink-muted">{appointment.doctor?.name ?? '—'}</p>
                    </td>
                    <td>
                      <Badge tone="neutral">{t(typeLabels[appointment.type] ?? appointment.type, { defaultValue: appointment.type })}</Badge>
                      {appointment.reason ? <p className="mt-1 max-w-[180px] truncate text-[11px] text-ink-subtle">{appointment.reason}</p> : null}
                    </td>
                    <td><StatusBadge status={appointment.status} /></td>
                    <td>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {canManage && appointment.status === 'booked' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={checkInMutation.isPending && checkInMutation.variables?.id === appointment.id}
                            onClick={() => checkInMutation.mutate(appointment)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {t('appointments.checkIn')}
                          </Button>
                        ) : null}
                        {canManage && ['booked', 'checked_in'].includes(appointment.status) ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setCancelTarget(appointment)} title={t('appointments.cancel')}>
                              <Ban className="h-4 w-4 text-danger-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={noShowMutation.isPending && noShowMutation.variables?.id === appointment.id}
                              onClick={() => noShowMutation.mutate(appointment)}
                              title={t('appointments.noShow')}
                            >
                              <UserX className="h-4 w-4 text-ink-subtle" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title={t('appointments.noAppointments')}
            action={
              canCreate ? (
                <Button onClick={() => setBookingOpen(true)}>
                  <CalendarPlus className="h-4 w-4" />
                  {t('appointments.new')}
                </Button>
              ) : undefined
            }
          />
        )}
      </div>

      <Modal
        open={bookingOpen}
        onClose={closeBooking}
        title={t('appointments.newTitle')}
        description={t('appointments.newSubtitle')}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeBooking}>{t('common.cancel')}</Button>
            <Button
              loading={bookMutation.isPending}
              disabled={!bookingValid}
              onClick={() => bookMutation.mutate()}
            >
              <CalendarPlus className="h-4 w-4" />
              {t('appointments.book')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('appointments.selectPatient')} required>
            <PatientPicker
              value={booking.patient}
              onChange={(patient) => setBooking({ ...booking, patient })}
              autoFocus
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('common.branch')} required>
              <Select
                value={booking.branch_id}
                onChange={(event) => setBooking({ ...booking, branch_id: event.target.value, department_id: '', doctor_id: '' })}
              >
                <option value="">{t('appointments.selectDepartment')}</option>
                {(meta?.branches ?? []).map((branch) => (
                  <option key={branch.id} value={branch.id}>{nameOf(branch, locale)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('appointments.selectDepartment')} required>
              <Select
                value={booking.department_id}
                onChange={(event) => setBooking({ ...booking, department_id: event.target.value, doctor_id: '' })}
              >
                <option value="">{t('appointments.selectDepartment')}</option>
                {((meta?.departments ?? []).filter((department) => !booking.branch_id || department.branch_id === Number(booking.branch_id))).map((department) => (
                  <option key={department.id} value={department.id}>{nameOf(department, locale)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('appointments.selectDoctor')}>
              <Select
                value={booking.doctor_id}
                onChange={(event) => setBooking({ ...booking, doctor_id: event.target.value })}
              >
                <option value="">{t('appointments.selectDoctor')}</option>
                {bookingDoctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('appointments.type')}>
              <Select value={booking.type} onChange={(event) => setBooking({ ...booking, type: event.target.value })}>
                <option value="new">{t('appointments.typeNew')}</option>
                <option value="follow_up">{t('appointments.typeFollowUp')}</option>
                <option value="consultation">{t('appointments.typeConsultation')}</option>
                <option value="walk_in">{t('appointments.typeWalkIn')}</option>
              </Select>
            </Field>
            <Field label={t('appointments.dateTime')} required>
              <Input
                type="datetime-local"
                value={booking.scheduled_at}
                onChange={(event) => setBooking({ ...booking, scheduled_at: event.target.value })}
              />
            </Field>
            <Field label={t('appointments.duration')} hint={t('appointments.slotsHint')}>
              <Input
                type="number"
                min={5}
                max={240}
                step={5}
                value={booking.duration_minutes}
                onChange={(event) => setBooking({ ...booking, duration_minutes: event.target.value })}
              />
            </Field>
          </div>
          <Field label={t('appointments.reason')}>
            <Input
              value={booking.reason}
              onChange={(event) => setBooking({ ...booking, reason: event.target.value })}
              placeholder={t('appointments.reason')}
            />
          </Field>
          <Field label={t('appointments.notes')}>
            <Textarea
              rows={2}
              value={booking.notes}
              onChange={(event) => setBooking({ ...booking, notes: event.target.value })}
            />
          </Field>
          {booking.patient ? (
            <div className="rounded-xl bg-surface-muted px-3.5 py-3 text-xs text-ink-muted">
              <p className="font-semibold text-ink">{patientDisplayName(booking.patient, locale)}</p>
              <p className="mt-0.5">
                {booking.patient.mrn}
                {booking.patient.phone ? ` · ${booking.patient.phone}` : ''}
                {booking.patient.age !== null && booking.patient.age !== undefined ? ` · ${booking.patient.age} ${t('common.years')}` : ''}
              </p>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => { setCancelTarget(null); setCancelReason('') }}
        title={t('appointments.cancel')}
        description={t('appointments.cancelConfirm')}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => { setCancelTarget(null); setCancelReason('') }}>{t('common.back')}</Button>
            <Button
              variant="danger"
              loading={cancelMutation.isPending}
              onClick={() => cancelTarget && cancelMutation.mutate({ appointment: cancelTarget, reason: cancelReason })}
            >
              <Ban className="h-4 w-4" />
              {t('appointments.cancel')}
            </Button>
          </>
        }
      >
        <Field label={t('appointments.cancellationReason')}>
          <Textarea
            rows={3}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder={t('appointments.cancelReasonPlaceholder')}
            autoFocus
          />
        </Field>
        {cancelTarget ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
            <Clock className="h-3.5 w-3.5" />
            {formatDateTime(cancelTarget.scheduled_at, locale)} · {patientDisplayName(cancelTarget.patient, locale)}
          </p>
        ) : null}
      </Modal>
    </div>
  )
}
