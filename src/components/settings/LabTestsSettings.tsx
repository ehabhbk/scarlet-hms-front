import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, FlaskConical, Settings2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, LabTest, LabTestParameter } from '@/lib/types'

type TestForm = {
  code: string
  name_ar: string
  name_en: string
  category: string
  unit: string
  reference_range: string
  price: string
  is_active: boolean
}

type ParamForm = {
  code: string
  name_ar: string
  name_en: string
  unit: string
  reference_range: string
  sort_order: string
}

const emptyTest: TestForm = {
  code: '', name_ar: '', name_en: '', category: '', unit: '', reference_range: '', price: '0', is_active: true,
}
const emptyParam: ParamForm = {
  code: '', name_ar: '', name_en: '', unit: '', reference_range: '', sort_order: '0',
}

export function LabTestsSettings() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LabTest | null>(null)
  const [form, setForm] = useState<TestForm>(emptyTest)

  const [paramOpen, setParamOpen] = useState(false)
  const [selectedTest, setSelectedTest] = useState<LabTest | null>(null)
  const [editingParam, setEditingParam] = useState<LabTestParameter | null>(null)
  const [paramForm, setParamForm] = useState<ParamForm>(emptyParam)

  const testsQuery = useQuery({
    queryKey: ['lab-tests', 'settings', search],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<LabTest[]>>('/lab-tests', { params: { per_page: 100, search } })
      return data.data
    },
  })

  const paramsQuery = useQuery({
    queryKey: ['lab-test-parameters', selectedTest?.id],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<LabTestParameter[]>>(`/lab-tests/${selectedTest!.id}/parameters`)
      return data.data
    },
    enabled: Boolean(selectedTest && paramOpen),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code,
        name_ar: form.name_ar,
        name_en: form.name_en || null,
        category: form.category || null,
        unit: form.unit || null,
        reference_range: form.reference_range || null,
        price: Number(form.price || 0),
        is_active: form.is_active,
      }
      if (editing) await api.patch(`/lab-tests/${editing.id}`, payload)
      else await api.post('/lab-tests', payload)
    },
    onSuccess: () => {
      toast.success('تم حفظ الفحص بنجاح')
      setOpen(false)
      setEditing(null)
      setForm(emptyTest)
      void queryClient.invalidateQueries({ queryKey: ['lab-tests'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الحفظ'),
  })

  const toggleMutation = useMutation({
    mutationFn: async (test: LabTest) => {
      await api.patch(`/lab-tests/${test.id}`, { is_active: !test.is_active })
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['lab-tests'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/lab-tests/${id}`) },
    onSuccess: () => {
      toast.success('تم حذف الفحص')
      void queryClient.invalidateQueries({ queryKey: ['lab-tests'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الحذف'),
  })

  const saveParamMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: paramForm.code,
        name_ar: paramForm.name_ar,
        name_en: paramForm.name_en || null,
        unit: paramForm.unit || null,
        reference_range: paramForm.reference_range || null,
        sort_order: Number(paramForm.sort_order || 0),
      }
      if (editingParam) await api.patch(`/lab-test-parameters/${editingParam.id}`, payload)
      else await api.post(`/lab-tests/${selectedTest!.id}/parameters`, payload)
    },
    onSuccess: () => {
      toast.success('تم حفظ البراميتر')
      setEditingParam(null)
      setParamForm(emptyParam)
      void queryClient.invalidateQueries({ queryKey: ['lab-test-parameters', selectedTest?.id] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الحفظ'),
  })

  const deleteParamMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/lab-test-parameters/${id}`) },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['lab-test-parameters', selectedTest?.id] }),
  })

  const rows = testsQuery.data ?? []
  const params = paramsQuery.data ?? []

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            className="ps-9"
            placeholder="ابحث باسم الفحص أو الرمز..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyTest); setOpen(true) }}>
          <Plus className="h-4 w-4" /> إضافة فحص جديد
        </Button>
      </div>

      <div className="table-shell">
        {testsQuery.isLoading ? <TableSkeleton rows={6} /> : rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>الرمز</th><th>اسم الفحص</th><th>التصنيف</th><th>السعر</th>
                <th>الوحدة</th><th>المدى الطبيعي</th><th>الحالة</th><th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((test) => (
                <tr key={test.id}>
                  <td className="font-mono text-xs">{test.code}</td>
                  <td className="font-semibold">{test.name_ar}</td>
                  <td>{test.category ?? '—'}</td>
                  <td>{test.price}</td>
                  <td>{test.unit ?? '—'}</td>
                  <td>{test.reference_range ?? '—'}</td>
                  <td>
                    <Badge tone={test.is_active ? 'success' : 'neutral'} dot>
                      {test.is_active ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </td>
                  <td className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditing(test)
                      setForm({
                        code: test.code,
                        name_ar: test.name_ar,
                        name_en: test.name_en ?? '',
                        category: test.category ?? '',
                        unit: test.unit ?? '',
                        reference_range: test.reference_range ?? '',
                        price: String(test.price),
                        is_active: test.is_active,
                      })
                      setOpen(true)
                    }}>تعديل</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedTest(test); setEditingParam(null); setParamForm(emptyParam); setParamOpen(true) }}>
                      البراميترات
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate(test)}>
                      {test.is_active ? 'إلغاء النشاط' : 'تفعيل'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => deleteMutation.mutate(test.id)}>حذف</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={FlaskConical} title="لا توجد فحوصات" description="استخدم زر «إضافة فحص جديد» لإنشاء أول فحص." />}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'تعديل الفحص' : 'إضافة فحص جديد'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>حفظ</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="رمز الفحص" required><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="اسم الفحص (عربي)" required><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></Field>
          <Field label="اسم الفحص (إنجليزي)"><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></Field>
          <Field label="التصنيف"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="CBC / كيمياء حيوية / هرمونات..." /></Field>
          <Field label="سعر الفحص"><Input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          <Field label="وحدة القياس"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="mg/dL" /></Field>
          <Field label="المدى الطبيعي"><Input value={form.reference_range} onChange={(e) => setForm({ ...form, reference_range: e.target.value })} placeholder="12 - 16" /></Field>
          <Field label="الحالة">
            <Select value={form.is_active ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={paramOpen}
        onClose={() => setParamOpen(false)}
        title={`براميترات الفحص: ${selectedTest?.name_ar ?? ''}`}
        size="xl"
        footer={<Button variant="outline" onClick={() => setParamOpen(false)}>إغلاق</Button>}
      >
        <div className="mb-4 grid gap-2 sm:grid-cols-6">
          <Input placeholder="الرمز" value={paramForm.code} onChange={(e) => setParamForm({ ...paramForm, code: e.target.value })} />
          <Input placeholder="الاسم (عربي)" value={paramForm.name_ar} onChange={(e) => setParamForm({ ...paramForm, name_ar: e.target.value })} />
          <Input placeholder="الاسم (إنجليزي)" value={paramForm.name_en} onChange={(e) => setParamForm({ ...paramForm, name_en: e.target.value })} />
          <Input placeholder="الوحدة" value={paramForm.unit} onChange={(e) => setParamForm({ ...paramForm, unit: e.target.value })} />
          <Input placeholder="المدى الطبيعي" value={paramForm.reference_range} onChange={(e) => setParamForm({ ...paramForm, reference_range: e.target.value })} />
          <Button onClick={() => saveParamMutation.mutate()} loading={saveParamMutation.isPending}>
            {editingParam ? 'تحديث' : 'إضافة براميتر'}
          </Button>
        </div>
        <div className="table-shell">
          {paramsQuery.isLoading ? <TableSkeleton rows={4} /> : params.length ? (
            <table className="data-table">
              <thead><tr><th>الرمز</th><th>الاسم</th><th>الوحدة</th><th>المدى الطبيعي</th><th>الترتيب</th><th>الإجراءات</th></tr></thead>
              <tbody>
                {params.map((param) => (
                  <tr key={param.id}>
                    <td className="font-mono text-xs">{param.code}</td>
                    <td>{param.name_ar}</td>
                    <td>{param.unit ?? '—'}</td>
                    <td>{param.reference_range ?? '—'}</td>
                    <td>{param.sort_order}</td>
                    <td className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditingParam(param)
                        setParamForm({
                          code: param.code,
                          name_ar: param.name_ar,
                          name_en: param.name_en ?? '',
                          unit: param.unit ?? '',
                          reference_range: param.reference_range ?? '',
                          sort_order: String(param.sort_order),
                        })
                      }}>تعديل</Button>
                      <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => deleteParamMutation.mutate(param.id)}>حذف</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState icon={Settings2} title="لا توجد براميترات" description="أضف براميترات مثل HB، WBC، RBC مع الوحدة والمدى الطبيعي." />}
        </div>
      </Modal>
    </div>
  )
}
