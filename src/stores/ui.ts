import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme } from '@/lib/types'

const THEME_KEY = 'scarlet_theme'

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  return theme
}

export function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.style.colorScheme = resolved
  localStorage.setItem(THEME_KEY, theme)
}

interface UiState {
  theme: Theme
  sidebarCollapsed: boolean
  mobileNavOpen: boolean
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setMobileNav: (open: boolean) => void
  initTheme: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      sidebarCollapsed: false,
      mobileNavOpen: false,

      setTheme(theme) {
        applyTheme(theme)
        set({ theme })
      },

      toggleSidebar() {
        set({ sidebarCollapsed: !get().sidebarCollapsed })
      },

      setMobileNav(open) {
        set({ mobileNavOpen: open })
      },

      initTheme() {
        applyTheme(get().theme)
      },
    }),
    {
      name: 'scarlet-ui',
      partialize: (state) => ({ theme: state.theme, sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
)
