import type { LucideIcon } from 'lucide-react'
import { Cpu, FlaskConical, ScanLine, Settings2, Stethoscope, UserCog } from 'lucide-react'

export type SettingsSection =
  | 'general'
  | 'services'
  | 'labTests'
  | 'labDevices'
  | 'radiologyStudies'
  | 'radiologyDevices'
  | 'clinicalDevices'
  | 'staff'

export interface SettingsNavItem {
  id: SettingsSection
  label: string
  labelKey: string
  description: string
  descriptionKey: string
  icon: LucideIcon
  to: string
}

export const settingsSections: SettingsNavItem[] = [
  {
    id: 'general',
    label: 'الإعدادات العامة',
    labelKey: 'nav.generalSettings',
    description: 'بيانات المستشفى والطابور والمالية والأمان',
    descriptionKey: 'settingsNav.generalDesc',
    icon: Settings2,
    to: '/settings?section=general',
  },
  {
    id: 'services',
    label: 'الخدمات',
    labelKey: 'nav.services',
    description: 'كتالوج الخدمات والأسعار',
    descriptionKey: 'settingsNav.servicesDesc',
    icon: Stethoscope,
    to: '/settings?section=services',
  },
  {
    id: 'labTests',
    label: 'إعدادات الفحوصات',
    labelKey: 'nav.labTestsSettings',
    description: 'الفحوصات، الأسعار، البراميترات، الوحدات والمدى الطبيعي',
    descriptionKey: 'settingsNav.labTestsDesc',
    icon: FlaskConical,
    to: '/settings?section=labTests',
  },
  {
    id: 'labDevices',
    label: 'إعدادات أجهزة المختبر',
    labelKey: 'nav.labDevicesSettings',
    description: 'تسجيل الأجهزة وربطها بالفحوصات',
    descriptionKey: 'settingsNav.labDevicesDesc',
    icon: Cpu,
    to: '/settings?section=labDevices',
  },
  {
    id: 'radiologyStudies',
    label: 'إعدادات الأشعة والموجات',
    labelKey: 'nav.radiologyStudiesSettings',
    description: 'دراسات الأشعة والموجات فوق الصوتية والأسعار',
    descriptionKey: 'settingsNav.radiologyStudiesDesc',
    icon: ScanLine,
    to: '/settings?section=radiologyStudies',
  },
  {
    id: 'radiologyDevices',
    label: 'أجهزة الأشعة والموجات',
    labelKey: 'nav.radiologyDevicesSettings',
    description: 'تسجيل أجهزة الأشعة والموجات وربطها بالدراسات',
    descriptionKey: 'settingsNav.radiologyDevicesDesc',
    icon: Cpu,
    to: '/settings?section=radiologyDevices',
  },
  {
    id: 'clinicalDevices',
    label: 'بوابة الأجهزة العامة',
    labelKey: 'nav.clinicalDevices',
    description: 'طوارئ، عمليات، عناية وغرف — استقبال وسحب تلقائي لكل البروتوكولات',
    descriptionKey: 'settingsNav.clinicalDevicesDesc',
    icon: Cpu,
    to: '/settings?section=clinicalDevices',
  },
  {
    id: 'staff',
    label: 'إعدادات الأطباء والممرضين',
    labelKey: 'nav.staffSettings',
    description: 'الرواتب ونسب العمولة وحالات الموظفين',
    descriptionKey: 'settingsNav.staffDesc',
    icon: UserCog,
    to: '/settings?section=staff',
  },
]

export function settingsSectionFromParam(value: string | null): SettingsSection {
  return settingsSections.find((section) => section.id === value)?.id ?? 'general'
}
