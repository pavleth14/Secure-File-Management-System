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

  return (
    <div className='text-center flex flex-col h-[80vh] justify-around border'>
      <div className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mb-8 text-slate-600">
        Welcome back, <span className="text-blue-600 font-bold">{user?.name}</span>.{' '}
        {user?.group?.name ? (
          <>
            You belong to the{' '}
            <span className="font-bold text-blue-600">
              {user.group.name}
            </span>{' '}
            group.
          </>
        ) : isSuperAdmin || isAdmin ? (
          'You have management access.'
        ) : (
          'Contact an admin to assign your group for file access.'
        )}
      </p>
      


      <div className="flex flex-wrap justify-center gap-4 ">
        {cards
          .filter((c) => c.show)
          .map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="rounded-xl w-60 border border-slate-300 bg-white hover:bg-brand-50 shadow-sm transition hover:border-brand-700 hover:shadow-xl"
            > 
            <div className='rounded-xl border-l-4 border-blue-600 bg-blue-50 p-4'>
              <h2 className="mb-2 text-lg font-semibold text-slate-900">{card.title}</h2>
              <p className="text-sm text-slate-500">{card.desc}</p>
              </div>
            </Link>
          ))}
      </div>

      </div>


      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-6 text-xl font-bold text-slate-900">
          Your Account
        </h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 pt-4">
          <div className="rounded-xl border-l-4 border-blue-600 bg-blue-50 p-8">
            <div className="text-sm font-medium text-blue-600">Role</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {user?.role}
            </div>
          </div>

          <div className="rounded-xl border-l-4 border-blue-600 bg-blue-50 p-8">
            <div className="text-sm font-medium text-blue-600">Email</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 break-all">
              {user?.email}
            </div>
          </div>

          <div className="rounded-xl border-l-4 border-blue-600 bg-blue-50 p-8">
            <div className="text-sm font-medium text-blue-600">Group</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {user?.group?.name || 'Not assigned'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
