import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { getRequestErrorMessage } from '../lib/errorMessage'
import type { AuthResponse, OtpResponse } from '../lib/types'

const RESEND_COOLDOWN_SECONDS = 45

export default function VerifyOTP() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const { email, mode } = (location.state || {}) as { email?: string; mode?: string }

  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!email) navigate('/register', { replace: true })
  }, [email, navigate])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const next = [...code]
    next[index] = value.slice(-1)
    setCode(next)
    if (value && index < 5) inputsRef.current[index + 1]?.focus()
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!digits) return
    event.preventDefault()
    const next = Array.from({ length: 6 }, (_, index) => digits[index] ?? '')
    setCode(next)
    inputsRef.current[Math.min(digits.length, 6) - 1]?.focus()
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent) => {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const fullCode = code.join('')
    if (fullCode.length !== 6) {
      setError('Please enter all 6 digits')
      return
    }

    setError('')
    setLoading(true)
    try {
      if (mode === 'reset') {
        navigate('/reset-password', { state: { email, code: fullCode } })
        return
      }

      const response = await api.post<AuthResponse>('/auth/verify-otp', {
        email: email?.trim().toLowerCase(),
        code: fullCode,
      })
      const { accessToken, refreshToken, user } = response.data
      login(accessToken, refreshToken, user)
      navigate('/', { replace: true })
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Invalid verification code.'))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email || resendLoading || cooldown > 0) return
    setResendLoading(true)
    try {
      await api.post<OtpResponse>('/auth/request-otp', {
        email: email.trim().toLowerCase(),
      })
      setError('')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, 'Failed to resend code.'))
    } finally {
      setResendLoading(false)
    }
  }

  if (!email) return null

  const isResetMode = mode === 'reset'

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm bg-surface rounded-2xl shadow-sm border border-card-border p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-text-primary text-center mb-1">
          {isResetMode ? 'Enter reset code' : 'Verify your email'}
        </h1>
        <p className="text-text-secondary text-center text-sm mb-6">
          Enter the 6-digit code sent to <span className="font-medium text-text-primary">{email}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center gap-2">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(element) => { inputsRef.current[index] = element }}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                aria-label={`Verification digit ${index + 1}`}
                maxLength={1}
                value={digit}
                onChange={(event) => handleChange(index, event.target.value)}
                onPaste={handlePaste}
                onKeyDown={(event) => handleKeyDown(index, event)}
                className="w-12 h-14 text-center text-xl font-semibold rounded-xl border border-input-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            ))}
          </div>

          {error && <p className="text-error text-sm text-center" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary text-white font-medium py-3 text-sm hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Checking…' : isResetMode ? 'Continue' : 'Verify'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          Didn&apos;t receive a code?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || cooldown > 0}
            className="text-primary hover:underline font-medium disabled:opacity-60"
          >
            {resendLoading ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
          </button>
        </p>

        <p className="mt-2 text-center text-sm text-text-secondary">
          <Link to="/login" className="text-primary hover:underline font-medium">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
