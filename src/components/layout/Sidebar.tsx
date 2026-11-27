import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BedDouble,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  FlaskConical,
  LayoutDashboard,
  ListOrdered,
  Microscope,
  MonitorPlay,
  Pill,
  Receipt,
  ScanLine,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Stethoscope,
  TestTubes,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { BrandMark } from '@/components/brand/Brand'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { usePermission } from '@/hooks/useMeta'
import { useIsRtl } from '@/hooks/useLocale'
import { settingsSections } from '@/lib/settingsNav'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  permission?: string
  end?: boolean
  external?: boolean
  children?: NavItem[]
  activeWhen?: (location: Location) => boolean
}

interface NavSection {
  label: string
  items: NavItem[]
}

function matchesLocation(to: string, location: Location): boolean {
  const [pathname, query = ''] = to.split('?')
  if (location.pathname !== pathname) return false
  if (!query) return true

  const expected = new URLSearchParams(query)
  const actual = new URLSearchParams(location.search)
  const expectedSection = expected.get('section')

  // Direct visits to /laboratory and /settings land on their first section.
  if (expectedSection && !actual.has('section')) {
    return (
      (pathname === '/laboratory' && expectedSection === 'collection') ||
      (pathname === '/settings' && expectedSection === 'general')
    )
  }

  return Array.from(expected.entries()).every(([key, value]) => actual.get(key) === value)
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
      items: [{ to: '/dashboard', label: 'nav.dashboard', icon: LayoutDashboard, permission: 'dashboard.view', end: true }],
    },
    {
      label: 'nav.clinical',
      items: [
        { to: '/patients', label: 'nav.patients', icon: Users, permission: 'patients.view', end: true },
        { to: '/appointments', label: 'nav.appointments', icon: CalendarDays, permission: 'appointments.view', end: true },
        { to: '/queues', label: 'nav.queues', icon: ListOrdered, permission: 'queues.view', end: true },
        { to: '/encounters', label: 'nav.doctorNurse', icon: Stethoscope, permission: 'encounters.view', end: true },
        {
          to: '/laboratory',
          label: 'nav.laboratory',
          icon: FlaskConical,
          permission: 'laboratory.view',
          children: [
            { to: '/laboratory?section=collection', label: 'nav.labCollection', icon: TestTubes },
            { to: '/laboratory?section=results', label: 'nav.labResults', icon: Microscope },
          ],
        },
        {
          to: '/radiology',
          label: 'nav.radiology',
          icon: ScanLine,
          permission: 'radiology.view',
          children: [
            { to: '/radiology', label: 'nav.radiologyResults', icon: ScanLine, end: true },
          ],
        },
        { to: '/pharmacy', label: 'nav.pharmacy', icon: Pill, permission: 'prescriptions.view', end: true },
        { to: '/billing', label: 'nav.billing', icon: Receipt, permission: 'billing.view', end: true },
        { to: '/insurance', label: 'nav.insurance', icon: Shield, permission: 'insurance.view', end: true },
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
        ...(canViewUsers ? [{ to: '/staff', label: 'nav.staff', icon: ShieldCheck, end: true }] : []),
        ...(canManageRoles ? [{ to: '/roles', label: 'nav.roles', icon: ShieldCheck, end: true }] : []),
        {
          to: '/reports',
          label: 'nav.reports',
          icon: BarChart3,
          children: [
            { to: '/reports', label: 'nav.reportsOverview', icon: BarChart3, end: true },
            ...(canViewAudit ? [{ to: '/audit', label: 'nav.audit', icon: ScrollText, end: true }] : []),
            { to: '/accounting', label: 'nav.accounting', icon: BookOpen, permission: 'accounting.view', end: true },
          ],
        },
        { to: '/employees', label: 'nav.employees', icon: UserCog, permission: 'users.manage', end: true },
        { to: '/inpatient', label: 'nav.inpatient', icon: BedDouble, permission: 'patients.view', end: true },
        { to: '/insurance-contracts', label: 'nav.insuranceContracts', icon: FileText, permission: 'insurance.view', end: true },
        ...(canManageSettings ? [{
          to: '/settings',
          label: 'nav.settings',
          icon: Settings,
          permission: 'settings.manage',
          children: settingsSections.map((section) => ({
            to: section.to,
            label: section.labelKey,
            icon: section.icon,
          })),
        }] : []),
      ],
    },
  ]
}

