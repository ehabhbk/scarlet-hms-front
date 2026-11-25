import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { BrandMark } from '@/components/brand/Brand'

export function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-surface-muted">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-soft ring-1 ring-line">
        <BrandMark className="h-11 w-auto" />
      </div>
      <div className="flex items-center gap-2 text-sm font-medium text-ink-muted">
        <span className="h-2 w-2 animate-pulse rounded-full bg-scarlet-600" />
        {label ?? 'جارٍ التحميل…'}
      </div>
    </div>
  )
}

export function RequireAuth() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'idle' || status === 'loading') {
    return <FullScreenLoader />
  }

  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return <Outlet />
}
