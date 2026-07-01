import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import StorageUsageWidget from '../components/dashboard/StorageUsageWidget';
import RecentFilesCard from '../components/dashboard/RecentFilesCard';
import FavoritesCard from '../components/dashboard/FavoritesCard';
import DashboardPanelModal from '../components/dashboard/DashboardPanelModal';

const PREVIEW_LIMIT = 3;

export default function DashboardPage() {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [showRecentModal, setShowRecentModal] = useState(false);

  const cards = [
    {
      title: 'File Folders',
      desc: 'Browse and manage files based on your group permissions',
      to: '/folders',
      show: true,
    },
    {
      title: 'My Files',
      desc: 'Your private personal drive',
      to: '/my-files',
      show: true,
    },
    {
      title: 'User Management',
      desc: 'Create users and assign groups',
      to: '/users',
      show: isAdmin,
    },
    {
      title: 'Audit Logs',
      desc: 'View security and compliance audit trail',
      to: '/admin/logs',
      show: isAdmin,
    },
    {
      title: 'Group Permissions',
      desc: 'Configure ACL permissions per group and folder',
      to: '/groups',
      show: isSuperAdmin,
    },
    {
      title: 'System Admin',
      desc: 'Full system overview and management',
      to: '/admin',
      show: isSuperAdmin,
    },
  ];

  useEffect(() => {
    api
      .get('/dashboard')
      .then(({ data }) => setDashboardData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="mb-8 text-slate-600 dark:text-slate-300">
          Welcome back, <span className="font-bold text-blue-600 dark:text-blue-400">{user?.name}</span>.{' '}
          {user?.group?.name ? (
            <>
              You belong to the{' '}
              <span className="font-bold text-blue-600 dark:text-blue-400">{user.group.name}</span>{' '}
              group.
            </>
          ) : isSuperAdmin || isAdmin ? (
            'You have management access.'
          ) : (
            'Contact an admin to assign your group for file access.'
          )}
        </p>
        <div className="flex flex-wrap justify-center gap-6">
  {cards
    .filter((c) => c.show)
    .map((card) => (
      <Link
        key={card.to}
        to={card.to}
        className="group relative w-72 h-40 overflow-hidden rounded-3xl border border-slate-200 bg-[#EFF6FF] p-6 shadow-md 
                   transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 
                   dark:border-slate-700 dark:bg-slate-900 flex flex-col"
      >
        {/* Accent bar */}
        <div className="absolute top-0 left-0 h-2 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

        {/* Ikonica (možeš kasnije zameniti pravim ikonama) */}
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-2xl transition-colors group-hover:bg-blue-500 group-hover:text-white dark:bg-slate-700 dark:group-hover:bg-blue-600">
          {card.title === 'File Folders' && '📁'}
          {card.title === 'My Files' && '📄'}
          {card.title === 'User Management' && '👥'}
          {card.title === 'Audit Logs' && '📋'}
          {card.title === 'Group Permissions' && '🔐'}
          {card.title === 'System Admin' && '⚙️'}
        </div>

        <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {card.title}
        </h2>

        <p className="mt-auto text-slate-600 dark:text-slate-400 text-[15px] leading-snug line-clamp-3">
          {card.desc}
        </p>

        {/* Hover strelica */}
        <div className="absolute bottom-6 right-6 text-blue-500 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1">
          →
        </div>
      </Link>
    ))}
</div>
      </div>

      {!loading && dashboardData && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <StorageUsageWidget storage={dashboardData.storage} />
          <FavoritesCard
            favorites={dashboardData.favorites}
            previewLimit={PREVIEW_LIMIT}
            onViewAll={() => setShowFavoritesModal(true)}
          />
          <RecentFilesCard
            recentAdded={dashboardData.recentAdded}
            recentDeleted={dashboardData.recentDeleted}
            recentOpened={dashboardData.recentOpened}
            previewLimit={PREVIEW_LIMIT}
            onViewAll={() => setShowRecentModal(true)}
          />
        </div>
      )}

      {showFavoritesModal && dashboardData && (
        <DashboardPanelModal title="Favorites" onClose={() => setShowFavoritesModal(false)}>
          <FavoritesCard favorites={dashboardData.favorites} embedded />
        </DashboardPanelModal>
      )}

      {showRecentModal && dashboardData && (
        <DashboardPanelModal title="Recent Files" onClose={() => setShowRecentModal(false)}>
          <RecentFilesCard
            recentAdded={dashboardData.recentAdded}
            recentDeleted={dashboardData.recentDeleted}
            recentOpened={dashboardData.recentOpened}
            embedded
          />
        </DashboardPanelModal>
      )}

<div className="rounded-3xl border border-slate-200 bg-[#EFF6FF] p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Your Account</h3>
          <div className="h-1.5 w-12 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"></div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Role Card */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-3xl dark:bg-slate-700">
              👤
            </div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Role</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {user?.role || 'User'}
            </div>
          </div>

          {/* Email Card */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-3xl dark:bg-slate-700">
              ✉️
            </div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Email</div>
            <div className="mt-1 break-all text-xl font-semibold text-slate-900 dark:text-slate-100">
              {user?.email}
            </div>
          </div>

          {/* Group Card */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-3xl dark:bg-slate-700">
              {user?.group?.name ? '🏢' : '🔓'}
            </div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Group</div>
            <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
              {user?.group?.name || 'Not assigned'}
            </div>
            {!user?.group?.name && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Contact admin for access
              </p>
            )}
          </div>
        </div>
      </div>
         
      
    </div>
  );
}
