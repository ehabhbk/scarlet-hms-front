import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCheck,
  KeyRound,
  Lock,
  Pencil,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, Permission, Role } from '@/lib/types'
import { formatNumber } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'
import { useMeta } from '@/hooks/useMeta'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'

const moduleLabels: Record<string, { ar: string; en: string }> = {
  dashboard: { ar: 'لوحة التحكم', en: 'Dashboard' },
  patients: { ar: 'المرضى', en: 'Patients' },
  appointments: { ar: 'المواعيد', en: 'Appointments' },
  queues: { ar: 'الطوابير', en: 'Queues' },
  encounters: { ar: 'الزيارات', en: 'Encounters' },
  vitals: { ar: 'العلامات الحيوية', en: 'Vitals' },
  diagnoses: { ar: 'التشخيصات', en: 'Diagnoses' },
  clinical_notes: { ar: 'الملاحظات السريرية', en: 'Clinical notes' },
  prescriptions: { ar: 'الوصفات', en: 'Prescriptions' },
  laboratory: { ar: 'المختبر', en: 'Laboratory' },
  radiology: { ar: 'الأشعة', en: 'Radiology' },
  billing: { ar: 'الفواتير', en: 'Billing' },
  payments: { ar: 'المدفوعات', en: 'Payments' },
  insurance: { ar: 'التأمين', en: 'Insurance' },
  users: { ar: 'المستخدمون', en: 'Users' },
  roles: { ar: 'الأدوار', en: 'Roles' },
  settings: { ar: 'الإعدادات', en: 'Settings' },
  audit: { ar: 'التدقيق', en: 'Audit' },
  reports: { ar: 'التقارير', en: 'Reports' },
}

function moduleLabel(module: string, locale: string): string {
  return moduleLabels[module] ? (locale === 'ar' ? moduleLabels[module].ar : moduleLabels[module].en) : module
}

