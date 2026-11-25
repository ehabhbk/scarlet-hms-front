import axios, { AxiosError } from 'axios'
import type { ApiEnvelope } from './types'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://server/scarlet-hms/public/api'

const TOKEN_KEY = 'scarlet_token'

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: 'application/json',
  },
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = tokenStorage.get()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const locale = localStorage.getItem('scarlet_locale') ?? 'ar'
  config.headers['X-Locale'] = locale
  config.headers['Accept-Language'] = locale

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      tokenStorage.clear()

      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/display')) {
        window.location.assign('/login')
      }
    }

    return Promise.reject(error)
  },
)

export interface ParsedApiError {
  message: string
  code?: string
  status?: number
  errors: Record<string, unknown>
  duplicates?: Array<{
    id: number
    mrn: string
    name: string
    name_ar?: string
    name_en?: string
    phone?: string | null
    date_of_birth?: string | null
    score: number
    reasons: string[]
  }>
}

export function parseApiError(error: unknown): ParsedApiError {
  if (axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
    const payload = error.response?.data
    const errors = payload?.errors ?? {}
    const duplicates = (errors.duplicates as ParsedApiError['duplicates']) ?? undefined

    return {
      message: payload?.message ?? error.message,
      code: payload?.code,
      status: error.response?.status,
      errors,
      duplicates,
    }
  }

  if (error instanceof Error) {
    return { message: error.message, errors: {} }
  }

  return { message: 'Unexpected error', errors: {} }
}

export function getFieldError(error: ParsedApiError, field: string): string | undefined {
  const value = error.errors?.[field]

  if (Array.isArray(value)) {
    return value[0] as string
  }

  if (typeof value === 'string') {
    return value
  }

  return undefined
}
