import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { GeneralSettings } from '@/components/settings/GeneralSettings'
import { ServicesSettings } from '@/components/settings/ServicesSettings'
import { LabTestsSettings } from '@/components/settings/LabTestsSettings'
import { LabDevicesSettings } from '@/components/settings/LabDevicesSettings'
import { ClinicalDevicesSettings } from '@/components/settings/ClinicalDevicesSettings'
import { RadiologyStudiesSettings } from '@/components/settings/RadiologyStudiesSettings'
import { RadiologyDevicesSettings } from '@/components/settings/RadiologyDevicesSettings'
import { StaffSettings } from '@/components/settings/StaffSettings'
import { settingsSections, settingsSectionFromParam } from '@/lib/settingsNav'

export function SettingsPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const section = settingsSectionFromParam(searchParams.get('section'))
  const active = settingsSections.find((item) => item.id === section) ?? settingsSections[0]

  return (
    <div>
      <PageHeader title={t('nav.settings')} subtitle={t('settingsPage.subtitle')} />
      <div className="min-w-0">
        <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-lg font-bold text-ink">{t(active.labelKey)}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">{t(active.descriptionKey)}</p>
        </div>

        {section === 'general' && <GeneralSettings />}
        {section === 'services' && <ServicesSettings />}
        {section === 'labTests' && <LabTestsSettings />}
        {section === 'labDevices' && <LabDevicesSettings />}
        {section === 'radiologyStudies' && <RadiologyStudiesSettings />}
        {section === 'radiologyDevices' && <RadiologyDevicesSettings />}
        {section === 'clinicalDevices' && <ClinicalDevicesSettings />}
        {section === 'staff' && <StaffSettings />}
      </div>
    </div>
  )
}
