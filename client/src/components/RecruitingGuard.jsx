import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RecruitingAccessGuard({ children }) {
  const { hasRecruitingAccess } = useAuth();

  if (!hasRecruitingAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function RecruitingManagerGuard({ children }) {
  const { user } = useAuth();

  if (!user?.isRecruitingManager) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function RecruitingBoardGuard({ children }) {
  const { user, hasRecruitingAccess, isRecruitingManager, isRecruitingModuleUser } = useAuth();
  const { userId } = useParams();

  if (!hasRecruitingAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isRecruitingManager || isRecruitingModuleUser) {
    return children;
  }

  if (user.isRecruiter && user.id === userId) {
    return children;
  }

  return <Navigate to="/dashboard" replace />;
}
