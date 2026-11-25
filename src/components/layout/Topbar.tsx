import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  Globe,
  LogOut,
  Menu,
  MonitorPlay,
  Moon,
  Search,
  Settings,
  Sun,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useLocale } from '@/hooks/useLocale'
import { changeAppLocale } from '@/lib/i18n'
import { nameOf } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Topbar() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const hasPermission = useAuthStore((state) => state.hasPermission)
  const updatePreferences = useAuthStore((state) => state.updatePreferences)
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const setMobileNav = useUiStore((state) => state.setMobileNav)
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const dateLabel = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SD-u-nu-latn' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  const toggleLocale = () => {
    const next = locale === 'ar' ? 'en' : 'ar'
    changeAppLocale(next)
    if (user) void updatePreferences({ locale: next }).catch(() => undefined)
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    if (user) void updatePreferences({ theme: next }).catch(() => undefined)
  }

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const term = search.trim()
    navigate(term ? `/patients?q=${encodeURIComponent(term)}` : '/patients')
    setSearch('')
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-surface/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 lg:px-8">
        <button
          type="button"
          onClick={() => setMobileNav(true)}
          className="rounded-lg p-2 text-ink-muted transition hover:bg-surface-sunken hover:text-ink lg:hidden"
          aria-label={t('nav.menu')}
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden min-w-0 items-center gap-2 text-xs font-medium text-ink-subtle md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="truncate">{dateLabel}</span>
        </div>

        <form onSubmit={submitSearch} className="relative ms-auto hidden w-full max-w-xs md:block lg:max-w-sm">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('common.searchPlaceholder')}
            className="h-9 w-full rounded-xl border border-line bg-surface-muted ps-9 pe-3 text-xs text-ink transition placeholder:text-ink-subtle focus:border-scarlet-400 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-scarlet-500/10"
          />
        </form>

        <div className="ms-auto flex items-center gap-1 md:ms-0">
          <Button variant="ghost" size="icon" onClick={toggleLocale} title={t('common.language')}>
            <Globe className="h-4 w-4" />
            <span className="sr-only">{t('common.language')}</span>
          </Button>
          <span className="hidden text-[11px] font-bold text-ink-muted sm:inline">
            {locale === 'ar' ? 'EN' : 'ع'}
          </span>
          <Button variant="ghost" size="icon" onClick={toggleTheme} title={t('common.theme')}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <div className="mx-1 hidden h-7 w-px bg-line sm:block" />

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-xl p-1 ps-2 transition hover:bg-surface-sunken"
            >
              <div className="hidden text-end sm:block">
                <p className="max-w-[140px] truncate text-xs font-bold leading-tight text-ink">{user?.name}</p>
                <p className="max-w-[140px] truncate text-[10px] text-ink-muted">
                  {user?.display_role ?? user?.job_title}
                </p>
              </div>
              <Avatar name={user?.name ?? '?'} size="sm" />
              <ChevronDown className={cn('h-3.5 w-3.5 text-ink-subtle transition', menuOpen && 'rotate-180')} />
            </button>

            {menuOpen ? (
              <div className="absolute end-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift animate-scale-in">
                <div className="border-b border-line bg-surface-muted/60 px-4 py-3">
                  <p className="truncate text-sm font-bold text-ink">{user?.name}</p>
                  <p className="truncate text-xs text-ink-muted">{user?.email ?? user?.username}</p>
                  {user?.branch ? (
                    <p className="mt-1 truncate text-[11px] text-ink-subtle">{nameOf(user.branch, locale)}</p>
                  ) : null}
                </div>
                <div className="p-1.5">
                  <Link
                    to="/display"
                    target="_blank"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
                  >
                    <MonitorPlay className="h-4 w-4" />
                    {t('nav.display')}
                  </Link>
                  {hasPermission('settings.manage') ? (
                    <Link
                      to="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
                    >
                      <Settings className="h-4 w-4" />
                      {t('common.settings')}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-danger-600 transition hover:bg-danger-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('common.logout')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
