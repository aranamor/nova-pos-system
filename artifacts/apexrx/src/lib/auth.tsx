import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setCsrfToken, setUnauthorizedHandler, type AuthUser, type Role } from "./api";

interface AuthContextValue {
  loggedIn: boolean;
  user: AuthUser | null;
  username: string | null;
  role: Role | null;
  loading: boolean;
  needsBootstrap: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setCsrfToken(me.csrfToken ?? null);
      setUser(me.loggedIn && me.user ? me.user : null);
      // Probe bootstrap by attempting signup detection: if signup with no body
      // returns 400 (validation) we can't tell. Instead infer from absence of
      // logged-in state on first load — the backend allows /signup to create
      // the first admin without auth.
      setNeedsBootstrap(false);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    refresh();
  }, [refresh]);

  const login = useCallback(async (u: string, p: string) => {
    const r = await api.login(u, p);
    if (!r.success || !r.user) throw new Error(r.message ?? "Login failed");
    // Refresh to pull csrf + canonical user
    const me = await api.me();
    setCsrfToken(me.csrfToken ?? null);
    setUser(me.user ?? r.user);
    return r.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setUser(null);
    setCsrfToken(null);
  }, []);

  const hasRole = useCallback(
    (...roles: Role[]) => !!user && roles.includes(user.role),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      loggedIn: !!user,
      user,
      username: user?.username ?? null,
      role: user?.role ?? null,
      loading,
      needsBootstrap,
      login,
      logout,
      refresh,
      hasRole,
    }),
    [user, loading, needsBootstrap, login, logout, refresh, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
