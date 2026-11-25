import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone =
  | 'neutral'
  | 'scarlet'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'violet'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-muted ring-line',
  scarlet: 'bg-scarlet-50 text-scarlet-800 ring-scarlet-200',
  success: 'bg-success-50 text-success-700 ring-success-100',
  warning: 'bg-warning-50 text-warning-700 ring-warning-100',
  danger: 'bg-danger-50 text-danger-700 ring-danger-100',
  info: 'bg-info-50 text-info-700 ring-info-100',
  violet: 'bg-violet-50 text-violet-700 ring-violet-100',
}

const dots: Record<BadgeTone, string> = {
  neutral: 'bg-ink-subtle',
  scarlet: 'bg-scarlet-600',
  success: 'bg-success-600',
  warning: 'bg-warning-600',
  danger: 'bg-danger-600',
  info: 'bg-info-600',
  violet: 'bg-violet-600',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  dot?: boolean
}

export function Badge({ className, tone = 'neutral', dot = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} aria-hidden /> : null}
      {children}
    </span>
  )
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'active':
    case 'completed':
    case 'confirmed':
    case 'signed':
    case 'success':
      return 'success'
    case 'booked':
    case 'open':
    case 'draft':
    case 'waiting':
      return 'info'
    case 'checked_in':
    case 'called':
    case 'in_progress':
    case 'in_consultation':
      return 'warning'
    case 'cancelled':
    case 'skipped':
    case 'no_show':
    case 'deceased':
    case 'suspected':
      return 'danger'
    case 'urgent':
      return 'warning'
    case 'emergency':
      return 'danger'
    default:
      return 'neutral'
  }
}
