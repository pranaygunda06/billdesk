import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Fast like ps-enterprises-swart:
 * Only wait for Firebase Auth — never block on cloud sync.
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const loc = useLocation();

  // Brief check only while Firebase restores session (usually <300ms)
  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  return <Outlet />;
}
