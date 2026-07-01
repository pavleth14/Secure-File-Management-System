import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GlobalSearch from './GlobalSearch';
import ThemeToggle from './ThemeToggle';
import UploadManager from './UploadManager';
import logo from '../assets/logo2.png';

const navLinkClass = (active) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active
    ? 'bg-brand-600 text-white'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
  }`;

export default function Layout() {
  const { user, logout, isSuperAdmin, isAdmin } = useAuth();
  const location = useLocation();

  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/folders', label: 'Folders' },
    { to: '/my-files', label: 'My Files' },
  ];

  if (isAdmin) {
    links.push({ to: '/users', label: 'Users' });
    links.push({ to: '/register', label: 'Register' });
    links.push({ to: '/admin/logs', label: 'Logs' });
  }

  if (isSuperAdmin) {
    links.push({ to: '/groups', label: 'Groups' });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          {/* Left Section */}
          <div className="flex items-center gap-16">
            <div className="flex items-center gap-6">
              <Link
                to="/dashboard">
                <img
                  src={logo}
                  alt="TBF File Manager"
                  className="h-12 w-24 rounded"
                />
              </Link>
        
            </div>

            {/* Navigation + Search */}
            <div className="flex w-fit gap-3">
              <nav className="flex  gap-1">
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

          </div>

          {/* Right Section */}
          <div className="flex w-[500px] items-center gap-4">
          <div className='flex items-center w-full'><GlobalSearch/></div>

            <ThemeToggle />

            <div className="flex flex-col text-right text-sm whitespace-nowrap">
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {user?.name}
              </p>

              <p className="text-slate-500 dark:text-slate-400">
                {user?.role}
                {user?.group?.name && ` · ${user.group.name}`}
              </p>
            </div>

            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto w-full px-4 sm:px-6 ${location.pathname.includes('/files') || location.pathname.startsWith('/my-files')
            ? 'max-w-full py-0'
            : 'max-w-7xl py-8'
          }`}
      >
        <Outlet />
      </main>

      <UploadManager />
    </div>
  );
}