export function Sidebar() {
  const { t } = useTranslation()
  const isRtl = useIsRtl()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const mobileOpen = useUiStore((state) => state.mobileNavOpen)
  const setMobileNav = useUiStore((state) => state.setMobileNav)
  const collapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)
  const sections = useNavSections()
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const section of sections) {
      for (const item of section.items) {
        if (item.children?.some((child) => matchesLocation(child.to, location))) {
          initial[item.to] = true
        }
      }
    }

    return initial
  })

  useEffect(() => {
    setMobileNav(false)
  }, [location.pathname, location.search, setMobileNav])

  useEffect(() => {
    setExpanded((previous) => {
      const next = { ...previous }
      for (const section of sections) {
        for (const item of section.items) {
          if (item.children?.some((child) => matchesLocation(child.to, location))) {
            next[item.to] = true
          }
        }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search])

  const isVisible = (item: NavItem) => !item.permission || Boolean(user?.permissions?.includes(item.permission))

  const toggle = (to: string) => {
    if (collapsed) {
      toggleSidebar()
      setExpanded((previous) => ({ ...previous, [to]: true }))
      return
    }

    setExpanded((previous) => ({ ...previous, [to]: !previous[to] }))
  }

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
          'fixed inset-y-0 start-0 z-50 flex w-72 flex-col bg-gradient-to-b from-[#44081A] via-[#5E0E26] to-[#32040F] text-white transition-[width,transform] duration-300 ease-out lg:z-30 lg:translate-x-0',
          collapsed && 'lg:w-20',
          mobileOpen ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full',
        )}
      >
        <div
          className={cn(
            'flex items-center justify-between gap-3 px-5 pt-5',
            collapsed && 'lg:flex-col lg:justify-center lg:px-3',
          )}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-lg shadow-black/20">
              <BrandMark className="h-9 w-auto" />
            </span>
            <div className={cn('leading-tight', collapsed && 'lg:hidden')}>
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

        <div className={cn('mx-5 mt-4 h-px bg-white/10', collapsed && 'lg:mx-3')} />

        <nav className={cn('scrollbar-none flex-1 overflow-y-auto px-3 py-4', collapsed && 'lg:px-2')}>
          {sections.map((section) => {
            const items = section.items
              .map((item) => ({
                ...item,
                visibleChildren: item.children?.filter(isVisible) ?? [],
              }))
              .filter((item) => {
                if (item.children) {
                  return isVisible(item) && item.visibleChildren.length > 0
                }

                return isVisible(item)
              })

            if (!items.length) return null

            return (
              <div key={section.label} className="mb-5">
                <p className={cn('mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35', collapsed && 'lg:hidden')}>
                  {t(section.label)}
                </p>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon
                    const hasChildren = item.children !== undefined
                    const groupActive = item.visibleChildren.some((child) => matchesLocation(child.to, location))
                    const isOpen = hasChildren ? (expanded[item.to] ?? groupActive) : false

                    if (hasChildren) {
                      return (
                        <li key={item.to}>
                          <button
                            type="button"
                            onClick={() => toggle(item.to)}
                            title={collapsed ? t(item.label) : undefined}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150',
                              collapsed && 'lg:justify-center lg:gap-0 lg:px-2',
                              groupActive
                                ? 'bg-white/12 text-white ring-1 ring-inset ring-white/10'
                                : 'text-white/65 hover:bg-white/8 hover:text-white',
                            )}
                            aria-expanded={isOpen}
                          >
                            <Icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
                            <span className={cn('flex-1 text-start', collapsed && 'lg:hidden')}>{t(item.label)}</span>
                            <ChevronDown
                              className={cn(
                                'h-4 w-4 shrink-0 opacity-60 transition-transform',
                                collapsed && 'lg:hidden',
                                isOpen && 'rotate-180',
                              )}
                            />
                          </button>
                          {isOpen ? (
                            <ul className={cn('mt-1 space-y-0.5 border-s-2 border-white/10 ps-2', collapsed && 'lg:hidden')}>
                              {item.visibleChildren.map((child) => {
                                const ChildIcon = child.icon
                                const childActive = child.activeWhen
                                  ? child.activeWhen(location)
                                  : matchesLocation(child.to, location)

                                return (
                                  <li key={child.to}>
                                    <Link
                                      to={child.to}
                                      className={cn(
                                        'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                                        childActive
                                          ? 'bg-white/14 text-white shadow-inner'
                                          : 'text-white/55 hover:bg-white/8 hover:text-white',
                                      )}
                                    >
                                      <ChildIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                      <span className="flex-1">{t(child.label)}</span>
                                    </Link>
                                  </li>
                                )
                              })}
                            </ul>
                          ) : null}
                        </li>
                      )
                    }

                    const linkClasses = ({ isActive }: { isActive: boolean }) =>
                      cn(
                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150',
                        collapsed && 'lg:justify-center lg:gap-0 lg:px-2',
                        isActive
                          ? 'bg-white/12 text-white shadow-inner ring-1 ring-inset ring-white/10'
                          : 'text-white/65 hover:bg-white/8 hover:text-white',
                      )

                    return (
                      <li key={item.to}>
                        {item.external ? (
                          <a
                            href={item.to}
                            target="_blank"
                            rel="noreferrer"
                            className={linkClasses({ isActive: false })}
                            title={collapsed ? t(item.label) : undefined}
                          >
                            <Icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
                            <span className={cn('flex-1', collapsed && 'lg:hidden')}>{t(item.label)}</span>
                            <span className={cn('rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/60', collapsed && 'lg:hidden')}>
                              TV
                            </span>
                          </a>
                        ) : (
                          <NavLink
                            to={item.to}
                            end={item.end}
                            className={linkClasses}
                            title={collapsed ? t(item.label) : undefined}
                          >
                            <Icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
                            <span className={cn('flex-1', collapsed && 'lg:hidden')}>{t(item.label)}</span>
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
          <button
            type="button"
            onClick={toggleSidebar}
            title={collapsed ? t('nav.expand') : t('nav.collapse')}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/65 transition hover:bg-white/8 hover:text-white',
              collapsed && 'lg:justify-center lg:gap-0 lg:px-2',
            )}
          >
            {collapsed ? (
              <ChevronRight className={cn('h-[18px] w-[18px] shrink-0 opacity-80', isRtl && 'rotate-180')} />
            ) : (
              <ChevronLeft className={cn('h-[18px] w-[18px] shrink-0 opacity-80', isRtl && 'rotate-180')} />
            )}
            <span className={cn('flex-1 text-start', collapsed && 'lg:hidden')}>
              {collapsed ? t('nav.expand') : t('nav.collapse')}
            </span>
          </button>
        </div>
      </aside>
    </>
  )
}
