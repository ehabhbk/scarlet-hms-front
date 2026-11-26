export type Locale = 'ar' | 'en'
export type Theme = 'light' | 'dark' | 'system'
export type Gender = 'male' | 'female' | 'other'

export interface ApiMeta {
  pagination?: {
    current_page: number
    per_page: number
    total: number
    last_page: number
    from: number | null
    to: number | null
  }
  request_id?: string
}

export interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
  meta?: ApiMeta
  errors?: Record<string, unknown>
  code?: string
}

export interface Branch {
  id: number
  code: string
  name_ar: string
  name_en: string
  name: string
  type: string
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  timezone?: string
  is_active: boolean
}

export interface Department {
  id: number
  branch_id: number
  parent_id?: number | null
  code: string
  name_ar: string
  name_en: string
  name: string
  type: string
  location?: string | null
  phone?: string | null
  sort_order?: number
  is_active: boolean
}

export interface Role {
  id: number
  name: string
  name_ar: string
  name_en: string
  display_name?: string
  description?: string | null
  is_system: boolean
  permissions?: Permission[]
  permissions_count?: number
  users_count?: number
}

export interface Permission {
  id: number
  name: string
  module: string
  name_ar: string
  name_en: string
}

export interface User {
  id: number
  name: string
  username: string
  email?: string | null
  phone?: string | null
  locale: Locale
  theme: Theme
  job_title?: string | null
  avatar_path?: string | null
  is_active: boolean
  last_login_at?: string | null
  branch_id?: number | null
  department_id?: number | null
  branch?: Branch | null
  department?: Department | null
  branches?: Branch[]
  roles: Pick<Role, 'id' | 'name' | 'name_ar' | 'name_en'>[]
  role_names: string[]
  permissions: string[]
  display_role?: string | null
  initials: string
}

export interface PatientAllergy {
  id: number
  patient_id: number
  allergen: string
  reaction?: string | null
  severity: 'mild' | 'moderate' | 'severe' | 'life_threatening'
  status: string
  recorded_by?: string | null
  created_at: string
}

export interface PatientCondition {
  id: number
  patient_id: number
  type: string
  code?: string | null
  name_ar: string
  name_en?: string | null
  diagnosed_on?: string | null
  status: string
  notes?: string | null
  recorded_by?: string | null
  created_at: string
}

export interface Patient {
  id: number
  mrn: string
  first_name_ar: string
  last_name_ar: string
  first_name_en?: string | null
  last_name_en?: string | null
  full_name_ar: string
  full_name_en: string
  display_name: string
  national_id?: string | null
  passport_number?: string | null
  gender: Gender
  date_of_birth: string
  age: number | null
  phone?: string | null
  alt_phone?: string | null
  email?: string | null
  marital_status?: string | null
  nationality?: string | null
  blood_type?: string | null
  address?: string | null
  city?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  emergency_contact_relation?: string | null
  status: 'active' | 'inactive' | 'deceased' | 'merged'
  notes?: string | null
  registration_branch?: Branch | null
  allergies?: PatientAllergy[]
  conditions?: PatientCondition[]
  has_allergy_alert?: boolean
  appointments_count?: number
  encounters_count?: number
  last_visit_at?: string | null
  created_at: string
  updated_at: string
}

export interface PatientDetail {
  patient: Patient
  recent_encounters: Encounter[]
  upcoming_appointments: Appointment[]
}

export interface TimelineItem {
  id: string
  type: 'encounter' | 'appointment' | 'vitals' | 'diagnosis' | 'clinical_note' | 'allergy' | 'condition'
  at: string
  status: string
  title_ar: string
  title_en: string
  subtitle_ar?: string | null
  subtitle_en?: string | null
  reference_id: number
  meta?: Record<string, unknown>
}

