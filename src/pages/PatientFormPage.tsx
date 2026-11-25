import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowLeft, ArrowRight, Contact, IdCard, Loader2, Save, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { api, getFieldError, parseApiError } from '@/lib/api'
import type { ParsedApiError } from '@/lib/api'
import type { ApiEnvelope, Patient, PatientDetail } from '@/lib/types'
import { useMeta } from '@/hooks/useMeta'
import { useLocale } from '@/hooks/useLocale'
import { useAuthStore } from '@/stores/auth'
import { nameOf, toDateInput } from '@/lib/format'

const emptyValues = {
  first_name_ar: '',
  last_name_ar: '',
  first_name_en: '',
  last_name_en: '',
  national_id: '',
  passport_number: '',
  gender: '',
  date_of_birth: '',
  phone: '',
  alt_phone: '',
  email: '',
  marital_status: '',
  nationality: 'سوداني',
  blood_type: '',
  address: '',
  city: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relation: '',
  notes: '',
  registration_branch_id: '',
}

type FormValues = typeof emptyValues

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof IdCard
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-scarlet-50 text-scarlet-700">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-bold text-ink">{title}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  )
}

function reasonLabel(reason: string, t: (key: string) => string): string {
  switch (reason) {
    case 'phone':
      return t('patients.matchPhone')
    case 'national_id':
      return t('patients.matchNationalId')
    case 'arabic_name_and_dob':
    case 'english_name_and_dob':
      return t('patients.matchNameDob')
    case 'arabic_name':
    case 'english_name':
      return t('patients.matchName')
    default:
      return reason
  }
}

