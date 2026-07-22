import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RecruitingAccessGuard({ children }) {
  const { hasRecruitingAccess } = useAuth();
  const location = useLocation();
  const accessGranted = hasRecruitingAccess;

  console.log('[RECRUITING-ACCESS] route guard', {
    requestedRoute: location.pathname,
    accessGranted,
  });

  if (!accessGranted) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function RecruitingImportGuard({ children }) {
  const { isRecruitingManager, isSuperAdmin, hasRecruitingAccess } = useAuth();
  const location = useLocation();
  const accessGranted = hasRecruitingAccess && (isRecruitingManager || isSuperAdmin);

  console.log('[RECRUITING-ACCESS] route guard', {
    requestedRoute: location.pathname,
    accessGranted,
  });

  if (!accessGranted) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function RecruitingManagerGuard({ children }) {
  const { isRecruitingManager, isSuperAdmin, hasRecruitingAccess } = useAuth();
  const location = useLocation();
  const accessGranted = hasRecruitingAccess && (isRecruitingManager || isSuperAdmin);

  console.log('[RECRUITING-ACCESS] route guard', {
    requestedRoute: location.pathname,
    accessGranted,
  });

  if (!accessGranted) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function RecruitingBoardGuard({ children }) {
  const { hasRecruitingAccess } = useAuth();
  const location = useLocation();
  const accessGranted = hasRecruitingAccess;

  console.log('[RECRUITING-ACCESS] route guard', {
    requestedRoute: location.pathname,
    accessGranted,
  });

  if (!accessGranted) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
