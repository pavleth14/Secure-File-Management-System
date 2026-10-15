import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function MaintenanceAccessGuard({ children }) {
  const { hasMaintenanceAccess } = useAuth();
  const location = useLocation();

  if (!hasMaintenanceAccess) {
    return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />;
  }

  return children;
}