export function RolesPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const { data: meta } = useMeta()
  const refreshUser = useAuthStore((state) => state.refreshUser)

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Role | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  const { data: roles, isLoading, isError } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Role[]>>('/roles')
      return data.data
    },
  })

  const permissions = meta?.permissions ?? []

  const grouped = useMemo(() => {
    const groups = new Map<string, Permission[]>()
    permissions.forEach((permission) => {
      const list = groups.get(permission.module) ?? []
      list.push(permission)
      groups.set(permission.module, list)
    })
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [permissions])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!roles || !term) return roles ?? []
    return roles.filter((role) =>
      [role.name, role.name_ar, role.name_en, role.display_name ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [roles, search])

  const openEditor = (role: Role) => {
    setEditing(role)
    setSelected((role.permissions ?? []).map((permission) => permission.name))
  }

  const closeEditor = () => {
    setEditing(null)
    setSelected([])
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: string[]) => {
      if (!editing) return
      const { data } = await api.put<ApiEnvelope<Role>>(`/roles/${editing.id}/permissions`, {
        permissions: payload,
      })
      return data.data
    },
    onSuccess: () => {
      toast.success(t('roles.permissionSaved'))
      closeEditor()
      void queryClient.invalidateQueries({ queryKey: ['roles'] })
      void queryClient.invalidateQueries({ queryKey: ['meta'] })
      void refreshUser().catch(() => undefined)
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const toggle = (name: string) => {
    setSelected((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    )
  }

  const toggleModule = (modulePermissions: Permission[]) => {
    const names = modulePermissions.map((permission) => permission.name)
    const allSelected = names.every((name) => selected.includes(name))
    setSelected((current) =>
      allSelected ? current.filter((name) => !names.includes(name)) : Array.from(new Set([...current, ...names])),
    )
  }

  const locked = editing?.name === 'super_admin'

  return (
    <div>
      <PageHeader
        title={t('roles.title')}
        subtitle={t('roles.subtitle')}
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('common.search')}
              className="field h-10 w-64 ps-9"
              aria-label={t('common.search')}
            />
          </div>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card p-5">
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton mt-3 h-3 w-2/3" />
              <div className="skeleton mt-5 h-8 w-full" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="card">
          <EmptyState icon={ShieldCheck} title={t('errors.generic')} description={t('common.retry')} />
        </div>
      ) : filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((role) => {
            const assigned = role.permissions?.length ?? role.permissions_count ?? 0
            const isSystem = role.is_system || role.name === 'super_admin'

            return (
              <div key={role.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset',
                        isSystem
                          ? 'bg-scarlet-50 text-scarlet-700 ring-scarlet-100'
                          : 'bg-surface-sunken text-ink-muted ring-line',
                      )}
                    >
                      {isSystem ? <ShieldCheck className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">
                        {locale === 'ar' ? role.name_ar : role.name_en}
                      </p>
                      <p className="truncate font-mono text-[10px] text-ink-subtle">{role.name}</p>
                    </div>
                  </div>
                  {isSystem ? <Badge tone="scarlet">{t('roles.superAdminLocked').split(' ')[0]}</Badge> : null}
                </div>

                {role.description ? (
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-ink-muted">{role.description}</p>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-surface-muted px-3 py-2">
                    <p className="text-[10px] font-semibold text-ink-subtle">{t('roles.permissionsCount')}</p>
                    <p className="mt-0.5 text-lg font-extrabold text-ink">
                      {formatNumber(assigned, locale)}
                      <span className="text-xs font-medium text-ink-subtle"> / {permissions.length || '—'}</span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-surface-muted px-3 py-2">
                    <p className="text-[10px] font-semibold text-ink-subtle">{t('roles.usersCount')}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-lg font-extrabold text-ink">
                      <Users className="h-3.5 w-3.5 text-ink-subtle" />
                      {formatNumber(role.users_count ?? 0, locale)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  <span className="text-[10px] text-ink-subtle">
                    {isSystem ? t('roles.superAdminLocked') : t('roles.allPermissions')}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEditor(role)}
                    disabled={role.name === 'super_admin'}
                  >
                    {role.name === 'super_admin' ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                    {t('roles.editPermissions')}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState icon={ShieldCheck} title={t('common.noResults')} />
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={closeEditor}
        title={editing ? `${t('roles.editPermissions')} — ${locale === 'ar' ? editing.name_ar : editing.name_en}` : ''}
        description={t('roles.subtitle')}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={closeEditor}>
              {t('common.cancel')}
            </Button>
            <Button
              loading={saveMutation.isPending}
              disabled={locked}
              onClick={() => saveMutation.mutate(selected)}
            >
              <CheckCheck className="h-4 w-4" />
              {t('roles.savePermissions')}
            </Button>
          </>
        }
      >
        {locked ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning-100 bg-warning-50 px-4 py-3 text-sm font-medium text-warning-700">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            {t('roles.superAdminLocked')}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-muted px-4 py-3">
          <p className="text-xs font-semibold text-ink-muted">
            {formatNumber(selected.length, locale)} / {formatNumber(permissions.length, locale)}{' '}
            {t('roles.permissionsCount')}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={locked}
              onClick={() => setSelected(permissions.map((permission) => permission.name))}
            >
              {t('common.all')}
            </Button>
            <Button variant="outline" size="sm" disabled={locked} onClick={() => setSelected([])}>
              {t('common.none')}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {grouped.map(([module, modulePermissions]) => {
            const selectedCount = modulePermissions.filter((permission) => selected.includes(permission.name)).length
            const allSelected = selectedCount === modulePermissions.length

            return (
              <div key={module} className="overflow-hidden rounded-xl border border-line">
                <button
                  type="button"
                  onClick={() => toggleModule(modulePermissions)}
                  disabled={locked}
                  className="flex w-full items-center justify-between gap-2 bg-surface-muted px-3.5 py-2.5 text-start transition hover:bg-surface-sunken disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded border',
                        allSelected ? 'border-scarlet-800 bg-scarlet-800 text-white' : 'border-line-strong bg-surface',
                      )}
                    >
                      {allSelected ? <CheckCheck className="h-3 w-3" /> : null}
                    </span>
                    <span className="text-xs font-bold text-ink">{moduleLabel(module, locale)}</span>
                    <span className="font-mono text-[10px] text-ink-subtle">{module}</span>
                  </span>
                  <span className="text-[10px] font-semibold text-ink-muted">
                    {selectedCount}/{modulePermissions.length}
                  </span>
                </button>
                <div className="grid gap-1.5 p-2 sm:grid-cols-2">
                  {modulePermissions.map((permission) => {
                    const checked = selected.includes(permission.name)
                    return (
                      <label
                        key={permission.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 transition',
                          checked ? 'bg-scarlet-50/60' : 'hover:bg-surface-muted',
                          locked && 'cursor-not-allowed opacity-60',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={locked}
                          onChange={() => toggle(permission.name)}
                          className="mt-0.5 h-4 w-4 rounded border-line-strong text-scarlet-800 focus:ring-scarlet-500"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-ink">
                            {locale === 'ar' ? permission.name_ar : permission.name_en}
                          </span>
                          <span className="block font-mono text-[10px] text-ink-subtle">{permission.name}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>
    </div>
  )
}
