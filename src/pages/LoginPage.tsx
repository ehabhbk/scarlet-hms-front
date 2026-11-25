import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useLocale } from '@/hooks/useLocale'
import { changeAppLocale } from '@/lib/i18n'
import { parseApiError } from '@/lib/api'

const demoAccounts = [
  { username: 'admin', labelKey: 'auth.admin', icon: ShieldCheck },
  { username: 'doctor', labelKey: 'auth.doctor', icon: Activity },
  { username: 'reception', labelKey: 'auth.receptionist', icon: Users },
]

export function LoginPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const status = useAuthStore((state) => state.status)
  const login = useAuthStore((state) => state.login)
  const theme = useUiStore((state) => state.theme)
  const setTheme = useUiStore((state) => state.setTheme)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from

  if (status === 'authenticated') {
    return <Navigate to={from ?? '/dashboard'} replace />
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!identifier.trim() || !password) {
      setError(t('errors.validation'))
      return
    }

    setSubmitting(true)
    try {
      await login(identifier.trim(), password)
      navigate(from ?? '/dashboard', { replace: true })
    } catch (caught) {
      setError(parseApiError(caught).message || t('auth.invalid'))
    } finally {
      setSubmitting(false)
    }
  }

  const pickDemo = (username: string) => {
    setIdentifier(username)
    setPassword('Scarlet@2026')
    setError(null)
  }

  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight

  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#3A0513] via-[#5E0E26] to-[#8A1538] px-10 py-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-scarlet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-scarlet-400/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-1.5 shadow-xl shadow-black/25">
            <img src="/brand/scarlet-mark.png" alt="Scarlet" className="h-11 w-auto object-contain" />
          </span>
          <div>
            <p className="text-lg font-extrabold tracking-tight">Scarlet Care</p>
            <p className="text-[11px] font-medium tracking-[0.22em] text-white/50">DIGITAL SOLUTION</p>
          </div>
        </div>

        <div className="relative my-auto max-w-xl py-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-scarlet-200" />
            {t('common.tagline')}
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.15] tracking-tight">
            {t('auth.heroTitle')}
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/65">{t('auth.heroSubtitle')}</p>

          <ul className="mt-10 space-y-4">
            {[
              { icon: UserRound, label: t('auth.featureRecords') },
              { icon: CalendarDays, label: t('auth.featureQueue') },
              { icon: ShieldCheck, label: t('auth.featureAudit') },
            ].map((feature) => (
              <li key={feature.label} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                  <feature.icon className="h-4 w-4 text-scarlet-100" />
                </span>
                <span className="text-sm font-medium text-white/80">{feature.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[11px] text-white/40">
          <span>© {new Date().getFullYear()} Scarlet Care</span>
          <span>{t('auth.secureNote')}</span>
        </div>
      </section>

      {/* Form panel */}
      <section className="relative flex min-h-screen flex-col bg-surface">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1 shadow-soft ring-1 ring-line">
              <img src="/brand/scarlet-mark.png" alt="Scarlet" className="h-8 w-auto" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-extrabold text-ink">Scarlet Care</p>
              <p className="text-[10px] text-ink-subtle">Scarlet HMS</p>
            </div>
          </div>

          <div className="ms-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeAppLocale(locale === 'ar' ? 'en' : 'ar')}
              title={t('common.language')}
            >
              <Globe className="h-4 w-4" />
            </Button>
            <span className="text-[11px] font-bold text-ink-muted">{locale === 'ar' ? 'EN' : 'ع'}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={t('common.theme')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-10 sm:px-8">
          <div className="animate-slide-up">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-scarlet-700">{t('common.brand')}</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{t('auth.signIn')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t('auth.signInSubtitle')}</p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              {error ? (
                <div className="rounded-xl border border-danger-100 bg-danger-50 px-3.5 py-3 text-sm font-medium text-danger-700" role="alert">
                  {error}
                </div>
              ) : null}

              <div>
                <label htmlFor="identifier" className="mb-1.5 block text-sm font-semibold text-ink">
                  {t('auth.username')}
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                  <Input
                    id="identifier"
                    autoComplete="username"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder={t('auth.usernamePlaceholder')}
                    className="h-12 ps-10 text-sm"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink">
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    className="h-12 ps-10 pe-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-subtle transition hover:text-ink"
                    aria-label={t('auth.password')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" loading={submitting || status === 'loading'}>
                {submitting ? t('auth.signingIn') : t('auth.signIn')}
                {!submitting ? <Arrow className="h-4 w-4" /> : null}
              </Button>
            </form>

            <div className="mt-8 rounded-2xl border border-line bg-surface-muted/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-ink">{t('auth.demoAccounts')}</p>
                <p className="text-[10px] text-ink-subtle">{t('auth.demoHint')}</p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {demoAccounts.map((account) => (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => pickDemo(account.username)}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-3 text-center transition hover:border-scarlet-200 hover:bg-scarlet-50"
                  >
                    <account.icon className="h-4 w-4 text-scarlet-700" />
                    <span className="text-[11px] font-semibold text-ink">{t(account.labelKey)}</span>
                    <span className="font-mono text-[9px] text-ink-subtle">{account.username}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-ink-subtle">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t('auth.secureNote')}
            </div>
            <p className="mt-3 text-center text-[10px] text-ink-subtle">
              © {new Date().getFullYear()} Scarlet Care · {t('auth.copyright')}
            </p>
          </div>
        </div>
      </section>

      {submitting ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-scarlet-100">
          <div className="h-full w-1/2 animate-pulse bg-scarlet-600" />
        </div>
      ) : null}
      {status === 'loading' && !submitting ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-surface/60 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-scarlet-700" />
        </div>
      ) : null}
    </div>
  )
}
