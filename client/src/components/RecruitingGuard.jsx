import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RecruitingAccessGuard({ children }) {
  const { hasRecruitingAccess } = useAuth();

  if (!hasRecruitingAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function RecruitingImportGuard({ children }) {
  const { isRecruitingManager, isSuperAdmin } = useAuth();

  if (isRecruitingManager || isSuperAdmin) {
    return children;
  }

  return <Navigate to="/dashboard" replace />;
}

export function RecruitingManagerGuard({ children }) {
  const { user } = useAuth();

  if (!user?.isRecruitingManager) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function RecruitingBoardGuard({ children }) {
  const { hasRecruitingAccess } = useAuth();

  if (!hasRecruitingAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
