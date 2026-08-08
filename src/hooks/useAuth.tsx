import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { adminLogin, adminLogout, watchAuth } from '../lib/firebase';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = watchAuth((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      async login(email, password) {
        await adminLogin(email, password);
      },
      async logout() {
        await adminLogout();
      },
    }),
    [user, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
