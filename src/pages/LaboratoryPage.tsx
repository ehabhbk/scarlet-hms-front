import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ClipboardList, Microscope, Plus, Printer, Search, TestTubes } from 'lucide-react'
import { toast } from 'sonner'
import { ResultEntryWorkspace } from '@/components/laboratory/ResultEntryWorkspace'
import { EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { api, parseApiError } from '@/lib/api'
import { useCurrentUser, useMeta, usePermission } from '@/hooks/useMeta'
import { useLocale } from '@/hooks/useLocale'
import { formatDateTime, patientDisplayName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  ApiEnvelope,
  ApiMeta,
  LabOrderItem,
  LabTest,
  Patient,
} from '@/lib/types'

type LabSection = 'collection' | 'results'

const fullAccessRoles = ['admin', 'super_admin', 'laboratory_supervisor']

function canCollectSamples(user: ReturnType<typeof useCurrentUser>): boolean {
  const roles = user?.role_names ?? []
  return !roles.includes('laboratory_technician') || roles.some((role) => fullAccessRoles.includes(role))
}

export function LaboratoryPage() {
  const [section, setSection] = useState<LabSection>('collection')

  const sections = [
    { id: 'collection' as const, label: 'جمع العينات', icon: TestTubes, hint: 'استقبال العينات وتسجيلها' },
    { id: 'results' as const, label: 'نتائج المختبر', icon: Microscope, hint: 'إدخال النتائج والتوقيع والطباعة' },
  ]

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

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5">
        {sections.map((item) => {
          const Icon = item.icon
          const active = section === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={cn(
                'flex min-w-52 flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5 text-start transition',
                active
                  ? 'bg-scarlet-800 text-white shadow-sm'
                  : 'text-ink hover:bg-surface-muted',
              )}
            >
              <span
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                  active ? 'bg-white/15' : 'bg-scarlet-50 text-scarlet-700',
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{item.label}</span>
                <span className={cn('block text-[10px]', active ? 'text-white/70' : 'text-ink-subtle')}>
                  {item.hint}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="min-w-0">
        {section === 'collection' ? <SampleCollectionPanel /> : <ResultEntryWorkspace />}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Sample collection                                                          */
/* -------------------------------------------------------------------------- */

function SampleCollectionPanel() {
  const locale = useLocale()
  const canManage = usePermission('laboratory.manage')
  const canCollect = canManage && canCollectSamples(useCurrentUser())
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [orderOpen, setOrderOpen] = useState(false)
  const [search, setSearch] = useState('')

  const pendingQuery = useQuery({
    queryKey: ['lab-order-items', 'samples-pending', page, search],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<LabOrderItem[]>>('/lab-order-items', {
        params: { sample_status: 'pending', search, page, per_page: 15 },
      })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
  })

  const collectedQuery = useQuery({
    queryKey: ['lab-order-items', 'samples-collected', 'count'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<LabOrderItem[]>>('/lab-order-items', {
        params: { sample_status: 'collected', per_page: 1 },
      })
      return data.meta?.pagination?.total ?? 0
    },
  })

  const collectMutation = useMutation({
    mutationFn: async (item: LabOrderItem) => { await api.post(`/lab-order-items/${item.id}/collect`) },
    onSuccess: () => {
      toast.success('تم تسجيل جمع العينة بنجاح')
      void queryClient.invalidateQueries({ queryKey: ['lab-order-items'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر تسجيل العينة'),
  })

  const rows = pendingQuery.data?.rows ?? []
  const pagination = pendingQuery.data?.meta?.pagination

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-ink-subtle">عينات بانتظار الجمع</p>
          <p className="mt-1 text-2xl font-extrabold text-scarlet-800">{pagination?.total ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-ink-subtle">عينات تم جمعها</p>
          <p className="mt-1 text-2xl font-extrabold text-ink">{collectedQuery.data ?? 0}</p>
        </div>
        <div className="card flex items-center justify-end p-4">
          {canManage ? (
            <Button onClick={() => setOrderOpen(true)}><Plus className="h-4 w-4" /> طلب فحص جديد</Button>
          ) : (
            <span className="text-xs text-ink-subtle">صلاحية إدارة المختبر مطلوبة لإنشاء الطلبات</span>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            className="ps-9"
            placeholder="بحث بالاسم أو رقم الملف أو الفحص..."
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          />
        </div>
      </div>

      <div className="table-shell">
        {pendingQuery.isLoading ? <TableSkeleton rows={8} /> : rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم الطلب</th><th>المريض</th><th>الفحص</th><th>الطبيب</th>
                <th>وقت الطلب</th><th>الحالة</th><th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className="font-mono text-xs">{item.order?.order_number ?? `#${item.lab_order_id}`}</td>
                  <td className="font-semibold">{patientDisplayName(item.order?.patient, locale)}</td>
                  <td>{item.test?.name_ar ?? '—'}</td>
                  <td>{item.order?.doctor?.name ?? '—'}</td>
                  <td className="text-xs">{formatDateTime(item.order?.ordered_at, locale)}</td>
                  <td><Badge tone="warning" dot>لم تُجمع العينة</Badge></td>
                  <td>
                    {canCollect ? (
                      <Button size="sm" onClick={() => collectMutation.mutate(item)} loading={collectMutation.isPending && collectMutation.variables?.id === item.id}>
                        <TestTubes className="h-3.5 w-3.5" /> تجميع العينة
                      </Button>
                    ) : <span className="text-xs text-ink-subtle">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={TestTubes} title="لا توجد عينات بانتظار الجمع" description="أنشئ طلب فحص جديد لتبدأ سير العمل." />}
        {pagination ? (
          <Pagination
            page={pagination.current_page}
            lastPage={pagination.last_page}
            total={pagination.total}
            from={pagination.from}
            to={pagination.to}
            onChange={setPage}
          />
        ) : null}
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
