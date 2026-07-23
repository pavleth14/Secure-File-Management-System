import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import RoleGuard from './components/RoleGuard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import FoldersPage from './pages/FoldersPage';
import FolderFilesPage from './pages/FolderFilesPage';
import MyFilesPage from './pages/MyFilesPage';
import AdminPage from './pages/AdminPage';
import UsersPage from './pages/UsersPage';
import GroupsPage from './pages/GroupsPage';
import LogsPage from './pages/LogsPage';
import RecruiterBoardPage from './pages/RecruiterBoardPage';
import ImportLeadsPage from './pages/ImportLeadsPage';
import ArchiveLeadsPage from './pages/ArchiveLeadsPage';
import LeadSourcesPage from './pages/LeadSourcesPage';
import TrucksPage from './pages/safety/TrucksPage';
import TrailersPage from './pages/safety/TrailersPage';
import DriversPage from './pages/safety/DriversPage';
import AssignmentsPage from './pages/safety/AssignmentsPage';
import {
  RecruitingAccessGuard,
  RecruitingBoardGuard,
  RecruitingImportGuard,
  RecruitingManagerGuard,
} from './components/RecruitingGuard';
import {
  DispatchSafetyViewGuard,
  DispatchModuleGuard,
  ArchivedLoadsGuard,
} from './components/DispatchSafetyGuard';
import LoadsPage from './pages/dispatch/LoadsPage';
import ArchiveLoadsPage from './pages/dispatch/ArchiveLoadsPage';

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
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/register"
          element={
            <RoleGuard roles={['SUPER_ADMIN', 'ADMIN']}>
              {/* <RegisterPage /> */}
            </RoleGuard>
          }
        />
        <Route path="/folders" element={<FoldersPage />} />
        <Route path="/folders/:id/files" element={<FolderFilesPage />} />
        <Route path="/my-files" element={<MyFilesPage />} />
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
        <Route
          path="/recruiting/boards/:userId"
          element={
            <RecruitingAccessGuard>
              <RecruitingBoardGuard>
                <RecruiterBoardPage />
              </RecruitingBoardGuard>
            </RecruitingAccessGuard>
          }
        />
        <Route
          path="/recruiting/import"
          element={
            <RecruitingAccessGuard>
              <RecruitingImportGuard>
                <ImportLeadsPage />
              </RecruitingImportGuard>
            </RecruitingAccessGuard>
          }
        />
        <Route
          path="/recruiting/archive"
          element={
            <RecruitingAccessGuard>
              <RecruitingManagerGuard>
                <ArchiveLeadsPage />
              </RecruitingManagerGuard>
            </RecruitingAccessGuard>
          }
        />
        <Route
          path="/recruiting/sources"
          element={
            <RecruitingAccessGuard>
              <RecruitingManagerGuard>
                <LeadSourcesPage />
              </RecruitingManagerGuard>
            </RecruitingAccessGuard>
          }
        />
        <Route
          path="/safety/trucks"
          element={
            <DispatchSafetyViewGuard>
              <TrucksPage />
            </DispatchSafetyViewGuard>
          }
        />
        <Route
          path="/safety/trailers"
          element={
            <DispatchSafetyViewGuard>
              <TrailersPage />
            </DispatchSafetyViewGuard>
          }
        />
        <Route
          path="/safety/drivers"
          element={
            <DispatchSafetyViewGuard>
              <DriversPage />
            </DispatchSafetyViewGuard>
          }
        />
        <Route
          path="/safety/assignments"
          element={
            <DispatchSafetyViewGuard>
              <AssignmentsPage />
            </DispatchSafetyViewGuard>
          }
        />
        <Route
          path="/dispatch/loads"
          element={
            <DispatchModuleGuard>
              <LoadsPage />
            </DispatchModuleGuard>
          }
        />
        <Route
          path="/dispatch/loads/archived"
          element={
            <DispatchModuleGuard>
              <ArchivedLoadsGuard>
                <ArchiveLoadsPage />
              </ArchivedLoadsGuard>
            </DispatchModuleGuard>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
