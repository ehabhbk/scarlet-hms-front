import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FilterX,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, TableSkeleton } from '@/components/ui/PageHeader'
import { usePermission } from '@/hooks/useMeta'
import { api, parseApiError } from '@/lib/api'
import { periodLabel, useFinance } from '@/lib/finance'
import type { ApiEnvelope, ChartAccount, JournalRecord } from '@/lib/types'
import { printReport } from '@/utils/printReport'

interface DraftLine {
  account_id: number | ''
  debit: number
  credit: number
  description: string
}

const emptyLine = (): DraftLine => ({ account_id: '', debit: 0, credit: 0, description: '' })
const today = () => new Date().toISOString().slice(0, 10)

export function JournalEntriesPage() {
  const { money, organization, date, locale } = useFinance()
  const canManage = usePermission('accounting.manage')
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<JournalRecord | null>(null)
  const [form, setForm] = useState({ entry_date: today(), reference: '', description: '' })
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()])

  const accountsQuery = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<{ accounts: ChartAccount[] }>>('/accounting/chart-of-accounts')
      return data.data.accounts
    },
  })

  const entriesQuery = useQuery({
    queryKey: ['journal-entries', search, from, to, page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<JournalRecord[]>>('/journal-entries', {
        params: { per_page: 50, page, search: search || undefined, from: from || undefined, to: to || undefined },
      })
      return { rows: data.data, pagination: data.meta?.pagination }
    },
  })

  const entries = entriesQuery.data?.rows ?? []
  const pagination = entriesQuery.data?.pagination
  const totalPages = Number(pagination?.last_page) || 1
  const totalEntries = Number(pagination?.total) || entries.length

  const totals = useMemo(
    () =>
      entries.reduce(
        (accumulator, entry) => {
          for (const line of entry.lines ?? []) {
            accumulator.debit += Number(line.debit) || 0
            accumulator.credit += Number(line.credit) || 0
          }
          return accumulator
        },
        { debit: 0, credit: 0 },
      ),
    [entries],
  )

  const resetFilters = () => {
    setSearch('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const resetForm = () => {
    setEditing(null)
    setForm({ entry_date: today(), reference: '', description: '' })
    setLines([emptyLine(), emptyLine()])
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        entry_date: form.entry_date,
        reference: form.reference || null,
        description: form.description || null,
        lines: lines.map((line) => ({
          account_id: Number(line.account_id),
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          description: line.description || null,
        })),
      }
      if (editing) await api.put(`/journal-entries/${editing.id}`, payload)
      else await api.post('/journal-entries', payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      void queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
      void queryClient.invalidateQueries({ queryKey: ['trial-balance'] })
      setShowModal(false)
      resetForm()
      toast.success(editing ? 'تم تحديث القيد' : 'تم تسجيل القيد')
    },
    onError: (error) => toast.error(parseApiError(error).message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => api.delete(`/journal-entries/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      void queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
      toast.success('تم حذف القيد')
    },
    onError: (error) => toast.error(parseApiError(error).message),
  })

  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0)
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.001

  const addLine = () => setLines((previous) => [...previous, emptyLine()])
  const removeLine = (index: number) => setLines((previous) => previous.filter((_, itemIndex) => itemIndex !== index))
  const updateLine = (index: number, patch: Partial<DraftLine>) =>
    setLines((previous) => previous.map((line, itemIndex) => (itemIndex === index ? { ...line, ...patch } : line)))

  const openEdit = (entry: JournalRecord) => {
    setEditing(entry)
    setForm({
      entry_date: String(entry.entry_date || '').slice(0, 10),
      reference: entry.reference || '',
      description: entry.description || '',
    })
    setLines(
      (entry.lines ?? []).map((line) => ({
        account_id: line.account_id,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        description: line.description || '',
      })),
    )
    setShowModal(true)
  }

  const handlePrint = () => {
    const range = periodLabel(from, to)
    const rows = entries.flatMap((entry) => {
      const entryLines = entry.lines ?? []
      if (entryLines.length === 0) {
        return [[entry.entry_number, date(entry.entry_date), '-', entry.description || entry.reference || '-', '', '']]
      }
      return entryLines.map((line, index) => [
        index === 0 ? entry.entry_number : '',
        index === 0 ? date(entry.entry_date) : '',
        `${line.account?.code || ''} - ${line.account?.name || ''}`,
        line.description || (index === 0 ? entry.description || entry.reference || '' : ''),
        Number(line.debit) ? money(line.debit) : '',
        Number(line.credit) ? money(line.credit) : '',
      ])
    })

    printReport({
      title: 'قيود اليومية',
      subtitle: `الفترة: ${range}${search ? ` — بحث: ${search}` : ''}`,
      organization,
      locale,
      meta: [
        { label: 'الفترة', value: range },
        { label: 'عدد القيود', value: String(totalEntries) },
        { label: 'العملة', value: locale === 'ar' ? 'الجنيه السوداني' : 'Sudanese pound' },
        { label: 'تاريخ الإصدار', value: date(new Date()) },
        { label: 'بحث', value: search || 'بدون' },
      ],
      kpis: [
        { label: 'إجمالي المدين', value: money(totals.debit), tone: 'blue' },
        { label: 'إجمالي الدائن', value: money(totals.credit), tone: 'green' },
        { label: 'عدد القيود', value: String(totalEntries) },
        {
          label: 'حالة التوازن',
          value: balanced ? 'متوازن' : 'ليست متوازنة',
          tone: balanced ? 'green' : 'red',
        },
      ],
      sections: [
        {
          title: 'تفاصيل القيود',
          columns: [
            { label: 'رقم القيد', nowrap: true },
            { label: 'التاريخ', nowrap: true },
            { label: 'الحساب' },
            { label: 'البيان' },
            { label: 'مدين', align: 'left', nowrap: true },
            { label: 'دائن', align: 'left', nowrap: true },
          ],
          rows,
          footer: ['الإجمالي', '', '', '', money(totals.debit), money(totals.credit)],
          emptyText: 'لا توجد قيود مطابقة للبحث',
        },
      ],
      summaryTitle: 'ملخص القيود',
      summary: [
        { label: 'إجمالي المدين', value: money(totals.debit) },
        { label: 'إجمالي الدائن', value: money(totals.credit) },
        {
          label: 'الفرق',
          value: money(totals.debit - totals.credit),
          tone: balanced ? 'green' : 'red',
        },
      ],
      signatures: ['المحاسب', 'المدير المالي'],
      footerNote: 'قيود اليومية',
    })
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!balanced) {
      toast.error('القيد غير متوازن؛ يجب تساوي المدين والدائن')
      return
    }
    saveMutation.mutate()
  }

  return (
    <div>
      <PageHeader
        title="قيود اليومية"
        subtitle="تسجيل وعرض القيود المحاسبية"
        actions={
          <>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              تصدير PDF
            </Button>
            {canManage ? (
              <Button
                onClick={() => {
                  resetForm()
                  setShowModal(true)
                }}
              >
                <Plus className="h-4 w-4" />
                قيد جديد
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_11rem_11rem_auto] md:items-end">
          <Field label="بحث برقم القيد أو البيان أو المرجع">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="مثال: JE-000001 أو راتب"
            />
          </Field>
          <Field label="من تاريخ">
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value)
                setPage(1)
              }}
            />
          </Field>
          <Field label="إلى تاريخ">
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value)
                setPage(1)
              }}
            />
          </Field>
          <Button variant="secondary" onClick={resetFilters} className="h-10">
            <FilterX className="h-4 w-4" />
            مسح الفلاتر
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {from || to ? `${from || 'البداية'} ← ${to || today()}` : 'كل الفترات'}
          </span>
          <span>
            إجمالي القيود: <b className="text-ink">{String(totalEntries)}</b>
          </span>
          <span>
            مدين الصفحة: <b className="text-ink">{money(totals.debit)}</b>
          </span>
          <span>
            دائن الصفحة: <b className="text-ink">{money(totals.credit)}</b>
          </span>
        </div>
      </Card>

      <Card className="mt-5 overflow-hidden">
        {entriesQuery.isLoading ? (
          <TableSkeleton rows={8} />
        ) : entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">لا توجد قيود مطابقة للبحث أو الفترة المحددة.</p>
        ) : (
          <div className="table-shell border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>القيد</th>
                  <th>الحساب</th>
                  <th>البيان</th>
                  <th>مدين</th>
                  <th>دائن</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const entryLines = entry.lines ?? []
                  const rowCount = Math.max(entryLines.length, 1)
                  return Array.from({ length: rowCount }).map((_, index) => {
                    const line = entryLines[index]
                    return (
                      <tr key={`${entry.id}-${line?.id ?? index}`}>
                        {index === 0 ? (
                          <td rowSpan={rowCount} className="align-top">
                            <span className="rounded-md bg-scarlet-50 px-2 py-0.5 font-mono text-xs font-bold text-scarlet-700">
                              {entry.entry_number}
                            </span>
                            <p className="mt-1 text-[11px] text-ink-muted">{date(entry.entry_date)}</p>
                            {entry.reference ? (
                              <p className="text-[11px] text-ink-subtle">مرجع: {entry.reference}</p>
                            ) : null}
                            {canManage ? (
                              <div className="mt-2 flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEdit(entry)}
                                  className="rounded p-1.5 text-info-700 hover:bg-info-50"
                                  title="تعديل"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm('حذف القيد؟')) deleteMutation.mutate(entry.id)
                                  }}
                                  className="rounded p-1.5 text-danger-600 hover:bg-danger-50"
                                  title="حذف"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : null}
                          </td>
                        ) : null}
                        <td>
                          {line ? (
                            <>
                              <span className="font-mono text-xs text-ink-subtle">{line.account?.code}</span>{' '}
                              {line.account?.name || line.account_name}
                            </>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="text-xs text-ink-muted">
                          {line?.description || (index === 0 ? entry.description || '-' : '')}
                        </td>
                        <td className="whitespace-nowrap font-semibold tabular-nums text-info-700">
                          {line && Number(line.debit) ? money(line.debit) : '—'}
                        </td>
                        <td className="whitespace-nowrap font-semibold tabular-nums text-success-700">
                          {line && Number(line.credit) ? money(line.credit) : '—'}
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
              <tfoot className="font-bold">
                <tr>
                  <td colSpan={3}>إجمالي الصفحة</td>
                  <td className="tabular-nums">{money(totals.debit)}</td>
                  <td className="tabular-nums">{money(totals.credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
            <span className="text-xs text-ink-muted">
              صفحة {page} من {totalPages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <ChevronRight className="h-4 w-4" />
                السابق
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          resetForm()
        }}
        title={editing ? `تعديل قيد ${editing.entry_number}` : 'قيد جديد'}
        size="xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="التاريخ" required>
              <Input
                type="date"
                value={form.entry_date}
                onChange={(event) => setForm({ ...form, entry_date: event.target.value })}
                required
              />
            </Field>
            <Field label="المرجع">
              <Input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} />
            </Field>
            <Field label="الوصف">
              <Input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_6rem_6rem_auto] gap-2 px-1 text-xs font-semibold text-ink-muted">
              <span>الحساب</span>
              <span>مدين</span>
              <span>دائن</span>
              <span className="w-8" />
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-[1fr_6rem_6rem_auto] items-center gap-2">
                <select
                  value={line.account_id}
                  onChange={(event) =>
                    updateLine(index, { account_id: event.target.value ? Number(event.target.value) : '' })
                  }
                  className="field"
                  required
                >
                  <option value="">اختر حساباً</option>
                  {(accountsQuery.data ?? []).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.debit}
                  onChange={(event) => updateLine(index, { debit: Number(event.target.value) || 0 })}
                  className="field"
                  placeholder="مدين"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.credit}
                  onChange={(event) => updateLine(index, { credit: Number(event.target.value) || 0 })}
                  className="field"
                  placeholder="دائن"
                />
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  className="rounded-lg p-2 text-danger-600 hover:bg-danger-50"
                  title="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button type="button" size="sm" variant="secondary" onClick={addLine}>
              <Plus className="h-4 w-4" />
              إضافة سطر
            </Button>
          </div>

          <div className="rounded-xl bg-surface-muted/70 px-3 py-2 text-sm">
            <span className={balanced ? 'font-semibold text-success-700' : 'font-semibold text-danger-600'}>
              مدين: {money(totalDebit)} | دائن: {money(totalCredit)} {balanced ? '✓ متوازن' : '✗ غير متوازن'}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              إلغاء
            </Button>
            <Button type="submit" loading={saveMutation.isPending} disabled={!balanced}>
              حفظ
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
