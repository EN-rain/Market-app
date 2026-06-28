import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { api, wakeBackend } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { getRequestErrorMessage } from '../lib/errorMessage'
import type { AuthResponse } from '../lib/types'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warmingUp, setWarmingUp] = useState(true)

  useEffect(() => {
    let active = true

    void wakeBackend().finally(() => {
      if (active) setWarmingUp(false)
    })

    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      let response: { data: AuthResponse }

      try {
        response = await api.post<AuthResponse>('/auth/login', {
          email: normalizedEmail,
          password,
        })
      } catch (requestError) {
        if (axios.isAxiosError(requestError) && requestError.code === 'ECONNABORTED') {
          setError('Waking up the server. Retrying sign in...')
          await wakeBackend()
          response = await api.post<AuthResponse>('/auth/login', {
            email: normalizedEmail,
            password,
          })
        } else {
          throw requestError
        }
      }

      const { accessToken, user } = response.data
      login(accessToken, user)
      navigate('/', { replace: true })
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Invalid email or password.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm bg-surface rounded-2xl shadow-sm border border-card-border p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-text-primary text-center mb-1">Welcome back</h1>
        <p className="text-text-secondary text-center text-sm mb-6">Sign in to your PocketTrade account</p>
        {warmingUp && <p className="mb-4 text-center text-sm text-text-secondary">Starting the server...</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="w-full rounded-xl border border-input-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="you@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="w-full rounded-xl border border-input-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="Password" />
          </div>

          {error && <p className="text-error text-sm" role="alert">{error}</p>}

          <button type="submit" disabled={loading || warmingUp} className="w-full rounded-xl bg-primary text-white font-medium py-3 text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? 'Signing in...' : warmingUp ? 'Starting server...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-text-secondary space-y-2">
          <Link to="/forgot-password" className="text-primary hover:underline block">Forgot password?</Link>
          <p>New to PocketTrade? <Link to="/register" className="text-primary hover:underline font-medium">Create an account</Link></p>
        </div>
      </div>
    </div>
  )
}
