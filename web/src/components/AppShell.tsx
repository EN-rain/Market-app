import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/search', label: 'Search' },
  { path: '/messages', label: 'Messages' },
  { path: '/profile', label: 'Profile' },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleSellClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault()
      navigate('/login')
    }
  }

  const darkModeLabel = theme === 'dark' ? 'Light mode' : 'Dark mode'

  return (
    <div className="min-h-dvh flex flex-col bg-background text-text-primary animate-page-in">

      {/* ── Desktop Header ──────────────────────────────── */}
      <header
        className="hidden md:block sticky top-0 z-40 w-full animate-slide-down"
        style={{ boxShadow: 'var(--shadow-nav)' }}
      >
        <div className="bg-background/95 backdrop-blur-md border-b border-border">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-8">

            {/* Logo */}
            <Link
              to="/"
              className="font-heading text-xl font-bold text-primary shrink-0 tracking-tight hover:text-primary-dark"
            >
              PocketTrade
            </Link>

            {/* Nav Links */}
            <nav className="flex items-center gap-1">
              {navLinks.map((t) => {
                const isActive = t.path === '/' ? pathname === '/' : pathname.startsWith(t.path)
                return (
                  <Link
                    key={t.path}
                    to={t.path}
                    className={`text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-nav-indicator text-primary font-semibold'
                        : 'text-text-muted hover:bg-surface-high hover:text-text-primary'
                    }`}
                  >
                    {t.label}
                  </Link>
                )
              })}
            </nav>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={darkModeLabel}
                title={darkModeLabel}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-card-border bg-surface text-text-secondary hover:bg-surface-high hover:text-text-primary"
              >
                {theme === 'dark' ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path d="M10 4.25a.75.75 0 0 1 .75.75v.25a.75.75 0 0 1-1.5 0V5a.75.75 0 0 1 .75-.75Zm0 9a.75.75 0 0 1 .75.75v.25a.75.75 0 0 1-1.5 0V14a.75.75 0 0 1 .75-.75Zm5-3.25a.75.75 0 0 1 .75.75.75.75 0 0 1-.75.75h-.25a.75.75 0 0 1 0-1.5H15Zm-9.75.75A.75.75 0 0 1 6 10.75a.75.75 0 0 1-.75.75H5a.75.75 0 0 1 0-1.5h.25ZM13.712 6.288a.75.75 0 0 1 1.06 0l.177.177a.75.75 0 1 1-1.06 1.06l-.177-.176a.75.75 0 0 1 0-1.06Zm-7.247 7.247a.75.75 0 0 1 1.06 0l.177.177a.75.75 0 1 1-1.06 1.06l-.177-.177a.75.75 0 0 1 0-1.06Zm8.484.177a.75.75 0 1 1-1.06 1.06l-.177-.177a.75.75 0 1 1 1.06-1.06l.177.177ZM7.525 6.288a.75.75 0 0 1 0 1.06l-.177.177a.75.75 0 1 1-1.06-1.06l.177-.177a.75.75 0 0 1 1.06 0ZM10 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path d="M11.714 2.046a.75.75 0 0 1 .23.804 6.75 6.75 0 0 0 8.206 8.206.75.75 0 0 1 .803.229 8 8 0 1 1-9.239-9.239Z" />
                  </svg>
                )}
              </button>
              {user ? (
                <>
                  <Link
                    to="/sell"
                    onClick={handleSellClick}
                    className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4"
                      aria-hidden="true"
                    >
                      <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                    </svg>
                    List an item
                  </Link>
                  <button
                    onClick={() => { logout(); navigate('/login') }}
                    className="text-sm font-medium text-text-muted hover:text-error transition-colors cursor-pointer"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm font-medium text-text-secondary hover:text-primary transition-colors cursor-pointer"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center bg-primary hover:bg-primary-dark text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────── */}
      <main className="flex-1 pb-20 md:pb-0 animate-page-in">{children}</main>

      {/* ── Mobile Bottom Nav ─────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40 safe-area-pb animate-slide-up">
        <div className="flex items-center justify-around py-2">
          {[...navLinks, { path: '/sell', label: 'Sell' }, { path: '#theme', label: theme === 'dark' ? 'Light' : 'Dark' }].map((t) => {
            if (t.path === '#theme') {
              return (
                <button
                  key={t.path}
                  type="button"
                  onClick={toggleTheme}
                  className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl active:scale-90 transition-all duration-150 text-text-muted"
                >
                  <span className="text-[10px] font-semibold">{t.label}</span>
                </button>
              )
            }
            const isActive = t.path === '/' ? pathname === '/' : pathname.startsWith(t.path)
            return (
              <Link
                key={t.path}
                to={t.path}
                onClick={t.path === '/sell' ? handleSellClick : undefined}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl active:scale-90 transition-all duration-150 cursor-pointer ${
                  isActive ? 'text-primary' : 'text-text-muted'
                }`}
              >
                <span className="text-[10px] font-semibold">{t.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

    </div>
  )
}
