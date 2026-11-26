import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Microscope,
  Plus,
  Printer,
  Search,
  TestTubes,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { Tabs } from '@/components/ui/Tabs'
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
type ResultFilter = 'pending' | 'entered' | 'approved'

const fullAccessRoles = ['admin', 'super_admin', 'laboratory_supervisor']

function canCollectSamples(user: ReturnType<typeof useCurrentUser>): boolean {
  const roles = user?.role_names ?? []
  return !roles.includes('laboratory_technician') || roles.some((role) => fullAccessRoles.includes(role))
}

function canEnterResults(user: ReturnType<typeof useCurrentUser>): boolean {
  const roles = user?.role_names ?? []
  return !roles.includes('sample_collector') || roles.some((role) => fullAccessRoles.includes(role))
}

export function LaboratoryPage() {
  const [section, setSection] = useState<LabSection>('collection')

  const sections = [
    { id: 'collection' as const, label: 'جمع العينات', icon: TestTubes, hint: 'استقبال العينات وتسجيلها' },
    { id: 'results' as const, label: 'نتائج المختبر', icon: Microscope, hint: 'إدخال النتائج والتوقيع والطباعة' },
  ]

  return (
    <div>
      <PageHeader title="المختبر" subtitle="إدارة سير عمل المختبر من جمع العينة حتى طباعة النتيجة المُعتمدة" />
      <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
        <aside className="space-y-1.5">
          {sections.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-start transition',
                  section === item.id
                    ? 'bg-scarlet-800 text-white shadow-sm'
                    : 'bg-surface text-ink hover:bg-surface-muted',
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span className={cn('block text-[11px]', section === item.id ? 'text-white/70' : 'text-ink-subtle')}>
                    {item.hint}
                  </span>
                </span>
              </button>
            )
          })}
        </aside>

        <div className="min-w-0">
          {section === 'collection' ? <SampleCollectionPanel /> : <LabResultsPanel />}
        </div>
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

/* -------------------------------------------------------------------------- */
/* Lab results                                                                */
/* -------------------------------------------------------------------------- */

