import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ScanLine, Trash2, PlugZap } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { api, parseApiError } from '@/lib/api'
import { validateDeviceEndpoint } from '@/lib/deviceValidation'
import type { ApiEnvelope, RadiologyDevice, RadiologyStudy } from '@/lib/types'

type DeviceForm = {
  code: string
  name: string
  manufacturer: string
  model: string
  protocol: string
  ae_title: string
  host: string
  port: string
  modality: string
  status: string
  study_ids: number[]
}

const emptyForm: DeviceForm = {
  code: '', name: '', manufacturer: '', model: '', protocol: 'HL7',
  ae_title: '', host: '', port: '', modality: '', status: 'active', study_ids: [],
}

export function RadiologyDevicesSettings() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RadiologyDevice | null>(null)
  const [form, setForm] = useState<DeviceForm>(emptyForm)

  const devicesQuery = useQuery({
    queryKey: ['radiology-devices', 'settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<RadiologyDevice[]>>('/radiology-devices', { params: { per_page: 100 } })
      return data.data
    },
  })

  const studiesQuery = useQuery({
    queryKey: ['radiology-studies', 'settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<RadiologyStudy[]>>('/radiology-studies', { params: { per_page: 100 } })
      return data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const error = validateDeviceEndpoint(form.host, form.port, form.ae_title)
      if (error) throw new Error(error)

      const payload = {
        code: form.code,
        name: form.name,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        protocol: form.protocol,
        ae_title: form.ae_title || null,
        host: form.host || null,
        port: form.port ? Number(form.port) : null,
        modality: form.modality || null,
        status: form.status,
        study_ids: form.study_ids,
      }
      if (editing) await api.patch(`/radiology-devices/${editing.id}`, payload)
      else await api.post('/radiology-devices', payload)
    },
    onSuccess: () => {
      toast.success('تم حفظ جهاز الأشعة/الموجات بنجاح')
      setOpen(false)
      setEditing(null)
      setForm(emptyForm)
      void queryClient.invalidateQueries({ queryKey: ['radiology-devices'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الحفظ'),
  })

  const toggleMutation = useMutation({
    mutationFn: async (device: RadiologyDevice) => {
      await api.patch(`/radiology-devices/${device.id}`, { status: device.status === 'active' ? 'inactive' : 'active' })
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['radiology-devices'] }),
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر تغيير الحالة'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/radiology-devices/${id}`) },
    onSuccess: () => {
      toast.success('تم حذف الجهاز')
      void queryClient.invalidateQueries({ queryKey: ['radiology-devices'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الحذف'),
  })

  const testConnectionMutation = useMutation({
    mutationFn: async (device: RadiologyDevice) => {
      const { data } = await api.post<ApiEnvelope<{ ok: boolean; message: string }>>(`/radiology-devices/${device.id}/test-connection`)
      return data
    },
    onSuccess: (response) => toast.success(response.message || 'اتصال TCP ناجح'),
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الاتصال بالجهاز'),
  })

  const rows = devicesQuery.data ?? []
  const studies = studiesQuery.data ?? []

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true) }}>
          <Plus className="h-4 w-4" /> إضافة جهاز أشعة/موجات
        </Button>
      </div>
      <div className="table-shell">
        {devicesQuery.isLoading ? <TableSkeleton rows={6} /> : rows.length ? (
          <table className="data-table">
            <thead>
              <tr><th>الرمز</th><th>اسم الجهاز</th><th>النوع</th><th>البروتوكول</th><th>AE Title</th><th>الاتصال</th><th>الدراسات المرتبطة</th><th>الحالة</th><th>الإجراءات</th></tr>
            </thead>
            <tbody>
              {rows.map((device) => (
                <tr key={device.id}>
                  <td className="font-mono text-xs">{device.code}</td>
                  <td className="font-semibold">{device.name}</td>
                  <td>{device.modality ?? '—'}</td>
                  <td>{device.protocol}</td>
                  <td className="font-mono text-xs" dir="ltr">{device.ae_title ?? '—'}</td>
                  <td className="text-xs" dir="ltr">{device.host ? `${device.host}${device.port ? `:${device.port}` : ''}` : '—'}</td>
                  <td>
                    {device.studies?.length
                      ? <span className="text-xs">{device.studies.map((study) => study.name_ar).join('، ')}</span>
                      : <span className="text-xs text-ink-subtle">غير مربوط</span>}
                  </td>
                  <td>
                    <Badge tone={device.status === 'active' ? 'success' : 'neutral'} dot>
                      {device.status === 'active' ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </td>
                  <td className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditing(device)
                      setForm({
                        code: device.code,
                        name: device.name,
                        manufacturer: device.manufacturer ?? '',
                        model: device.model ?? '',
                        protocol: device.protocol,
                        ae_title: device.ae_title ?? '',
                        host: device.host ?? '',
                        port: device.port ? String(device.port) : '',
                        modality: device.modality ?? '',
                        status: device.status,
                        study_ids: device.studies?.map((study) => study.id) ?? [],
                      })
                      setOpen(true)
                    }}>تعديل وربط</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={testConnectionMutation.isPending && testConnectionMutation.variables?.id === device.id}
                      onClick={() => testConnectionMutation.mutate(device)}
                    >
                      <PlugZap className="h-3.5 w-3.5" /> اختبار الاتصال
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate(device)}>
                      {device.status === 'active' ? 'إلغاء النشاط' : 'تفعيل'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => deleteMutation.mutate(device.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> حذف
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={ScanLine} title="لا توجد أجهزة" description="استخدم زر «إضافة جهاز أشعة/موجات» ثم اربطه بالدراسات." />}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'تعديل الجهاز وربط الدراسات' : 'إضافة جهاز أشعة/موجات'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>حفظ</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="رمز الجهاز" required><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="اسم الجهاز" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="الشركة المصنعة"><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></Field>
          <Field label="الموديل"><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
          <Field label="بروتوكول الاتصال">
            <Select value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
              <option value="HL7">HL7</option>
              <option value="DICOM/HL7">DICOM + HL7</option>
              <option value="ASTM">ASTM</option>
              <option value="manual">يدوي</option>
            </Select>
          </Field>
          <Field label="نوع الجهاز (Modality)">
            <Select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })}>
              <option value="">—</option>
              <option value="X-Ray">أشعة سينية</option>
              <option value="Ultrasound">موجات فوق صوتية</option>
              <option value="CT">أشعة مقطعية</option>
              <option value="MRI">رنين مغناطيسي</option>
              <option value="Mammography">ماموغرافيا</option>
            </Select>
          </Field>
          <Field label="AE Title"><Input value={form.ae_title} onChange={(e) => setForm({ ...form, ae_title: e.target.value })} placeholder="SCARLET_CT" /></Field>
          <Field label="عنوان IP للجهاز"><Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="192.168.1.60" /></Field>
          <Field label="منفذ الجهاز"><Input type="number" min="1" max="65535" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="2576" /></Field>
          <Field label="الحالة">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-ink">الدراسات المرتبطة بالجهاز</p>
          <div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
            {studies.length ? studies.map((study) => {
              const checked = form.study_ids.includes(study.id)
              return (
                <label key={study.id} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setForm({
                      ...form,
                      study_ids: event.target.checked
                        ? [...form.study_ids, study.id]
                        : form.study_ids.filter((id) => id !== study.id),
                    })}
                    className="h-4 w-4 accent-scarlet-700"
                  />
                  <span>{study.name_ar}</span>
                  <span className="text-xs text-ink-subtle">({study.code})</span>
                </label>
              )
            }) : <p className="text-sm text-ink-subtle">لا توجد دراسات. أضف الدراسات من قسم «إعدادات الأشعة والموجات» أولًا.</p>}
          </div>
        </div>
      </Modal>
    </div>
  )
}