export interface Appointment {
  id: number
  appointment_number: string
  patient_id: number
  patient?: Patient
  branch_id: number
  branch?: Branch
  department_id: number
  department?: Department
  doctor_id?: number | null
  doctor?: User | null
  scheduled_at: string
  scheduled_date: string
  scheduled_time: string
  duration_minutes: number
  type: string
  status: 'booked' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  reason?: string | null
  notes?: string | null
  checked_in_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
  cancellation_reason?: string | null
  queue_ticket?: QueueTicket | null
  created_at: string
}

export interface QueueTicket {
  id: number
  queue_date: string
  number: number
  prefix: string
  display_number: string
  status: 'waiting' | 'called' | 'in_progress' | 'completed' | 'skipped' | 'no_show'
  priority: 'normal' | 'urgent' | 'emergency'
  patient_id: number
  patient?: Patient
  branch_id: number
  department_id: number
  department?: Department
  doctor_id?: number | null
  doctor?: User | null
  appointment_id?: number | null
  encounter_id?: number | null
  encounter?: Encounter | null
  called_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  skip_reason?: string | null
  waiting_since?: number | null
  created_at: string
}

export interface QueueBoard {
  date: string
  counts: Record<string, number>
  tickets: QueueTicket[]
}

export interface PublicQueueBoard {
  date: string
  current: {
    number: string
    status: string
    priority: string
    department_ar?: string
    department_en?: string
    doctor?: string
  } | null
  called: Array<{
    number: string
    status: string
    priority: string
    department_ar?: string
    department_en?: string
    doctor?: string
  }>
  next: Array<{
    number: string
    status: string
    priority: string
    department_ar?: string
    department_en?: string
    doctor?: string
  }>
  waiting_count: number
}

export interface VitalSign {
  id: number
  patient_id: number
  encounter_id?: number | null
  temperature_c?: string | number | null
  heart_rate?: number | null
  respiratory_rate?: number | null
  systolic_bp?: number | null
  diastolic_bp?: number | null
  blood_pressure?: string | null
  oxygen_saturation?: number | null
  weight_kg?: string | number | null
  height_cm?: string | number | null
  bmi?: string | number | null
  pain_score?: number | null
  notes?: string | null
  recorded_by?: string | null
  recorded_at: string
  flags?: string[]
}

export interface Diagnosis {
  id: number
  patient_id: number
  encounter_id?: number | null
  icd10_code?: string | null
  name_ar: string
  name_en?: string | null
  type: 'primary' | 'secondary'
  certainty: 'suspected' | 'confirmed' | 'rule_out'
  notes?: string | null
  diagnosed_by?: string | null
  created_at: string
}

export interface ClinicalNote {
  id: number
  patient_id: number
  encounter_id?: number | null
  type: string
  content: string
  status: 'draft' | 'signed' | 'amended'
  author?: string | null
  signed_at?: string | null
  is_signed: boolean
  created_at: string
}

export interface Encounter {
  id: number
  encounter_number: string
  patient_id: number
  patient?: Patient
  branch_id: number
  branch?: Branch
  department_id: number
  department?: Department
  doctor_id?: number | null
  doctor?: User | null
  appointment_id?: number | null
  appointment?: Appointment | null
  type: string
  status: 'open' | 'in_progress' | 'completed' | 'cancelled'
  started_at: string
  ended_at?: string | null
  chief_complaint?: string | null
  history?: string | null
  examination?: string | null
  assessment?: string | null
  plan?: string | null
  disposition?: string | null
  is_signed: boolean
  signed_at?: string | null
  signed_by?: string | null
  vital_signs?: VitalSign[]
  diagnoses?: Diagnosis[]
  clinical_notes?: ClinicalNote[]
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: number
  user_id?: number | null
  user?: string | null
  event: string
  auditable_type?: string | null
  auditable_id?: number | null
  description?: string | null
  old_values?: Record<string, unknown> | null
  new_values?: Record<string, unknown> | null
  ip_address?: string | null
  user_agent?: string | null
  request_id?: string | null
  created_at: string
}

export interface Setting {
  id: number
  group: string
  key: string
  value: unknown
  type: string
  is_public: boolean
  updated_at?: string
}

