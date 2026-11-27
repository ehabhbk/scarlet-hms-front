import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, TableSkeleton } from '@/components/ui/PageHeader'
import { api, parseApiError } from '@/lib/api'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ORDER, accountTypeLabel, useFinance } from '@/lib/finance'
import type { AccountType, ApiEnvelope, ChartAccount } from '@/lib/types'
import { printReport } from '@/utils/printReport'
import { usePermission } from '@/hooks/useMeta'

interface AccountForm {
  code: string
  name: string
  type: AccountType
  parent_id: string
  opening_balance: number
  is_active: boolean
  notes: string
}

const emptyForm: AccountForm = {
  code: '',
  name: '',
  type: 'asset',
  parent_id: '',
  opening_balance: 0,
  is_active: true,
  notes: '',
}

const TYPE_COLORS: Record<AccountType, string> = {
  asset: 'text-blue-600 dark:text-blue-400',
  liability: 'text-red-600 dark:text-red-400',
  equity: 'text-purple-600 dark:text-purple-400',
  revenue: 'text-green-600 dark:text-green-400',
  expense: 'text-amber-600 dark:text-amber-400',
}

export function ChartOfAccountsPage() {
  const { money, organization, date, locale } = useFinance()
  const canManage = usePermission('accounting.manage')
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ChartAccount | null>(null)
  const [form, setForm] = useState<AccountForm>(emptyForm)
  const [expandedOverrides, setExpandedOverrides] = useState<{ expanded: Set<number>; collapsed: Set<number> }>({
    expanded: new Set(),
    collapsed: new Set(),
  })

  const accountsQuery = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<{ accounts: ChartAccount[] }>>('/accounting/chart-of-accounts')
      return data.data.accounts
    },
  })

  const accounts = accountsQuery.data ?? []
  const parentIds = useMemo(
    () => new Set(accounts.flatMap((account) => (account.parent_id == null ? [] : [account.parent_id]))),
    [accounts],
  )
  const expanded = useMemo(
    () =>
      new Set([
        ...[...parentIds].filter((id) => !expandedOverrides.collapsed.has(id)),
        ...expandedOverrides.expanded,
      ]),
    [parentIds, expandedOverrides],
  )

  const saveMutation = useMutation({
    mutationFn: async (payload: AccountForm) => {
      const body = {
        code: payload.code,
        name_ar: payload.name,
        name_en: null,
        type: payload.type,
        parent_id: payload.parent_id ? Number(payload.parent_id) : null,
        opening_balance: Number(payload.opening_balance) || 0,
        is_active: payload.is_active,
        notes: payload.notes || null,
      }
      if (editing) await api.put(`/accounts/${editing.id}`, body)
      else await api.post('/accounts', body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
      void queryClient.invalidateQueries({ queryKey: ['trial-balance'] })
      setShowModal(false)
      setEditing(null)
      setForm(emptyForm)
      toast.success(editing ? 'تم تحديث الحساب' : 'تمت إضافة الحساب')
    },
    onError: (error) => toast.error(parseApiError(error).message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
      toast.success('تم حذف الحساب')
    },
    onError: (error) => toast.error(parseApiError(error).message),
  })

  const childrenOf = (parentId: number | null) =>
    accounts.filter((account) => (account.parent_id ?? null) === parentId)

  const toggle = (id: number) => {
    setExpandedOverrides((previous) => {
      const nextExpanded = new Set(previous.expanded)
      const nextCollapsed = new Set(previous.collapsed)
      if (expanded.has(id)) {
        nextExpanded.delete(id)
        if (parentIds.has(id)) nextCollapsed.add(id)
      } else {
        nextCollapsed.delete(id)
        nextExpanded.add(id)
      }
      return { expanded: nextExpanded, collapsed: nextCollapsed }
    })
  }

  const openNew = (parentId: number | null = null) => {
    setEditing(null)
    setForm({ ...emptyForm, parent_id: parentId ? String(parentId) : '' })
    setShowModal(true)
  }

  const openEdit = (account: ChartAccount) => {
    setEditing(account)
    setForm({
      code: account.code,
      name: account.name_ar || account.name_en || account.name,
      type: account.type,
      parent_id: account.parent_id ? String(account.parent_id) : '',
      opening_balance: Number(account.opening_balance) || 0,
      is_active: account.is_active,
      notes: account.notes || '',
    })
    setShowModal(true)
  }

  const renderNode = (account: ChartAccount, depth = 0) => {
    const kids = childrenOf(account.id)
    const hasKids = kids.length > 0
    const isExpanded = expanded.has(account.id)

    return (
      <div key={account.id}>
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3 py-2"
          style={{ marginInlineStart: depth * 20 }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {hasKids ? (
              <button type="button" onClick={() => toggle(account.id)} className="text-ink-subtle">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className="font-mono text-xs text-ink-subtle">{account.code}</span>
            <span className={`truncate font-semibold ${TYPE_COLORS[account.type] ?? ''}`}>{account.name}</span>
            <span className="text-xs text-ink-subtle">({accountTypeLabel(account.type)})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums text-ink">{money(account.balance)}</span>
            {canManage ? (
              <>
                <button
                  type="button"
                  onClick={() => openEdit(account)}
                  className="rounded-lg p-1.5 text-info-700 hover:bg-info-50"
                  title="تعديل"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`حذف ${account.name}؟`)) deleteMutation.mutate(account.id)
                  }}
                  className="rounded-lg p-1.5 text-danger-600 hover:bg-danger-50"
                  title="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openNew(account.id)}
                  className="rounded-lg p-1.5 text-success-700 hover:bg-success-50"
                  title="إضافة فرعي"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>
        </div>
        {hasKids && isExpanded ? (
          <div className="mt-1 space-y-1">{kids.map((child) => renderNode(child, depth + 1))}</div>
        ) : null}
      </div>
    )
  }

  const handlePrint = () => {
    const sorted = [...accounts].sort((a, b) => String(a.code).localeCompare(String(b.code)))
    const rows = sorted.map((account) => [
      account.code,
      account.name,
      accountTypeLabel(account.type),
      money(account.balance),
    ])
    const totalsByType = ACCOUNT_TYPE_ORDER.map((type) => ({
      type,
      total: sorted
        .filter((account) => account.type === type)
        .reduce((sum, account) => sum + (Number(account.balance) || 0), 0),
    }))

    printReport({
      title: 'شجرة الحسابات',
      subtitle: 'دليل الحسابات والأرصدة الحالية',
      organization,
      locale,
      meta: [
        { label: 'عدد الحسابات', value: String(sorted.length) },
        { label: 'العملة', value: locale === 'ar' ? 'الجنيه السوداني' : 'Sudanese pound' },
        { label: 'تاريخ الإصدار', value: date(new Date()) },
      ],
      kpis: totalsByType.map((item) => ({
        label: `إجمالي ${ACCOUNT_TYPE_LABELS[item.type]}`,
        value: money(item.total),
        tone: item.type === 'asset' ? 'blue' : item.type === 'liability' || item.type === 'expense' ? 'red' : 'green',
      })),
      sections: [
        {
          title: 'دليل الحسابات',
          columns: [
            { label: 'الرمز', nowrap: true },
            { label: 'اسم الحساب' },
            { label: 'النوع', nowrap: true },
            { label: 'الرصيد', align: 'left', nowrap: true },
          ],
          rows,
          emptyText: 'لا توجد حسابات مسجلة',
        },
      ],
      summaryTitle: 'ملخص الأرصدة حسب النوع',
      summary: totalsByType.map((item) => ({
        label: `إجمالي ${ACCOUNT_TYPE_LABELS[item.type]}`,
        value: money(item.total),
      })),
      signatures: ['المحاسب', 'المدير المالي'],
      footerNote: 'شجرة الحسابات',
    })
  }

  return (
    <div>
      <PageHeader
        title="شجرة الحسابات"
        subtitle="دليل الحسابات والأرصدة"
        actions={
          <>
            <Button variant="outline" onClick={handlePrint} disabled={accounts.length === 0}>
              <Printer className="h-4 w-4" />
              تصدير PDF
            </Button>
            {canManage ? (
              <Button onClick={() => openNew(null)}>
                <Plus className="h-4 w-4" />
                إضافة حساب
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="p-5">
        {accountsQuery.isLoading ? (
          <TableSkeleton rows={8} />
        ) : accounts.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">لا توجد حسابات. أضف حساباً أو أعد تشغيل البذور.</p>
        ) : (
          <div className="space-y-2">{childrenOf(null).map((account) => renderNode(account, 0))}</div>
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          setEditing(null)
          setForm(emptyForm)
        }}
        title={editing ? 'تعديل حساب' : 'إضافة حساب'}
        size="lg"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            saveMutation.mutate(form)
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="رمز الحساب" required>
              <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
            </Field>
            <Field label="اسم الحساب" required>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </Field>
            <Field label="النوع" required>
              <Select
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as AccountType })}
              >
                {ACCOUNT_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {ACCOUNT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الحساب الأب">
              <Select
                value={form.parent_id}
                onChange={(event) => setForm({ ...form, parent_id: event.target.value })}
              >
                <option value="">بدون (جذر)</option>
                {accounts
                  .filter((account) => account.id !== editing?.id)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="الرصيد الافتتاحي">
              <Input
                type="number"
                step="0.01"
                value={form.opening_balance}
                onChange={(event) => setForm({ ...form, opening_balance: Number(event.target.value) || 0 })}
              />
            </Field>
            <Field label="الحالة">
              <Select
                value={form.is_active ? 'active' : 'inactive'}
                onChange={(event) => setForm({ ...form, is_active: event.target.value === 'active' })}
              >
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
              </Select>
            </Field>
            <Field label="ملاحظات" className="sm:col-span-2">
              <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              إلغاء
            </Button>
            <Button type="submit" loading={saveMutation.isPending}>
              {editing ? 'تحديث' : 'إضافة'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
