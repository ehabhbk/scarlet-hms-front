import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Cpu, Trash2, PlugZap } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { api, parseApiError } from '@/lib/api'
import { validateDeviceEndpoint } from '@/lib/deviceValidation'
import type { ApiEnvelope, LabDevice, LabTest, Setting } from '@/lib/types'

type DeviceForm = {
  code: string
  name: string
  manufacturer: string
  model: string
  protocol: string
  host: string
  port: string
  status: string
  test_ids: number[]
}

const emptyForm: DeviceForm = {
  code: '', name: '', manufacturer: '', model: '', protocol: 'HL7', host: '', port: '', status: 'active', test_ids: [],
}

export function LabDevicesSettings() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LabDevice | null>(null)
  const [form, setForm] = useState<DeviceForm>(emptyForm)

  const devicesQuery = useQuery({
    queryKey: ['lab-devices', 'settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<LabDevice[]>>('/lab-devices', { params: { per_page: 100 } })
      return data.data
    },
  })

  const testsQuery = useQuery({
    queryKey: ['lab-tests', 'settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<LabTest[]>>('/lab-tests', { params: { per_page: 100 } })
      return data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const error = validateDeviceEndpoint(form.host, form.port)
      if (error) throw new Error(error)

      const payload = {
        code: form.code,
        name: form.name,
        manufacturer: form.manufacturer || null,
        model: form.model || null,
        protocol: form.protocol,
        host: form.host || null,
        port: form.port ? Number(form.port) : null,
        status: form.status,
        test_ids: form.test_ids,
      }
      if (editing) await api.patch(`/lab-devices/${editing.id}`, payload)
      else await api.post('/lab-devices', payload)
    },
    onSuccess: () => {
      toast.success('تم حفظ الجهاز بنجاح')
      setOpen(false)
      setEditing(null)
      setForm(emptyForm)
      void queryClient.invalidateQueries({ queryKey: ['lab-devices'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الحفظ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/lab-devices/${id}`) },
    onSuccess: () => {
      toast.success('تم حذف الجهاز')
      void queryClient.invalidateQueries({ queryKey: ['lab-devices'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الحذف'),
  })

  const testConnectionMutation = useMutation({
    mutationFn: async (device: LabDevice) => {
      const { data } = await api.post<ApiEnvelope<{ ok: boolean; message: string }>>(`/lab-devices/${device.id}/test-connection`)
      return data
    },
    onSuccess: (response) => toast.success(response.message || 'اتصال TCP ناجح'),
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الاتصال بالجهاز'),
  })

  const rows = devicesQuery.data ?? []
  const tests = testsQuery.data ?? []

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<{ settings: Setting[] }>>('/settings')
      return data.data.settings
    },
  })

  const allowEmptyResults = Boolean(
    settingsQuery.data?.find((setting) => setting.key === 'lab_allow_empty_results')?.value ?? false,
  )

  const allowEmptyMutation = useMutation({
    mutationFn: async (value: boolean) => {
      await api.put('/settings', {
        settings: {
          lab_allow_empty_results: { value, group: 'laboratory', is_public: false },
        },
      })
    },
    onSuccess: () => {
      toast.success('تم حفظ إعداد المختبر')
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر حفظ إعداد المختبر'),
  })

  return (
    <div>
      <div className="card mb-3 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-black text-ink">السماح باعتماد نتائج بحقول فارغة</p>
          <p className="mt-1 text-[11px] text-ink-subtle">
            عند الإيقاف لا يستطيع المشرف توقيع فحص فيه قيمة مفقودة.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-muted/40 px-3 py-2 text-xs font-bold text-ink">
          <input
            type="checkbox"
            checked={allowEmptyResults}
            disabled={allowEmptyMutation.isPending}
            onChange={(event) => allowEmptyMutation.mutate(event.target.checked)}
            className="h-4 w-4 accent-scarlet-700"
          />
          {allowEmptyResults ? 'مسموح' : 'ممنوع'}
        </label>
      </div>

      <div className="mb-3 flex justify-end">
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true) }}>
          <Plus className="h-4 w-4" /> إضافة جهاز
        </Button>
      </div>
      <div className="table-shell">
        {devicesQuery.isLoading ? <TableSkeleton rows={6} /> : rows.length ? (
          <table className="data-table">
            <thead>
              <tr><th>الرمز</th><th>اسم الجهاز</th><th>الشركة</th><th>الموديل</th><th>البروتوكول</th><th>الاتصال</th><th>الفحوصات المرتبطة</th><th>الحالة</th><th>الإجراءات</th></tr>
            </thead>
            <tbody>
              {rows.map((device) => (
                <tr key={device.id}>
                  <td className="font-mono text-xs">{device.code}</td>
                  <td className="font-semibold">{device.name}</td>
                  <td>{device.manufacturer ?? '—'}</td>
                  <td>{device.model ?? '—'}</td>
                  <td>{device.protocol}</td>
                  <td className="text-xs" dir="ltr">
                    {device.host ? `${device.host}${device.port ? `:${device.port}` : ''}` : '—'}
                  </td>
                  <td>
                    {device.tests?.length
                      ? <span className="text-xs">{device.tests.map((test) => test.name_ar).join('، ')}</span>
                      : <span className="text-xs text-ink-subtle">غير مربوط</span>}
                  </td>
                  <td>
                    <Badge tone={device.status === 'active' ? 'success' : 'neutral'} dot>
                      {device.status === 'active' ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </td>
                  <td className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditing(device)
                      setForm({
                        code: device.code,
                        name: device.name,
                        manufacturer: device.manufacturer ?? '',
                        model: device.model ?? '',
                        protocol: device.protocol,
                        host: device.host ?? '',
                        port: device.port ? String(device.port) : '',
                        status: device.status,
                        test_ids: device.tests?.map((test) => test.id) ?? [],
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
                    <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => deleteMutation.mutate(device.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> حذف
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={Cpu} title="لا توجد أجهزة" description="استخدم زر «إضافة جهاز» ثم اربطه بالفحوصات." />}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'تعديل الجهاز وربط الفحوصات' : 'إضافة جهاز مختبر'}
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
              <option value="ASTM">ASTM</option>
              <option value="LIS">LIS</option>
              <option value="manual">يدوي</option>
            </Select>
          </Field>
          <Field label="عنوان IP للجهاز"><Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="192.168.1.50" /></Field>
          <Field label="منفذ الجهاز"><Input type="number" min="1" max="65535" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="2575" /></Field>
          <Field label="الحالة">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-ink">الفحوصات المرتبطة بالجهاز</p>
          <div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-line p-3 sm:grid-cols-2">
            {tests.length ? tests.map((test) => {
              const checked = form.test_ids.includes(test.id)
              return (
                <label key={test.id} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => setForm({
                      ...form,
                      test_ids: event.target.checked
                        ? [...form.test_ids, test.id]
                        : form.test_ids.filter((id) => id !== test.id),
                    })}
                    className="h-4 w-4 accent-scarlet-700"
                  />
                  <span>{test.name_ar}</span>
                  <span className="text-xs text-ink-subtle">({test.code})</span>
                </label>
              )
            }) : <p className="text-sm text-ink-subtle">لا توجد فحوصات. أضف فحوصات من قسم «إعدادات الفحوصات» أولًا.</p>}
          </div>
        </div>
      </Modal>
    </div>
  )
}
