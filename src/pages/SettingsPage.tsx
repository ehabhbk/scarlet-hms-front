import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Check, Globe2, Loader2, RotateCcw, Save, Settings2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Field'
import { Tabs } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, Setting } from '@/lib/types'
import { useLocale } from '@/hooks/useLocale'
import { useMeta } from '@/hooks/useMeta'
import { cn } from '@/lib/utils'

const labelKeys: Record<string, string> = {
  hospital_name_ar: 'hospitalNameAr',
  hospital_name_en: 'hospitalNameEn',
  hospital_phone: 'hospitalPhone',
  hospital_email: 'hospitalEmail',
  hospital_address_ar: 'addressAr',
  hospital_address_en: 'addressEn',
  brand_tagline_ar: 'taglineAr',
  brand_tagline_en: 'taglineEn',
  queue_display_notice_ar: 'queueNoticeAr',
  queue_display_notice_en: 'queueNoticeEn',
  appointment_slot_minutes: 'slotMinutes',
  allow_walk_ins: 'allowWalkIns',
  currency: 'currency',
  timezone: 'timezone',
  mrn_prefix: 'mrnPrefix',
  duplicate_score_threshold: 'duplicateThreshold',
  audit_retention_days: 'auditRetention',
  session_timeout_minutes: 'sessionTimeout',
  support_email: 'supportEmail',
}

const longTextKeys = new Set([
  'hospital_address_ar',
  'hospital_address_en',
  'brand_tagline_ar',
  'brand_tagline_en',
  'queue_display_notice_ar',
  'queue_display_notice_en',
])

const groupIcons: Record<string, typeof Settings2> = {
  hospital: Building2,
  branding: Globe2,
  security: ShieldCheck,
  audit: ShieldCheck,
}

interface DraftSetting {
  value: string | boolean
  group: string
  is_public: boolean
  type: string
}

