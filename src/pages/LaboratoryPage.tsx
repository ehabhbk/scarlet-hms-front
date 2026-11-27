import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Microscope, Printer, TestTubes } from 'lucide-react'
import { toast } from 'sonner'
import { ResultEntryWorkspace } from '@/components/laboratory/ResultEntryWorkspace'
import { SampleCollectionWorkspace } from '@/components/laboratory/SampleCollectionWorkspace'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { api, parseApiError } from '@/lib/api'
import { useMeta } from '@/hooks/useMeta'
import { patientDisplayName } from '@/lib/format'
import type { ApiEnvelope, LabTest, Patient } from '@/lib/types'

type LabSection = 'collection' | 'results'

export function LaboratoryPage() {
  const [searchParams] = useSearchParams()
  const [orderOpen, setOrderOpen] = useState(false)
  const section: LabSection = searchParams.get('section') === 'results' ? 'results' : 'collection'

  const steps = [
    { label: 'طلب فحص', icon: ClipboardList },
    { label: 'جمع العينة', icon: TestTubes },
    { label: 'إدخال النتيجة', icon: Microscope },
    { label: 'توقيع واعتماد', icon: CheckCircle2 },
    { label: 'طباعة', icon: Printer },
  ]

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-scarlet-950 via-scarlet-900 to-scarlet-800 p-5 text-white shadow-lift">
        <div className="pointer-events-none absolute -start-12 -top-20 h-56 w-56 rounded-full border-[26px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-24 end-10 h-52 w-52 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Scarlet Care · Laboratory</p>
            <h1 className="mt-1 text-2xl font-black">المختبر</h1>
            <p className="mt-1 text-sm text-white/70">من استقبال العينة حتى طباعة النتيجة المُعتمدة</p>
          </div>

          <ol className="flex flex-wrap items-center gap-1.5">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <li key={step.label} className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-bold ring-1 ring-white/15">
                    <Icon className="h-3.5 w-3.5" />
                    {step.label}
                  </span>
                  {index < steps.length - 1 ? <span className="text-white/30">‹</span> : null}
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <div className="min-w-0">
        {section === 'collection' ? (
          <SampleCollectionWorkspace onNewOrder={() => setOrderOpen(true)} />
        ) : (
          <ResultEntryWorkspace />
        )}
      </div>

      <NewLabOrderModal open={orderOpen} onClose={() => setOrderOpen(false)} />
    </div>
  )
}

function NewLabOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const meta = useMeta()
  const [patientSearch, setPatientSearch] = useState('')
  const [patientId, setPatientId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [notes, setNotes] = useState('')
  const [testIds, setTestIds] = useState<number[]>([])

  const patientsQuery = useQuery({
    queryKey: ['patients', 'picker', patientSearch],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Patient[]>>('/patients', {
        params: { search: patientSearch, per_page: 20 },
      })
      return data.data
    },
    enabled: open,
  })

  const testsQuery = useQuery({
    queryKey: ['lab-tests', 'order-picker'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<LabTest[]>>('/lab-tests', { params: { per_page: 100, is_active: true } })
      return data.data
    },
    enabled: open,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/lab-orders', {
        patient_id: Number(patientId),
        branch_id: Number(branchId || meta.data?.branches?.[0]?.id || 0),
        doctor_id: doctorId ? Number(doctorId) : null,
        test_ids: testIds,
        notes: notes || null,
      })
    },
    onSuccess: () => {
      toast.success('تم إنشاء طلب المختبر')
      setPatientId('')
      setBranchId('')
      setDoctorId('')
      setNotes('')
      setTestIds([])
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['lab-collection-worklist'] })
      void queryClient.invalidateQueries({ queryKey: ['lab-order-items'] })
      void queryClient.invalidateQueries({ queryKey: ['lab-orders'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر إنشاء الطلب'),
  })

  const patients = patientsQuery.data ?? []
  const tests = testsQuery.data ?? []
  const branches = meta.data?.branches ?? []
  const doctors = meta.data?.doctors ?? []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="طلب فحص جديد"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button
            loading={createMutation.isPending}
            disabled={!patientId || testIds.length === 0}
            onClick={() => createMutation.mutate()}
          >
            إنشاء الطلب
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="المريض" required className="sm:col-span-2">
          <Input
            placeholder="ابحث باسم المريض أو رقم الملف..."
            value={patientSearch}
            onChange={(event) => setPatientSearch(event.target.value)}
          />
          <Select className="mt-2" value={patientId} onChange={(event) => setPatientId(event.target.value)}>
            <option value="">اختر المريض</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patientDisplayName(patient, 'ar')} — {patient.mrn}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الفرع">
          <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">الفرع الافتراضي</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name_ar || branch.name}</option>)}
          </Select>
        </Field>
        <Field label="الطبيب الطالب">
          <Select value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
            <option value="">—</option>
            {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-ink">الفحوصات المطلوبة</p>
        <div className="grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
          {tests.length ? tests.map((test) => {
            const checked = testIds.includes(test.id)
            return (
              <label key={test.id} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setTestIds((prev) => event.target.checked
                    ? [...prev, test.id]
                    : prev.filter((id) => id !== test.id))}
                  className="h-4 w-4 accent-scarlet-700"
                />
                {test.name_ar} <span className="text-xs text-ink-subtle">({test.code})</span>
              </label>
            )
          }) : <p className="text-sm text-ink-subtle">لا توجد فحوصات نشطة. أضف فحوصات من الإعدادات.</p>}
        </div>
      </div>

      <Field label="ملاحظات" className="mt-3">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
    </Modal>
  )
}
