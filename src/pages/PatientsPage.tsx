import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Eye, Search, UserPlus, Users } from 'lucide-react'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { Pagination } from '@/components/ui/Pagination'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, Patient } from '@/lib/types'
import { formatDate, formatNumber, patientDisplayName } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePermission } from '@/hooks/useMeta'

export function PatientsPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const canCreate = usePermission('patients.create')
  const urlQuery = searchParams.get('q') ?? ''
  const [search, setSearch] = useState(urlQuery)
  const [status, setStatus] = useState('')
  const [gender, setGender] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search.trim(), 350)

  useEffect(() => {
    setSearch(urlQuery)
    setPage(1)
  }, [urlQuery])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, gender])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['patients', { page, search: debouncedSearch, status, gender }],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Patient[]>>('/patients', {
        params: {
          page,
          per_page: 15,
          search: debouncedSearch || undefined,
          status: status || undefined,
          gender: gender || undefined,
        },
      })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
    placeholderData: (previous) => previous,
  })

  const pagination = data?.meta?.pagination

  return (
    <div>
      <PageHeader
        title={t('patients.title')}
        subtitle={t('patients.subtitle')}
        actions={
          canCreate ? (
            <Button onClick={() => navigate('/patients/new')}>
              <UserPlus className="h-4 w-4" />
              {t('patients.new')}
            </Button>
          ) : null
        }
      />

      <div className="card mb-4 p-3 sm:p-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('patients.searchPlaceholder')}
              className="field h-10 ps-9"
              aria-label={t('common.search')}
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 min-w-[140px]"
              aria-label={t('common.status')}
            >
              <option value="">{t('common.all')}</option>
              <option value="active">{t('status.active')}</option>
              <option value="inactive">{t('status.inactive')}</option>
              <option value="deceased">{t('status.deceased')}</option>
            </Select>
            <Select
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              className="h-10 min-w-[130px]"
              aria-label={t('patients.gender')}
            >
              <option value="">{t('common.all')}</option>
              <option value="male">{t('patients.male')}</option>
              <option value="female">{t('patients.female')}</option>
            </Select>
          </div>
        </div>
        {pagination ? (
          <p className="mt-2 text-[11px] text-ink-subtle">
            {formatNumber(pagination.total, locale)} {t('patients.total')}
            {isFetching ? ` · ${t('common.loading')}` : ''}
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
                  <th>{t('patients.name')}</th>
                  <th>{t('patients.mrn')}</th>
                  <th>{t('patients.age')} / {t('patients.gender')}</th>
                  <th>{t('patients.phone')}</th>
                  <th>{t('patients.lastVisit')}</th>
                  <th>{t('patients.status')}</th>
                  <th className="text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((patient) => (
                  <tr key={patient.id} className="cursor-pointer" onClick={() => navigate(`/patients/${patient.id}`)}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={patientDisplayName(patient, locale)} size="sm" tone="neutral" />
                        <div className="min-w-0">
                          <Link
                            to={`/patients/${patient.id}`}
                            className="block truncate font-semibold text-ink hover:text-scarlet-800"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {patientDisplayName(patient, locale)}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            {patient.has_allergy_alert ? (
                              <Badge tone="danger">
                                <AlertTriangle className="h-3 w-3" />
                                {t('patients.allergyAlert')}
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-ink-subtle">{patient.national_id ?? '—'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-xs font-semibold text-ink-muted">{patient.mrn}</span>
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      {patient.age ?? '—'} {t('common.years')} ·{' '}
                      {patient.gender === 'male' ? t('patients.male') : patient.gender === 'female' ? t('patients.female') : t('patients.other')}
                    </td>
                    <td dir="ltr" className="whitespace-nowrap text-start text-sm">
                      {patient.phone ?? '—'}
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      {patient.last_visit_at ? formatDate(patient.last_visit_at, locale) : t('patients.lastVisitNever')}
                    </td>
                    <td>
                      <StatusBadge status={patient.status} />
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(event) => {
                            event.stopPropagation()
                            navigate(`/patients/${patient.id}`)
                          }}
                          title={t('common.view')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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
            title={t('patients.noPatients')}
            description={t('common.noResults')}
            action={
              canCreate ? (
                <Button onClick={() => navigate('/patients/new')}>
                  <UserPlus className="h-4 w-4" />
                  {t('patients.new')}
                </Button>
              ) : undefined
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
    </div>
  )
}
