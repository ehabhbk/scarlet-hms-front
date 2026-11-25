import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/scarlet-mark.png"
      alt="Scarlet"
      className={cn('h-10 w-auto object-contain', className)}
      draggable={false}
    />
  )
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src="/brand/scarlet-wordmark.png"
      alt="Scarlet Care"
      className={cn('h-12 w-auto object-contain', className)}
      draggable={false}
    />
  )
}
