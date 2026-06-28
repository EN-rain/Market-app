import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { User } from '../lib/types'
import { tokenStore } from '../lib/tokenStore'
import { api, refreshApi } from '../lib/api'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (accessToken: string, user: User) => void
  logout: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const restoreSession = async () => {
      const storedUser = tokenStore.getUser()
      if (!storedUser) {
        tokenStore.clear()
        if (!cancelled) {
          setUserState(null)
          setIsLoading(false)
        }
        return
      }

      try {
        const response = await refreshApi.post<{ accessToken: string }>('/auth/refresh', {})
        tokenStore.setAccess(response.data.accessToken)
        if (!cancelled) setUserState(storedUser)
      } catch {
        tokenStore.clear()
        if (!cancelled) setUserState(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    const handleAuthCleared = () => {
      tokenStore.clear()
      setUserState(null)
      setIsLoading(false)
    }

    void restoreSession()
    window.addEventListener('pt-auth-cleared', handleAuthCleared)

    return () => {
      cancelled = true
      window.removeEventListener('pt-auth-cleared', handleAuthCleared)
    }
  }, [])

  const login = useCallback((accessToken: string, user: User) => {
    tokenStore.setAccess(accessToken)
    tokenStore.setUser(user)
    setUserState(user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {})
    } catch {
      // Local logout must still complete when the server is unavailable.
    }
    tokenStore.clear()
    setUserState(null)
  }, [])

  const setUser = useCallback((user: User) => {
    tokenStore.setUser(user)
    setUserState(user)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user && tokenStore.getAccess()),
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
