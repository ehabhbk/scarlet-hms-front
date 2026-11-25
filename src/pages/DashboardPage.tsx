import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Clock,
  ListOrdered,
  RefreshCw,
  Stethoscope,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState, Skeleton } from '@/components/ui/PageHeader'
import { useAuthStore } from '@/stores/auth'
import { useLocale } from '@/hooks/useLocale'
import { api } from '@/lib/api'
import type { ApiEnvelope, DashboardSummary } from '@/lib/types'
import { formatNumber, patientDisplayName } from '@/lib/format'
import { usePermission } from '@/hooks/useMeta'

function QueueRow({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        <span className={`h-2 w-2 rounded-full ${tone}`} />
        {label}
      </span>
      <span className="text-sm font-extrabold text-ink">{count}</span>
    </div>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const user = useAuthStore((state) => state.user)
  const canCreatePatient = usePermission('patients.create')
  const canManageAppointments = usePermission('appointments.create')

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<DashboardSummary>>('/dashboard/summary')
      return data.data
    },
    refetchInterval: 45_000,
  })

  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight
  const stats = data?.stats
  const firstName = user?.name?.split(' ')[0] ?? ''

  const quickActions = [
    ...(canCreatePatient
      ? [{ to: '/patients/new', label: t('dashboard.registerPatient'), icon: UserPlus, tone: 'bg-scarlet-800' }]
      : []),
    ...(canManageAppointments
      ? [{ to: '/appointments?new=1', label: t('dashboard.bookAppointment'), icon: CalendarPlus, tone: 'bg-teal-700' }]
      : []),
    { to: '/queues', label: t('dashboard.openQueue'), icon: ListOrdered, tone: 'bg-amber-700' },
    { to: '/encounters', label: t('dashboard.startEncounter'), icon: Stethoscope, tone: 'bg-indigo-700' },
  ]

  return (
    <div>
      <PageHeader
        eyebrow={t('common.brand')}
        title={`${t('dashboard.greeting')}، ${firstName}`}
        subtitle={t('dashboard.subtitle')}
        actions={
          <>
            <span className="hidden items-center gap-1.5 text-[11px] text-ink-subtle sm:flex">
              <Clock className="h-3.5 w-3.5" />
              {t('dashboard.generatedNow')}
            </span>
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('dashboard.totalPatients')}
          value={formatNumber(stats?.total_patients ?? 0, locale)}
          icon={Users}
          tone="scarlet"
          hint={`+${formatNumber(stats?.new_patients_today ?? 0, locale)} ${t('dashboard.newToday')}`}
          loading={isLoading}
        />
        <StatCard
          label={t('dashboard.appointmentsToday')}
          value={formatNumber(stats?.appointments_today ?? 0, locale)}
          icon={CalendarDays}
          tone="info"
          hint={`${formatNumber(stats?.checked_in_today ?? 0, locale)} ${t('dashboard.checkedIn')}`}
          loading={isLoading}
        />
        <StatCard
          label={t('dashboard.waitingNow')}
          value={formatNumber(stats?.waiting_now ?? 0, locale)}
          icon={ListOrdered}
          tone="warning"
          hint={`${formatNumber(stats?.in_consultation ?? 0, locale)} ${t('dashboard.inConsultation')}`}
          loading={isLoading}
        />
        <StatCard
          label={t('dashboard.openEncounters')}
          value={formatNumber(stats?.open_encounters ?? 0, locale)}
          icon={Stethoscope}
          tone="success"
          hint={`${formatNumber(stats?.my_appointments_today ?? 0, locale)} ${t('dashboard.myAppointments')}`}
          loading={isLoading}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-ink sm:text-base">{t('dashboard.weeklyRegistrations')}</h2>
              <p className="mt-0.5 text-xs text-ink-muted">{t('dashboard.subtitle')}</p>
            </div>
            <span className="hidden rounded-lg bg-scarlet-50 px-2.5 py-1 text-[11px] font-bold text-scarlet-800 sm:inline">
              {t('common.thisWeek')}
            </span>
          </div>
          <div className="h-64 px-2 py-4 sm:h-72 sm:px-4">
            {isLoading ? (
              <div className="flex h-full items-end gap-3 px-4">
                {[55, 75, 40, 85, 65, 90, 50].map((height, index) => (
                  <div key={index} className="skeleton flex-1" style={{ height: `${height}%` }} />
                ))}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.weekly_registrations ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scarletArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8A1538" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#8A1538" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={30}
                    tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--color-line)',
                      fontSize: 12,
                      background: 'var(--color-surface)',
                      color: 'var(--color-ink)',
                      boxShadow: '0 12px 32px -16px rgba(65,7,22,.25)',
                    }}
                    labelStyle={{ fontWeight: 700 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#8A1538"
                    strokeWidth={2.5}
                    fill="url(#scarletArea)"
                    name={t('dashboard.registrationShort')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card flex flex-col">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-bold text-ink sm:text-base">{t('dashboard.queueOverview')}</h2>
            <p className="mt-0.5 text-xs text-ink-muted">{t('dashboard.subtitle')}</p>
          </div>
          <div className="flex-1 px-5 py-3">
            <QueueRow label={t('queues.waiting')} count={data?.queue_counts?.waiting ?? 0} tone="bg-amber-500" />
            <QueueRow label={t('queues.called')} count={data?.queue_counts?.called ?? 0} tone="bg-orange-500" />
            <QueueRow label={t('queues.inProgress')} count={data?.queue_counts?.in_progress ?? 0} tone="bg-emerald-500" />
            <QueueRow label={t('queues.completed')} count={data?.queue_counts?.completed ?? 0} tone="bg-slate-400" />
            <div className="mt-3 rounded-xl bg-scarlet-50 p-3.5">
              <p className="text-2xl font-extrabold text-scarlet-900">
                {formatNumber(stats?.waiting_now ?? 0, locale)}
              </p>
              <p className="text-[11px] font-medium text-scarlet-700">{t('dashboard.patientsWaiting')}</p>
              <Link
                to="/queues"
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-scarlet-800 hover:underline"
              >
                {t('dashboard.openQueue')}
                <Arrow className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-sm font-bold text-ink sm:text-base">{t('dashboard.todayAppointments')}</h2>
            <Link to="/appointments" className="text-xs font-bold text-scarlet-800 hover:underline">
              {t('dashboard.viewAll')}
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="ms-auto h-3 w-16" />
                </div>
              ))}
            </div>
          ) : data?.today_appointments?.length ? (
            <div className="divide-y divide-line">
              {data.today_appointments.map((appointment) => (
                <div key={appointment.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-surface-muted py-1">
                    <span className="text-xs font-extrabold text-ink">
                      {appointment.scheduled_time}
                    </span>
                    <span className="text-[9px] text-ink-subtle">{appointment.appointment_number?.slice(-4)}</span>
                  </div>
                  <Avatar
                    name={patientDisplayName(appointment.patient, locale)}
                    size="sm"
                    tone="neutral"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {patientDisplayName(appointment.patient, locale)}
                    </p>
                    <p className="truncate text-[11px] text-ink-muted">
                      {appointment.patient?.mrn}
                      {appointment.department ? ` · ${locale === 'ar' ? appointment.department.name_ar : appointment.department.name_en}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={appointment.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title={t('dashboard.noAppointments')} />
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-sm font-bold text-ink sm:text-base">{t('dashboard.recentPatients')}</h2>
            <Link to="/patients" className="text-xs font-bold text-scarlet-800 hover:underline">
              {t('dashboard.viewAll')}
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : data?.recent_patients?.length ? (
            <div className="divide-y divide-line">
              {data.recent_patients.map((patient) => (
                <Link
                  key={patient.id}
                  to={`/patients/${patient.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition hover:bg-scarlet-50/50"
                >
                  <Avatar name={patientDisplayName(patient, locale)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{patientDisplayName(patient, locale)}</p>
                    <p className="truncate text-[11px] text-ink-muted">
                      {patient.mrn} · {patient.age ?? '—'} {t('common.years')}
                    </p>
                  </div>
                  <UserRound className="h-4 w-4 text-ink-subtle" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={Users} title={t('dashboard.noRecentPatients')} />
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-bold text-ink sm:text-base">{t('dashboard.departmentLoad')}</h2>
          </div>
          <div className="h-56 px-3 py-4">
            {data?.department_load?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.department_load} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey={locale === 'ar' ? 'name_ar' : 'name_en'}
                    width={120}
                    tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(138,21,56,0.05)' }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--color-line)',
                      fontSize: 12,
                      background: 'var(--color-surface)',
                      color: 'var(--color-ink)',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} name={t('nav.encounters')}>
                    {(data.department_load ?? []).map((entry, index) => (
                      <Cell key={entry.department_id} fill={index === 0 ? '#8A1538' : index === 1 ? '#B4234B' : '#D76A85'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={Activity} title={t('common.noData')} />
            )}
          </div>
        </div>

        <div className="card">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-bold text-ink sm:text-base">{t('dashboard.quickActions')}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5 p-4">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="group flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5 transition hover:-translate-y-0.5 hover:border-scarlet-200 hover:shadow-soft"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-white ${action.tone}`}>
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="text-xs font-bold leading-snug text-ink">{action.label}</span>
              </Link>
            ))}
          </div>
          <div className="mx-4 mb-4 flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-[11px] text-ink-muted">
            <ClipboardList className="h-4 w-4 shrink-0 text-scarlet-700" />
            {t('auth.secureNote')}
          </div>
        </div>
      </div>
    </div>
  )
}
