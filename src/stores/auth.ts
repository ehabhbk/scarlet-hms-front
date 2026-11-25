import { create } from 'zustand'
import { api, parseApiError, tokenStorage } from '@/lib/api'
import type { ApiEnvelope, LoginResponse, Locale, User } from '@/lib/types'

interface AuthState {
  user: User | null
  status: 'idle' | 'loading' | 'authenticated' | 'guest'
  error: string | null
  login: (identifier: string, password: string) => Promise<void>
  bootstrap: () => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  updatePreferences: (preferences: { locale?: Locale; theme?: 'light' | 'dark' | 'system' }) => Promise<void>
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  error: null,

  async login(identifier, password) {
    set({ status: 'loading', error: null })

    try {
      const { data } = await api.post<ApiEnvelope<LoginResponse>>('/auth/login', {
        identifier,
        password,
        device_name: 'scarlet-web',
      })

      tokenStorage.set(data.data.token)
      set({ user: data.data.user, status: 'authenticated', error: null })
    } catch (error) {
      const parsed = parseApiError(error)
      set({ status: 'guest', error: parsed.message })
      throw error
    }
  },

  async bootstrap() {
    if (!tokenStorage.get()) {
      set({ user: null, status: 'guest' })
      return
    }

    set({ status: 'loading' })

    try {
      const { data } = await api.get<ApiEnvelope<User>>('/auth/me')
      set({ user: data.data, status: 'authenticated' })
    } catch {
      tokenStorage.clear()
      set({ user: null, status: 'guest' })
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // Token may already be revoked; local cleanup still proceeds.
    } finally {
      tokenStorage.clear()
      set({ user: null, status: 'guest', error: null })
    }
  },

  async refreshUser() {
    if (!tokenStorage.get()) return

    const { data } = await api.get<ApiEnvelope<User>>('/auth/me')
    set({ user: data.data, status: 'authenticated' })
  },

  async updatePreferences(preferences) {
    await api.patch<ApiEnvelope<User>>('/auth/preferences', preferences)
    const current = get().user
    if (current) {
      set({ user: { ...current, ...preferences } })
    }
  },

  hasPermission(permission) {
    const user = get().user
    return Boolean(user?.permissions?.includes(permission))
  },

  hasAnyPermission(permissions) {
    const user = get().user
    return permissions.some((permission) => user?.permissions?.includes(permission))
  },
}))
