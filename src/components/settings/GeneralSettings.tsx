import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, Setting } from '@/lib/types'

const groupLabels: Record<string, string> = {
  general: 'عام',
  hospital: 'معلومات المستشفى',
  branding: 'الهوية البصرية',
  queues: 'الطوابير وشاشة العرض',
  scheduling: 'المواعيد',
  finance: 'المالية',
  patients: 'المرضى',
  audit: 'السجلات والتدقيق',
  security: 'الأمان',
  services: 'الخدمات',
  laboratory: 'المختبر',
  whatsapp: 'واتساب',
  display: 'شاشة العرض',
  clinics: 'العيادات',
}

const keyLabels: Record<string, string> = {
  hospital_name_ar: 'اسم المستشفى (عربي)',
  hospital_name_en: 'اسم المستشفى (إنجليزي)',
  hospital_phone: 'رقم الهاتف',
  hospital_email: 'البريد الإلكتروني',
  hospital_address_ar: 'العنوان (عربي)',
  hospital_address_en: 'العنوان (إنجليزي)',
  brand_tagline_ar: 'الشعار التعريفي (عربي)',
  brand_tagline_en: 'الشعار التعريفي (إنجليزي)',
  queue_display_notice_ar: 'تنبيه شاشة الطابور (عربي)',
  queue_display_notice_en: 'تنبيه شاشة الطابور (إنجليزي)',
  appointment_slot_minutes: 'مدة الموعد (دقيقة)',
  allow_walk_ins: 'السماح بالزيارات دون موعد',
  queue_auto_call: 'استدعاء تلقائي للطابور',
  currency: 'العملة',
  timezone: 'المنطقة الزمنية',
  mrn_prefix: 'بادئة رقم الملف',
  duplicate_score_threshold: 'حد تطابق المرضى المكررين',
  audit_retention_days: 'مدة الاحتفاظ بسجل التدقيق (يوم)',
  session_timeout_minutes: 'مدة انتهاء الجلسة (دقيقة)',
  support_email: 'بريد الدعم الفني',
  service_default_price: 'السعر الافتراضي للخدمة',
  lab_auto_approve: 'اعتماد نتائج المختبر تلقائيًا',
  lab_device_sync_interval: 'فترة مزامنة أجهزة المختبر (ثانية)',
  lab_allow_empty_results: 'السماح باعتماد نتائج بحقول فارغة',
  whatsapp_enabled: 'تفعيل واتساب',
  whatsapp_api_url: 'رابط API واتساب',
  whatsapp_token: 'رمز واتساب',
  display_refresh_seconds: 'ثواني تحديث شاشة العرض',
  display_show_doctor: 'إظهار اسم الطبيب على الشاشة',
  clinic_default_duration: 'مدة الكشف الافتراضية (دقيقة)',
  clinic_allow_overbooking: 'السماح بحجوزات زائدة',
}

export function GeneralSettings() {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Record<string, unknown>>({})

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<{ settings: Setting[]; groups: string[] }>>('/settings')
      return data.data.settings
    },
  })

  useEffect(() => {
    if (settingsQuery.data) {
      setValues(Object.fromEntries(settingsQuery.data.map((s) => [s.key, s.value])))
    }
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const settings = Object.fromEntries(
        (settingsQuery.data ?? []).map((setting) => [
          setting.key,
          {
            value: values[setting.key] ?? null,
            group: setting.group,
            is_public: setting.is_public,
          },
        ]),
      )
      await api.put('/settings', { settings })
    },
    onSuccess: () => {
      toast.success('تم حفظ الإعدادات بنجاح')
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      void queryClient.invalidateQueries({ queryKey: ['meta'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر حفظ الإعدادات'),
  })

  const grouped = useMemo(() => {
    const map = new Map<string, Setting[]>()
    for (const setting of settingsQuery.data ?? []) {
      const list = map.get(setting.group) ?? []
      list.push(setting)
      map.set(setting.group, list)
    }
    return Array.from(map.entries())
  }, [settingsQuery.data])

  if (settingsQuery.isLoading) return <TableSkeleton rows={8} />

  if (!grouped.length) {
    return <div className="card"><EmptyState icon={Settings2} title="لا توجد إعدادات" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
          <Save className="h-4 w-4" /> حفظ الإعدادات
        </Button>
      </div>

      {grouped.map(([group, settings]) => (
        <section key={group} className="card p-5">
          <h2 className="mb-4 text-base font-bold text-ink">{groupLabels[group] ?? group}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {settings.map((setting) => {
              const label = keyLabels[setting.key] ?? setting.key
              const current = values[setting.key]

              if (setting.type === 'boolean') {
                return (
                  <label key={setting.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-surface-muted/40 px-3 py-2.5">
                    <span className="text-sm font-semibold text-ink">{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(current)}
                      onChange={(event) => setValues((prev) => ({ ...prev, [setting.key]: event.target.checked }))}
                      className="h-4 w-4 accent-scarlet-700"
                    />
                  </label>
                )
              }

              const isLong = String(setting.key).includes('address') || String(setting.key).includes('notice') || String(setting.key).includes('api_url')
              return (
                <Field key={setting.key} label={label}>
                  {isLong ? (
                    <Textarea
                      value={current == null ? '' : String(current)}
                      onChange={(event) => setValues((prev) => ({ ...prev, [setting.key]: event.target.value }))}
                    />
                  ) : (
                    <Input
                      type={setting.type === 'integer' || setting.type === 'double' ? 'number' : 'text'}
                      value={current == null ? '' : String(current)}
                      onChange={(event) => setValues((prev) => ({
                        ...prev,
                        [setting.key]: setting.type === 'integer' || setting.type === 'double'
                          ? Number(event.target.value)
                          : event.target.value,
                      }))}
                    />
                  )}
                </Field>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
