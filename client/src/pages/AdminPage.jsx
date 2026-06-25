import { useEffect, useState } from 'react';
import api from '../api/client';

export default function AdminPage() {
  const [stats, setStats] = useState({ users: 0, groups: 0, folders: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/users'),
      api.get('/groups'),
      api.get('/folders'),
    ])
      .then(([users, groups, folders]) => {
        setStats({
          users: users.data.users.length,
          groups: groups.data.groups.length,
          folders: folders.data.folders.length,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500 dark:text-slate-400">Loading...</div>;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">System Administration</h1>
      <p className="mb-8 text-slate-600 dark:text-slate-300">Super admin overview and system management.</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Users" value={stats.users} />
        <StatCard label="Groups" value={stats.groups} />
        <StatCard label="Root Folders" value={stats.folders} />
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">System configuration</h2>
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li>• 4 groups: eld, dispatch, safety, maintenance</li>
          <li>• 5 root folders: folder1 – folder5</li>
          <li>• ACL enforced server-side on every file operation</li>
          <li>• Roles control UI/management only — file access is group-based</li>
          <li>• Super admin seeded from environment variables on server start</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-3xl font-bold text-brand-700 dark:text-brand-400">{value}</p>
    </div>
  );
}
