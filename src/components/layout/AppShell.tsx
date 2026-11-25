import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppShell() {
  return (
    <div className="min-h-screen bg-surface-muted">
      <Sidebar />
      <div className="lg:ps-72">
        <Topbar />
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
        <footer className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-2 px-4 pb-6 pt-2 text-[11px] text-ink-subtle sm:px-6 lg:px-8">
          <span>Scarlet Care · Scarlet HMS</span>
          <span>© {new Date().getFullYear()} — جميع الحقوق محفوظة</span>
        </footer>
      </div>
    </div>
  )
}
