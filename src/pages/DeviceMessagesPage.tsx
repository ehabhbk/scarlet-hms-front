import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Radio, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api, parseApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ApiEnvelope, ApiMeta, LabDeviceMessage, RadiologyDeviceMessage } from '@/lib/types'

type Channel = 'lab' | 'radiology'

const statusTone = (status: string): 'success' | 'warning' | 'danger' | 'neutral' => {
  if (status === 'imported') return 'success'
  if (status === 'unmatched') return 'warning'
  if (status === 'error') return 'danger'
  return 'neutral'
}

export function DeviceMessagesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [channel, setChannel] = useState<Channel>('lab')

  const reprocessMutation = useMutation({
    mutationFn: async (message: LabDeviceMessage | RadiologyDeviceMessage) => {
      const endpoint = channel === 'lab'
        ? `/lab-device-messages/${message.id}/reprocess`
        : `/radiology-device-messages/${message.id}/reprocess`
      await api.post(endpoint)
    },
    onSuccess: () => {
      toast.success('تمت إعادة معالجة الرسالة')
      void queryClient.invalidateQueries({ queryKey: ['lab-device-messages'] })
      void queryClient.invalidateQueries({ queryKey: ['radiology-device-messages'] })
      void queryClient.invalidateQueries({ queryKey: ['lab-order-items'] })
      void queryClient.invalidateQueries({ queryKey: ['radiology-orders'] })
    },
    onError: (error) => toast.error(parseApiError(error).message || 'تعذرت إعادة المعالجة'),
  })

  const { data, isLoading } = useQuery({
    queryKey: [channel === 'lab' ? 'lab-device-messages' : 'radiology-device-messages', page],
    queryFn: async () => {
      const endpoint = channel === 'lab' ? '/lab-device-messages' : '/radiology-device-messages'
      const { data } = await api.get<ApiEnvelope<Array<LabDeviceMessage | RadiologyDeviceMessage>>>(endpoint, {
        params: { page, per_page: 15 },
      })
      return { rows: data.data, meta: data.meta as ApiMeta }
    },
  })

  const rows = data?.rows ?? []
  const pagination = data?.meta?.pagination

  return (
    <div>
      <PageHeader title="رسائل الأجهزة" subtitle="سجل رسائل HL7/ASTM وDICOM المستلمة من أجهزة المختبر والأشعة والموجات" />
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => { setChannel('lab'); setPage(1) }}
          className={cn('rounded-xl px-4 py-2 text-sm font-semibold', channel === 'lab' ? 'bg-scarlet-800 text-white' : 'bg-surface text-ink hover:bg-surface-muted')}
        >
          رسائل المختبر
        </button>
        <button
          type="button"
          onClick={() => { setChannel('radiology'); setPage(1) }}
          className={cn('rounded-xl px-4 py-2 text-sm font-semibold', channel === 'radiology' ? 'bg-scarlet-800 text-white' : 'bg-surface text-ink hover:bg-surface-muted')}
        >
          رسائل الأشعة والموجات
        </button>
      </div>
      <div className="table-shell">
        {isLoading ? <TableSkeleton rows={8} /> : rows.length ? (
          <table className="data-table">
            <thead><tr><th>الجهاز</th><th>الحالة</th><th>وقت الاستلام</th><th>ملخص الرسالة</th><th>الإجراءات</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>{m.device?.name ?? m.id}</td>
                  <td><Badge tone={statusTone(m.status)} dot>{m.status}</Badge></td>
                  <td>{m.received_at ?? '—'}</td>
                  <td className="max-w-md truncate text-xs">{m.parsed_summary ?? '—'}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={reprocessMutation.isPending && reprocessMutation.variables?.id === m.id}
                      onClick={() => reprocessMutation.mutate(m)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> إعادة المعالجة
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState icon={Radio} title={t('common.noData')} />}
        {pagination ? <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} from={pagination.from} to={pagination.to} onChange={setPage} /> : null}
      </div>
    </div>
  )
}
