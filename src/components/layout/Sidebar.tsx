import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  MonitorPlay,
  ScrollText,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BrandMark } from '@/components/brand/Brand'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { usePermission } from '@/hooks/useMeta'
import { useIsRtl, useLocale } from '@/hooks/useLocale'
import { nameOf } from '@/lib/format'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  permission?: string
  end?: boolean
  external?: boolean
}

interface NavSection {
  label: string
  items: NavItem[]
}

function useNavSections(): NavSection[] {
  const canViewUsers = usePermission('users.manage')
  const canManageRoles = usePermission('roles.manage')
  const canViewAudit = usePermission('audit.view')
  const canManageSettings = usePermission('settings.manage')
  const branchId = useAuthStore((state) => state.user?.branch_id)

  return [
    {
      label: 'nav.main',
      items: [{ to: '/dashboard', label: 'nav.dashboard', icon: LayoutDashboard, permission: 'dashboard.view' }],
    },
    {
      label: 'nav.clinical',
      items: [
        { to: '/patients', label: 'nav.patients', icon: Users, permission: 'patients.view' },
        { to: '/appointments', label: 'nav.appointments', icon: CalendarDays, permission: 'appointments.view' },
        { to: '/queues', label: 'nav.queues', icon: ListOrdered, permission: 'queues.view' },
        { to: '/encounters', label: 'nav.encounters', icon: Stethoscope, permission: 'encounters.view' },
        {
          to: branchId ? `/display/${branchId}` : '/display',
          label: 'nav.display',
          icon: MonitorPlay,
          external: true,
        },
      ],
    },
    {
      label: 'nav.administration',
      items: [
        ...(canViewUsers ? [{ to: '/staff', label: 'nav.staff', icon: ShieldCheck }] : []),
        ...(canManageRoles ? [{ to: '/roles', label: 'nav.roles', icon: ShieldCheck }] : []),
        { to: '/reports', label: 'nav.reports', icon: BarChart3, permission: 'dashboard.view' },
        ...(canViewAudit ? [{ to: '/audit', label: 'nav.audit', icon: ScrollText }] : []),
        ...(canManageSettings ? [{ to: '/settings', label: 'nav.settings', icon: Settings }] : []),
      ],
    },
  ]
}

export function Sidebar() {
  const { t } = useTranslation()
  const locale = useLocale()
  const isRtl = useIsRtl()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const mobileOpen = useUiStore((state) => state.mobileNavOpen)
  const setMobileNav = useUiStore((state) => state.setMobileNav)
  const sections = useNavSections()

  useEffect(() => {
    setMobileNav(false)
  }, [location.pathname, setMobileNav])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const isVisible = (item: NavItem) => !item.permission || Boolean(user?.permissions?.includes(item.permission))

  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-scarlet-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNav(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-72 flex-col bg-gradient-to-b from-[#44081A] via-[#5E0E26] to-[#32040F] text-white transition-transform duration-300 ease-out lg:z-30 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1 shadow-lg shadow-black/20">
              <BrandMark className="h-9 w-auto" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-extrabold tracking-tight">{t('common.appName')}</p>
              <p className="text-[11px] font-medium text-white/55">{t('common.appFullName')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileNav(false)}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-5 mt-4 h-px bg-white/10" />

        <nav className="scrollbar-none flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => {
            const items = section.items.filter(isVisible)
            if (!items.length) return null

            return (
              <div key={section.label} className="mb-5">
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                  {t(section.label)}
                </p>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon
                    const linkClasses = ({ isActive }: { isActive: boolean }) =>
                      cn(
                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150',
                        isActive
                          ? 'bg-white/12 text-white shadow-inner ring-1 ring-inset ring-white/10'
                          : 'text-white/65 hover:bg-white/8 hover:text-white',
                      )

                    return (
                      <li key={item.to}>
                        {item.external ? (
                          <a href={item.to} target="_blank" rel="noreferrer" className={linkClasses({ isActive: false })}>
                            <Icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
                            <span className="flex-1">{t(item.label)}</span>
                            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/60">
                              TV
                            </span>
                          </a>
                        ) : (
                          <NavLink to={item.to} end={item.end} className={linkClasses}>
                            <Icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
                            <span className="flex-1">{t(item.label)}</span>
                          </NavLink>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white/6 p-3 ring-1 ring-inset ring-white/10">
            <Avatar name={user?.name ?? '?'} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user?.name}</p>
              <p className="truncate text-[11px] text-white/55">
                {user?.display_role ?? user?.role_names?.[0] ?? user?.job_title ?? ''}
              </p>
              {user?.branch ? (
                <p className="mt-0.5 truncate text-[10px] text-white/40">{nameOf(user.branch, locale)}</p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-white/50 hover:bg-white/10 hover:text-white"
              title={t('common.logout')}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}
