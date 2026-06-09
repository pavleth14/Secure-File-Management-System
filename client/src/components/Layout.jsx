import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GlobalSearch from './GlobalSearch';

const navLinkClass = (active) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    active
      ? 'bg-brand-600 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

export default function Layout() {
  const { user, logout, isSuperAdmin, isAdmin } = useAuth();
  const location = useLocation();

  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/folders', label: 'Folders' },
  ];

  if (isAdmin) {
    links.push({ to: '/users', label: 'Users' });
    links.push({ to: '/admin/logs', label: 'Logs' });
  }
  if (isSuperAdmin) {
    links.push({ to: '/groups', label: 'Groups' });
    links.push({ to: '/admin', label: 'Admin' });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="text-lg font-bold text-brand-700">
              Secure File Manager
            </Link>
            <nav className="flex gap-1">
              {links.map((link) => {
                const isActive =
                  link.to === '/admin'
                    ? location.pathname === '/admin'
                    : location.pathname.startsWith(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={navLinkClass(isActive)}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex flex-1 items-center justify-end gap-4">
            <GlobalSearch />
            <div className="text-right text-sm">
              <p className="font-medium text-slate-900">{user?.name}</p>
              <p className="text-slate-500">
                {user?.role}
                {user?.group?.name && ` · ${user.group.name}`}
              </p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main
        className={`mx-auto w-full px-4 sm:px-6 ${
          location.pathname.includes('/files') ? 'max-w-full py-0' : 'max-w-7xl py-8'
        }`}
      >
        <Outlet />
      </main>
    </div>
  );
}