export interface OptionItem {
  value: string
  ar: string
  en: string
}

export interface MetaBootstrap {
  user: User
  branches: Branch[]
  departments: Department[]
  doctors: Array<{
    id: number
    name: string
    job_title?: string | null
    branch_id?: number | null
    department_id?: number | null
    branch?: Pick<Branch, 'id' | 'name_ar' | 'name_en'> | null
    department?: Pick<Department, 'id' | 'name_ar' | 'name_en'> | null
  }>
  roles: Role[]
  permissions: Permission[]
  settings: Setting[]
  options: Record<string, OptionItem[] | string[]>
}

export interface PublicMeta {
  brand: {
    name: string
    name_ar: string
    legal_name: string
    tagline_ar: string
    tagline_en: string
    palette: Record<string, string>
  }
  branches: Branch[]
  departments: Department[]
  settings: Setting[]
  options: Record<string, OptionItem[] | string[]>
}

export interface DashboardSummary {
  generated_at: string
  branch_id: number | null
  stats: {
    total_patients: number
    new_patients_today: number
    appointments_today: number
    checked_in_today: number
    completed_appointments: number
    waiting_now: number
    called_now: number
    in_consultation: number
    open_encounters: number
    my_appointments_today: number
  }
  queue_counts: Record<string, number>
  appointment_counts: Record<string, number>
  recent_patients: Patient[]
  today_appointments: Appointment[]
  weekly_registrations: Array<{ date: string; label: string; count: number }>
  department_load: Array<{ department_id: number; name_ar: string; name_en: string; count: number }>
}

export interface LoginResponse {
  token: string
  token_type: string
  user: User
}

export interface AppointmentSummary {
  date: string
  total: number
  counts: Record<string, number>
}


// Enterprise modules
export interface Medication {
  id: number
  code: string
  name_ar: string
  name_en?: string | null
  generic_name?: string | null
  form?: string | null
  strength?: string | null
  unit?: string | null
  unit_price: number
  stock_quantity: number
  reorder_level: number
  is_active: boolean
}

export interface PrescriptionItem {
  id: number
  prescription_id: number
  medication_id: number
  medication?: Medication
  dosage?: string | null
  frequency?: string | null
  duration?: string | null
  quantity: number
  instructions?: string | null
}

export interface Dispense {
  id: number
  prescription_id: number
  prescription_item_id?: number | null
  medication_id: number
  medication?: Medication
  quantity: number
  unit_price: number
  total_price: number
  dispensed_by?: number | null
  dispensed_at?: string | null
}

export interface Prescription {
  id: number
  prescription_number: string
  patient_id: number
  patient?: Patient
  encounter_id?: number | null
  appointment_id?: number | null
  branch_id: number
  branch?: Branch
  doctor_id?: number | null
  doctor?: User | null
  status: 'pending' | 'dispensed' | 'cancelled'
  notes?: string | null
  prescribed_at?: string | null
  dispensed_at?: string | null
  dispensed_by?: number | null
  items?: PrescriptionItem[]
  dispenses?: Dispense[]
  created_at: string
}

export interface InvoiceItem {
  id: number
  invoice_id: number
  description: string
  code?: string | null
  unit_price: number
  quantity: number
  total: number
}

export interface Payment {
  id: number
  invoice_id: number
  payment_number: string
  method: string
  amount: number
  reference?: string | null
  paid_at?: string | null
  collected_by?: number | null
  collector?: User | null
  notes?: string | null
}

export interface Refund {
  id: number
  invoice_id: number
  payment_id?: number | null
  amount: number
  reason?: string | null
  status: 'pending' | 'approved' | 'rejected'
  approved_by?: number | null
  approved_at?: string | null
}

