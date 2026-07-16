import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RecruitingAccessGuard({ children }) {
  const { user } = useAuth();

  if (!user?.isRecruiter && !user?.isRecruitingManager) {
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
  const { user } = useAuth();
  const { userId } = useParams();

  if (!user?.isRecruiter && !user?.isRecruitingManager) {
    return <Navigate to="/dashboard" replace />;
  }

  if (user.isRecruitingManager) {
    return children;
  }

  if (user.isRecruiter && user.id === userId) {
    return children;
  }

  return <Navigate to="/dashboard" replace />;
}
