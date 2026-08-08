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
    const unsub = watchAuth(async (u) => {
      setUser(u);
      if (u) {
        setCloudReady(false);
        try {
          // Pull shared data for this email onto this device
          await db.bindCloudUser(u.uid);
        } catch (e) {
          console.error('Cloud bind failed', e);
        } finally {
          setCloudReady(true);
          setLoading(false);
        }
      } else {
        db.clearCloudUser();
        setCloudReady(false);
        setLoading(false);
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
        setLoading(true);
        try {
          const u = await adminLogin(email, password);
          await db.bindCloudUser(u.uid);
          setCloudReady(true);
        } finally {
          setLoading(false);
        }
      },
      async logout() {
        // Push latest data before logout so other devices stay in sync
        try {
          await db.forceCloudPush();
        } catch {
          /* ignore */
        }
        db.clearCloudUser();
        await adminLogout();
        setCloudReady(false);
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
