import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/** Blocks unauthenticated access to admin pages. Public /p and /pay routes stay open. */
export default function ProtectedRoute() {
  const { user, loading, cloudReady } = useAuth();
  const loc = useLocation();

  if (loading || (user && !cloudReady)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm font-medium">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
          <div>{loading ? 'Signing in…' : 'Syncing data across devices…'}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  return <Outlet />;
}
