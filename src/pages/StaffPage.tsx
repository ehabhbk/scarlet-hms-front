import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck,
  Building2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  UserX,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { api, getFieldError, parseApiError } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, User } from '@/lib/types'
import { formatDateTime, formatNumber, nameOf } from '@/lib/format'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useLocale } from '@/hooks/useLocale'
import { useMeta } from '@/hooks/useMeta'
import { cn } from '@/lib/utils'

interface StaffFormState {
  name: string
  username: string
  email: string
  phone: string
  password: string
  password_confirmation: string
  locale: string
  theme: string
  branch_id: string
  department_id: string
  job_title: string
  is_active: boolean
  roles: string[]
}

const emptyForm: StaffFormState = {
  name: '',
  username: '',
  email: '',
  phone: '',
  password: '',
  password_confirmation: '',
  locale: 'ar',
  theme: 'system',
  branch_id: '',
  department_id: '',
  job_title: '',
  is_active: true,
  roles: [],
}

function passwordProblem(password: string): boolean {
  return password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)
}

export function StaffPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const { data: meta } = useMeta()

  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search.trim(), 350)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState<StaffFormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, role, activeFilter])

  const { data, isLoading } = useQuery({
    queryKey: ['users', { page, search: debouncedSearch, role, activeFilter }],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<User[]>>('/users', {
        params: {
          page,
          per_page: 15,
          search: debouncedSearch || undefined,
          role: role || undefined,
          is_active: activeFilter === '' ? undefined : activeFilter === 'active' ? 1 : 0,
        },
      })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
    placeholderData: (previous) => previous,
  })

  const roles = meta?.roles ?? []
  const pagination = data?.meta?.pagination

  const departments = useMemo(() => {
    if (!meta) return []
    return form.branch_id
      ? meta.departments.filter((department) => department.branch_id === Number(form.branch_id))
      : meta.departments
  }, [meta, form.branch_id])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, branch_id: '', roles: [] })
    setFormError(null)
    setFieldErrors({})
    setFormOpen(true)
  }

  const openEdit = (user: User) => {
    setEditing(user)
    setForm({
      name: user.name,
      username: user.username,
      email: user.email ?? '',
      phone: user.phone ?? '',
      password: '',
      password_confirmation: '',
      locale: user.locale ?? 'ar',
      theme: user.theme ?? 'system',
      branch_id: user.branch_id ? String(user.branch_id) : '',
      department_id: user.department_id ? String(user.department_id) : '',
      job_title: user.job_title ?? '',
      is_active: user.is_active,
      roles: user.roles?.map((item) => item.name) ?? [],
    })
    setFormError(null)
    setFieldErrors({})
    setFormOpen(true)
  }

  const toggleRole = (name: string) => {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(name)
        ? current.roles.filter((item) => item !== name)
        : [...current.roles, name],
    }))
  }

  const saveMutation = useMutation({
    mutationFn: async (values: StaffFormState) => {
      const payload: Record<string, unknown> = {
        name: values.name.trim(),
        username: values.username.trim(),
        email: values.email.trim() || null,
        phone: values.phone.trim() || null,
        locale: values.locale,
        theme: values.theme,
        branch_id: values.branch_id ? Number(values.branch_id) : null,
        department_id: values.department_id ? Number(values.department_id) : null,
        job_title: values.job_title.trim() || null,
        is_active: values.is_active,
        roles: values.roles,
      }

      if (values.password) {
        payload.password = values.password
        payload.password_confirmation = values.password_confirmation
      }

      if (editing) {
        const { data } = await api.patch<ApiEnvelope<User>>(`/users/${editing.id}`, payload)
        return data.data
      }

      const { data } = await api.post<ApiEnvelope<User>>('/users', payload)
      return data.data
    },
    onSuccess: () => {
      toast.success(editing ? t('staff.updated') : t('staff.created'))
      setFormOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.invalidateQueries({ queryKey: ['meta'] })
    },
    onError: (error) => {
      const parsed = parseApiError(error)
      const mapped: Record<string, string> = {}
      Object.keys(parsed.errors ?? {}).forEach((field) => {
        const message = getFieldError(parsed, field)
        if (message) mapped[field] = message
      })
      setFieldErrors(mapped)
      setFormError(mapped.roles ?? (parsed.message || t('errors.generic')))
      if (!Object.keys(mapped).length) toast.error(parsed.message || t('errors.generic'))
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: async (user: User) => {
      await api.post(`/users/${user.id}/deactivate`)
    },
    onSuccess: () => {
      toast.success(t('staff.deactivated'))
      setDeactivateTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const submit = () => {
    setFormError(null)
    setFieldErrors({})

    if (!form.name.trim() || !form.username.trim()) {
      setFormError(t('errors.validation'))
      return
    }
    if (!editing && !form.password) {
      setFormError(t('validation.required'))
      return
    }
    if (form.password && passwordProblem(form.password)) {
      setFormError(t('validation.passwordStrength'))
      return
    }
    if (form.password !== form.password_confirmation) {
      setFormError(t('staff.passwordConfirmation'))
      return
    }
    if (!form.roles.length) {
      setFormError(t('staff.selectRole'))
      return
    }

    saveMutation.mutate(form)
  }

  return (
    <div>
      <PageHeader
        title={t('staff.title')}
        subtitle={t('staff.subtitle')}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('staff.add')}
          </Button>
        }
      />

      <div className="card mb-4 p-3 sm:p-4">
        <div className="grid gap-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('staff.searchPlaceholder')}
              className="field h-10 ps-9"
              aria-label={t('common.search')}
            />
          </div>
          <Select value={role} onChange={(event) => setRole(event.target.value)} className="h-10">
            <option value="">{t('staff.filterRole')}</option>
            {roles.map((item) => (
              <option key={item.id} value={item.name}>
                {locale === 'ar' ? item.name_ar : item.name_en}
              </option>
            ))}
          </Select>
          <Select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} className="h-10">
            <option value="">{t('common.all')}</option>
            <option value="active">{t('staff.active')}</option>
            <option value="inactive">{t('staff.inactive')}</option>
          </Select>
        </div>
        {pagination ? (
          <p className="mt-2 text-[11px] text-ink-subtle">
            {formatNumber(pagination.total, locale)} {t('staff.title')}
          </p>
        ) : null}
      </div>

      <div className="table-shell">
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : data?.rows.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('staff.name')}</th>
                  <th>{t('staff.role')}</th>
                  <th>{t('staff.branch')} / {t('staff.department')}</th>
                  <th>{t('staff.phone')}</th>
                  <th>{t('staff.lastLogin')}</th>
                  <th>{t('staff.status')}</th>
                  <th className="text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-ink">{user.name}</p>
                          <p className="truncate text-[11px] text-ink-muted">
                            @{user.username}
                            {user.job_title ? ` · ${user.job_title}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(user.roles ?? []).map((item) => (
                          <Badge key={item.id} tone="scarlet">
                            {locale === 'ar' ? item.name_ar : item.name_en}
                          </Badge>
                        ))}
                        {!user.roles?.length ? <span className="text-xs text-ink-subtle">—</span> : null}
                      </div>
                    </td>
                    <td className="text-sm">
                      <p className="font-medium text-ink">{user.branch ? nameOf(user.branch, locale) : '—'}</p>
                      <p className="text-[11px] text-ink-muted">
                        {user.department ? nameOf(user.department, locale) : t('staff.noDepartment')}
                      </p>
                    </td>
                    <td dir="ltr" className="whitespace-nowrap text-start text-sm">
                      {user.phone ?? user.email ?? '—'}
                    </td>
                    <td className="whitespace-nowrap text-xs text-ink-muted">
                      {user.last_login_at ? formatDateTime(user.last_login_at, locale) : t('staff.neverLoggedIn')}
                    </td>
                    <td>
                      <Badge tone={user.is_active ? 'success' : 'neutral'} dot>
                        {user.is_active ? t('staff.active') : t('staff.inactive')}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title={t('common.edit')}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {user.is_active ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeactivateTarget(user)}
                            title={t('staff.deactivate')}
                          >
                            <UserX className="h-4 w-4 text-danger-600" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title={t('staff.noUsers')}
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {t('staff.add')}
              </Button>
            }
          />
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
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('staff.editTitle') : t('staff.createTitle')}
        description={t('staff.subtitle')}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button loading={saveMutation.isPending} onClick={submit}>
              <BadgeCheck className="h-4 w-4" />
              {editing ? t('common.save') : t('staff.add')}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {formError ? (
            <div className="rounded-xl border border-danger-100 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-700">
              {formError}
            </div>
          ) : null}

          <div>
            <p className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
              <UserCog className="h-3.5 w-3.5" />
              {t('staff.accountInfo')}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('staff.name')} required error={fieldErrors.name}>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoFocus />
              </Field>
              <Field label={t('staff.username')} required error={fieldErrors.username}>
                <Input
                  dir="ltr"
                  value={form.username}
                  onChange={(event) => setForm({ ...form, username: event.target.value })}
                />
              </Field>
              <Field label={t('staff.email')} error={fieldErrors.email}>
                <Input
                  dir="ltr"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </Field>
              <Field label={t('staff.phone')} error={fieldErrors.phone}>
                <Input
                  dir="ltr"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </Field>
              <Field
                label={t('staff.password')}
                required={!editing}
                hint={editing ? t('common.optional') : t('staff.passwordHint')}
                error={fieldErrors.password}
              >
                <Input
                  dir="ltr"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
              </Field>
              <Field label={t('staff.passwordConfirmation')} error={fieldErrors.password_confirmation}>
                <Input
                  dir="ltr"
                  type="password"
                  autoComplete="new-password"
                  value={form.password_confirmation}
                  onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })}
                />
              </Field>
              <Field label={t('common.language')}>
                <Select value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value })}>
                  <option value="ar">{t('common.arabic')}</option>
                  <option value="en">{t('common.english')}</option>
                </Select>
              </Field>
              <Field label={t('common.theme')}>
                <Select value={form.theme} onChange={(event) => setForm({ ...form, theme: event.target.value })}>
                  <option value="system">{t('common.system')}</option>
                  <option value="light">{t('common.light')}</option>
                  <option value="dark">{t('common.dark')}</option>
                </Select>
              </Field>
            </div>
          </div>

          <div>
            <p className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
              <Building2 className="h-3.5 w-3.5" />
              {t('staff.workInfo')}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('staff.branch')} error={fieldErrors.branch_id}>
                <Select
                  value={form.branch_id}
                  onChange={(event) =>
                    setForm({ ...form, branch_id: event.target.value, department_id: '' })
                  }
                >
                  <option value="">{t('staff.selectBranch')}</option>
                  {(meta?.branches ?? []).map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {nameOf(branch, locale)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('staff.department')} error={fieldErrors.department_id}>
                <Select
                  value={form.department_id}
                  onChange={(event) => setForm({ ...form, department_id: event.target.value })}
                >
                  <option value="">{t('staff.selectDepartment')}</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {nameOf(department, locale)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('staff.jobTitle')} error={fieldErrors.job_title}>
                <Input
                  value={form.job_title}
                  onChange={(event) => setForm({ ...form, job_title: event.target.value })}
                />
              </Field>
              <Field label={t('staff.status')} hint={t('staff.activeHint')}>
                <label className="flex h-10 items-center gap-3 rounded-xl border border-line bg-surface-muted/60 px-3.5">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                    className="h-4 w-4 rounded border-line-strong text-scarlet-800 focus:ring-scarlet-500"
                  />
                  <span className="text-sm font-medium text-ink">
                    {form.is_active ? t('staff.active') : t('staff.inactive')}
                  </span>
                </label>
              </Field>
            </div>
          </div>

          <div>
            <p className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('staff.roles')} <span className="text-scarlet-600">*</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {roles.map((item) => {
                const selected = form.roles.includes(item.name)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleRole(item.name)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition',
                      selected
                        ? 'border-scarlet-300 bg-scarlet-50/70 ring-1 ring-scarlet-200'
                        : 'border-line bg-surface hover:border-line-strong hover:bg-surface-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        selected ? 'border-scarlet-700 bg-scarlet-800 text-white' : 'border-line-strong bg-surface',
                      )}
                    >
                      {selected ? <BadgeCheck className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {locale === 'ar' ? item.name_ar : item.name_en}
                      </span>
                      <span className="block truncate text-[10px] text-ink-subtle">{item.name}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            {fieldErrors.roles ? (
              <p className="mt-1.5 text-xs font-medium text-danger-600">{fieldErrors.roles}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-4 rounded-xl bg-surface-muted px-4 py-3 text-[11px] text-ink-muted">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {form.email || '—'}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {form.phone || '—'}
            </span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateTarget && deactivateMutation.mutate(deactivateTarget)}
        title={t('staff.deactivate')}
        description={t('staff.deactivateConfirm')}
        confirmLabel={t('staff.deactivate')}
        loading={deactivateMutation.isPending}
      />
    </div>
  )
}
