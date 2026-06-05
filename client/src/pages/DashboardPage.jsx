import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user, isSuperAdmin, isAdmin } = useAuth();

  const cards = [
    {
      title: 'File Folders',
      desc: 'Browse and manage files based on your group permissions',
      to: '/folders',
      show: true,
    },
    {
      title: 'User Management',
      desc: 'Create users and assign groups',
      to: '/users',
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

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mb-8 text-slate-600">
        Welcome back, {user?.name}.{' '}
        {user?.group?.name
          ? `You belong to the ${user.group.name} group.`
          : isSuperAdmin || isAdmin
            ? 'You have management access.'
            : 'Contact an admin to assign your group for file access.'}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 text-center">
        {cards
          .filter((c) => c.show)
          .map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="rounded-xl border border-slate-300 bg-white hover:bg-brand-50 p-12 shadow-sm transition hover:border-brand-700  hover:shadow-xl"
            >
              <h2 className="mb-2 text-lg font-semibold text-slate-900">{card.title}</h2>
              <p className="text-sm text-slate-500">{card.desc}</p>
            </Link>
          ))}
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 font-bold text-xl text-slate-900">Your account</h3>
        <div className="grid-col gap-3 text-sm sm:grid-cols-2">
          <div className='p-2'>
            <div className="text-slate-500">Role</div>
            <div className="font-medium">{user?.role}</div>
          </div>
          <div className='p-2'>
            <div className="text-slate-500">Email</div>
            <div className="font-medium">{user?.email}</div>
          </div>
          <div className='p-2'>
            <div className="text-slate-500">Group</div>
            <div className="font-medium">{user?.group?.name || 'Not assigned'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
