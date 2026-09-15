import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, setAccessToken, getAccessToken } from '@/lib/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  /** Self-serve registration always creates a member account. */
  register: (input: { name: string; email: string; phone: string; password: string }) => Promise<{ user: User }>;
  /** `identifier` is an email or a phone number. */
  login: (identifier: string, password: string) => Promise<{ user: User }>;
  applySession: (user: User, accessToken: string) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      if (!getAccessToken()) {
        // maybe a refresh cookie is still valid
        const r = await api<{ user: User; accessToken: string }>('/auth/refresh', {
          method: 'POST',
        }).catch(() => null);
        if (r) {
          setAccessToken(r.accessToken);
          setUser(r.user);
          return;
        }
      }
      const me = await api<{ user: User }>('/auth/me');
      setUser(me.user);
    } catch {
      setAccessToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const register: AuthState['register'] = useCallback(async (input) => {
    const res = await api<{ user: User; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: input,
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    return { user: res.user };
  }, []);

  const login: AuthState['login'] = useCallback(async (identifier, password) => {
    const res = await api<{ user: User; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: { identifier, password },
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    return { user: res.user };
  }, []);

  const applySession: AuthState['applySession'] = useCallback((u, accessToken) => {
    setAccessToken(accessToken);
    setUser(u);
  }, []);

  const logout: AuthState['logout'] = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await api<{ user: User }>('/auth/me');
    setUser(me.user);
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      register,
      login,
      applySession,
      logout,
      refreshUser,
      updateUser,
    }),
    [user, loading, register, login, applySession, logout, refreshUser, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}