export function PatientFormPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const params = useParams()
  const patientId = params.id ? Number(params.id) : null
  const isEdit = Boolean(patientId)
  const user = useAuthStore((state) => state.user)
  const { data: meta } = useMeta()
  const [duplicates, setDuplicates] = useState<ParsedApiError['duplicates']>([])
  const [duplicateOpen, setDuplicateOpen] = useState(false)

  const schema = useMemo(
    () =>
      z.object({
        first_name_ar: z.string().trim().min(1, { message: t('validation.required') }),
        last_name_ar: z.string().trim().min(1, { message: t('validation.required') }),
        first_name_en: z.string(),
        last_name_en: z.string(),
        national_id: z.string(),
        passport_number: z.string(),
        gender: z.string().min(1, { message: t('validation.required') }),
        date_of_birth: z.string().min(1, { message: t('validation.required') }),
        phone: z.string(),
        alt_phone: z.string(),
        email: z.string().refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
          message: t('validation.invalidEmail'),
        }),
        marital_status: z.string(),
        nationality: z.string(),
        blood_type: z.string(),
        address: z.string(),
        city: z.string(),
        emergency_contact_name: z.string(),
        emergency_contact_phone: z.string(),
        emergency_contact_relation: z.string(),
        notes: z.string(),
        registration_branch_id: z.string(),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...emptyValues,
      registration_branch_id: user?.branch_id ? String(user.branch_id) : '',
    },
  })

  const { data: patientData, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<PatientDetail>>(`/patients/${patientId}`)
      return data.data
    },
    enabled: isEdit,
  })

  useEffect(() => {
    const patient = patientData?.patient

    if (!patient) return

    reset({
      first_name_ar: patient.first_name_ar ?? '',
      last_name_ar: patient.last_name_ar ?? '',
      first_name_en: patient.first_name_en ?? '',
      last_name_en: patient.last_name_en ?? '',
      national_id: patient.national_id ?? '',
      passport_number: patient.passport_number ?? '',
      gender: patient.gender ?? '',
      date_of_birth: toDateInput(patient.date_of_birth),
      phone: patient.phone ?? '',
      alt_phone: patient.alt_phone ?? '',
      email: patient.email ?? '',
      marital_status: patient.marital_status ?? '',
      nationality: patient.nationality ?? '',
      blood_type: patient.blood_type ?? '',
      address: patient.address ?? '',
      city: patient.city ?? '',
      emergency_contact_name: patient.emergency_contact_name ?? '',
      emergency_contact_phone: patient.emergency_contact_phone ?? '',
      emergency_contact_relation: patient.emergency_contact_relation ?? '',
      notes: patient.notes ?? '',
      registration_branch_id: patient.registration_branch?.id ? String(patient.registration_branch.id) : '',
    })
  }, [patientData, reset])

  const mutation = useMutation({
    mutationFn: async ({ values, ignoreDuplicates }: { values: FormValues; ignoreDuplicates: boolean }) => {
      const payload = {
        ...values,
        first_name_en: values.first_name_en || null,
        last_name_en: values.last_name_en || null,
        registration_branch_id: values.registration_branch_id ? Number(values.registration_branch_id) : null,
        ...(ignoreDuplicates ? { ignore_duplicates: true } : {}),
      }

      if (isEdit && patientId) {
        const { data } = await api.patch<ApiEnvelope<Patient>>(`/patients/${patientId}`, payload)
        return data.data
      }

      const { data } = await api.post<ApiEnvelope<Patient>>('/patients', payload)
      return data.data
    },
    onSuccess: (patient) => {
      toast.success(isEdit ? t('patients.patientUpdated') : t('patients.patientCreated'))
      navigate(`/patients/${patient.id}`)
    },
    onError: (error) => {
      const parsed = parseApiError(error)

      if (parsed.status === 409 && parsed.duplicates?.length) {
        setDuplicates(parsed.duplicates)
        setDuplicateOpen(true)
        return
      }

      if (parsed.errors) {
        let fieldMapped = false
        ;(Object.keys(parsed.errors) as Array<keyof FormValues>).forEach((field) => {
          const message = getFieldError(parsed, field)
          if (message) {
            fieldMapped = true
            setError(field, { type: 'server', message })
          }
        })
        if (fieldMapped) {
          toast.error(t('errors.validation'))
          return
        }
      }

      toast.error(parsed.message || t('errors.generic'))
    },
  })

  const submitPatient = (values: FormValues, ignoreDuplicates = false) =>
    mutation.mutate({ values, ignoreDuplicates })

  const onSubmit = handleSubmit((values) => submitPatient(values, false))

  if (isEdit && isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-ink-muted">
        <Loader2 className="h-5 w-5 animate-spin text-scarlet-700" />
        {t('common.loading')}
      </div>
    )
  }

  const ArrowBack = locale === 'ar' ? ArrowRight : ArrowLeft

  return (
    <div>
      <PageHeader
        eyebrow={t('nav.patients')}
        title={isEdit ? t('patients.editTitle') : t('patients.createTitle')}
        subtitle={isEdit ? t('patients.editSubtitle') : t('patients.createSubtitle')}
        actions={
          <Button variant="outline" onClick={() => navigate(isEdit && patientId ? `/patients/${patientId}` : '/patients')}>
            <ArrowBack className="h-4 w-4" />
            {t('common.back')}
          </Button>
        }
      />

      <form onSubmit={onSubmit} className="space-y-4">
        {isEdit && patientData?.patient?.has_allergy_alert ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm font-semibold text-danger-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {t('patients.allergiesAlert')}
          </div>
        ) : null}

        <FormSection icon={IdCard} title={t('patients.basicInfo')}>
          <Field label={t('patients.firstNameAr')} htmlFor="first_name_ar" required error={errors.first_name_ar?.message}>
            <Input id="first_name_ar" {...register('first_name_ar')} placeholder="محمد" />
          </Field>
          <Field label={t('patients.lastNameAr')} htmlFor="last_name_ar" required error={errors.last_name_ar?.message}>
            <Input id="last_name_ar" {...register('last_name_ar')} placeholder="عبد الله" />
          </Field>
          <Field label={t('patients.dateOfBirth')} htmlFor="date_of_birth" required error={errors.date_of_birth?.message}>
            <Input id="date_of_birth" type="date" max={new Date().toISOString().slice(0, 10)} {...register('date_of_birth')} />
          </Field>
          <Field label={t('patients.firstNameEn')} htmlFor="first_name_en" error={errors.first_name_en?.message}>
            <Input id="first_name_en" dir="ltr" {...register('first_name_en')} placeholder="Mohamed" />
          </Field>
          <Field label={t('patients.lastNameEn')} htmlFor="last_name_en" error={errors.last_name_en?.message}>
            <Input id="last_name_en" dir="ltr" {...register('last_name_en')} placeholder="Abdalla" />
          </Field>
          <Field label={t('patients.gender')} htmlFor="gender" required error={errors.gender?.message}>
            <Select id="gender" {...register('gender')}>
              <option value="">{t('patients.selectGender')}</option>
              <option value="male">{t('patients.male')}</option>
              <option value="female">{t('patients.female')}</option>
              <option value="other">{t('patients.other')}</option>
            </Select>
          </Field>
          <Field label={t('patients.nationalId')} htmlFor="national_id" hint={t('patients.nationalIdHint')} error={errors.national_id?.message}>
            <Input id="national_id" dir="ltr" {...register('national_id')} placeholder="11010101234" />
          </Field>
          <Field label={t('patients.passport')} htmlFor="passport_number" error={errors.passport_number?.message}>
            <Input id="passport_number" dir="ltr" {...register('passport_number')} />
          </Field>
          <Field label={t('patients.maritalStatus')} htmlFor="marital_status" error={errors.marital_status?.message}>
            <Select id="marital_status" {...register('marital_status')}>
              <option value="">{t('common.none')}</option>
              <option value="single">{locale === 'ar' ? 'أعزب' : 'Single'}</option>
              <option value="married">{locale === 'ar' ? 'متزوج' : 'Married'}</option>
              <option value="divorced">{locale === 'ar' ? 'مطلق' : 'Divorced'}</option>
              <option value="widowed">{locale === 'ar' ? 'أرمل' : 'Widowed'}</option>
            </Select>
          </Field>
          <Field label={t('patients.nationality')} htmlFor="nationality" error={errors.nationality?.message}>
            <Input id="nationality" {...register('nationality')} />
          </Field>
          <Field label={t('patients.bloodType')} htmlFor="blood_type" error={errors.blood_type?.message}>
            <Select id="blood_type" {...register('blood_type')}>
              <option value="">{t('common.none')}</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('patients.registeredBranch')} htmlFor="registration_branch_id" error={errors.registration_branch_id?.message}>
            <Select id="registration_branch_id" {...register('registration_branch_id')}>
              <option value="">{t('common.none')}</option>
              {meta?.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{nameOf(branch, locale)}</option>
              ))}
            </Select>
          </Field>
        </FormSection>

        <FormSection icon={Contact} title={t('patients.contactSection')}>
          <Field label={t('patients.phone')} htmlFor="phone" hint={t('patients.phoneHint')} error={errors.phone?.message}>
            <Input id="phone" dir="ltr" inputMode="tel" {...register('phone')} placeholder="0912345678" />
          </Field>
          <Field label={t('common.optional')} htmlFor="alt_phone" error={errors.alt_phone?.message}>
            <Input id="alt_phone" dir="ltr" inputMode="tel" {...register('alt_phone')} />
          </Field>
          <Field label="البريد الإلكتروني" htmlFor="email" error={errors.email?.message}>
            <Input id="email" dir="ltr" type="email" {...register('email')} placeholder="name@example.com" />
          </Field>
          <Field label={t('patients.city')} htmlFor="city" error={errors.city?.message}>
            <Input id="city" {...register('city')} />
          </Field>
          <Field label={t('patients.address')} htmlFor="address" className="sm:col-span-2" error={errors.address?.message}>
            <Input id="address" {...register('address')} />
          </Field>
          <Field label={t('patients.emergencyName')} htmlFor="emergency_contact_name" error={errors.emergency_contact_name?.message}>
            <Input id="emergency_contact_name" {...register('emergency_contact_name')} />
          </Field>
          <Field label={t('patients.emergencyPhone')} htmlFor="emergency_contact_phone" error={errors.emergency_contact_phone?.message}>
            <Input id="emergency_contact_phone" dir="ltr" inputMode="tel" {...register('emergency_contact_phone')} />
          </Field>
          <Field label={t('patients.emergencyRelation')} htmlFor="emergency_contact_relation" error={errors.emergency_contact_relation?.message}>
            <Input id="emergency_contact_relation" {...register('emergency_contact_relation')} />
          </Field>
        </FormSection>

        <FormSection icon={Stethoscope} title={t('patients.notes')}>
          <Field label={t('patients.notes')} htmlFor="notes" className="sm:col-span-2 lg:col-span-3">
            <Textarea id="notes" rows={4} {...register('notes')} />
          </Field>
        </FormSection>

        <div className="flex flex-col-reverse items-stretch justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-[11px] leading-relaxed text-ink-subtle">{t('patients.securityNote')}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(isEdit && patientId ? `/patients/${patientId}` : '/patients')}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              <Save className="h-4 w-4" />
              {isEdit ? t('common.save') : t('patients.register')}
            </Button>
          </div>
        </div>
      </form>

      <Modal
        open={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        title={t('patients.duplicateTitle')}
        description={t('patients.duplicateDescription')}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDuplicateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={mutation.isPending} onClick={() => void handleSubmit((values) => submitPatient(values, true))()}>
              {t('patients.registerAnyway')}
            </Button>
          </>
        }
      >
        <div className="space-y-2.5">
          {duplicates?.map((candidate) => (
            <div key={candidate.id} className="rounded-xl border border-warning-100 bg-warning-50/50 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-ink">{locale === 'ar' ? candidate.name_ar ?? candidate.name : candidate.name_en ?? candidate.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {candidate.mrn}
                    {candidate.phone ? ` · ${candidate.phone}` : ''}
                    {candidate.date_of_birth ? ` · ${candidate.date_of_birth}` : ''}
                  </p>
                </div>
                <Badge tone="warning">{candidate.score}%</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {candidate.reasons.map((reason) => (
                  <span key={reason} className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-semibold text-warning-700 ring-1 ring-warning-100">
                    {reasonLabel(reason, t)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
