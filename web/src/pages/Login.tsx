import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import type { AuthResponse } from '../lib/types'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<AuthResponse>('/auth/login', { email, password })
      const { accessToken, refreshToken, user } = res.data
      login(accessToken, refreshToken, user)
      navigate('/', { replace: true })
    } catch (err: any) {
      const msg = err.response?.data?.message
      if (Array.isArray(msg)) {
        setError(msg.join('. '))
      } else if (typeof msg === 'string' && msg) {
        setError(msg)
      } else {
        setError('Invalid email or password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm bg-surface rounded-2xl shadow-sm border border-card-border p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-text-primary text-center mb-1">Welcome back</h1>
        <p className="text-text-secondary text-center text-sm mb-6">Sign in to your PocketTrade account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-input-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-input-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-error text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary text-white font-medium py-3 text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-text-secondary space-y-2">
          <Link to="/forgot-password" className="text-primary hover:underline block">
            Forgot password?
          </Link>
          <p>
            New to PocketTrade?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
