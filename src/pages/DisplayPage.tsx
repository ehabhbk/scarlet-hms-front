import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Activity, Clock, Globe, Megaphone, MonitorPlay, Users } from 'lucide-react'
import { api } from '@/lib/api'
import type { ApiEnvelope, PublicMeta, PublicQueueBoard } from '@/lib/types'
import { useLocale } from '@/hooks/useLocale'
import { changeAppLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

function useClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return now
}

function priorityTone(priority: string) {
  if (priority === 'emergency') return 'bg-danger-600/20 text-danger-100 ring-danger-400/30'
  if (priority === 'urgent') return 'bg-warning-500/20 text-warning-100 ring-warning-400/30'
  return 'bg-white/10 text-white/80 ring-white/15'
}

export function DisplayPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const params = useParams()
  const now = useClock()

  const paramBranch = params.branchId ? Number(params.branchId) : null
  const [branchId, setBranchId] = useState<number | null>(paramBranch)

  useEffect(() => {
    setBranchId(params.branchId ? Number(params.branchId) : null)
  }, [params.branchId])

  const metaQuery = useQuery({
    queryKey: ['public-meta'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<PublicMeta>>('/public/meta')
      return data.data
    },
    staleTime: 5 * 60 * 1000,
  })

  const branches = metaQuery.data?.branches ?? []

  useEffect(() => {
    if (!branchId && branches.length) {
      setBranchId(branches[0].id)
    }
  }, [branchId, branches])

  const boardQuery = useQuery({
    queryKey: ['public-queue', branchId],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<PublicQueueBoard>>(`/public/queues/${branchId}`)
      return data.data
    },
    enabled: Boolean(branchId),
    refetchInterval: 5000,
  })

  const board = boardQuery.data
  const branch = branches.find((item) => item.id === branchId)
  const notice = metaQuery.data?.settings?.find((setting) =>
    setting.key === (locale === 'ar' ? 'queue_display_notice_ar' : 'queue_display_notice_en'),
  )?.value

  const timeLabel = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SD-u-nu-latn' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(now)
  const dateLabel = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SD-u-nu-latn' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now)

  const current = board?.current ?? null
  const next = board?.next ?? []
  const calledOthers = (board?.called ?? []).filter((ticket) => ticket.number !== current?.number)

  const switchBranch = (value: string) => {
    const id = Number(value)
    if (!Number.isFinite(id)) return
    setBranchId(id)
    navigate(`/display/${id}`, { replace: true })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#2A030D] text-white">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#3A0513] via-[#5E0E26] to-[#1D0209]" />
      <div className="pointer-events-none absolute -start-32 -top-32 h-[36rem] w-[36rem] rounded-full bg-scarlet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -end-24 h-[36rem] w-[36rem] rounded-full bg-scarlet-400/10 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col px-5 py-5 sm:px-8 lg:px-12">
        <header className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-1.5 shadow-xl shadow-black/30">
              <img src="/brand/scarlet-mark.png" alt="Scarlet" className="h-11 w-auto object-contain" />
            </span>
            <div className="leading-tight">
              <p className="text-lg font-extrabold tracking-tight sm:text-xl">Scarlet Care</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">Patient Display</p>
            </div>
          </div>

          <div className="ms-auto flex flex-wrap items-center gap-2 sm:gap-3">
            {branches.length > 1 ? (
              <select
                value={branchId ?? ''}
                onChange={(event) => switchBranch(event.target.value)}
                className="h-10 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white backdrop-blur focus:outline-none"
                aria-label={t('queues.branch')}
              >
                {branches.map((item) => (
                  <option key={item.id} value={item.id} className="text-ink">
                    {locale === 'ar' ? item.name_ar : item.name_en}
                  </option>
                ))}
              </select>
            ) : branch ? (
              <span className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 backdrop-blur">
                {locale === 'ar' ? branch.name_ar : branch.name_en}
              </span>
            ) : null}

            <div className="hidden text-end sm:block">
              <p className="font-mono text-xl font-bold leading-none tabular-nums">{timeLabel}</p>
              <p className="mt-1 text-[10px] text-white/45">{dateLabel}</p>
            </div>

            <button
              type="button"
              onClick={() => changeAppLocale(locale === 'ar' ? 'en' : 'ar')}
              className="flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white/80 backdrop-blur transition hover:bg-white/20"
            >
              <Globe className="h-4 w-4" />
              {locale === 'ar' ? 'EN' : 'ع'}
            </button>
          </div>
        </header>

        <main className="grid flex-1 items-stretch gap-5 py-6 lg:grid-cols-[1.2fr_1fr]">
          <section className="relative flex flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] px-6 py-10 backdrop-blur-sm">
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em] text-white/50">
              <Megaphone className="h-4 w-4 text-scarlet-200" />
              {t('display.nowServing')}
            </div>

            <div className="relative mt-6 flex items-center justify-center">
              {current ? (
                <>
                  <span className="absolute h-56 w-56 animate-ping rounded-full bg-scarlet-400/10 sm:h-72 sm:w-72" />
                  <div className="relative flex h-56 w-56 flex-col items-center justify-center rounded-[2.5rem] border-2 border-white/20 bg-gradient-to-br from-white/20 to-white/5 shadow-2xl shadow-black/40 backdrop-blur sm:h-72 sm:w-72">
                    <span className="font-mono text-6xl font-black leading-none tracking-tight sm:text-8xl">
                      {current.number}
                    </span>
                    <span className="mt-3 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/70">
                      {current.status === 'called' ? t('queues.called') : t('queues.inProgress')}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex h-56 w-56 flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-white/20 bg-white/5 sm:h-72 sm:w-72">
                  <MonitorPlay className="h-10 w-10 text-white/30" />
                  <p className="mt-3 max-w-[12rem] text-center text-xs font-medium leading-relaxed text-white/45">
                    {t('display.noCurrent')}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-7 text-center">
              <p className="text-xl font-bold sm:text-2xl">
                {current
                  ? locale === 'ar'
                    ? current.department_ar
                    : current.department_en
                  : t('display.pleaseWait')}
              </p>
              {current?.doctor ? <p className="mt-1 text-sm text-white/50">{current.doctor}</p> : null}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {calledOthers.map((ticket) => (
                <span
                  key={ticket.number}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-2"
                >
                  <span className="font-mono text-xl font-bold">{ticket.number}</span>
                  <span className="max-w-[8rem] truncate text-[10px] text-white/50">
                    {locale === 'ar' ? ticket.department_ar : ticket.department_en}
                  </span>
                </span>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-scarlet-200" />
                  <h2 className="text-sm font-bold">{t('display.next')}</h2>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/60">
                  {board?.waiting_count ?? 0} {t('display.patientsWaiting')}
                </span>
              </div>

              <div className="mt-3 grid gap-2">
                {next.length ? (
                  next.map((ticket, index) => (
                    <div
                      key={ticket.number}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition',
                        index === 0
                          ? 'border-scarlet-300/30 bg-scarlet-100/10'
                          : 'border-white/10 bg-white/[0.04]',
                      )}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 font-mono text-sm font-black">
                        {ticket.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {locale === 'ar' ? ticket.department_ar : ticket.department_en}
                        </p>
                        <p className="truncate text-[10px] text-white/45">{ticket.doctor ?? t('display.clinic')}</p>
                      </div>
                      {ticket.priority !== 'normal' ? (
                        <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold ring-1 ring-inset', priorityTone(ticket.priority))}>
                          {t(ticket.priority === 'emergency' ? 'display.emergency' : 'display.urgent')}
                        </span>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-xs text-white/40">
                    {t('queues.empty')}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-[2rem] border border-white/10 bg-white/[0.06] px-5 py-4 backdrop-blur-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Activity className="h-4 w-4 text-emerald-300" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">
                  {typeof notice === 'string' && notice ? notice : t('display.pleaseWait')}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/40">
                  <Clock className="h-3 w-3" />
                  {t('display.refreshNote')}
                  {boardQuery.isFetching ? ` · ${t('common.loading')}` : ''}
                </p>
              </div>
            </div>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[10px] text-white/35">
          <span className="flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', boardQuery.isError ? 'bg-danger-500' : 'animate-pulse bg-emerald-400')} />
            {boardQuery.isError ? t('errors.network') : t('display.updated')}
          </span>
          <span>
            {t('display.poweredBy')} · Scarlet HMS
          </span>
        </footer>
      </div>
    </div>
  )
}
