import type { HTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-line px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-ink sm:text-base">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

const iconTones: Record<string, string> = {
  scarlet: 'bg-scarlet-50 text-scarlet-700 ring-scarlet-100',
  success: 'bg-success-50 text-success-700 ring-success-100',
  warning: 'bg-warning-50 text-warning-700 ring-warning-100',
  info: 'bg-info-50 text-info-700 ring-info-100',
  neutral: 'bg-surface-sunken text-ink-muted ring-line',
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'scarlet',
  hint,
  loading = false,
}: {
  label: string
  value: ReactNode
  icon: LucideIcon
  tone?: keyof typeof iconTones
  hint?: string
  loading?: boolean
}) {
  return (
    <div className="card relative overflow-hidden p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-ink-muted">{label}</p>
          {loading ? (
            <div className="skeleton mt-2 h-8 w-20" />
          ) : (
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{value}</p>
          )}
          {hint ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
        </div>
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset', iconTones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  )
}

export function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-muted/60 px-3.5 py-3">
      {Icon ? (
        <span className="mt-0.5 text-ink-subtle">
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-ink-subtle">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium text-ink">{value || '—'}</p>
      </div>
    </div>
  )
}