export interface Invoice {
  id: number
  invoice_number: string
  patient_id: number
  patient?: Patient
  branch_id: number
  branch?: Branch
  department_id?: number | null
  department?: Department
  encounter_id?: number | null
  appointment_id?: number | null
  status: 'draft' | 'issued' | 'paid' | 'partial' | 'cancelled'
  subtotal: number
  discount: number
  tax: number
  total: number
  paid: number
  balance: number
  currency: string
  issued_at?: string | null
  due_at?: string | null
  notes?: string | null
  items?: InvoiceItem[]
  payments?: Payment[]
  refunds?: Refund[]
  created_at: string
}

export interface InsuranceProvider {
  id: number
  code: string
  name: string
  contact_phone?: string | null
  contact_email?: string | null
  coverage_percent: number
  is_active: boolean
}

export interface PatientInsurance {
  id: number
  patient_id: number
  patient?: Patient
  insurance_provider_id: number
  provider?: InsuranceProvider
  policy_number: string
  valid_from?: string | null
  valid_to?: string | null
  status: string
}

export interface InsuranceClaim {
  id: number
  claim_number: string
  patient_id: number
  patient?: Patient
  insurance_provider_id: number
  provider?: InsuranceProvider
  invoice_id?: number | null
  invoice?: Invoice
  claimed_amount: number
  approved_amount: number
  status: 'submitted' | 'approved' | 'rejected'
  notes?: string | null
  submitted_at?: string | null
  decided_at?: string | null
  created_at: string
}

export interface LabTest {
  id: number
  code: string
  name_ar: string
  name_en?: string | null
  category?: string | null
  unit?: string | null
  reference_range?: string | null
  price: number
  is_active: boolean
}

export interface LabResultValue {
  id: number
  lab_order_item_id: number
  lab_test_parameter_id: number
  parameter?: LabTestParameter
  value?: string | null
  flag?: string | null
}

export interface LabOrderItem {
  id: number
  lab_order_id: number
  lab_test_id: number
  test?: LabTest & { parameters?: LabTestParameter[] }
  order?: LabOrder | null
  values?: LabResultValue[]
  status: 'pending' | 'entered' | 'approved'
  result_value?: string | null
  result_unit?: string | null
  flag?: string | null
  notes?: string | null
  sample_collected_at?: string | null
  sample_collected_by?: number | null
  sample_collector_user?: User | null
  entered_by?: number | null
  entered_by_user?: User | null
  entered_at?: string | null
  approved_by?: number | null
  approved_by_user?: User | null
  approved_at?: string | null
  source?: 'manual' | 'device'
  source_device_id?: number | null
  source_device?: LabDevice | null
  source_message_id?: number | null
  imported_at?: string | null
}

export interface LabOrder {
  id: number
  order_number: string
  patient_id: number
  patient?: Patient
  encounter_id?: number | null
  branch_id: number
  branch?: Branch
  doctor_id?: number | null
  doctor?: User | null
  status: 'ordered' | 'in_progress' | 'completed' | 'cancelled'
  ordered_at?: string | null
  completed_at?: string | null
  notes?: string | null
  items?: LabOrderItem[]
  created_at: string
}

export interface RadiologyOrder {
  id: number
  order_number: string
  patient_id: number
  patient?: Patient
  encounter_id?: number | null
  branch_id: number
  branch?: Branch
  doctor_id?: number | null
  doctor?: User | null
  modality?: string | null
  study_description: string
  status: 'ordered' | 'result_received' | 'completed' | 'cancelled'
  ordered_at?: string | null
  completed_at?: string | null
  report?: string | null
  reported_by?: number | null
  reporter?: User | null
  source?: 'manual' | 'device'
  source_device_id?: number | null
  source_device?: RadiologyDevice | null
  source_message_id?: number | null
  radiology_study_id?: number | null
  study?: RadiologyStudy | null
  result_received_at?: string | null
  created_at: string
}


// Accounting
export interface Account {
  id: number
  code: string
  name_ar: string
  name_en?: string | null
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  parent_id?: number | null
  parent?: Pick<Account, 'id' | 'code' | 'name_ar' | 'name_en'> | null
  is_active: boolean
  notes?: string | null
}

