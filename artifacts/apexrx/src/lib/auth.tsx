import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setUnauthorizedHandler } from "./api";

interface AuthContextValue {
  loggedIn: boolean;
  username: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setLoggedIn(!!me.loggedIn);
      setUsername(me.username ?? null);
    } catch {
      setLoggedIn(false);
      setUsername(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setLoggedIn(false);
      setUsername(null);
    });
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (u: string, p: string) => {
      const r = await api.login(u, p);
      if (!r.success) throw new Error(r.message ?? "Login failed");
      setLoggedIn(true);
      setUsername(r.username ?? u);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setLoggedIn(false);
    setUsername(null);
  }, []);

  const value = useMemo(
    () => ({ loggedIn, username, loading, login, logout, refresh }),
    [loggedIn, username, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
