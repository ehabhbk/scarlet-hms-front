import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Cpu, Trash2, PlugZap, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, ClinicalDevice, ClinicalDeviceMessage } from '@/lib/types'

type Form = {
  code: string
  name: string
  category: string
  protocol: string
  host: string
  port: string
  direction: string
  poll_enabled: boolean
  poll_interval_seconds: string
  poll_query: string
  poll_query_encoding: string
  status: string
}

const emptyForm: Form = {
  code: '', name: '', category: 'icu', protocol: 'AUTO', host: '', port: '',
  direction: 'push', poll_enabled: false, poll_interval_seconds: '30',
  poll_query: '', poll_query_encoding: 'literal', status: 'active',
}

const categories: { value: string; label: string }[] = [
  { value: 'emergency', label: 'طوارئ' },
  { value: 'operating_room', label: 'عمليات' },
  { value: 'icu', label: 'عناية مركزة' },
  { value: 'ward', label: 'غرف المرضى' },
  { value: 'other', label: 'أخرى' },
]

export function ClinicalDevicesSettings() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ClinicalDevice | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [messagesFor, setMessagesFor] = useState<ClinicalDevice | null>(null)

  const devicesQuery = useQuery({
    queryKey: ['clinical-devices', 'settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<ClinicalDevice[]>>('/clinical-devices', { params: { per_page: 100 } })
      return data.data
    },
  })

  const messagesQuery = useQuery({
    queryKey: ['clinical-device-messages', messagesFor?.id],
    enabled: Boolean(messagesFor),
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<ClinicalDeviceMessage[]>>(`/clinical-devices/${messagesFor?.id}/messages`)
      return data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        port: form.port ? Number(form.port) : null,
        poll_interval_seconds: Number(form.poll_interval_seconds || 30),
      }
      if (editing) await api.patch(`/clinical-devices/${editing.id}`, payload)
      else await api.post('/clinical-devices', payload)
    },
    onSuccess: () => {
      toast.success('تم حفظ الجهاز السريري')
      setOpen(false)
      setEditing(null)
      setForm(emptyForm)
      void queryClient.invalidateQueries({ queryKey: ['clinical-devices'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الحفظ'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await api.delete(`/clinical-devices/${id}`) },
    onSuccess: () => {
      toast.success('تم حذف الجهاز')
      void queryClient.invalidateQueries({ queryKey: ['clinical-devices'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الحذف'),
  })

  const testMutation = useMutation({
    mutationFn: async (device: ClinicalDevice) => {
      const { data } = await api.post<ApiEnvelope<{ message: string }>>(`/clinical-devices/${device.id}/test-connection`)
      return data
    },
    onSuccess: (data) => toast.success(data.message || 'اتصال TCP ناجح'),
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الاتصال'),
  })

  const pollMutation = useMutation({
    mutationFn: async (device: ClinicalDevice) => {
      const { data } = await api.post<ApiEnvelope<{ frames: number; imported: number }>>(`/clinical-devices/${device.id}/poll`)
      return data
    },
    onSuccess: (data) => toast.success(`تم الجلب: ${data.data?.frames ?? 0} رسالة`),
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر استجواب الجهاز'),
  })

  const rows = devicesQuery.data ?? []
  const categoryLabel = (value: string) => categories.find((item) => item.value === value)?.label ?? value

  return (
    <div>
      <div className="card mb-3 p-4 text-xs leading-6 text-ink-muted">
        بوابة موحّدة لأجهزة الطوارئ والعمليات والعناية والغرف. تستقبل HL7 وASTM وFHIR وJSON وXML وCSV والرسائل النصية،
        ويمكنها طلب البيانات من الجهاز (Host Query) عبر TCP، أو استقبالها عبر UDP/Syslog وHTTP.
        جميع البيانات تُحفظ للمراجعة ولا تُعتمد تلقائياً.
      </div>

      <div className="mb-3 flex justify-end">
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true) }}>
          <Plus className="h-4 w-4" /> إضافة جهاز سريري
        </Button>
      </div>

      <div className="table-shell">
        {devicesQuery.isLoading ? <TableSkeleton rows={6} /> : rows.length ? (
          <table className="data-table">
            <thead>
              <tr><th>الرمز</th><th>الاسم</th><th>القسم</th><th>البروتوكول</th><th>الاتصال</th><th>السحب</th><th>الحالة</th><th>الإجراءات</th></tr>
            </thead>
            <tbody>
              {rows.map((device) => (
                <tr key={device.id}>
                  <td className="font-mono text-xs">{device.code}</td>
                  <td className="font-semibold">{device.name}</td>
                  <td>{categoryLabel(device.category)}</td>
                  <td>{device.protocol_detected || device.protocol}</td>
                  <td className="text-xs" dir="ltr">{device.host ? `${device.host}${device.port ? `:${device.port}` : ''}` : '—'}</td>
                  <td>
                    <Badge tone={device.poll_enabled ? 'success' : 'neutral'} dot>
                      {device.poll_enabled ? `تلقائي كل ${device.poll_interval_seconds}ث` : 'استقبال فقط'}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={device.status === 'active' ? 'success' : 'neutral'} dot>
                      {device.status === 'active' ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </td>
                  <td className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setMessagesFor(device)}>الرسائل</Button>
                    <Button size="sm" variant="ghost" loading={pollMutation.isPending && pollMutation.variables?.id === device.id} onClick={() => pollMutation.mutate(device)}>
                      <RefreshCw className="h-3.5 w-3.5" /> جلب الآن
                    </Button>
                    <Button size="sm" variant="ghost" loading={testMutation.isPending && testMutation.variables?.id === device.id} onClick={() => testMutation.mutate(device)}>
                      <PlugZap className="h-3.5 w-3.5" /> اختبار
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditing(device)
                      setForm({
                        code: device.code,
                        name: device.name,
                        category: device.category,
                        protocol: device.protocol,
                        host: device.host ?? '',
                        port: device.port ? String(device.port) : '',
                        direction: device.direction,
                        poll_enabled: device.poll_enabled,
                        poll_interval_seconds: String(device.poll_interval_seconds),
                        poll_query: device.poll_query ?? '',
                        poll_query_encoding: device.poll_query_encoding,
                        status: device.status,
                      })
                      setOpen(true)
                    }}>تعديل</Button>
                    <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => deleteMutation.mutate(device.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> حذف
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={Cpu} title="لا توجد أجهزة سريرية" description="أضف جهازاً أو استخدم الإرسال عبر device-ingest/clinical." />}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'تعديل الجهاز السريري' : 'إضافة جهاز سريري'}
        size="lg"
        footer={<>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>حفظ</Button>
        </>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="رمز الجهاز" required><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="اسم الجهاز" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="القسم">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </Field>
          <Field label="البروتوكول">
            <Select value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}>
              <option value="AUTO">اكتشاف تلقائي</option>
              <option value="HL7">HL7</option><option value="ASTM">ASTM</option>
              <option value="FHIR">FHIR</option><option value="JSON">JSON</option>
              <option value="XML">XML / CDA</option><option value="CSV">CSV</option>
            </Select>
          </Field>
          <Field label="عنوان IP"><Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} dir="ltr" /></Field>
          <Field label="المنفذ"><Input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} /></Field>
          <Field label="اتجاه الاتصال">
            <Select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              <option value="push">الجهاز يرسل إلينا</option>
              <option value="pull">نطلب البيانات منه</option>
              <option value="bidirectional">الاتجاهان</option>
            </Select>
          </Field>
          <Field label="فترة الاستجواب (ثانية)"><Input type="number" min="5" value={form.poll_interval_seconds} onChange={(e) => setForm({ ...form, poll_interval_seconds: e.target.value })} /></Field>
          <Field label="أمر الاستجواب"><Input value={form.poll_query} onChange={(e) => setForm({ ...form, poll_query: e.target.value })} placeholder="\x05" dir="ltr" /></Field>
          <Field label="ترميز الأمر">
            <Select value={form.poll_query_encoding} onChange={(e) => setForm({ ...form, poll_query_encoding: e.target.value })}>
              <option value="literal">نص</option><option value="hex">Hex</option><option value="base64">Base64</option>
            </Select>
          </Field>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
          <input type="checkbox" checked={form.poll_enabled} onChange={(e) => setForm({ ...form, poll_enabled: e.target.checked })} className="h-4 w-4 accent-scarlet-700" />
          تفعيل السحب التلقائي
        </label>
      </Modal>

      <Modal open={Boolean(messagesFor)} onClose={() => setMessagesFor(null)} title={`رسائل ${messagesFor?.name ?? ''}`} size="lg" footer={<Button variant="outline" onClick={() => setMessagesFor(null)}>إغلاق</Button>}>
        {messagesQuery.isLoading ? <TableSkeleton rows={4} /> : messagesQuery.data?.length ? (
          <div className="space-y-2">
            {messagesQuery.data.map((message) => (
              <div key={message.id} className="rounded-xl border border-line p-3 text-xs">
                <div className="mb-1 flex justify-between gap-2 text-ink-muted">
                  <span>{message.protocol} — {message.received_at}</span>
                  <Badge tone="neutral">{message.status}</Badge>
                </div>
                <p className="font-semibold text-ink">{message.parsed_summary ?? 'رسالة خام'}</p>
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-muted/50 p-2" dir="ltr">{message.raw_message}</pre>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={Cpu} title="لا توجد رسائل" description="لم تصل رسائل من هذا الجهاز بعد." />}
      </Modal>
    </div>
  )
}
