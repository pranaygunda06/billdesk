import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { adminLogin, adminLogout, watchAuth } from '../lib/firebase';
import { db } from '../lib/db';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  cloudReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);

  useEffect(() => {
    const unsub = watchAuth((u) => {
      setUser(u);
      setLoading(false); // UI opens immediately — like Swart

      if (u) {
        // Cloud pull in background — does NOT block dashboard
        void db
          .bindCloudUser(u.uid)
          .then(() => setCloudReady(true))
          .catch((e) => {
            console.error('Cloud bind failed', e);
            setCloudReady(true);
          });
      } else {
        db.clearCloudUser();
        setCloudReady(false);
      }
    });
    return unsub;
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      cloudReady,
      async login(email, password) {
        const u = await adminLogin(email, password);
        setUser(u);
        setLoading(false);
        // Push/pull shop data in background — login feels instant
        void db
          .bindCloudUser(u.uid)
          .then(() => setCloudReady(true))
          .catch(() => setCloudReady(true));
      },
      async logout() {
        void db.forceCloudPush().catch(() => {});
        db.clearCloudUser();
        setCloudReady(false);
        await adminLogout();
        setUser(null);
      },
    }),
    [user, loading, cloudReady],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
