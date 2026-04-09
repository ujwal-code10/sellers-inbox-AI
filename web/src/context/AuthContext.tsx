import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authApi } from '../services/api/authApi'
import type { User } from '../services/api/types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Check auth status on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await authApi.getMe()
        setUser(response.user)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password)
    setUser(response.user)
  }

  const signup = async (name: string, email: string, password: string) => {
    const response = await authApi.signup(name, email, password)
    setUser(response.user)
  }

  const logout = () => {
    void authApi.logout().catch(() => undefined)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
