import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function DispatchSafetyViewGuard({ children }) {
  const { user, loading, hasDispatchSafetyViewAccess } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!hasDispatchSafetyViewAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function SafetyEditGuard({ children }) {
  const { canEditSafetyEntities, loading } = useAuth();

  if (loading) return null;
  if (!canEditSafetyEntities) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
