import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, UserRound, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import type { ApiEnvelope, Patient } from '@/lib/types'
import { patientDisplayName } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'


export function PatientPicker({
  value,
  onChange,
  placeholder,
  disabled = false,
  autoFocus = false,
}: {
  value?: Patient | null
  onChange: (patient: Patient | null) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounced = useDebouncedValue(query.trim(), 300)

  const { data, isFetching } = useQuery({
    queryKey: ['patient-picker', debounced],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Patient[]>>('/patients', {
        params: { search: debounced, per_page: 8, status: 'active' },
      })
      return data.data
    },
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  })

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-scarlet-200 bg-scarlet-50/60 px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-scarlet-800 text-white">
          <UserRound className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{patientDisplayName(value, locale)}</p>
          <p className="truncate text-xs text-ink-muted">
            {value.mrn}
            {value.phone ? ` · ${value.phone}` : ''}
            {value.age !== null && value.age !== undefined ? ` · ${value.age} ${t('common.years')}` : ''}
          </p>
        </div>
        {!disabled ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-lg p-1.5 text-ink-muted transition hover:bg-white hover:text-danger-600"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <input
          className="field ps-9 pe-9"
          value={query}
          disabled={disabled}
          autoFocus={autoFocus}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? t('patients.searchPatient')}
        />
        {isFetching ? (
          <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-scarlet-600" />
        ) : null}
      </div>

      {open && debounced.length >= 2 ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lift">
          {isFetching && !data?.length ? (
            <div className="flex items-center gap-2 px-3 py-6 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : data?.length ? (
            data.map((patient) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => {
                  onChange(patient)
                  setQuery('')
                  setOpen(false)
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition hover:bg-scarlet-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-muted">
                  <UserRound className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {patientDisplayName(patient, locale)}
                  </span>
                  <span className="block truncate text-[11px] text-ink-muted">
                    {patient.mrn}
                    {patient.phone ? ` · ${patient.phone}` : ''}
                    {patient.age !== null && patient.age !== undefined ? ` · ${patient.age} ${t('common.years')}` : ''}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">{t('appointments.noPatientsFound')}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
