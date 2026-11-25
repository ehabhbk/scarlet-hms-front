import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-scarlet-800 text-white shadow-sm hover:bg-scarlet-900 active:bg-scarlet-950 disabled:hover:bg-scarlet-800',
  secondary:
    'border border-scarlet-200 bg-scarlet-50 text-scarlet-800 hover:bg-scarlet-100 active:bg-scarlet-200/70',
  outline:
    'border border-line-strong bg-surface text-ink shadow-sm hover:bg-surface-muted active:bg-surface-sunken',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger-600 text-white shadow-sm hover:bg-danger-700 active:bg-danger-700',
  subtle: 'bg-surface-sunken text-ink hover:bg-line',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm font-semibold',
  lg: 'h-12 gap-2.5 rounded-xl px-6 text-sm font-bold',
  icon: 'h-9 w-9 rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-scarlet-500/20',
        'disabled:pointer-events-none disabled:opacity-55',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  )
})
