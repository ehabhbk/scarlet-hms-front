import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Printer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, TableSkeleton } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { usePermission } from '@/hooks/useMeta'
import { api, parseApiError } from '@/lib/api'
import { useFinance } from '@/lib/finance'
import { todayInput } from '@/lib/format'
import type { ApiEnvelope, ApiMeta, ChartAccount, FinanceExpense } from '@/lib/types'
import { printReport } from '@/utils/printReport'

const PAYMENT_METHODS = [
  { value: 'cash', ar: 'نقداً', en: 'Cash' },
  { value: 'bank', ar: 'بنك', en: 'Bank' },
  { value: 'card', ar: 'بطاقة', en: 'Card' },
]

export function ExpensesPage() {
  const { money, organization, date, locale } = useFinance()
  const canManage = usePermission('accounting.manage')
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const expensesQuery = useQuery({
    queryKey: ['expenses', page, search, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      if (search) params.set('search', search)
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      const { data } = await api.get<ApiEnvelope<FinanceExpense[]>>(`/expenses?${params.toString()}`)
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
  })

  const accountsQuery = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<{ accounts: ChartAccount[] }>>('/accounting/chart-of-accounts')
      return data.data.accounts
    },
  })

  const expenses = expensesQuery.data?.rows ?? []
  const pagination = expensesQuery.data?.meta?.pagination
  const total = pagination?.total ?? expenses.length

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    void queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
    void queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
    void queryClient.invalidateQueries({ queryKey: ['trial-balance'] })
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      invalidate()
      toast.success('تم حذف المصروف')
    },
    onError: (error) => toast.error(parseApiError(error).message),
  })

  const handlePrint = () => {
    printReport({
      title: 'تقرير المصروفات',
      organization,
      locale,
      meta: [
        { label: 'الفترة', value: `${fromDate || 'البداية'} — ${toDate || todayInput()}` },
        { label: 'البحث', value: search || 'الكل' },
        { label: 'عدد المصروفات', value: String(total) },
      ],
      kpis: [
        { label: 'إجمالي المصروفات', value: money(expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)), tone: 'red' },
      ],
      sections: [
        {
          title: 'المصروفات',
          columns: [
            { label: 'الفئة' },
            { label: 'المبلغ' },
            { label: 'الحساب' },
            { label: 'التاريخ' },
            { label: 'الوصف' },
            { label: 'معتمد' },
          ],
          rows: expenses.map((expense) => [
            expense.category,
            money(expense.amount),
            expense.account?.name_ar || expense.account?.name_en || '-',
            date(expense.expense_date),
            expense.description || '-',
            expense.is_approved ? 'نعم' : 'لا',
          ]),
        },
      ],
      generatedAt: new Date(),
    })
  }

  return (
    <div>
      <PageHeader
        title="المصروفات"
        subtitle="تسجيل المصروفات وعرضها"
        actions={
          <>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              طباعة / PDF
            </Button>
            {canManage ? (
              <Button onClick={() => setShowModal(true)}>
                <Plus className="h-4 w-4" />
                إضافة مصروف
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
          <Field label="بحث بالوصف/الفئة">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </Field>
          <Field label="من تاريخ">
            <Input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value)
                setPage(1)
              }}
            />
          </Field>
          <Field label="إلى تاريخ">
            <Input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value)
                setPage(1)
              }}
            />
          </Field>
        </div>

        {expensesQuery.isLoading ? (
          <TableSkeleton rows={6} />
        ) : (
          <div className="table-shell border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الفئة</th>
                  <th>المبلغ</th>
                  <th>الحساب</th>
                  <th>التاريخ</th>
                  <th>الوصف</th>
                  <th>معتمد</th>
                  {canManage ? <th>الإجراءات</th> : null}
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 7 : 6} className="py-10 text-center text-ink-muted">
                      لا توجد مصروفات
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="font-semibold">{expense.category}</td>
                      <td className="whitespace-nowrap font-bold tabular-nums">{money(expense.amount)}</td>
                      <td>{expense.account?.name_ar || expense.account?.name_en || '-'}</td>
                      <td className="whitespace-nowrap">{date(expense.expense_date)}</td>
                      <td className="text-xs text-ink-muted">{expense.description || '-'}</td>
                      <td>{expense.is_approved ? 'نعم' : 'لا'}</td>
                      {canManage ? (
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('حذف المصروف؟')) deleteMutation.mutate(expense.id)
                            }}
                            className="rounded-lg p-1.5 text-danger-600 hover:bg-danger-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {pagination ? (
          <Pagination
            page={pagination.current_page}
            lastPage={pagination.last_page}
            total={pagination.total}
            from={pagination.from}
            to={pagination.to}
            onChange={setPage}
          />
        ) : null}
      </Card>

      {canManage ? (
        <ExpenseFormModal
          open={showModal}
          onClose={() => setShowModal(false)}
          accounts={(accountsQuery.data ?? []).filter((account) => account.type === 'expense' && account.is_active)}
          onSuccess={() => {
            setShowModal(false)
            invalidate()
            toast.success('تم تسجيل المصروف')
          }}
        />
      ) : null}
    </div>
  )
}

function ExpenseFormModal({
  open,
  onClose,
  accounts,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  accounts: ChartAccount[]
  onSuccess: () => void
}) {
  const { locale } = useFinance()
  const [form, setForm] = useState({
    category: '',
    amount: '',
    account_id: '',
    expense_date: todayInput(),
    description: '',
    payment_method: 'cash',
  })

  const mutation = useMutation({
    mutationFn: async () =>
      api.post('/expenses', {
        ...form,
        amount: Number(form.amount),
        account_id: Number(form.account_id),
      }),
    onSuccess,
    onError: (error) => toast.error(parseApiError(error).message),
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <Modal open={open} onClose={onClose} title="إضافة مصروف" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="الفئة" required>
          <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="المبلغ" required>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              required
            />
          </Field>
          <Field label="التاريخ" required>
            <Input
              type="date"
              value={form.expense_date}
              onChange={(event) => setForm({ ...form, expense_date: event.target.value })}
              required
            />
          </Field>
        </div>
        <Field label="حساب المصروف" required>
          <Select
            value={form.account_id}
            onChange={(event) => setForm({ ...form, account_id: event.target.value })}
            required
          >
            <option value="">اختر حساب المصروف</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="طريقة الدفع" required>
          <Select
            value={form.payment_method}
            onChange={(event) => setForm({ ...form, payment_method: event.target.value })}
            required
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method[locale]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الوصف">
          <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            حفظ
          </Button>
        </div>
      </form>
    </Modal>
  )
}
