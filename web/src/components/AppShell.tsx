import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/search', label: 'Search' },
  { path: '/messages', label: 'Messages' },
  { path: '/profile', label: 'Profile' },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleSellClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault()
      navigate('/login')
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background text-text-primary">

      {/* ── Desktop Header ──────────────────────────────── */}
      <header
        className="hidden md:block sticky top-0 z-40 w-full"
        style={{ boxShadow: 'var(--shadow-nav)' }}
      >
        <div className="bg-white/95 backdrop-blur-md border-b border-border">
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
      <main className="flex-1 pb-20 md:pb-0 animate-fade-in">{children}</main>

      {/* ── Mobile Bottom Nav ─────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40 safe-area-pb">
        <div className="flex items-center justify-around py-2">
          {[...navLinks, { path: '/sell', label: 'Sell' }].map((t) => {
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
