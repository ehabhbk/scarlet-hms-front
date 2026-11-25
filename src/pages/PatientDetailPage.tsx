import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Clock,
  Droplets,
  FileText,
  HeartPulse,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShieldAlert,
  Stethoscope,
  Trash2,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { InfoRow } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'

import { StatusBadge } from '@/components/ui/StatusBadge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, PatientDetail, TimelineItem } from '@/lib/types'
import { formatDate, formatDateTime, nameOf, patientDisplayName } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'
import { usePermission } from '@/hooks/useMeta'

type AllergyForm = { allergen: string; reaction: string; severity: string }
type ConditionForm = { type: string; code: string; name_ar: string; name_en: string; diagnosed_on: string; notes: string }

const emptyAllergy: AllergyForm = { allergen: '', reaction: '', severity: 'mild' }
const emptyCondition: ConditionForm = { type: 'chronic', code: '', name_ar: '', name_en: '', diagnosed_on: '', notes: '' }

const severityTone = (severity: string) =>
  severity === 'life_threatening' || severity === 'severe' ? 'danger' : severity === 'moderate' ? 'warning' : 'neutral'

export function PatientDetailPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const params = useParams()
  const patientId = Number(params.id)
  const queryClient = useQueryClient()
  const canUpdate = usePermission('patients.update')
  const canCreateAppointment = usePermission('appointments.create')
  const canCreateEncounter = usePermission('encounters.create')
  const canArchive = usePermission('patients.merge')

  const [tab, setTab] = useState('overview')
  const [allergyOpen, setAllergyOpen] = useState(false)
  const [conditionOpen, setConditionOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'allergy' | 'condition'; id: number } | null>(null)
  const [allergyForm, setAllergyForm] = useState<AllergyForm>(emptyAllergy)
  const [conditionForm, setConditionForm] = useState<ConditionForm>(emptyCondition)

  const { data, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<PatientDetail>>(`/patients/${patientId}`)
      return data.data
    },
    enabled: Number.isFinite(patientId),
  })

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['patient-timeline', patientId],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<{ patient: PatientDetail['patient']; items: TimelineItem[] }>>(
        `/patients/${patientId}/timeline`,
      )
      return data.data.items
    },
    enabled: tab === 'timeline',
  })

  const patient = data?.patient

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
    void queryClient.invalidateQueries({ queryKey: ['patient-timeline', patientId] })
  }

  const allergyMutation = useMutation({
    mutationFn: async (payload: AllergyForm) => {
      await api.post(`/patients/${patientId}/allergies`, payload)
    },
    onSuccess: () => {
      toast.success(t('patients.allergyAdded'))
      setAllergyOpen(false)
      setAllergyForm(emptyAllergy)
      refresh()
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const conditionMutation = useMutation({
    mutationFn: async (payload: ConditionForm) => {
      await api.post(`/patients/${patientId}/conditions`, payload)
    },
    onSuccess: () => {
      toast.success(t('patients.conditionAdded'))
      setConditionOpen(false)
      setConditionForm(emptyCondition)
      refresh()
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const deleteMutation = useMutation({
    mutationFn: async (target: { type: 'allergy' | 'condition'; id: number }) => {
      await api.delete(`/patients/${patientId}/${target.type === 'allergy' ? 'allergies' : 'conditions'}/${target.id}`)
    },
    onSuccess: () => {
      toast.success(t('common.saved'))
      setDeleteTarget(null)
      refresh()
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const archiveMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/patients/${patientId}`)
    },
    onSuccess: () => {
      toast.success(t('patients.archived'))
      navigate('/patients')
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const ArrowBack = locale === 'ar' ? ArrowRight : ArrowLeft

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-ink-muted">
        <Loader2 className="h-5 w-5 animate-spin text-scarlet-700" />
        {t('common.loading')}
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="card">
        <EmptyState icon={UserRound} title={t('errors.notFound')} action={<Button onClick={() => navigate('/patients')}>{t('common.back')}</Button>} />
      </div>
    )
  }

  const activeAllergies = patient.allergies?.filter((allergy) => allergy.status === 'active') ?? []
  const encounterTone = (status: string) => (status === 'completed' ? 'success' : status === 'cancelled' ? 'danger' : 'info')

  return (
    <div>
      <PageHeader
        eyebrow={patient.mrn}
        title={patientDisplayName(patient, locale)}
        subtitle={`${patient.age ?? '—'} ${t('common.years')} · ${patient.gender === 'male' ? t('patients.male') : patient.gender === 'female' ? t('patients.female') : t('patients.other')}${patient.blood_type ? ` · ${patient.blood_type}` : ''}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/patients')}>
              <ArrowBack className="h-4 w-4" />
              {t('common.back')}
            </Button>
            {canArchive ? (
              <Button variant="outline" size="sm" onClick={() => setArchiveOpen(true)}>
                <Trash2 className="h-4 w-4" />
                {t('patients.archive')}
              </Button>
            ) : null}
            {canUpdate ? (
              <Button variant="outline" size="sm" onClick={() => navigate(`/patients/${patient.id}/edit`)}>
                <Pencil className="h-4 w-4" />
                {t('common.edit')}
              </Button>
            ) : null}
            {canCreateAppointment ? (
              <Button variant="secondary" size="sm" onClick={() => navigate(`/appointments?new=1&patient_id=${patient.id}`)}>
                <CalendarPlus className="h-4 w-4" />
                {t('appointments.new')}
              </Button>
            ) : null}
            {canCreateEncounter ? (
              <Button size="sm" onClick={() => navigate(`/encounters?new=1&patient_id=${patient.id}`)}>
                <Stethoscope className="h-4 w-4" />
                {t('encounters.startEncounter')}
              </Button>
            ) : null}
          </>
        }
      />

      {activeAllergies.length ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
          <div>
            <p className="text-sm font-bold text-danger-700">{t('patients.allergiesAlert')}</p>
            <p className="mt-0.5 text-xs text-danger-600">
              {activeAllergies.map((allergy) => allergy.allergen).join(' · ')}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'overview', label: t('patients.overview') },
            { id: 'timeline', label: t('patients.timeline') },
            { id: 'encounters', label: t('patients.encounters'), count: data?.recent_encounters?.length ?? 0 },
            { id: 'appointments', label: t('patients.appointments'), count: data?.upcoming_appointments?.length ?? 0 },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={patient.status === 'active' ? 'success' : 'neutral'} dot>
            {t(`status.${patient.status}`, { defaultValue: patient.status })}
          </Badge>
          {patient.national_id ? <Badge tone="neutral">ID {patient.national_id}</Badge> : null}
        </div>
      </div>

      {tab === 'overview' ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="card xl:col-span-2">
              <div className="flex items-center gap-2 border-b border-line px-5 py-4">
                <UserRound className="h-4 w-4 text-scarlet-700" />
                <h2 className="text-sm font-bold text-ink">{t('patients.demographics')}</h2>
              </div>
              <div className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label={t('patients.mrn')} value={<span className="font-mono">{patient.mrn}</span>} icon={ClipboardList} />
                <InfoRow label={t('patients.dateOfBirth')} value={formatDate(patient.date_of_birth, locale)} icon={CalendarDays} />
                <InfoRow label={t('patients.nationality')} value={patient.nationality} icon={MapPin} />
                <InfoRow label={t('patients.nationalId')} value={patient.national_id} icon={FileText} />
                <InfoRow label={t('patients.passport')} value={patient.passport_number} icon={FileText} />
                <InfoRow label={t('patients.bloodType')} value={patient.blood_type} icon={Droplets} />
                <InfoRow label={t('patients.registeredAt')} value={formatDate(patient.created_at, locale)} icon={Clock} />
                <InfoRow label={t('patients.registeredBranch')} value={patient.registration_branch ? nameOf(patient.registration_branch, locale) : null} icon={MapPin} />
                <InfoRow label={t('common.status')} value={<StatusBadge status={patient.status} />} icon={Activity} />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-2 border-b border-line px-5 py-4">
                <Phone className="h-4 w-4 text-scarlet-700" />
                <h2 className="text-sm font-bold text-ink">{t('patients.contactInfo')}</h2>
              </div>
              <div className="space-y-2.5 p-4">
                <InfoRow label={t('patients.phone')} value={<span dir="ltr">{patient.phone ?? '—'}</span>} icon={Phone} />
                <InfoRow label={t('common.optional')} value={<span dir="ltr">{patient.alt_phone ?? '—'}</span>} icon={Phone} />
                <InfoRow label="Email" value={<span dir="ltr">{patient.email ?? '—'}</span>} icon={FileText} />
                <InfoRow label={t('patients.city')} value={patient.city} icon={MapPin} />
                <InfoRow label={t('patients.address')} value={patient.address} icon={MapPin} />
                <InfoRow
                  label={t('patients.emergencyContact')}
                  value={
                    patient.emergency_contact_name
                      ? `${patient.emergency_contact_name}${patient.emergency_contact_relation ? ` (${patient.emergency_contact_relation})` : ''}${patient.emergency_contact_phone ? ` · ${patient.emergency_contact_phone}` : ''}`
                      : null
                  }
                  icon={ShieldAlert}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="card">
              <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-danger-600" />
                  <h2 className="text-sm font-bold text-ink">{t('patients.allergiesTitle')}</h2>
                </div>
                {canUpdate ? (
                  <Button variant="secondary" size="sm" onClick={() => setAllergyOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    {t('patients.addAllergy')}
                  </Button>
                ) : null}
              </div>
              {patient.allergies?.length ? (
                <div className="divide-y divide-line">
                  {patient.allergies.map((allergy) => (
                    <div key={allergy.id} className="flex items-start gap-3 px-5 py-3.5">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-50 text-danger-600">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-ink">{allergy.allergen}</p>
                          <Badge tone={severityTone(allergy.severity)}>{allergy.severity.replace('_', ' ')}</Badge>
                          <Badge tone={allergy.status === 'active' ? 'danger' : 'neutral'}>{allergy.status}</Badge>
                        </div>
                        {allergy.reaction ? <p className="mt-0.5 text-xs text-ink-muted">{allergy.reaction}</p> : null}
                        <p className="mt-1 text-[10px] text-ink-subtle">
                          {formatDate(allergy.created_at, locale)}
                          {allergy.recorded_by ? ` · ${allergy.recorded_by}` : ''}
                        </p>
                      </div>
                      {canUpdate ? (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ type: 'allergy', id: allergy.id })}
                          className="rounded-lg p-1.5 text-ink-subtle transition hover:bg-danger-50 hover:text-danger-600"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={AlertTriangle} title={t('patients.noAllergies')} className="py-8" />
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
                <div className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-scarlet-700" />
                  <h2 className="text-sm font-bold text-ink">{t('patients.conditionsTitle')}</h2>
                </div>
                {canUpdate ? (
                  <Button variant="secondary" size="sm" onClick={() => setConditionOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    {t('patients.addCondition')}
                  </Button>
                ) : null}
              </div>
              {patient.conditions?.length ? (
                <div className="divide-y divide-line">
                  {patient.conditions.map((condition) => (
                    <div key={condition.id} className="flex items-start gap-3 px-5 py-3.5">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-scarlet-50 text-scarlet-700">
                        <HeartPulse className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-ink">
                            {locale === 'ar' ? condition.name_ar : condition.name_en || condition.name_ar}
                          </p>
                          <Badge tone="scarlet">{condition.type}</Badge>
                          {condition.code ? <Badge tone="neutral">{condition.code}</Badge> : null}
                        </div>
                        {condition.notes ? <p className="mt-0.5 text-xs text-ink-muted">{condition.notes}</p> : null}
                        {condition.diagnosed_on ? (
                          <p className="mt-1 text-[10px] text-ink-subtle">{formatDate(condition.diagnosed_on, locale)}</p>
                        ) : null}
                      </div>
                      {canUpdate ? (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ type: 'condition', id: condition.id })}
                          className="rounded-lg p-1.5 text-ink-subtle transition hover:bg-danger-50 hover:text-danger-600"
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={HeartPulse} title={t('patients.noConditions')} className="py-8" />
              )}
            </div>
          </div>

          {patient.notes ? (
            <div className="card px-5 py-4">
              <h2 className="mb-1 text-sm font-bold text-ink">{t('patients.notes')}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">{patient.notes}</p>
            </div>
          ) : null}

          <div className="card">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-sm font-bold text-ink">{t('patients.recentEncounters')}</h2>
              <button type="button" onClick={() => setTab('encounters')} className="text-xs font-bold text-scarlet-800 hover:underline">
                {t('common.viewAll')}
              </button>
            </div>
            {data?.recent_encounters?.length ? (
              <div className="divide-y divide-line">
                {data.recent_encounters.slice(0, 5).map((encounter) => (
                  <Link
                    key={encounter.id}
                    to={`/encounters/${encounter.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-scarlet-50/40"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-scarlet-50 text-scarlet-700">
                      <Stethoscope className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {encounter.encounter_number}
                        {encounter.chief_complaint ? ` · ${encounter.chief_complaint}` : ''}
                      </p>
                      <p className="truncate text-[11px] text-ink-muted">
                        {formatDateTime(encounter.started_at, locale)}
                        {encounter.department ? ` · ${nameOf(encounter.department, locale)}` : ''}
                        {encounter.doctor ? ` · ${encounter.doctor.name}` : ''}
                      </p>
                    </div>
                    <Badge tone={encounter.is_signed ? 'success' : encounterTone(encounter.status)}>
                      {encounter.is_signed ? t('encounters.signed') : t(`status.${encounter.status}`, { defaultValue: encounter.status })}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState icon={Stethoscope} title={t('encounters.noEncounters')} className="py-8" />
            )}
          </div>
        </div>
      ) : null}

      {tab === 'timeline' ? (
        <div className="card">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-bold text-ink">{t('patients.timeline')}</h2>
            <p className="mt-0.5 text-xs text-ink-muted">{t('patients.subtitle')}</p>
          </div>
          {timelineLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : timeline?.length ? (
            <ol className="relative px-5 py-5">
              <div className="absolute inset-y-6 start-[2.05rem] w-px bg-line" aria-hidden />
              {timeline.map((item) => {
                const Icon =
                  item.type === 'encounter'
                    ? Stethoscope
                    : item.type === 'appointment'
                      ? CalendarDays
                      : item.type === 'vitals'
                        ? Activity
                        : item.type === 'diagnosis'
                          ? FileText
                          : item.type === 'allergy'
                            ? AlertTriangle
                            : item.type === 'condition'
                              ? HeartPulse
                              : ClipboardList

                return (
                  <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
                    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-surface bg-scarlet-50 text-scarlet-700 ring-1 ring-line">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface-muted/40 px-3.5 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">
                          {locale === 'ar' ? item.title_ar : item.title_en}
                        </p>
                        <StatusBadge status={item.status} />
                      </div>
                      {item.subtitle_ar || item.subtitle_en ? (
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {locale === 'ar' ? item.subtitle_ar : item.subtitle_en}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[10px] text-ink-subtle">{formatDateTime(item.at, locale)}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <EmptyState icon={Clock} title={t('common.noData')} />
          )}
        </div>
      ) : null}

      {tab === 'encounters' ? (
        <div className="card">
          {data?.recent_encounters?.length ? (
            <div className="divide-y divide-line">
              {data.recent_encounters.map((encounter) => (
                <Link
                  key={encounter.id}
                  to={`/encounters/${encounter.id}`}
                  className="flex items-center gap-3 px-5 py-4 transition hover:bg-scarlet-50/40"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-scarlet-50 text-scarlet-700">
                    <Stethoscope className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{encounter.encounter_number}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {formatDateTime(encounter.started_at, locale)}
                      {encounter.department ? ` · ${nameOf(encounter.department, locale)}` : ''}
                    </p>
                    {encounter.chief_complaint ? (
                      <p className="mt-0.5 truncate text-xs text-ink-subtle">{encounter.chief_complaint}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={encounter.is_signed ? 'success' : 'info'}>
                      {encounter.is_signed ? t('encounters.signed') : t(`status.${encounter.status}`, { defaultValue: encounter.status })}
                    </Badge>
                    {encounter.diagnoses?.length ? (
                      <span className="text-[10px] text-ink-subtle">
                        {encounter.diagnoses.length} {t('encounters.diagnoses')}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={Stethoscope} title={t('encounters.noEncounters')} />
          )}
        </div>
      ) : null}

      {tab === 'appointments' ? (
        <div className="card">
          {data?.upcoming_appointments?.length ? (
            <div className="divide-y divide-line">
              {data.upcoming_appointments.map((appointment) => (
                <div key={appointment.id} className="flex items-center gap-3 px-5 py-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-info-50 text-info-700">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{appointment.appointment_number}</p>
                    <p className="text-xs text-ink-muted">
                      {formatDateTime(appointment.scheduled_at, locale)}
                      {appointment.department ? ` · ${nameOf(appointment.department, locale)}` : ''}
                      {appointment.doctor ? ` · ${appointment.doctor.name}` : ''}
                    </p>
                    {appointment.reason ? <p className="mt-0.5 text-xs text-ink-subtle">{appointment.reason}</p> : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={appointment.status} />
                    {appointment.queue_ticket ? (
                      <span className="rounded-md bg-scarlet-50 px-2 py-0.5 text-[10px] font-bold text-scarlet-800">
                        {t('appointments.queueNumber')} {appointment.queue_ticket.display_number}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title={t('patients.noUpcoming')} />
          )}
        </div>
      ) : null}

      <Modal
        open={allergyOpen}
        onClose={() => setAllergyOpen(false)}
        title={t('patients.addAllergyTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setAllergyOpen(false)}>{t('common.cancel')}</Button>
            <Button
              loading={allergyMutation.isPending}
              disabled={!allergyForm.allergen.trim()}
              onClick={() => allergyMutation.mutate(allergyForm)}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('patients.allergy')} required>
            <Input
              value={allergyForm.allergen}
              onChange={(event) => setAllergyForm({ ...allergyForm, allergen: event.target.value })}
              placeholder={t('patients.allergenPlaceholder')}
              autoFocus
            />
          </Field>
          <Field label={t('patients.reaction')}>
            <Input
              value={allergyForm.reaction}
              onChange={(event) => setAllergyForm({ ...allergyForm, reaction: event.target.value })}
              placeholder={t('patients.reactionPlaceholder')}
            />
          </Field>
          <Field label={t('patients.severity')}>
            <Select
              value={allergyForm.severity}
              onChange={(event) => setAllergyForm({ ...allergyForm, severity: event.target.value })}
            >
              <option value="mild">{locale === 'ar' ? 'خفيفة' : 'Mild'}</option>
              <option value="moderate">{locale === 'ar' ? 'متوسطة' : 'Moderate'}</option>
              <option value="severe">{locale === 'ar' ? 'شديدة' : 'Severe'}</option>
              <option value="life_threatening">{locale === 'ar' ? 'مهددة للحياة' : 'Life threatening'}</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={conditionOpen}
        onClose={() => setConditionOpen(false)}
        title={t('patients.addConditionTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setConditionOpen(false)}>{t('common.cancel')}</Button>
            <Button
              loading={conditionMutation.isPending}
              disabled={!conditionForm.name_ar.trim()}
              onClick={() => conditionMutation.mutate(conditionForm)}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('patients.conditionNameAr')} required>
              <Input
                value={conditionForm.name_ar}
                onChange={(event) => setConditionForm({ ...conditionForm, name_ar: event.target.value })}
                autoFocus
              />
            </Field>
            <Field label={t('patients.conditionNameEn')}>
              <Input
                dir="ltr"
                value={conditionForm.name_en}
                onChange={(event) => setConditionForm({ ...conditionForm, name_en: event.target.value })}
              />
            </Field>
            <Field label={t('patients.conditionType')}>
              <Select
                value={conditionForm.type}
                onChange={(event) => setConditionForm({ ...conditionForm, type: event.target.value })}
              >
                <option value="chronic">{t('patients.chronic')}</option>
                <option value="surgical">{t('patients.surgical')}</option>
                <option value="family">{t('patients.family')}</option>
                <option value="social">{t('patients.social')}</option>
              </Select>
            </Field>
            <Field label={t('patients.diagnosisCode')}>
              <Input
                dir="ltr"
                value={conditionForm.code}
                onChange={(event) => setConditionForm({ ...conditionForm, code: event.target.value })}
                placeholder="E11.9"
              />
            </Field>
            <Field label={t('patients.diagnosedOn')} className="sm:col-span-2">
              <Input
                type="date"
                value={conditionForm.diagnosed_on}
                onChange={(event) => setConditionForm({ ...conditionForm, diagnosed_on: event.target.value })}
              />
            </Field>
          </div>
          <Field label={t('patients.notes')}>
            <Textarea
              rows={3}
              value={conditionForm.notes}
              onChange={(event) => setConditionForm({ ...conditionForm, notes: event.target.value })}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => archiveMutation.mutate()}
        title={t('patients.archive')}
        description={t('patients.archiveConfirm')}
        confirmLabel={t('common.yesArchive')}
        loading={archiveMutation.isPending}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        title={t('common.delete')}
        description={t('common.areYouSure')}
        confirmLabel={t('common.yesDelete')}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