export interface JournalLine {
  id: number
  journal_entry_id: number
  account_id: number
  account?: Account
  debit: number
  credit: number
  description?: string | null
}

export interface JournalEntry {
  id: number
  entry_number: string
  entry_date: string
  description: string
  reference_type?: string | null
  reference_id?: number | null
  status: string
  posted_by?: number | null
  lines?: JournalLine[]
  created_at: string
}


// HR / Inpatient / Insurance contracts / Devices
export interface Employee {
  id: number
  user_id?: number | null
  employee_number: string
  name: string
  department?: string | null
  job_title?: string | null
  basic_salary: number
  commission_percent: number
  hired_on?: string | null
  status: string
}

export interface Ward {
  id: number
  branch_id: number
  branch?: Branch
  code: string
  name_ar: string
  name_en?: string | null
  type: string
}

export interface Bed {
  id: number
  ward_id: number
  ward?: Ward
  code: string
  status: string
}

export interface Admission {
  id: number
  patient_id: number
  patient?: Patient
  bed_id?: number | null
  bed?: Bed
  doctor_id?: number | null
  doctor?: User | null
  status: string
  admitted_at?: string | null
  discharged_at?: string | null
  diagnosis?: string | null
  notes?: string | null
}

export interface InsuranceContract {
  id: number
  insurance_provider_id: number
  provider?: InsuranceProvider
  contract_number: string
  start_date?: string | null
  end_date?: string | null
  patient_share_percent: number
  company_share_percent: number
  terms?: string | null
  status: string
}

export interface InsuranceContractService {
  id: number
  insurance_contract_id: number
  service_code: string
  service_name: string
  price: number
  patient_share_percent?: number | null
  company_share_percent?: number | null
}

export interface LabDevice {
  id: number
  code: string
  name: string
  manufacturer?: string | null
  model?: string | null
  protocol: string
  host?: string | null
  port?: number | null
  status: string
  last_sync_at?: string | null
  tests?: LabTest[]
}


// Services & Radiology studies
export interface Service {
  id: number
  code: string
  name_ar: string
  name_en?: string | null
  category?: string | null
  price: number
  is_active: boolean
}

export interface RadiologyStudy {
  id: number
  code: string
  name_ar: string
  name_en?: string | null
  modality?: string | null
  price: number
  is_active: boolean
}

export interface RadiologyDevice {
  id: number
  code: string
  name: string
  manufacturer?: string | null
  model?: string | null
  protocol: string
  ae_title?: string | null
  host?: string | null
  port?: number | null
  modality?: string | null
  status: string
  last_sync_at?: string | null
  studies?: RadiologyStudy[]
}

export interface RadiologyDeviceMessage {
  id: number
  radiology_device_id: number
  device?: RadiologyDevice
  raw_message: string
  status: string
  message_id?: string | null
  parsed_summary?: string | null
  received_at?: string | null
}


// Deep modules
export interface LabTestParameter {
  id: number
  lab_test_id: number
  code: string
  name_ar: string
  name_en?: string | null
  unit?: string | null
  reference_range?: string | null
  sort_order: number
}

export interface LabDeviceMessage {
  id: number
  lab_device_id: number
  device?: LabDevice
  raw_message: string
  status: string
  parsed_summary?: string | null
  received_at?: string | null
}

export interface Surgery {
  id: number
  patient_id: number
  patient?: Patient
  doctor_id?: number | null
  doctor?: User | null
  procedure_name: string
  scheduled_at?: string | null
  started_at?: string | null
  ended_at?: string | null
  status: string
  notes?: string | null
}

export interface MaternityRecord {
  id: number
  patient_id: number
  patient?: Patient
  doctor_id?: number | null
  doctor?: User | null
  edd?: string | null
  status: string
  notes?: string | null
}

export interface NurseryRecord {
  id: number
  patient_id: number
  patient?: Patient
  bed_id?: number | null
  bed?: Bed
  admitted_at?: string | null
  discharged_at?: string | null
  weight_kg?: number | null
  notes?: string | null
}