function humanize(key: string): string {
  return key
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function toDraft(setting: Setting): DraftSetting {
  const value = setting.value

  if (typeof value === 'boolean') {
    return { value, group: setting.group, is_public: setting.is_public, type: setting.type }
  }

  return {
    value: value === null || value === undefined ? '' : String(value),
    group: setting.group,
    is_public: setting.is_public,
    type: setting.type,
  }
}

export function SettingsPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const { data: meta } = useMeta()
  const [group, setGroup] = useState('hospital')
  const [drafts, setDrafts] = useState<Record<string, DraftSetting>>({})
  const [dirty, setDirty] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<{ settings: Setting[]; groups: string[] }>>('/settings')
      return data.data
    },
  })

  useEffect(() => {
    if (!data) return
    const next: Record<string, DraftSetting> = {}
    data.settings.forEach((setting) => {
      next[setting.key] = toDraft(setting)
    })
    setDrafts(next)
    setDirty(false)
    if (data.groups.length && !data.groups.includes(group)) {
      setGroup(data.groups[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const groups = data?.groups ?? []

  const groupSettings = useMemo(
    () => (data?.settings ?? []).filter((setting) => setting.group === group),
    [data, group],
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, { value: unknown; group: string; is_public: boolean }> = {}

      Object.entries(drafts).forEach(([key, draft]) => {
        const numeric = draft.type === 'integer' || draft.type === 'double'
        payload[key] = {
          value:
            typeof draft.value === 'boolean'
              ? draft.value
              : numeric
                ? draft.value === ''
                  ? null
                  : Number(draft.value)
                : draft.value,
          group: draft.group,
          is_public: draft.is_public,
        }
      })

      const { data } = await api.put<ApiEnvelope<Setting[]>>('/settings', { settings: payload })
      return data.data
    },
    onSuccess: () => {
      toast.success(t('settings.saved'))
      setDirty(false)
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      void queryClient.invalidateQueries({ queryKey: ['meta'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const update = (key: string, patch: Partial<DraftSetting>) => {
    setDrafts((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
    setDirty(true)
  }

  const reset = () => {
    if (!data) return
    const next: Record<string, DraftSetting> = {}
    data.settings.forEach((setting) => {
      next[setting.key] = toDraft(setting)
    })
    setDrafts(next)
    setDirty(false)
  }

  const labelFor = (key: string) =>
    labelKeys[key] ? t(`settings.${labelKeys[key]}`) : humanize(key)

  return (
    <div>
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={reset} disabled={!dirty || saveMutation.isPending}>
              <RotateCcw className="h-4 w-4" />
              {t('common.cancel')}
            </Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!dirty}>
              <Save className="h-4 w-4" />
              {t('settings.save')}
            </Button>
          </>
        }
      />

      {isLoading || !data ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-ink-muted">
          <Loader2 className="h-5 w-5 animate-spin text-scarlet-700" />
          {t('common.loading')}
        </div>
      ) : !data.settings.length ? (
        <div className="card">
          <EmptyState icon={Settings2} title={t('settings.noSettings')} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-3">
            <div className="card p-2">
              <Tabs
                items={groups.map((item) => ({ id: item, label: t(`settings.${item}`, { defaultValue: item }) }))}
                value={group}
                onChange={setGroup}
                className="flex-col bg-transparent p-0"
              />
            </div>
            <div className="card p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-ink">
                <ShieldCheck className="h-4 w-4 text-scarlet-700" />
                {t('settings.security')}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{t('settings.readOnlyNote')}</p>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-subtle">
                <Check className="h-3.5 w-3.5 text-success-600" />
                {t('settings.savedDescription')}
              </p>
            </div>
            {meta?.settings?.length ? (
              <div className="card p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-subtle">{t('settings.public')}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {meta.settings.length} / {data.settings.length}
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                {(() => {
                  const Icon = groupIcons[group] ?? Settings2
                  return <Icon className="h-4 w-4 text-scarlet-700" />
                })()}
                {t(`settings.${group}`, { defaultValue: group })}
              </h2>
              {dirty ? <Badge tone="warning">{locale === 'ar' ? 'تغييرات غير محفوظة' : 'Unsaved changes'}</Badge> : null}
            </div>

            {groupSettings.map((setting) => {
              const draft = drafts[setting.key]
              if (!draft) return null
              const isBoolean = typeof draft.value === 'boolean'
              const isNumeric = draft.type === 'integer' || draft.type === 'double'
              const isLong = longTextKeys.has(setting.key)

              return (
                <div key={setting.key} className="card px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-ink">{labelFor(setting.key)}</p>
                        <Badge tone="neutral" className="font-mono text-[10px]">
                          {setting.key}
                        </Badge>
                        {draft.is_public ? <Badge tone="info">{t('settings.public')}</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-ink-subtle">{setting.type} · {t(`settings.${group}`, { defaultValue: group })}</p>
                    </div>

                    <div className="w-full shrink-0 sm:w-72">
                      {isBoolean ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={draft.value as boolean}
                            onClick={() => update(setting.key, { value: !(draft.value as boolean) })}
                            className={cn(
                              'relative h-6 w-11 rounded-full transition',
                              draft.value ? 'bg-scarlet-800' : 'bg-line-strong',
                            )}
                          >
                            <span
                              className={cn(
                                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                                draft.value ? 'start-[1.375rem]' : 'start-0.5',
                              )}
                            />
                          </button>
                          <span className="text-xs font-semibold text-ink-muted">
                            {draft.value ? t('common.yes') : t('common.no')}
                          </span>
                        </div>
                      ) : isLong ? (
                        <Textarea
                          rows={3}
                          value={String(draft.value)}
                          onChange={(event) => update(setting.key, { value: event.target.value })}
                          dir={setting.key.endsWith('_en') ? 'ltr' : undefined}
                        />
                      ) : (
                        <Input
                          value={String(draft.value)}
                          type={isNumeric ? 'number' : 'text'}
                          step={draft.type === 'double' ? '0.01' : undefined}
                          onChange={(event) => update(setting.key, { value: event.target.value })}
                          dir={setting.key.endsWith('_en') || setting.key === 'hospital_email' || setting.key === 'support_email' || setting.key === 'timezone' ? 'ltr' : undefined}
                        />
                      )}
                    </div>
                  </div>

                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-[11px] font-medium text-ink-muted">
                    <input
                      type="checkbox"
                      checked={draft.is_public}
                      onChange={(event) => update(setting.key, { is_public: event.target.checked })}
                      className="h-3.5 w-3.5 rounded border-line-strong text-scarlet-800 focus:ring-scarlet-500"
                    />
                    {t('settings.public')}
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
