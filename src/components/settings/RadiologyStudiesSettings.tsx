import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, RadiologyStudy } from '@/lib/types'

type StudyForm = {
  code: string
  name_ar: string
  name_en: string
  modality: string
  price: string
  is_active: boolean
}

const emptyForm: StudyForm = { code: '', name_ar: '', name_en: '', modality: '', price: '0', is_active: true }

export function RadiologyStudiesSettings() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RadiologyStudy | null>(null)
  const [form, setForm] = useState<StudyForm>(emptyForm)

  const studiesQuery = useQuery({
    queryKey: ['radiology-studies', 'settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<RadiologyStudy[]>>('/radiology-studies', { params: { per_page: 100 } })
      return data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code,
        name_ar: form.name_ar,
        name_en: form.name_en || null,
        modality: form.modality || null,
        price: Number(form.price || 0),
        is_active: form.is_active,
      }
      if (editing) await api.patch(`/radiology-studies/${editing.id}`, payload)
      else await api.post('/radiology-studies', payload)
    },
    onSuccess: () => {
      toast.success('تم حفظ الدراسة بنجاح')
      setOpen(false)
      setEditing(null)
      setForm(emptyForm)
      void queryClient.invalidateQueries({ queryKey: ['radiology-studies'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الحفظ'),
  })

  const toggleMutation = useMutation({
    mutationFn: async (study: RadiologyStudy) => { await api.patch(`/radiology-studies/${study.id}`, { is_active: !study.is_active }) },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['radiology-studies'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/radiology-studies/${id}`) },
    onSuccess: () => {
      toast.success('تم حذف الدراسة')
      void queryClient.invalidateQueries({ queryKey: ['radiology-studies'] })
    },
  })

  const rows = studiesQuery.data ?? []

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true) }}>
          <Plus className="h-4 w-4" /> إضافة دراسة/فحص أشعة
        </Button>
      </div>
      <div className="table-shell">
        {studiesQuery.isLoading ? <TableSkeleton rows={6} /> : rows.length ? (
          <table className="data-table">
            <thead><tr><th>الرمز</th><th>اسم الدراسة</th><th>النوع (Modality)</th><th>السعر</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
            <tbody>
              {rows.map((study) => (
                <tr key={study.id}>
                  <td className="font-mono text-xs">{study.code}</td>
                  <td className="font-semibold">{study.name_ar}</td>
                  <td>{study.modality ?? '—'}</td>
                  <td>{study.price}</td>
                  <td>
                    <Badge tone={study.is_active ? 'success' : 'neutral'} dot>
                      {study.is_active ? 'نشطة' : 'غير نشطة'}
                    </Badge>
                  </td>
                  <td className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditing(study)
                      setForm({
                        code: study.code,
                        name_ar: study.name_ar,
                        name_en: study.name_en ?? '',
                        modality: study.modality ?? '',
                        price: String(study.price),
                        is_active: study.is_active,
                      })
                      setOpen(true)
                    }}>تعديل</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate(study)}>
                      {study.is_active ? 'إلغاء النشاط' : 'تفعيل'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => deleteMutation.mutate(study.id)}>حذف</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={ScanLine} title="لا توجد دراسات" description="استخدم زر «إضافة دراسة/فحص أشعة»." />}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'تعديل الدراسة' : 'إضافة دراسة/فحص أشعة'}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>حفظ</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="رمز الدراسة" required><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="اسم الدراسة (عربي)" required><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="أشعة سينية / موجات فوق صوتية / رنين مغناطيسي" /></Field>
          <Field label="اسم الدراسة (إنجليزي)"><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></Field>
          <Field label="النوع (Modality)">
            <Select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })}>
              <option value="">—</option>
              <option value="X-Ray">أشعة سينية (X-Ray)</option>
              <option value="Ultrasound">موجات فوق صوتية (Ultrasound)</option>
              <option value="CT">أشعة مقطعية (CT)</option>
              <option value="MRI">رنين مغناطيسي (MRI)</option>
              <option value="Mammography">ماموغرافيا</option>
              <option value="ECG">تخطيط القلب (ECG)</option>
            </Select>
          </Field>
          <Field label="السعر"><Input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          <Field label="الحالة">
            <Select value={form.is_active ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}>
              <option value="active">نشطة</option>
              <option value="inactive">غير نشطة</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
