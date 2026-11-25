import { cn } from '@/lib/utils'

export interface TabItem {
  id: string
  label: string
  count?: number
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn('scrollbar-none flex gap-1 overflow-x-auto rounded-xl bg-surface-sunken p-1', className)}>
      {items.map((item) => {
        const active = item.id === value

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition',
              active
                ? 'bg-surface text-ink shadow-sm'
                : 'text-ink-muted hover:bg-surface/60 hover:text-ink',
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                  active ? 'bg-scarlet-50 text-scarlet-800' : 'bg-surface text-ink-subtle',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
