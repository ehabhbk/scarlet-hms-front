import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, Employee, User } from '@/lib/types'

type EmployeeForm = {
  employee_number: string
  name: string
  department: string
  job_title: string
  basic_salary: string
  commission_percent: string
  hired_on: string
  status: string
  user_id: string
}

const emptyForm: EmployeeForm = {
  employee_number: '',
  name: '',
  department: '',
  job_title: '',
  basic_salary: '0',
  commission_percent: '0',
  hired_on: '',
  status: 'active',
  user_id: '',
}

export function StaffSettings() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState<EmployeeForm>(emptyForm)

  const employeesQuery = useQuery({
    queryKey: ['employees', 'settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Employee[]>>('/employees', { params: { per_page: 100 } })
      return data.data
    },
  })

  const usersQuery = useQuery({
    queryKey: ['users', 'settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<User[]>>('/users', { params: { per_page: 100 } })
      return data.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        employee_number: form.employee_number,
        name: form.name,
        department: form.department || null,
        job_title: form.job_title || null,
        basic_salary: Number(form.basic_salary || 0),
        commission_percent: Number(form.commission_percent || 0),
        hired_on: form.hired_on || null,
        status: form.status,
        user_id: form.user_id ? Number(form.user_id) : null,
      }
      if (editing) await api.patch(`/employees/${editing.id}`, payload)
      else await api.post('/employees', payload)
    },
    onSuccess: () => {
      toast.success('تم الحفظ بنجاح')
      setOpen(false)
      setEditing(null)
      setForm(emptyForm)
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذر الحفظ'),
  })

  const toggleMutation = useMutation({
    mutationFn: async (employee: Employee) => {
      await api.patch(`/employees/${employee.id}`, { status: employee.status === 'active' ? 'inactive' : 'active' })
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['employees'] }),
  })

  const rows = employeesQuery.data ?? []
  const users = usersQuery.data ?? []

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true) }}>
          <Plus className="h-4 w-4" /> إضافة طبيب/ممرض
        </Button>
      </div>
      <div className="table-shell">
        {employeesQuery.isLoading ? <TableSkeleton rows={6} /> : rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th><th>القسم</th><th>المسمى الوظيفي</th><th>الراتب</th>
                <th>النسبة %</th><th>الحالة</th><th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((employee) => (
                <tr key={employee.id}>
                  <td className="font-semibold">{employee.name}</td>
                  <td>{employee.department ?? '—'}</td>
                  <td>{employee.job_title ?? '—'}</td>
                  <td>{employee.basic_salary}</td>
                  <td>{employee.commission_percent}%</td>
                  <td>
                    <Badge tone={employee.status === 'active' ? 'success' : 'neutral'} dot>
                      {employee.status === 'active' ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </td>
                  <td className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditing(employee)
                      setForm({
                        employee_number: employee.employee_number,
                        name: employee.name,
                        department: employee.department ?? '',
                        job_title: employee.job_title ?? '',
                        basic_salary: String(employee.basic_salary),
                        commission_percent: String(employee.commission_percent),
                        hired_on: employee.hired_on ?? '',
                        status: employee.status,
                        user_id: employee.user_id ? String(employee.user_id) : '',
                      })
                      setOpen(true)
                    }}>تعديل</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate(employee)}>
                      {employee.status === 'active' ? 'إلغاء النشاط' : 'تفعيل'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={UserCog} title="لا يوجد موظفون" />}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'تعديل بيانات الموظف' : 'إضافة طبيب/ممرض'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>حفظ</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="رقم الموظف" required>
            <Input value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} />
          </Field>
          <Field label="الاسم" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="القسم">
            <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </Field>
          <Field label="المسمى الوظيفي">
            <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} placeholder="طبيب / ممرضة / ميترون ..." />
          </Field>
          <Field label="الراتب الأساسي">
            <Input type="number" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} />
          </Field>
          <Field label="نسبة العمولة %">
            <Input type="number" min="0" max="100" value={form.commission_percent} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} />
          </Field>
          <Field label="تاريخ التعيين">
            <Input type="date" value={form.hired_on} onChange={(e) => setForm({ ...form, hired_on: e.target.value })} />
          </Field>
          <Field label="حساب المستخدم">
            <Select value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
              <option value="">بدون</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </Select>
          </Field>
          <Field label="الحالة">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
