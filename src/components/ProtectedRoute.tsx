import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/** Blocks unauthenticated access to admin pages. Public /p and /pay routes stay open. */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm font-medium">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  return <Outlet />;
}
