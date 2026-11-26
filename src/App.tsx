import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PatientsPage } from '@/pages/PatientsPage'
import { PatientDetailPage } from '@/pages/PatientDetailPage'
import { PatientFormPage } from '@/pages/PatientFormPage'
import { AccountingPage } from '@/pages/AccountingPage'
import { AppointmentsPage } from '@/pages/AppointmentsPage'
import { AttendancePage } from '@/pages/AttendancePage'
import { PayrollPage } from '@/pages/PayrollPage'
import { QueuesPage } from '@/pages/QueuesPage'
import { EncountersPage } from '@/pages/EncountersPage'
import { EncounterDetailPage } from '@/pages/EncounterDetailPage'
import { StaffPage } from '@/pages/StaffPage'
import { RolesPage } from '@/pages/RolesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AuditPage } from '@/pages/AuditPage'
import { BillingPage } from '@/pages/BillingPage'
import { DeviceMessagesPage } from '@/pages/DeviceMessagesPage'
import { MaternityPage } from '@/pages/MaternityPage'
import { NurseryPage } from '@/pages/NurseryPage'
import { SurgeryPage } from '@/pages/SurgeryPage'
import { EmployeesPage } from '@/pages/EmployeesPage'
import { InpatientPage } from '@/pages/InpatientPage'
import { InsuranceContractsPage } from '@/pages/InsuranceContractsPage'
import { LabDevicesPage } from '@/pages/LabDevicesPage'
import { InsurancePage } from '@/pages/InsurancePage'
import { LaboratoryPage } from '@/pages/LaboratoryPage'
import { PharmacyPage } from '@/pages/PharmacyPage'
import { RadiologyPage } from '@/pages/RadiologyPage'
import { RadiologyDevicesPage } from '@/pages/RadiologyDevicesPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { DisplayPage } from '@/pages/DisplayPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

function guard(permission: string | string[], element: ReactNode) {
  return <RequirePermission permission={permission}>{element}</RequirePermission>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/display" element={<DisplayPage />} />
      <Route path="/display/:branchId" element={<DisplayPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={guard('dashboard.view', <DashboardPage />)} />

          <Route path="/patients" element={guard('patients.view', <PatientsPage />)} />
          <Route path="/patients/new" element={guard('patients.create', <PatientFormPage />)} />
          <Route path="/patients/:id" element={guard('patients.view', <PatientDetailPage />)} />
          <Route path="/patients/:id/edit" element={guard('patients.update', <PatientFormPage />)} />

          <Route path="/appointments" element={guard('appointments.view', <AppointmentsPage />)} />
          <Route path="/queues" element={guard('queues.view', <QueuesPage />)} />

          <Route path="/encounters" element={guard('encounters.view', <EncountersPage />)} />
          <Route path="/encounters/:id" element={guard('encounters.view', <EncounterDetailPage />)} />

          <Route path="/pharmacy" element={guard('prescriptions.view', <PharmacyPage />)} />
          <Route path="/billing" element={guard('billing.view', <BillingPage />)} />
          <Route path="/insurance" element={guard('insurance.view', <InsurancePage />)} />
          <Route path="/laboratory" element={guard('laboratory.view', <LaboratoryPage />)} />
          <Route path="/radiology" element={guard('radiology.view', <RadiologyPage />)} />

          <Route path="/surgery" element={guard('patients.view', <SurgeryPage />)} />
          <Route path="/maternity" element={guard('patients.view', <MaternityPage />)} />
          <Route path="/nursery" element={guard('patients.view', <NurseryPage />)} />
          <Route path="/device-messages" element={guard('laboratory.view', <DeviceMessagesPage />)} />

          <Route path="/employees" element={guard('users.manage', <EmployeesPage />)} />
          <Route path="/attendance" element={guard('users.manage', <AttendancePage />)} />
          <Route path="/payroll" element={guard('users.manage', <PayrollPage />)} />
          <Route path="/inpatient" element={guard('patients.view', <InpatientPage />)} />
          <Route path="/insurance-contracts" element={guard('insurance.view', <InsuranceContractsPage />)} />
          <Route path="/lab-devices" element={guard('laboratory.view', <LabDevicesPage />)} />
          <Route path="/radiology-devices" element={guard('radiology.view', <RadiologyDevicesPage />)} />

          <Route path="/staff" element={guard('users.manage', <StaffPage />)} />
          <Route path="/roles" element={guard('roles.manage', <RolesPage />)} />
          <Route path="/reports" element={guard('dashboard.view', <ReportsPage />)} />
          <Route path="/audit" element={guard('audit.view', <AuditPage />)} />
          <Route path="/accounting" element={guard('accounting.view', <AccountingPage />)} />
          <Route path="/settings" element={guard('settings.manage', <SettingsPage />)} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
