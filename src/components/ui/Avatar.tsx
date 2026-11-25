import { cn } from '@/lib/utils'

const sizes = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
}

export function Avatar({
  name,
  size = 'md',
  tone = 'scarlet',
  className,
}: {
  name: string
  size?: keyof typeof sizes
  tone?: 'scarlet' | 'neutral' | 'success'
  className?: string
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('') || '?'

  const tones = {
    scarlet: 'bg-gradient-to-br from-scarlet-700 to-scarlet-950 text-white',
    neutral: 'bg-surface-sunken text-ink-muted ring-1 ring-line',
    success: 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white',
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-wide',
        sizes[size],
        tones[tone],
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  )
}
