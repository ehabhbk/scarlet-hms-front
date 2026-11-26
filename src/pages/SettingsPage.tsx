import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Cpu, FlaskConical, ScanLine, Settings2, Stethoscope, UserCog } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'
import { GeneralSettings } from '@/components/settings/GeneralSettings'
import { ServicesSettings } from '@/components/settings/ServicesSettings'
import { LabTestsSettings } from '@/components/settings/LabTestsSettings'
import { LabDevicesSettings } from '@/components/settings/LabDevicesSettings'
import { RadiologyStudiesSettings } from '@/components/settings/RadiologyStudiesSettings'
import { RadiologyDevicesSettings } from '@/components/settings/RadiologyDevicesSettings'
import { StaffSettings } from '@/components/settings/StaffSettings'

type Section = 'general' | 'services' | 'labTests' | 'labDevices' | 'radiologyStudies' | 'radiologyDevices' | 'staff'

interface SettingsNavItem {
  id: Section
  label: string
  icon: LucideIcon
  description: string
}

interface SettingsNavGroup {
  label: string
  items: SettingsNavItem[]
}

const navigation: SettingsNavGroup[] = [
  {
    label: 'أساسية',
    items: [
      { id: 'general', label: 'الإعدادات العامة', icon: Settings2, description: 'بيانات المستشفى والطابور والمالية والأمان' },
      { id: 'services', label: 'الخدمات', icon: Stethoscope, description: 'كتالوج الخدمات والأسعار' },
    ],
  },
  {
    label: 'المختبر',
    items: [
      { id: 'labTests', label: 'إعدادات الفحوصات', icon: FlaskConical, description: 'الفحوصات، الأسعار، البراميترات، الوحدات والمدى الطبيعي' },
      { id: 'labDevices', label: 'إعدادات أجهزة المختبر', icon: Cpu, description: 'تسجيل الأجهزة وربطها بالفحوصات' },
    ],
  },
  {
    label: 'الأشعة',
    items: [
      { id: 'radiologyStudies', label: 'إعدادات الأشعة والموجات', icon: ScanLine, description: 'دراسات الأشعة والموجات فوق الصوتية والأسعار' },
      { id: 'radiologyDevices', label: 'أجهزة الأشعة والموجات', icon: Cpu, description: 'تسجيل أجهزة الأشعة والموجات وربطها بالدراسات' },
    ],
  },
  {
    label: 'الموارد البشرية',
    items: [
      { id: 'staff', label: 'إعدادات الأطباء والممرضين', icon: UserCog, description: 'الرواتب ونسب العمولة وحالات الموظفين' },
    ],
  },
]

export function SettingsPage() {
  const [section, setSection] = useState<Section>('general')
  const active = navigation.flatMap((group) => group.items).find((item) => item.id === section)

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="إدارة كاملة لإعدادات المستشفى والخدمات والمختبر والأشعة" />
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          {navigation.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">{group.label}</p>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSection(item.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-start text-sm font-semibold transition',
                        section === item.id
                          ? 'bg-scarlet-800 text-white shadow-sm'
                          : 'bg-surface text-ink hover:bg-surface-muted',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </aside>

        <div className="min-w-0">
          <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-lg font-bold text-ink">{active?.label}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{active?.description}</p>
          </div>

          {section === 'general' && <GeneralSettings />}
          {section === 'services' && <ServicesSettings />}
          {section === 'labTests' && <LabTestsSettings />}
          {section === 'labDevices' && <LabDevicesSettings />}
          {section === 'radiologyStudies' && <RadiologyStudiesSettings />}
          {section === 'radiologyDevices' && <RadiologyDevicesSettings />}
          {section === 'staff' && <StaffSettings />}
        </div>
      </div>
    </div>
  )
}
