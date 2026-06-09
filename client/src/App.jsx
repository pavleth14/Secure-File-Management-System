import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import RoleGuard from './components/RoleGuard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import FoldersPage from './pages/FoldersPage';
import FolderFilesPage from './pages/FolderFilesPage';
import AdminPage from './pages/AdminPage';
import UsersPage from './pages/UsersPage';
import GroupsPage from './pages/GroupsPage';
import LogsPage from './pages/LogsPage';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/folders" element={<FoldersPage />} />
        <Route path="/folders/:id/files" element={<FolderFilesPage />} />
        <Route
          path="/admin"
          element={
            <RoleGuard roles={['SUPER_ADMIN']}>
              <AdminPage />
            </RoleGuard>
          }
        />
        <Route
          path="/users"
          element={
            <RoleGuard roles={['SUPER_ADMIN', 'ADMIN']}>
              <UsersPage />
            </RoleGuard>
          }
        />
        <Route
          path="/groups"
          element={
            <RoleGuard roles={['SUPER_ADMIN']}>
              <GroupsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <RoleGuard roles={['SUPER_ADMIN', 'ADMIN']}>
              <LogsPage />
            </RoleGuard>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
