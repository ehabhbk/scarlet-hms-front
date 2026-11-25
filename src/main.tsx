import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/cairo/arabic-400.css'
import '@fontsource/cairo/arabic-600.css'
import '@fontsource/cairo/arabic-700.css'
import '@fontsource/cairo/arabic-800.css'

import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import App from './App'
import './index.css'
import { SplashScreen } from '@/components/brand/SplashScreen'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useLocale } from '@/hooks/useLocale'
import { changeAppLocale } from '@/lib/i18n'
import { parseApiError } from '@/lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = parseApiError(error).status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})

useUiStore.getState().initTheme()

function Boot() {
  const status = useAuthStore((state) => state.status)
  const bootstrap = useAuthStore((state) => state.bootstrap)
  const user = useAuthStore((state) => state.user)
  const setTheme = useUiStore((state) => state.setTheme)

  useEffect(() => {
    if (status === 'idle') {
      void bootstrap()
    }
  }, [status, bootstrap])

  useEffect(() => {
    if (!user) return
    if (user.locale) changeAppLocale(user.locale)
    if (user.theme) setTheme(user.theme)
    // Apply the signed-in user's saved preferences once per identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return null
}

function AppToaster() {
  const locale = useLocale()
  const theme = useUiStore((state) => state.theme)

  return (
    <Toaster
      position="top-center"
      theme={theme}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      richColors
      closeButton
      toastOptions={{
        style: {
          borderRadius: '14px',
          fontFamily: locale === 'ar' ? 'Cairo, Inter, sans-serif' : 'Inter, Cairo, sans-serif',
        },
      }}
    />
  )
}

function Root() {
  const isDisplay = window.location.pathname.startsWith('/display')
  const [splash, setSplash] = useState(
    () => !isDisplay && sessionStorage.getItem('scarlet_splash_seen') !== '1',
  )

  return (
    <>
      <Boot />
      <App />
      {splash ? (
        <SplashScreen
          onDone={() => {
            sessionStorage.setItem('scarlet_splash_seen', '1')
            setSplash(false)
          }}
        />
      ) : null}
      <AppToaster />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
