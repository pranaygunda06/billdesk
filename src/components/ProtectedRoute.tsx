import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/** Blocks unauthenticated access. Cloud wait max ~2.5s — no endless loading. */
export default function ProtectedRoute() {
  const { user, loading, cloudReady } = useAuth();
  const loc = useLocation();
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    if (!user || cloudReady) return;
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, [user, cloudReady]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm font-medium">
        <div className="text-center">
          <div className="w-9 h-9 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
          <div>Signing in…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  if (!cloudReady && !waited) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm font-medium">
        <div className="text-center">
          <div className="w-9 h-9 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
          <div>Loading your data…</div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
