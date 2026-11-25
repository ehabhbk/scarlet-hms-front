import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth'
import { EmptyState } from '@/components/ui/PageHeader'

export function RequirePermission({
  permission,
  mode = 'all',
  children,
}: {
  permission: string | string[]
  mode?: 'all' | 'any'
  children: ReactNode
}) {
  const { t } = useTranslation()
  const permissions = useAuthStore((state) => state.user?.permissions ?? [])
  const required = Array.isArray(permission) ? permission : [permission]
  const allowed =
    mode === 'any'
      ? required.some((item) => permissions.includes(item))
      : required.every((item) => permissions.includes(item))

  if (!allowed) {
    return (
      <div className="card">
        <EmptyState
          icon={ShieldAlert}
          title={t('errors.forbidden')}
          description={t('errors.forbidden')}
        />
      </div>
    )
  }

  return <>{children}</>
}
