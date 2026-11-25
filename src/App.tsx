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
import { AppointmentsPage } from '@/pages/AppointmentsPage'
import { QueuesPage } from '@/pages/QueuesPage'
import { EncountersPage } from '@/pages/EncountersPage'
import { EncounterDetailPage } from '@/pages/EncounterDetailPage'
import { StaffPage } from '@/pages/StaffPage'
import { RolesPage } from '@/pages/RolesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AuditPage } from '@/pages/AuditPage'
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

          <Route path="/staff" element={guard('users.manage', <StaffPage />)} />
          <Route path="/roles" element={guard('roles.manage', <RolesPage />)} />
          <Route path="/reports" element={guard('dashboard.view', <ReportsPage />)} />
          <Route path="/audit" element={guard('audit.view', <AuditPage />)} />
          <Route path="/settings" element={guard('settings.manage', <SettingsPage />)} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
