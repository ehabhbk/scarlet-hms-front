import { useTranslation } from 'react-i18next'
import { Badge, statusTone } from './Badge'

export function StatusBadge({ status, dot = true }: { status: string; dot?: boolean }) {
  const { t } = useTranslation()

  return (
    <Badge tone={statusTone(status)} dot={dot}>
      {t(`status.${status}`, { defaultValue: status })}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation()
  const tone = priority === 'emergency' ? 'danger' : priority === 'urgent' ? 'warning' : 'neutral'

  return (
    <Badge tone={tone} dot>
      {t(`queues.${priority}`, { defaultValue: priority })}
    </Badge>
  )
}
