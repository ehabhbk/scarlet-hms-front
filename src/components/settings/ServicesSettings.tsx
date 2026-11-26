import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, Service } from '@/lib/types'

type ServiceForm = {
  code: string
  name_ar: string
  name_en: string
  category: string
  price: string
  is_active: boolean
}

const emptyForm: ServiceForm = { code: '', name_ar: '', name_en: '', category: '', price: '0', is_active: true }

export function ServicesSettings() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState<ServiceForm>(emptyForm)

  const servicesQuery = useQuery({
    queryKey: ['services', 'settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Service[]>>('/services', { params: { per_page: 100 } })
      return data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code,
        name_ar: form.name_ar,
        name_en: form.name_en || null,
        category: form.category || null,
        price: Number(form.price || 0),
        is_active: form.is_active,
      }
      if (editing) await api.patch(`/services/${editing.id}`, payload)
      else await api.post('/services', payload)
    },
    onSuccess: () => {
      toast.success('تم حفظ الخدمة بنجاح')
      setOpen(false)
      setEditing(null)
      setForm(emptyForm)
      void queryClient.invalidateQueries({ queryKey: ['services'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الحفظ'),
  })

  const toggleMutation = useMutation({
    mutationFn: async (service: Service) => { await api.patch(`/services/${service.id}`, { is_active: !service.is_active }) },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['services'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/services/${id}`) },
    onSuccess: () => {
      toast.success('تم حذف الخدمة')
      void queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })

  const rows = servicesQuery.data ?? []

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true) }}>
          <Plus className="h-4 w-4" /> إضافة خدمة
        </Button>
      </div>
      <div className="table-shell">
        {servicesQuery.isLoading ? <TableSkeleton rows={6} /> : rows.length ? (
          <table className="data-table">
            <thead><tr><th>الرمز</th><th>اسم الخدمة</th><th>التصنيف</th><th>السعر</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
            <tbody>
              {rows.map((service) => (
                <tr key={service.id}>
                  <td className="font-mono text-xs">{service.code}</td>
                  <td className="font-semibold">{service.name_ar}</td>
                  <td>{service.category ?? '—'}</td>
                  <td>{service.price}</td>
                  <td>
                    <Badge tone={service.is_active ? 'success' : 'neutral'} dot>
                      {service.is_active ? 'نشطة' : 'غير نشطة'}
                    </Badge>
                  </td>
                  <td className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditing(service)
                      setForm({
                        code: service.code,
                        name_ar: service.name_ar,
                        name_en: service.name_en ?? '',
                        category: service.category ?? '',
                        price: String(service.price),
                        is_active: service.is_active,
                      })
                      setOpen(true)
                    }}>تعديل</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate(service)}>
                      {service.is_active ? 'إلغاء النشاط' : 'تفعيل'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => deleteMutation.mutate(service.id)}>حذف</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={Stethoscope} title="لا توجد خدمات" description="استخدم زر «إضافة خدمة» لإنشاء خدمة جديدة." />}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'تعديل الخدمة' : 'إضافة خدمة'}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>حفظ</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="رمز الخدمة" required><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="اسم الخدمة (عربي)" required><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></Field>
          <Field label="اسم الخدمة (إنجليزي)"><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></Field>
          <Field label="التصنيف"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
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