function LabResultsPanel() {
  const locale = useLocale()
  const canManage = usePermission('laboratory.manage')
  const canEnter = canManage && canEnterResults(useCurrentUser())
  const canApprove = usePermission('laboratory.approve')
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<ResultFilter>('pending')
  const [page, setPage] = useState(1)
  const [entryItem, setEntryItem] = useState<LabOrderItem | null>(null)

  const resultsQuery = useQuery({
    queryKey: ['lab-order-items', 'results', filter, page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<LabOrderItem[]>>('/lab-order-items', {
        params: { result_status: filter, page, per_page: 15 },
      })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
  })

  const approveMutation = useMutation({
    mutationFn: async (item: LabOrderItem) => { await api.post(`/lab-order-items/${item.id}/approve`) },
    onSuccess: () => {
      toast.success('تم توقيع واعتماد النتيجة')
      void queryClient.invalidateQueries({ queryKey: ['lab-order-items'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الاعتماد'),
  })

  const rows = resultsQuery.data?.rows ?? []
  const pagination = resultsQuery.data?.meta?.pagination

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={[
            { id: 'pending', label: 'بانتظار النتيجة' },
            { id: 'entered', label: 'نتائج مُدخلة' },
            { id: 'approved', label: 'نتائج معتمدة' },
          ]}
          value={filter}
          onChange={(value) => { setFilter(value as ResultFilter); setPage(1) }}
        />
        {filter === 'approved' ? (
          <span className="text-xs text-ink-subtle">يمكن طباعة النتائج المعتمدة من زر «طباعة»</span>
        ) : null}
      </div>

      <div className="table-shell">
        {resultsQuery.isLoading ? <TableSkeleton rows={8} /> : rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم الطلب</th><th>المريض</th><th>الفحص</th><th>جمع العينة</th>
                <th>النتيجة</th><th>المصدر</th><th>الحالة</th><th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className="font-mono text-xs">{item.order?.order_number ?? `#${item.lab_order_id}`}</td>
                  <td className="font-semibold">{patientDisplayName(item.order?.patient, locale)}</td>
                  <td>{item.test?.name_ar ?? '—'}</td>
                  <td className="text-xs">{formatDateTime(item.sample_collected_at, locale)}</td>
                  <td className="max-w-52 truncate text-xs" title={item.result_value ?? ''}>
                    {item.result_value ?? '—'}
                  </td>
                  <td className="text-xs">
                    {item.source === 'device'
                      ? (item.source_device?.name ?? 'جهاز متصل')
                      : 'إدخال يدوي'}
                  </td>
                  <td>
                    <Badge tone={item.status === 'approved' ? 'success' : item.status === 'entered' ? 'warning' : 'neutral'} dot>
                      {item.status === 'approved' ? 'معتمدة' : item.status === 'entered' ? 'مدخلة' : 'بانتظار'}
                    </Badge>
                  </td>
                  <td className="flex flex-wrap gap-1">
                    {canEnter && item.status === 'pending' ? (
                      <Button size="sm" onClick={() => setEntryItem(item)}>
                        <ClipboardList className="h-3.5 w-3.5" /> إدخال النتيجة
                      </Button>
                    ) : null}
                    {canEnter && item.status === 'entered' ? (
                      <Button size="sm" variant="secondary" onClick={() => setEntryItem(item)}>تعديل النتيجة</Button>
                    ) : null}
                    {canApprove && item.status === 'entered' ? (
                      <Button size="sm" onClick={() => approveMutation.mutate(item)} loading={approveMutation.isPending && approveMutation.variables?.id === item.id}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> توقيع واعتماد
                      </Button>
                    ) : null}
                    {item.status !== 'pending' ? (
                      <Button size="sm" variant="outline" onClick={() => printLabResult(item)}>
                        <Printer className="h-3.5 w-3.5" /> طباعة
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={FlaskConical} title="لا توجد نتائج في هذا التصنيف" />}
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

      <ResultEntryModal item={entryItem} onClose={() => setEntryItem(null)} />
    </div>
  )
}

function ResultEntryModal({ item, onClose }: { item: LabOrderItem | null; onClose: () => void }) {
  const locale = useLocale()
  const queryClient = useQueryClient()
  const parameters = item?.test?.parameters ?? []
  const [values, setValues] = useState<Record<number, string>>({})
  const [flags, setFlags] = useState<Record<number, string>>({})
  const [resultValue, setResultValue] = useState('')
  const [flag, setFlag] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!item) return
    setValues(Object.fromEntries((item.values ?? []).map((value) => [value.lab_test_parameter_id, value.value ?? ''])))
    setFlags(Object.fromEntries((item.values ?? []).map((value) => [value.lab_test_parameter_id, value.flag ?? ''])))
    setResultValue(item.result_value ?? '')
    setFlag(item.flag ?? '')
    setNotes(item.notes ?? '')
  }, [item?.id])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!item) return
      if (parameters.length) {
        await api.post(`/lab-order-items/${item.id}/values`, {
          values: parameters.map((parameter) => ({
            parameter_id: parameter.id,
            value: values[parameter.id] ?? '',
            flag: flags[parameter.id] || null,
          })),
        })
      } else {
        await api.post(`/lab-order-items/${item.id}/result`, {
          result_value: resultValue,
          flag: flag || null,
          notes: notes || null,
        })
      }
    },
    onSuccess: () => {
      toast.success('تم حفظ النتيجة')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['lab-order-items'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر حفظ النتيجة'),
  })

  if (!item) return null

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title={`إدخال نتيجة: ${item.test?.name_ar ?? ''}`}
      description={`المريض: ${patientDisplayName(item.order?.patient, locale)} — ${item.order?.order_number ?? ''}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>حفظ النتيجة</Button>
        </>
      }
    >
      {parameters.length ? (
        <div className="space-y-3">
          <p className="text-xs text-ink-subtle">أدخل قيمة كل براميتر. لن تُعتمد النتيجة إلا بعد التوقيع.</p>
          <div className="table-shell">
            <table className="data-table">
              <thead><tr><th>البراميتر</th><th>الوحدة</th><th>المدى الطبيعي</th><th>القيمة</th><th>علامة</th></tr></thead>
              <tbody>
                {parameters.map((parameter) => (
                  <tr key={parameter.id}>
                    <td className="font-semibold">{parameter.name_ar}</td>
                    <td>{parameter.unit ?? '—'}</td>
                    <td className="text-xs">{parameter.reference_range ?? '—'}</td>
                    <td>
                      <Input
                        className="w-28"
                        value={values[parameter.id] ?? ''}
                        onChange={(event) => setValues((prev) => ({ ...prev, [parameter.id]: event.target.value }))}
                        placeholder="القيمة"
                      />
                    </td>
                    <td>
                      <Select
                        className="w-24"
                        value={flags[parameter.id] ?? ''}
                        onChange={(event) => setFlags((prev) => ({ ...prev, [parameter.id]: event.target.value }))}
                      >
                        <option value="">—</option>
                        <option value="low">منخفض</option>
                        <option value="high">مرتفع</option>
                        <option value="critical">حرج</option>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="قيمة النتيجة" required className="sm:col-span-2">
            <Input value={resultValue} onChange={(event) => setResultValue(event.target.value)} placeholder="مثال: 13.5" />
          </Field>
          <Field label="علامة النتيجة">
            <Select value={flag} onChange={(event) => setFlag(event.target.value)}>
              <option value="">طبيعية</option>
              <option value="low">منخفضة</option>
              <option value="high">مرتفعة</option>
              <option value="critical">حرجة</option>
            </Select>
          </Field>
          <Field label="ملاحظات">
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>
      )}
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Printing                                                                   */
/* -------------------------------------------------------------------------- */

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function printLabResult(item: LabOrderItem) {
  const parameters = item.test?.parameters ?? []
  const values = item.values ?? []

  const parameterRows = parameters.length
    ? parameters.map((parameter, index) => {
      const value = values.find((entry) => entry.lab_test_parameter_id === parameter.id)
      return `<tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(parameter.name_ar)}</td>
        <td>${escapeHtml(value?.value ?? '—')}</td>
        <td>${escapeHtml(parameter.unit ?? '—')}</td>
        <td>${escapeHtml(parameter.reference_range ?? '—')}</td>
        <td>${escapeHtml(value?.flag ?? '—')}</td>
      </tr>`
    }).join('')
    : `<tr><td>1</td><td>النتيجة</td><td>${escapeHtml(item.result_value ?? '—')}</td><td>${escapeHtml(item.result_unit ?? '—')}</td><td>—</td><td>${escapeHtml(item.flag ?? '—')}</td></tr>`

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>نتيجة مختبر — ${escapeHtml(item.order?.order_number ?? item.id)}</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; color: #1a1a1a; margin: 32px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #7a1028; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { font-size: 22px; margin: 0; color: #7a1028; }
  .meta { font-size: 13px; line-height: 1.9; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #bbb; padding: 8px; text-align: right; }
  th { background: #f3e9ec; }
  footer { margin-top: 28px; font-size: 12px; display: flex; justify-content: space-between; }
  @page { margin: 20mm; }
</style>
</head>
<body>
<header>
  <div>
    <h1>Scarlet Care — تقرير نتيجة مختبر</h1>
    <div class="meta">مستشفى سكارلت العام</div>
  </div>
  <div class="meta">
    رقم الطلب: ${escapeHtml(item.order?.order_number ?? item.id)}<br />
    التاريخ: ${escapeHtml(new Date().toLocaleString('ar-SD'))}
  </div>
</header>
<div class="meta">
  <strong>المريض:</strong> ${escapeHtml(item.order?.patient ? patientDisplayName(item.order.patient, 'ar') : '—')}<br />
  <strong>رقم الملف:</strong> ${escapeHtml(item.order?.patient?.mrn ?? '—')}<br />
  <strong>الفحص:</strong> ${escapeHtml(item.test?.name_ar ?? '—')}<br />
  <strong>وقت جمع العينة:</strong> ${escapeHtml(item.sample_collected_at ?? '—')}<br />
  <strong>وقت إدخال النتيجة:</strong> ${escapeHtml(item.entered_at ?? '—')}<br />
  <strong>اعتماد:</strong> ${escapeHtml(item.approved_by_user?.name ?? (item.approved_at ? 'معتمد' : 'غير معتمد'))}
</div>
<table>
  <thead><tr><th>#</th><th>البراميتر</th><th>القيمة</th><th>الوحدة</th><th>المدى الطبيعي</th><th>العلامة</th></tr></thead>
  <tbody>${parameterRows}</tbody>
</table>
<footer>
  <div>اسم المُدخل: ${escapeHtml(item.entered_by_user?.name ?? '—')}</div>
  <div>توقيع المُعتمد: ${escapeHtml(item.approved_by_user?.name ?? '—')}</div>
</footer>
<script>window.onload = function () { window.print(); };</script>
</body>
</html>`

  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) {
    toast.error('سمح للمتصفح بفتح نافذة الطباعة')
    return
  }
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
}
