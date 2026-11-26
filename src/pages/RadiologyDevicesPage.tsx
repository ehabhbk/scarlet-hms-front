import { PageHeader } from '@/components/ui/PageHeader'
import { RadiologyDevicesSettings } from '@/components/settings/RadiologyDevicesSettings'

export function RadiologyDevicesPage() {
  return (
    <div>
      <PageHeader
        title="أجهزة الأشعة والموجات"
        subtitle="تسجيل الأجهزة، ربطها بالدراسات، ومتابعة آخر مزامنة واستقبال النتائج تلقائيًا"
      />
      <RadiologyDevicesSettings />
    </div>
  )
}
