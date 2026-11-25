import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FileText, Plus, Search, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PatientPicker } from '@/components/patients/PatientPicker'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, Encounter, Patient, PatientDetail } from '@/lib/types'
import { formatDateTime, nameOf, patientDisplayName } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useAuthStore } from '@/stores/auth'
import { useMeta, usePermission } from '@/hooks/useMeta'

interface EncounterForm {
  patient: Patient | null
  branch_id: string
  department_id: string
  doctor_id: string
  type: string
  chief_complaint: string
}

export function EncountersPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((state) => state.user)
  const { data: meta } = useMeta()
  const canCreate = usePermission('encounters.create')

  const [filter, setFilter] = useState('all')
  const [date, setDate] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim(), 350)
  const [createOpen, setCreateOpen] = useState(searchParams.get('new') === '1')
  const [form, setForm] = useState<EncounterForm>(() => ({
    patient: null,
    branch_id: user?.branch_id ? String(user.branch_id) : '',
    department_id: user?.department_id ? String(user.department_id) : '',
    doctor_id: '',
    type: 'outpatient',
    chief_complaint: '',
  }))

  const initialPatientId = searchParams.get('patient_id') ? Number(searchParams.get('patient_id')) : null

  const { data: initialPatient } = useQuery({
    queryKey: ['patient', initialPatientId, 'encounter-summary'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<PatientDetail>>(`/patients/${initialPatientId}`)
      return data.data.patient
    },
    enabled: Boolean(initialPatientId) && createOpen && !form.patient,
  })

  useEffect(() => {
    if (initialPatient && !form.patient) {
      setForm((current) => ({ ...current, patient: initialPatient }))
    }
  }, [initialPatient, form.patient])

  const { data, isLoading } = useQuery({
    queryKey: ['encounters', { filter, date, search: debouncedSearch }],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Encounter[]>>('/encounters', {
        params: {
          per_page: 50,
          date: date || undefined,
          search: debouncedSearch || undefined,
          ...(filter === 'open' ? { open: 1 } : {}),
          ...(filter === 'signed' ? { status: 'completed' } : {}),
        },
      })
      return data.data
    },
    placeholderData: (previous) => previous,
  })

  const departments = useMemo(() => {
    if (!meta) return []
    return form.branch_id
      ? meta.departments.filter((department) => department.branch_id === Number(form.branch_id))
      : meta.departments
  }, [meta, form.branch_id])

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiEnvelope<Encounter>>('/encounters', {
        patient_id: form.patient?.id,
        branch_id: Number(form.branch_id),
        department_id: Number(form.department_id),
        doctor_id: form.doctor_id ? Number(form.doctor_id) : null,
        type: form.type,
        chief_complaint: form.chief_complaint || null,
      })
      return data.data
    },
    onSuccess: (encounter) => {
      toast.success(t('encounters.encounterStarted'))
      void queryClient.invalidateQueries({ queryKey: ['encounters'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setCreateOpen(false)
      const next = new URLSearchParams(searchParams)
      next.delete('new')
      next.delete('patient_id')
      setSearchParams(next, { replace: true })
      navigate(`/encounters/${encounter.id}`)
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const closeCreate = () => {
    setCreateOpen(false)
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    next.delete('patient_id')
    setSearchParams(next, { replace: true })
  }

  return (
    <div>
      <PageHeader
        title={t('encounters.title')}
        subtitle={t('encounters.subtitle')}
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('encounters.startEncounter')}
            </Button>
          ) : null
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center">
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { id: 'all', label: t('encounters.filtersAll') },
            { id: 'open', label: t('encounters.filtersOpen') },
            { id: 'signed', label: t('encounters.filtersSigned') },
          ]}
        />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('common.searchPlaceholder')}
            className="field h-10 ps-9"
            aria-label={t('common.search')}
          />
        </div>
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 lg:w-44" aria-label={t('common.date')} />
      </div>

      <div className="table-shell">
        {isLoading ? (
          <TableSkeleton rows={7} />
        ) : data?.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('encounters.encounterNumber')}</th>
                  <th>{t('encounters.patient')}</th>
                  <th>{t('encounters.doctor')} / {t('encounters.department')}</th>
                  <th>{t('encounters.startedAt')}</th>
                  <th>{t('encounters.diagnoses')}</th>
                  <th>{t('common.status')}</th>
                  <th className="text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((encounter) => (
                  <tr key={encounter.id} className="cursor-pointer" onClick={() => navigate(`/encounters/${encounter.id}`)}>
                    <td>
                      <span className="font-mono text-xs font-bold text-scarlet-800">{encounter.encounter_number}</span>
                      <p className="mt-0.5 text-[10px] text-ink-subtle">#{encounter.id}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={patientDisplayName(encounter.patient, locale)} size="sm" tone="neutral" />
                        <div className="min-w-0">
                          <Link
                            to={`/patients/${encounter.patient_id}`}
                            onClick={(event) => event.stopPropagation()}
                            className="block truncate text-sm font-semibold text-ink hover:text-scarlet-800"
                          >
                            {patientDisplayName(encounter.patient, locale)}
                          </Link>
                          <p className="text-[10px] text-ink-muted">{encounter.patient?.mrn}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">
                      <p className="font-medium text-ink">{encounter.doctor?.name ?? '—'}</p>
                      <p className="text-[11px] text-ink-muted">{encounter.department ? nameOf(encounter.department, locale) : '—'}</p>
                    </td>
                    <td className="whitespace-nowrap text-xs text-ink-muted">{formatDateTime(encounter.started_at, locale)}</td>
                    <td>
                      <Badge tone={encounter.diagnoses?.length ? 'scarlet' : 'neutral'}>
                        {encounter.diagnoses?.length ?? 0}
                      </Badge>
                    </td>
                    <td>
                      {encounter.is_signed ? (
                        <Badge tone="success" dot>{t('encounters.signed')}</Badge>
                      ) : (
                        <StatusBadge status={encounter.status} />
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation()
                            navigate(`/encounters/${encounter.id}`)
                          }}
                          title={t('encounters.viewEncounter')}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Stethoscope}
            title={t('encounters.noEncounters')}
            action={
              canCreate ? (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t('encounters.startEncounter')}
                </Button>
              ) : undefined
            }
          />
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={closeCreate}
        title={t('encounters.startEncounter')}
        description={t('encounters.subtitle')}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeCreate}>{t('common.cancel')}</Button>
            <Button
              loading={createMutation.isPending}
              disabled={!form.patient || !form.branch_id || !form.department_id}
              onClick={() => createMutation.mutate()}
            >
              <Stethoscope className="h-4 w-4" />
              {t('encounters.startEncounter')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('encounters.patient')} required>
            <PatientPicker value={form.patient} onChange={(patient) => setForm({ ...form, patient })} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('common.branch')} required>
              <Select
                value={form.branch_id}
                onChange={(event) => setForm({ ...form, branch_id: event.target.value, department_id: '', doctor_id: '' })}
              >
                <option value="">{t('common.branch')}</option>
                {(meta?.branches ?? []).map((branch) => (
                  <option key={branch.id} value={branch.id}>{nameOf(branch, locale)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('encounters.department')} required>
              <Select
                value={form.department_id}
                onChange={(event) => setForm({ ...form, department_id: event.target.value, doctor_id: '' })}
              >
                <option value="">{t('appointments.selectDepartment')}</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{nameOf(department, locale)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('encounters.doctor')}>
              <Select value={form.doctor_id} onChange={(event) => setForm({ ...form, doctor_id: event.target.value })}>
                <option value="">{t('appointments.selectDoctor')}</option>
                {(meta?.doctors ?? []).map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('appointments.type')}>
              <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                <option value="outpatient">{locale === 'ar' ? 'عيادة خارجية' : 'Outpatient'}</option>
                <option value="emergency">{locale === 'ar' ? 'طوارئ' : 'Emergency'}</option>
                <option value="inpatient">{locale === 'ar' ? 'تنويم' : 'Inpatient'}</option>
                <option value="surgery">{locale === 'ar' ? 'جراحة' : 'Surgery'}</option>
                <option value="icu">{locale === 'ar' ? 'عناية مركزة' : 'ICU'}</option>
                <option value="dental">{locale === 'ar' ? 'أسنان' : 'Dental'}</option>
              </Select>
            </Field>
          </div>
          <Field label={t('encounters.chiefComplaint')}>
            <Textarea
              rows={2}
              value={form.chief_complaint}
              onChange={(event) => setForm({ ...form, chief_complaint: event.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}
