import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  Loader2,
  Lock,
  Plus,
  Printer,
  Save,
  Stethoscope,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Tabs } from '@/components/ui/Tabs'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, Encounter, VitalSign } from '@/lib/types'
import { formatDate, formatDateTime, nameOf, patientDisplayName } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'
import { usePermission } from '@/hooks/useMeta'

interface ClinicalForm {
  chief_complaint: string
  history: string
  examination: string
  assessment: string
  plan: string
  disposition: string
}

const emptyClinical: ClinicalForm = {
  chief_complaint: '',
  history: '',
  examination: '',
  assessment: '',
  plan: '',
  disposition: '',
}

const emptyVitals = {
  temperature_c: '',
  heart_rate: '',
  respiratory_rate: '',
  systolic_bp: '',
  diastolic_bp: '',
  oxygen_saturation: '',
  weight_kg: '',
  height_cm: '',
  pain_score: '',
  notes: '',
}

const emptyDiagnosis = {
  icd10_code: '',
  name_ar: '',
  name_en: '',
  type: 'primary',
  certainty: 'suspected',
  notes: '',
}

const emptyNote = { type: 'progress', content: '', sign: false }

export function EncounterDetailPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const params = useParams()
  const encounterId = Number(params.id)
  const queryClient = useQueryClient()
  const canUpdate = usePermission('encounters.update')
  const canSign = usePermission('encounters.sign')
  const canAddVitals = usePermission('vitals.create')
  const canAddDiagnosis = usePermission('diagnoses.create')
  const canAddNote = usePermission('clinical_notes.create')

  const [clinical, setClinical] = useState<ClinicalForm>(emptyClinical)
  const [vitalsOpen, setVitalsOpen] = useState(false)
  const [diagnosisOpen, setDiagnosisOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [vitalsForm, setVitalsForm] = useState(emptyVitals)
  const [diagnosisForm, setDiagnosisForm] = useState(emptyDiagnosis)
  const [noteForm, setNoteForm] = useState(emptyNote)
  const [tab, setTab] = useState('clinical')

  const { data: encounter, isLoading } = useQuery({
    queryKey: ['encounter', encounterId],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Encounter>>(`/encounters/${encounterId}`)
      return data.data
    },
    enabled: Number.isFinite(encounterId),
  })

  useEffect(() => {
    if (!encounter) return
    setClinical({
      chief_complaint: encounter.chief_complaint ?? '',
      history: encounter.history ?? '',
      examination: encounter.examination ?? '',
      assessment: encounter.assessment ?? '',
      plan: encounter.plan ?? '',
      disposition: encounter.disposition ?? '',
    })
  }, [encounter])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['encounter', encounterId] })
    void queryClient.invalidateQueries({ queryKey: ['encounters'] })
    void queryClient.invalidateQueries({ queryKey: ['patient-timeline'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/encounters/${encounterId}`, clinical)
    },
    onSuccess: () => {
      toast.success(t('encounters.saved'))
      invalidate()
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const signMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ApiEnvelope<Encounter>>(`/encounters/${encounterId}/sign`)
      return data.data
    },
    onSuccess: () => {
      toast.success(t('encounters.signSuccess'))
      setSignOpen(false)
      invalidate()
    },
    onError: (error) => toast.error(parseApiError(error).message || t('encounters.signRequiresContent')),
  })

  const vitalsMutation = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(
        Object.entries(vitalsForm).map(([key, value]) => [key, value === '' ? null : value]),
      )
      await api.post(`/encounters/${encounterId}/vitals`, payload)
    },
    onSuccess: () => {
      toast.success(t('encounters.vitalsSaved'))
      setVitalsOpen(false)
      setVitalsForm(emptyVitals)
      invalidate()
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const diagnosisMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/encounters/${encounterId}/diagnoses`, diagnosisForm)
    },
    onSuccess: () => {
      toast.success(t('encounters.diagnosisAdded'))
      setDiagnosisOpen(false)
      setDiagnosisForm(emptyDiagnosis)
      invalidate()
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const noteMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/encounters/${encounterId}/notes`, noteForm)
    },
    onSuccess: () => {
      toast.success(t('encounters.noteAdded'))
      setNoteOpen(false)
      setNoteForm(emptyNote)
      invalidate()
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

  if (!encounter) {
    return (
      <div className="card">
        <EmptyState icon={Stethoscope} title={t('errors.notFound')} action={<Button onClick={() => navigate('/encounters')}>{t('common.back')}</Button>} />
      </div>
    )
  }

  const signed = encounter.is_signed
  const locked = signed || encounter.status === 'cancelled'
  const patient = encounter.patient
  const allergies = patient?.allergies?.filter((allergy) => allergy.status === 'active') ?? []
  const conditions = patient?.conditions ?? []
  const vitals = encounter.vital_signs ?? []
  const diagnoses = encounter.diagnoses ?? []
  const notes = encounter.clinical_notes ?? []

  const flagLabel = (flag: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      fever: { ar: 'حمى', en: 'Fever' },
      tachycardia: { ar: 'تسرع النبض', en: 'Tachycardia' },
      bradycardia: { ar: 'بطء النبض', en: 'Bradycardia' },
      high_systolic: { ar: 'ارتفاع الانقباضي', en: 'High systolic' },
      low_oxygen: { ar: 'انخفاض الأكسجين', en: 'Low oxygen' },
    }
    return locale === 'ar' ? labels[flag]?.ar ?? flag : labels[flag]?.en ?? flag
  }

  const clinicalFields: Array<{ key: keyof ClinicalForm; label: string; rows: number }> = [
    { key: 'chief_complaint', label: t('encounters.chiefComplaint'), rows: 2 },
    { key: 'history', label: t('encounters.history'), rows: 3 },
    { key: 'examination', label: t('encounters.examination'), rows: 3 },
    { key: 'assessment', label: t('encounters.assessment'), rows: 3 },
    { key: 'plan', label: t('encounters.plan'), rows: 3 },
    { key: 'disposition', label: t('encounters.disposition'), rows: 2 },
  ]

  return (
    <div>
      <PageHeader
        eyebrow={encounter.encounter_number}
        title={patient ? patientDisplayName(patient, locale) : t('encounters.title')}
        subtitle={`${patient?.mrn ?? ''}${patient?.age !== null && patient?.age !== undefined ? ` · ${patient.age} ${t('common.years')}` : ''} · ${formatDateTime(encounter.started_at, locale)}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/encounters')}>
              <ArrowBack className="h-4 w-4" />
              {t('common.back')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              {t('common.print')}
            </Button>
            {!signed && canSign ? (
              <Button size="sm" onClick={() => setSignOpen(true)}>
                <CheckCircle2 className="h-4 w-4" />
                {t('encounters.signButton')}
              </Button>
            ) : null}
          </>
        }
      />

      {signed ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-success-100 bg-success-50 px-4 py-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-success-700" />
          <div>
            <p className="text-sm font-bold text-success-700">{t('encounters.signedImmutable')}</p>
            <p className="mt-0.5 text-xs text-success-700/80">
              {t('encounters.lockedBanner', {
                date: formatDateTime(encounter.signed_at, locale),
                name: encounter.signed_by ?? '—',
              })}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={signed ? 'signed' : encounter.status} />
        <Badge tone="neutral">{encounter.type}</Badge>
        <Badge tone="scarlet">{encounter.encounter_number}</Badge>
        {encounter.department ? <Badge tone="info">{nameOf(encounter.department, locale)}</Badge> : null}
        {encounter.doctor ? <Badge tone="neutral">{encounter.doctor.name}</Badge> : null}
        <Tabs
          className="ms-auto"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'clinical', label: t('encounters.clinicalSummary') },
            { id: 'vitals', label: t('encounters.vitals'), count: vitals.length },
            { id: 'diagnoses', label: t('encounters.diagnoses'), count: diagnoses.length },
            { id: 'notes', label: t('encounters.notes'), count: notes.length },
          ]}
        />
      </div>

      {tab === 'clinical' ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="card xl:col-span-2">
            <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-scarlet-700" />
                <h2 className="text-sm font-bold text-ink">{t('encounters.clinicalSummary')}</h2>
              </div>
              {!locked && canUpdate ? (
                <Button size="sm" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  <Save className="h-3.5 w-3.5" />
                  {t('encounters.saveEncounter')}
                </Button>
              ) : null}
            </div>
            <div className="space-y-4 p-5">
              {clinicalFields.map((field) => (
                <Field key={field.key} label={field.label}>
                  {locked ? (
                    <div className="min-h-[2.75rem] whitespace-pre-wrap rounded-xl border border-line bg-surface-muted/60 px-3.5 py-2.5 text-sm leading-relaxed text-ink">
                      {clinical[field.key] || '—'}
                    </div>
                  ) : (
                    <Textarea
                      rows={field.rows}
                      value={clinical[field.key]}
                      onChange={(event) => setClinical({ ...clinical, [field.key]: event.target.value })}
                      disabled={!canUpdate}
                    />
                  )}
                </Field>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-sm font-bold text-ink">{t('encounters.patientSummary')}</h2>
              </div>
              <div className="space-y-3 p-4">
                {patient ? (
                  <>
                    <Link
                      to={`/patients/${patient.id}`}
                      className="flex items-center gap-3 rounded-xl border border-line bg-surface-muted/50 p-3 transition hover:border-scarlet-200"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-scarlet-800 text-sm font-bold text-white">
                        {patientDisplayName(patient, locale).charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{patientDisplayName(patient, locale)}</p>
                        <p className="text-[11px] text-ink-muted">
                          {patient.mrn}
                          {patient.blood_type ? ` · ${patient.blood_type}` : ''}
                        </p>
                      </div>
                    </Link>

                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-ink-muted">
                        <AlertTriangle className="h-3.5 w-3.5 text-danger-600" />
                        {t('encounters.allergies')}
                      </p>
                      {allergies.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {allergies.map((allergy) => (
                            <Badge key={allergy.id} tone="danger">
                              {allergy.allergen}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-ink-subtle">{t('patients.noAllergies')}</p>
                      )}
                    </div>

                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-ink-muted">
                        <HeartPulse className="h-3.5 w-3.5 text-scarlet-700" />
                        {t('encounters.conditions')}
                      </p>
                      {conditions.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {conditions.map((condition) => (
                            <Badge key={condition.id} tone="scarlet">
                              {locale === 'ar' ? condition.name_ar : condition.name_en || condition.name_ar}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-ink-subtle">{t('patients.noConditions')}</p>
                      )}
                    </div>

                    {patient.phone ? (
                      <div className="rounded-xl bg-surface-muted px-3 py-2 text-xs">
                        <p className="text-[10px] text-ink-subtle">{t('patients.phone')}</p>
                        <p dir="ltr" className="mt-0.5 font-semibold text-ink">{patient.phone}</p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-ink-muted">{t('common.noData')}</p>
                )}
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="text-sm font-bold text-ink">{t('encounters.diagnoses')}</h2>
                {!locked && canAddDiagnosis ? (
                  <Button size="sm" variant="secondary" onClick={() => setDiagnosisOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    {t('encounters.addDiagnosis')}
                  </Button>
                ) : null}
              </div>
              {diagnoses.length ? (
                <div className="divide-y divide-line">
                  {diagnoses.map((diagnosis) => (
                    <div key={diagnosis.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-ink">
                            {locale === 'ar' ? diagnosis.name_ar : diagnosis.name_en || diagnosis.name_ar}
                          </p>
                          <p className="mt-0.5 text-[10px] text-ink-subtle">
                            {diagnosis.icd10_code ?? '—'} · {diagnosis.diagnosed_by ?? ''}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge tone={diagnosis.type === 'primary' ? 'scarlet' : 'neutral'}>{t(`encounters.${diagnosis.type}`)}</Badge>
                          <Badge tone={diagnosis.certainty === 'confirmed' ? 'success' : diagnosis.certainty === 'rule_out' ? 'neutral' : 'warning'}>
                            {t(`encounters.${diagnosis.certainty === 'rule_out' ? 'ruleOut' : diagnosis.certainty}`)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={FileText} title={t('encounters.noDiagnoses')} className="py-6" />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'vitals' ? (
        <div className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-scarlet-700" />
              <h2 className="text-sm font-bold text-ink">{t('encounters.vitalSigns')}</h2>
            </div>
            {!locked && canAddVitals ? (
              <Button size="sm" variant="secondary" onClick={() => setVitalsOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                {t('encounters.addVitals')}
              </Button>
            ) : null}
          </div>
          {vitals.length ? (
            <div className="divide-y divide-line">
              {vitals.map((record: VitalSign) => (
                <div key={record.id} className="px-5 py-4">
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-ink">{formatDateTime(record.recorded_at, locale)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {record.flags?.map((flag) => (
                        <Badge key={flag} tone="warning" dot>
                          {flagLabel(flag)}
                        </Badge>
                      ))}
                      {record.recorded_by ? <span className="text-[10px] text-ink-subtle">{record.recorded_by}</span> : null}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {[
                      { label: t('encounters.temperature'), value: record.temperature_c },
                      { label: t('encounters.heartRate'), value: record.heart_rate },
                      { label: t('encounters.systolic'), value: record.systolic_bp },
                      { label: t('encounters.diastolic'), value: record.diastolic_bp },
                      { label: t('encounters.oxygenSaturation'), value: record.oxygen_saturation },
                      { label: t('encounters.weight'), value: record.weight_kg },
                      { label: t('encounters.bmi'), value: record.bmi },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded-lg bg-surface-muted px-2.5 py-2">
                        <p className="text-[9px] font-semibold text-ink-subtle">{metric.label}</p>
                        <p className="mt-0.5 text-sm font-bold text-ink">{metric.value ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                  {record.notes ? <p className="mt-2 text-xs text-ink-muted">{record.notes}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Activity} title={t('encounters.noVitals')} description={t('encounters.noVitalsHint')} />
          )}
        </div>
      ) : null}

      {tab === 'diagnoses' ? (
        <div className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-sm font-bold text-ink">{t('encounters.diagnoses')}</h2>
            {!locked && canAddDiagnosis ? (
              <Button size="sm" variant="secondary" onClick={() => setDiagnosisOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                {t('encounters.addDiagnosis')}
              </Button>
            ) : null}
          </div>
          {diagnoses.length ? (
            <div className="divide-y divide-line">
              {diagnoses.map((diagnosis) => (
                <div key={diagnosis.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-scarlet-50 text-scarlet-700">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">
                      {locale === 'ar' ? diagnosis.name_ar : diagnosis.name_en || diagnosis.name_ar}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {diagnosis.icd10_code ?? '—'}
                      {diagnosis.diagnosed_by ? ` · ${diagnosis.diagnosed_by}` : ''}
                      {diagnosis.created_at ? ` · ${formatDate(diagnosis.created_at, locale)}` : ''}
                    </p>
                    {diagnosis.notes ? <p className="mt-1 text-xs text-ink-subtle">{diagnosis.notes}</p> : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={diagnosis.type === 'primary' ? 'scarlet' : 'neutral'}>{t(`encounters.${diagnosis.type}`)}</Badge>
                    <Badge tone={diagnosis.certainty === 'confirmed' ? 'success' : diagnosis.certainty === 'rule_out' ? 'neutral' : 'warning'}>
                      {t(`encounters.${diagnosis.certainty === 'rule_out' ? 'ruleOut' : diagnosis.certainty}`)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={FileText} title={t('encounters.noDiagnoses')} />
          )}
        </div>
      ) : null}

      {tab === 'notes' ? (
        <div className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-ink">{t('encounters.notes')}</h2>
              <p className="mt-0.5 text-[11px] text-ink-muted">{t('encounters.signNoteHint')}</p>
            </div>
            {!locked && canAddNote ? (
              <Button size="sm" variant="secondary" onClick={() => setNoteOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                {t('encounters.addNote')}
              </Button>
            ) : null}
          </div>
          {notes.length ? (
            <div className="divide-y divide-line">
              {notes.map((note) => (
                <div key={note.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-scarlet-700" />
                      <p className="text-xs font-bold text-ink">{t(`encounters.${note.type}`)}</p>
                      <Badge tone={note.is_signed ? 'success' : 'warning'} dot>
                        {note.is_signed ? t('encounters.signed') : t('encounters.draft')}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-ink-subtle">
                      {note.author ? `${note.author} · ` : ''}
                      {formatDateTime(note.created_at, locale)}
                    </p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{note.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={ClipboardList} title={t('encounters.noNotes')} />
          )}
        </div>
      ) : null}

      {/* Vitals modal */}
      <Modal
        open={vitalsOpen}
        onClose={() => setVitalsOpen(false)}
        title={t('encounters.addVitalsTitle')}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setVitalsOpen(false)}>{t('common.cancel')}</Button>
            <Button loading={vitalsMutation.isPending} onClick={() => vitalsMutation.mutate()}>{t('common.save')}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ['temperature_c', t('encounters.temperature'), '37.0', '0.1'],
              ['heart_rate', t('encounters.heartRate'), '80', '1'],
              ['respiratory_rate', t('encounters.respiratoryRate'), '18', '1'],
              ['systolic_bp', t('encounters.systolic'), '120', '1'],
              ['diastolic_bp', t('encounters.diastolic'), '80', '1'],
              ['oxygen_saturation', t('encounters.oxygenSaturation'), '98', '1'],
              ['weight_kg', t('encounters.weight'), '70', '0.1'],
              ['height_cm', t('encounters.height'), '170', '0.1'],
              ['pain_score', t('encounters.painScore'), '0', '1'],
            ] as const
          ).map(([key, label, placeholder, step]) => (
            <Field key={key} label={label}>
              <Input
                type="number"
                step={step}
                min={0}
                value={vitalsForm[key]}
                onChange={(event) => setVitalsForm({ ...vitalsForm, [key]: event.target.value })}
                placeholder={placeholder}
              />
            </Field>
          ))}
          <Field label={t('patients.notes')} className="sm:col-span-2 lg:col-span-3">
            <Input
              value={vitalsForm.notes}
              onChange={(event) => setVitalsForm({ ...vitalsForm, notes: event.target.value })}
            />
          </Field>
        </div>
      </Modal>

      {/* Diagnosis modal */}
      <Modal
        open={diagnosisOpen}
        onClose={() => setDiagnosisOpen(false)}
        title={t('encounters.addDiagnosisTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDiagnosisOpen(false)}>{t('common.cancel')}</Button>
            <Button
              loading={diagnosisMutation.isPending}
              disabled={!diagnosisForm.name_ar.trim()}
              onClick={() => diagnosisMutation.mutate()}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('encounters.diagnosisNameAr')} required>
              <Input
                value={diagnosisForm.name_ar}
                onChange={(event) => setDiagnosisForm({ ...diagnosisForm, name_ar: event.target.value })}
                autoFocus
              />
            </Field>
            <Field label={t('encounters.diagnosisNameEn')}>
              <Input
                dir="ltr"
                value={diagnosisForm.name_en}
                onChange={(event) => setDiagnosisForm({ ...diagnosisForm, name_en: event.target.value })}
              />
            </Field>
            <Field label={t('encounters.icd10')}>
              <Input
                dir="ltr"
                value={diagnosisForm.icd10_code}
                onChange={(event) => setDiagnosisForm({ ...diagnosisForm, icd10_code: event.target.value })}
                placeholder="R07.4"
              />
            </Field>
            <Field label={t('encounters.certainty')}>
              <Select
                value={diagnosisForm.certainty}
                onChange={(event) => setDiagnosisForm({ ...diagnosisForm, certainty: event.target.value })}
              >
                <option value="suspected">{t('encounters.suspected')}</option>
                <option value="confirmed">{t('encounters.confirmed')}</option>
                <option value="rule_out">{t('encounters.ruleOut')}</option>
              </Select>
            </Field>
            <Field label={t('encounters.primary')}>
              <Select
                value={diagnosisForm.type}
                onChange={(event) => setDiagnosisForm({ ...diagnosisForm, type: event.target.value })}
              >
                <option value="primary">{t('encounters.primary')}</option>
                <option value="secondary">{t('encounters.secondary')}</option>
              </Select>
            </Field>
          </div>
          <Field label={t('encounters.diagnosisNotes')}>
            <Textarea
              rows={2}
              value={diagnosisForm.notes}
              onChange={(event) => setDiagnosisForm({ ...diagnosisForm, notes: event.target.value })}
            />
          </Field>
        </div>
      </Modal>

      {/* Note modal */}
      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title={t('encounters.addNoteTitle')}
        footer={
          <>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>{t('common.cancel')}</Button>
            <Button
              loading={noteMutation.isPending}
              disabled={!noteForm.content.trim()}
              onClick={() => noteMutation.mutate()}
            >
              {t('encounters.saveNote')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('encounters.noteType')}>
            <Select value={noteForm.type} onChange={(event) => setNoteForm({ ...noteForm, type: event.target.value })}>
              <option value="progress">{t('encounters.progress')}</option>
              <option value="nursing">{t('encounters.nursing')}</option>
              <option value="consultation">{t('encounters.consultation')}</option>
              <option value="discharge">{t('encounters.discharge')}</option>
            </Select>
          </Field>
          <Field label={t('encounters.noteContent')} required>
            <Textarea
              rows={5}
              value={noteForm.content}
              onChange={(event) => setNoteForm({ ...noteForm, content: event.target.value })}
              placeholder={t('encounters.notePlaceholder')}
              autoFocus
            />
          </Field>
          <label className="flex items-center gap-2 text-xs font-medium text-ink-muted">
            <input
              type="checkbox"
              checked={noteForm.sign}
              onChange={(event) => setNoteForm({ ...noteForm, sign: event.target.checked })}
              className="h-4 w-4 rounded border-line-strong text-scarlet-800 focus:ring-scarlet-500"
            />
            {t('encounters.signNote')}
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onConfirm={() => signMutation.mutate()}
        title={t('encounters.sign')}
        description={t('encounters.signConfirm')}
        confirmLabel={t('encounters.signButton')}
        loading={signMutation.isPending}
        tone="primary"
      />
    </div>
  )
}
