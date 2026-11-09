/* oxlint-disable react/only-export-components -- provider and its hook live together */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getToken, setToken, setUnauthorizedHandler } from '../api/client'
import { authApi } from '../api/market'
import type { Session, User } from '../types'

interface AuthState {
  user: User | null
  /** True until the saved token has been checked on first load. */
  restoring: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Re-fetch the wallet after anything that moves gold. */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [restoring, setRestoring] = useState(() => getToken() !== null)

  const clear = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(clear)
    if (!getToken()) return
    authApi.me().then(setUser).catch(clear).finally(() => setRestoring(false))
  }, [clear])

  const start = useCallback((session: Session) => {
    setToken(session.token)
    setUser(session.user)
  }, [])

  const login = useCallback(async (u: string, p: string) => start(await authApi.login(u, p)), [start])
  const register = useCallback(async (u: string, p: string) => start(await authApi.register(u, p)), [start])
  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined) // sign out locally even if the server is unreachable
    clear()
  }, [clear])
  const refreshUser = useCallback(async () => setUser(await authApi.me()), [])

  const value = useMemo(
    () => ({ user, restoring, login, register, logout, refreshUser }),
    [user, restoring, login, register, logout, refreshUser],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside AuthProvider')
  return auth
}

/** For pages behind RequireAuth, where the user is always present. */
export function useUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('useUser called outside a signed-in route')
  return user
}
