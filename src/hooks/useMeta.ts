import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiEnvelope, MetaBootstrap } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'

export function useMeta() {
  const status = useAuthStore((state) => state.status)

  return useQuery({
    queryKey: ['meta', 'bootstrap'],
    queryFn: async () => {
      const { data } = await api.get<ApiEnvelope<MetaBootstrap>>('/meta/bootstrap')
      return data.data
    },
    enabled: status === 'authenticated',
    staleTime: 5 * 60 * 1000,
  })
}

export function useCurrentUser() {
  return useAuthStore((state) => state.user)
}

export function usePermission(permission: string | string[]) {
  return useAuthStore((state) => {
    const required = Array.isArray(permission) ? permission : [permission]
    return required.every((item) => state.user?.permissions?.includes(item))
  })
}

export function useAnyPermission(permissions: string[]) {
  return useAuthStore((state) => permissions.some((permission) => state.user?.permissions?.includes(permission)))
}
