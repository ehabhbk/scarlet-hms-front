import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  CalendarDays,
  Download,
  Loader2,
  RefreshCw,
  Stethoscope,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, statusTone } from '@/components/ui/Badge'
import { api } from '@/lib/api'
import type { ApiEnvelope, AppointmentSummary, DashboardSummary } from '@/lib/types'
import { formatDateTime, formatNumber, todayInput } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'

const PIE_COLORS = ['#8A1538', '#2563eb', '#059669', '#d97706', '#dc2626', '#6b7280']

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function ReportsPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const today = todayInput()

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<DashboardSummary>>('/dashboard/summary')
      return data.data
    },
  })

  const appointmentsQuery = useQuery({
    queryKey: ['appointments-summary', { date: today }],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<AppointmentSummary>>('/appointments/summary', {
        params: { date: today },
      })
      return data.data
    },
  })

  const dashboard = dashboardQuery.data
  const appointments = appointmentsQuery.data
  const loading = dashboardQuery.isLoading || appointmentsQuery.isLoading

  const appointmentStatuses = Object.entries(appointments?.counts ?? {})
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status,
      count,
      label: t(`status.${status}`, { defaultValue: status }),
    }))

  const exportReport = () => {
    if (!dashboard) {
      toast.error(t('reports.loadError'))
      return
    }

    const rows: unknown[][] = [
      ['Scarlet HMS — ' + t('reports.title')],
      [t('common.date'), formatDateTime(new Date().toISOString(), locale)],
      [],
      [t('reports.overview'), t('settings.value')],
      [t('dashboard.totalPatients'), dashboard.stats.total_patients],
      [t('dashboard.appointmentsToday'), dashboard.stats.appointments_today],
      [t('dashboard.waitingNow'), dashboard.stats.waiting_now],
      [t('dashboard.openEncounters'), dashboard.stats.open_encounters],
      [],
      [t('reports.appointmentsByStatus'), t('common.total')],
      ...Object.entries(appointments?.counts ?? {}).map(([status, count]) => [
        t(`status.${status}`, { defaultValue: status }),
        count,
      ]),
      [],
      [t('reports.weeklyRegistrations')],
      [t('common.date'), t('common.total')],
      ...dashboard.weekly_registrations.map((day) => [day.date, day.count]),
      [],
      [t('reports.patientsByDepartment')],
      [t('common.department'), t('common.total')],
      ...dashboard.department_load.map((row) => [locale === 'ar' ? row.name_ar : row.name_en, row.count]),
    ]

    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `scarlet-report-${today}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(t('reports.exported'))
  }

  return (
    <div>
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                void dashboardQuery.refetch()
                void appointmentsQuery.refetch()
              }}
              disabled={dashboardQuery.isFetching || appointmentsQuery.isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${dashboardQuery.isFetching || appointmentsQuery.isFetching ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </Button>
            <Button onClick={exportReport} disabled={loading}>
              <Download className="h-4 w-4" />
              {t('reports.export')}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="scarlet" dot>{t('reports.range')}: {t('reports.today')}</Badge>
        <Badge tone="info" dot>{t('reports.weeklyRegistrations')}: {t('reports.week')}</Badge>
        <span className="text-[11px] text-ink-subtle">
          {t('reports.subtitle')}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('dashboard.totalPatients')}
          value={formatNumber(dashboard?.stats.total_patients ?? 0, locale)}
          icon={Users}
          tone="scarlet"
          hint={`+${formatNumber(dashboard?.stats.new_patients_today ?? 0, locale)} ${t('dashboard.newToday')}`}
          loading={dashboardQuery.isLoading}
        />
        <StatCard
          label={t('reports.totalAppointments')}
          value={formatNumber(dashboard?.stats.appointments_today ?? 0, locale)}
          icon={CalendarDays}
          tone="info"
          hint={`${formatNumber(dashboard?.stats.checked_in_today ?? 0, locale)} ${t('dashboard.checkedIn')}`}
          loading={dashboardQuery.isLoading}
        />
        <StatCard
          label={t('dashboard.waitingNow')}
          value={formatNumber(dashboard?.stats.waiting_now ?? 0, locale)}
          icon={Activity}
          tone="warning"
          hint={`${formatNumber(dashboard?.stats.in_consultation ?? 0, locale)} ${t('dashboard.inConsultation')}`}
          loading={dashboardQuery.isLoading}
        />
        <StatCard
          label={t('dashboard.openEncounters')}
          value={formatNumber(dashboard?.stats.open_encounters ?? 0, locale)}
          icon={Stethoscope}
          tone="success"
          hint={`${formatNumber(dashboard?.stats.completed_appointments ?? 0, locale)} ${t('status.completed')}`}
          loading={dashboardQuery.isLoading}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-scarlet-700" />
              <h2 className="text-sm font-bold text-ink">{t('reports.weeklyRegistrations')}</h2>
            </div>
            <Badge tone="neutral">{t('reports.week')}</Badge>
          </div>
          <div className="h-72 px-2 py-4 sm:px-4">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-scarlet-700" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard?.weekly_registrations ?? []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reportArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8A1538" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#8A1538" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} width={30} tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--color-line)',
                      fontSize: 12,
                      background: 'var(--color-surface)',
                      color: 'var(--color-ink)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#8A1538"
                    strokeWidth={2.5}
                    fill="url(#reportArea)"
                    name={t('reports.weeklyRegistrations')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-bold text-ink">{t('reports.appointmentsByStatus')}</h2>
            <p className="mt-0.5 text-[11px] text-ink-muted">{formatDateTime(appointments?.date ?? today, locale)}</p>
          </div>
          <div className="h-48 px-2 py-2">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-scarlet-700" />
              </div>
            ) : appointmentStatuses.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={appointmentStatuses}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={44}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {appointmentStatuses.map((entry, index) => (
                      <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--color-line)',
                      fontSize: 12,
                      background: 'var(--color-surface)',
                      color: 'var(--color-ink)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-subtle">{t('common.noData')}</div>
            )}
          </div>
          <div className="space-y-1.5 px-5 pb-4">
            {appointmentStatuses.map((entry, index) => (
              <div key={entry.status} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 text-ink-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[index % PIE_COLORS.length] }} />
                  <Badge tone={statusTone(entry.status)}>{entry.label}</Badge>
                </span>
                <span className="font-bold text-ink">{formatNumber(entry.count, locale)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="card">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-bold text-ink">{t('reports.patientsByDepartment')}</h2>
            <p className="mt-0.5 text-[11px] text-ink-muted">{t('reports.today')}</p>
          </div>
          <div className="h-72 px-2 py-4 sm:px-4">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-scarlet-700" />
              </div>
            ) : dashboard?.department_load?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.department_load} layout="vertical" margin={{ top: 0, right: 20, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-ink-subtle)' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey={locale === 'ar' ? 'name_ar' : 'name_en'}
                    width={130}
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
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} fill="#8A1538" name={t('common.total')} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-subtle">{t('common.noData')}</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-bold text-ink">{t('dashboard.queueOverview')}</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {[
                { key: 'waiting', label: t('queues.waiting'), tone: 'text-amber-700' },
                { key: 'called', label: t('queues.called'), tone: 'text-orange-700' },
                { key: 'in_progress', label: t('queues.inProgress'), tone: 'text-emerald-700' },
                { key: 'completed', label: t('queues.completed'), tone: 'text-ink' },
                { key: 'skipped', label: t('queues.skipped'), tone: 'text-ink' },
                { key: 'no_show', label: t('queues.noShow'), tone: 'text-ink' },
              ].map((item) => (
                <div key={item.key} className="rounded-xl bg-surface-muted px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-ink-muted">{item.label}</p>
                  <p className={`mt-0.5 text-xl font-extrabold ${item.tone}`}>
                    {formatNumber(dashboard?.queue_counts?.[item.key] ?? 0, locale)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-muted text-[10px] uppercase tracking-wide text-ink-muted">
                    <th className="px-3 py-2 text-start font-bold">{t('common.department')}</th>
                    <th className="px-3 py-2 text-end font-bold">{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.department_load ?? []).slice(0, 6).map((row) => (
                    <tr key={row.department_id} className="border-t border-line">
                      <td className="px-3 py-2 text-xs text-ink">{locale === 'ar' ? row.name_ar : row.name_en}</td>
                      <td className="px-3 py-2 text-end text-xs font-bold text-ink">{formatNumber(row.count, locale)}</td>
                    </tr>
                  ))}
                  {!dashboard?.department_load?.length ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-6 text-center text-xs text-ink-subtle">
                        {t('common.noData')}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
