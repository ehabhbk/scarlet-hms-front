import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pill } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { Pagination } from '@/components/ui/Pagination'
import { api, parseApiError } from '@/lib/api'
import type { ApiEnvelope, ApiMeta, Medication, Prescription } from '@/lib/types'
import { formatNumber } from '@/lib/format'
import { useLocale } from '@/hooks/useLocale'


export function PharmacyPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState('medications')
  const [page, setPage] = useState(1)
  const [openMed, setOpenMed] = useState(false)
  const [medForm, setMedForm] = useState({ code: '', name_ar: '', name_en: '', unit_price: '', stock_quantity: '', is_active: true })

  const medicationsQuery = useQuery({
    queryKey: ['medications', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Medication[]>>('/medications', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
    enabled: tab === 'medications',
  })

  const prescriptionsQuery = useQuery({
    queryKey: ['prescriptions', page],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<Prescription[]>>('/prescriptions', { params: { page, per_page: 15 } })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
    enabled: tab === 'prescriptions',
  })

  const saveMedication = useMutation({
    mutationFn: async () => {
      await api.post('/medications', {
        code: medForm.code,
        name_ar: medForm.name_ar,
        name_en: medForm.name_en || null,
        unit_price: Number(medForm.unit_price || 0),
        stock_quantity: Number(medForm.stock_quantity || 0),
        is_active: medForm.is_active,
      })
    },
    onSuccess: () => {
      toast.success(t('common.saved'))
      setOpenMed(false)
      setMedForm({ code: '', name_ar: '', name_en: '', unit_price: '', stock_quantity: '', is_active: true })
      void queryClient.invalidateQueries({ queryKey: ['medications'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || t('errors.generic')),
  })

  const medications = medicationsQuery.data?.rows ?? []
  const prescriptions = prescriptionsQuery.data?.rows ?? []
  const pagination = (tab === 'medications' ? medicationsQuery.data?.meta : prescriptionsQuery.data?.meta)?.pagination

  return (
    <div>
      <PageHeader title={t('nav.pharmacy')} subtitle={t('dashboard.subtitle')} actions={
        tab === 'medications' ? <Button onClick={() => setOpenMed(true)}><Plus className="h-4 w-4" />{t('common.add')}</Button> : null
      } />
      <Tabs items={[{ id: 'medications', label: t('nav.pharmacy') }, { id: 'prescriptions', label: t('nav.pharmacy') + ' - Rx' }]} value={tab} onChange={(v) => { setTab(v); setPage(1) }} />

      <div className="mt-4 table-shell">
        {tab === 'medications' ? (
          medicationsQuery.isLoading ? <TableSkeleton rows={8} /> : medications.length ? (
            <table className="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Stock</th><th>Price</th><th>Status</th></tr></thead>
              <tbody>
                {medications.map((m) => (
                  <tr key={m.id}>
                    <td className="font-mono text-xs">{m.code}</td>
                    <td>{locale === 'ar' ? m.name_ar : (m.name_en || m.name_ar)}</td>
                    <td>{formatNumber(m.stock_quantity, locale)}</td>
                    <td>{formatNumber(m.unit_price, locale)}</td>
                    <td><Badge tone={m.is_active ? 'success' : 'neutral'} dot>{m.is_active ? t('common.active') : t('common.inactive')}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState icon={Pill} title={t('common.noData')} />
        ) : (
          prescriptionsQuery.isLoading ? <TableSkeleton rows={8} /> : prescriptions.length ? (
            <table className="data-table">
              <thead><tr><th>Rx #</th><th>Patient</th><th>Status</th><th>Items</th><th>Prescribed</th></tr></thead>
              <tbody>
                {prescriptions.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.prescription_number}</td>
                    <td>{p.patient?.display_name ?? p.patient_id}</td>
                    <td><Badge tone={p.status === 'dispensed' ? 'success' : p.status === 'cancelled' ? 'danger' : 'warning'} dot>{p.status}</Badge></td>
                    <td>{p.items?.length ?? 0}</td>
                    <td>{p.prescribed_at ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState icon={Pill} title={t('common.noData')} />
        )}
        {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
      </div>

      <Modal open={openMed} onClose={() => setOpenMed(false)} title={t('common.add')} size="md" footer={
        <>
          <Button variant="outline" onClick={() => setOpenMed(false)}>{t('common.cancel')}</Button>
          <Button loading={saveMedication.isPending} onClick={() => saveMedication.mutate()}>{t('common.save')}</Button>
        </>
      }>
        <div className="grid gap-3">
          <Field label="Code" required><Input value={medForm.code} onChange={(e) => setMedForm({ ...medForm, code: e.target.value })} /></Field>
          <Field label="Name (AR)" required><Input value={medForm.name_ar} onChange={(e) => setMedForm({ ...medForm, name_ar: e.target.value })} /></Field>
          <Field label="Name (EN)"><Input value={medForm.name_en} onChange={(e) => setMedForm({ ...medForm, name_en: e.target.value })} /></Field>
          <Field label="Unit price"><Input type="number" value={medForm.unit_price} onChange={(e) => setMedForm({ ...medForm, unit_price: e.target.value })} /></Field>
          <Field label="Stock"><Input type="number" value={medForm.stock_quantity} onChange={(e) => setMedForm({ ...medForm, stock_quantity: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}
