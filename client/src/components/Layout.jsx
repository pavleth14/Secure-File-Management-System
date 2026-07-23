import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import GlobalSearch from './GlobalSearch';
import ThemeToggle from './ThemeToggle';
import UploadManager from './UploadManager';
import logo from '../assets/logo2.png';

const dropdownLinkClass = () =>
  'nav-dropdown-link mx-1.5 my-0.5 block rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300 ease-in-out';

function TopNavItem({ active, children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`nav-top-item rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ease-in-out ${
        active ? 'nav-top-item-active' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function DatabaseDropdown({ links, location }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const isDatabaseActive = useMemo(
    () =>
      links.some((link) =>
        link.to === '/admin'
          ? location.pathname === '/admin'
          : location.pathname.startsWith(link.to)
      ),
    [links, location.pathname]
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        close();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [close]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <TopNavItem
        active={isDatabaseActive || open}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((prev) => !prev)}
      >
        Database
        <span
          className={`ml-1.5 inline-block transition-transform duration-300 ease-in-out ${
            open ? 'rotate-180' : 'rotate-0'
          }`}
          aria-hidden
        >
          ▾
        </span>
      </TopNavItem>

      <div
        className={`absolute left-0 top-full z-50 min-w-[11rem] pt-2 transition-all ease-in-out ${
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
        style={{ transitionDuration: '350ms' }}
      >
        <div className="rounded-xl border border-slate-200 bg-white px-1 py-1.5 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={dropdownLinkClass()}
                onClick={close}
                aria-current={
                  (link.to === '/admin'
                    ? location.pathname === '/admin'
                    : location.pathname.startsWith(link.to))
                    ? 'page'
                    : undefined
                }
              >
                {link.label}
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}

function SafetyDropdown({ location }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const isSafetyActive = useMemo(
    () => location.pathname.startsWith('/safety/'),
    [location.pathname]
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        close();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [close]);

  const links = [
    { to: '/safety/trucks', label: 'Trucks' },
    { to: '/safety/trailers', label: 'Trailers' },
    { to: '/safety/drivers', label: 'Drivers' },
    { to: '/safety/assignments', label: 'Assignments' },
  ];

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <TopNavItem
        active={isSafetyActive || open}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((prev) => !prev)}
      >
        Safety
        <span
          className={`ml-1.5 inline-block transition-transform duration-300 ease-in-out ${
            open ? 'rotate-180' : 'rotate-0'
          }`}
          aria-hidden
        >
          ▾
        </span>
      </TopNavItem>

      <div
        className={`absolute left-0 top-full z-50 min-w-[11rem] pt-2 transition-all ease-in-out ${
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
        style={{ transitionDuration: '350ms' }}
      >
        <div className="rounded-xl border border-slate-200 bg-white px-1 py-1.5 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={dropdownLinkClass()}
              onClick={close}
              aria-current={location.pathname.startsWith(link.to) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function BoardsDropdown({ boards, location, showArchivedLoads }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const isBoardsActive = useMemo(
    () =>
      location.pathname.startsWith('/dispatch/loads') ||
      location.pathname.startsWith('/dispatch/boards'),
    [location.pathname]
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        close();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [close]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <TopNavItem
        active={isBoardsActive || open}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((prev) => !prev)}
      >
        Boards
        <span
          className={`ml-1.5 inline-block transition-transform duration-300 ease-in-out ${
            open ? 'rotate-180' : 'rotate-0'
          }`}
          aria-hidden
        >
          ▾
        </span>
      </TopNavItem>

      <div
        className={`absolute left-0 top-full z-50 min-w-[12rem] pt-2 transition-all ease-in-out ${
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
        style={{ transitionDuration: '350ms' }}
      >
        <div className="rounded-xl border border-slate-200 bg-white px-1 py-1.5 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          <Link
            to="/dispatch/boards/global"
            className={dropdownLinkClass()}
            onClick={close}
            aria-current={location.pathname === '/dispatch/boards/global' ? 'page' : undefined}
          >
            Global Board
          </Link>
          {boards.length > 0 && (
            <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          )}
          {boards.map((board) => (
            <Link
              key={board.id}
              to={`/dispatch/boards/${board.id}`}
              className={dropdownLinkClass()}
              onClick={close}
              aria-current={location.pathname === `/dispatch/boards/${board.id}` ? 'page' : undefined}
            >
              {board.name}
            </Link>
          ))}
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <Link
            to="/dispatch/loads"
            className={dropdownLinkClass()}
            onClick={close}
            aria-current={
              location.pathname === '/dispatch/loads' ||
              location.pathname === '/dispatch/loads/'
                ? 'page'
                : undefined
            }
          >
            Loads
          </Link>
          {showArchivedLoads && (
            <Link
              to="/dispatch/loads/archived"
              className={dropdownLinkClass()}
              onClick={close}
              aria-current={
                location.pathname.startsWith('/dispatch/loads/archived') ? 'page' : undefined
              }
            >
              Archived Loads
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function RecruitingDropdown({ boards, showImportLeads, location, currentUserId, isRecruiter }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const showOwnBoardDivider = useMemo(() => {
    if (!isRecruiter || boards.length <= 1 || !currentUserId) return false;
    return boards[0]?.userId?.toString?.() === currentUserId.toString();
  }, [boards, currentUserId, isRecruiter]);

  const isRecruitingActive = useMemo(
    () =>
      location.pathname.startsWith('/recruiting/boards') ||
      location.pathname.startsWith('/recruiting/import') ||
      location.pathname.startsWith('/recruiting/archive') ||
      location.pathname.startsWith('/recruiting/sources'),
    [location.pathname]
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        close();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [close]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <TopNavItem
        active={isRecruitingActive || open}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((prev) => !prev)}
      >
        Recruiting
        <span
          className={`ml-1.5 inline-block transition-transform duration-300 ease-in-out ${
            open ? 'rotate-180' : 'rotate-0'
          }`}
          aria-hidden
        >
          ▾
        </span>
      </TopNavItem>

      <div
        className={`absolute left-0 top-full z-50 min-w-[11rem] pt-2 transition-all ease-in-out ${
          open
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
        style={{ transitionDuration: '350ms' }}
      >
        <div className="rounded-xl border border-slate-200 bg-white px-1 py-1.5 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {boards.map((board, index) => (
            <div key={board.userId}>
              <Link
                to={`/recruiting/boards/${board.userId}`}
                className={dropdownLinkClass()}
                onClick={close}
                aria-current={
                  location.pathname === `/recruiting/boards/${board.userId}`
                    ? 'page'
                    : undefined
                }
              >
                {board.label}
              </Link>
              {showOwnBoardDivider && index === 0 && (
                <div
                  className="my-1 border-t border-slate-200 dark:border-slate-600"
                  role="separator"
                  aria-hidden
                />
              )}
            </div>
          ))}
          {showImportLeads && (
            <>
              <Link
                to="/recruiting/import"
                className={dropdownLinkClass()}
                onClick={close}
                aria-current={
                  location.pathname.startsWith('/recruiting/import') ? 'page' : undefined
                }
              >
                Import Leads
              </Link>
              <Link
                to="/recruiting/archive"
                className={dropdownLinkClass()}
                onClick={close}
                aria-current={
                  location.pathname.startsWith('/recruiting/archive') ? 'page' : undefined
                }
              >
                Archive
              </Link>
              <Link
                to="/recruiting/sources"
                className={dropdownLinkClass()}
                onClick={close}
                aria-current={
                  location.pathname.startsWith('/recruiting/sources') ? 'page' : undefined
                }
              >
                Lead Sources
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const {
    user,
    logout,
    isSuperAdmin,
    isAdmin,
    hasRecruitingAccess,
    shouldShowRecruiting,
    isRecruitingManager,
    isRecruiter,
    shouldShowSafety,
    shouldShowBoards,
    canViewArchivedLoads,
  } = useAuth();
  const location = useLocation();
  const [recruitingBoards, setRecruitingBoards] = useState([]);
  const [dispatchBoards, setDispatchBoards] = useState([]);

  useEffect(() => {
    console.log('[RECRUITING-ACCESS] navbar', {
      currentUser: user
        ? {
            id: user.id,
            role: user.role,
            isRecruiting: Boolean(user.isRecruiter),
            isRecruitingManager: Boolean(user.isRecruitingManager),
          }
        : null,
      shouldShowRecruiting,
    });
  }, [user, shouldShowRecruiting]);

  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/folders', label: 'Folders' },
    { to: '/my-files', label: 'My Files' },
  ];

  if (isAdmin) {
    links.push({ to: '/users', label: 'Users' });
    links.push({ to: '/admin/logs', label: 'Logs' });
  }

  if (isSuperAdmin) {
    links.push({ to: '/groups', label: 'Groups' });
  }

  useEffect(() => {
    if (!hasRecruitingAccess) {
      setRecruitingBoards([]);
      return undefined;
    }

    let cancelled = false;

    async function loadBoards() {
      try {
        const { data } = await api.get('/recruiting/boards');
        if (!cancelled) {
          setRecruitingBoards(data.boards || []);
        }
      } catch {
        if (!cancelled) {
          setRecruitingBoards([]);
        }
      }
    }

    loadBoards();

    return () => {
      cancelled = true;
    };
  }, [hasRecruitingAccess, user?.id]);

  useEffect(() => {
    if (!shouldShowBoards) {
      setDispatchBoards([]);
      return undefined;
    }

    let cancelled = false;

    async function loadDispatchBoards() {
      try {
        const { data } = await api.get('/dispatch/boards');
        if (!cancelled) {
          setDispatchBoards(data.boards || []);
        }
      } catch {
        if (!cancelled) setDispatchBoards([]);
      }
    }

    loadDispatchBoards();
    return () => {
      cancelled = true;
    };
  }, [shouldShowBoards, user?.id]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-16">
            <div className="flex items-center gap-6">
              <Link to="/dashboard">
                <img
                  src={logo}
                  alt="TBF File Manager"
                  className="h-12 w-24 rounded"
                />
              </Link>
            </div>

            <div className="flex w-fit gap-1">
              <nav className="flex items-center gap-1">
                <DatabaseDropdown links={links} location={location} />
                {hasRecruitingAccess && (
                  <RecruitingDropdown
                    boards={recruitingBoards}
                    showImportLeads={isRecruitingManager || isSuperAdmin}
                    location={location}
                    currentUserId={user?.id}
                    isRecruiter={isRecruiter}
                  />
                )}
                {shouldShowBoards && (
                  <BoardsDropdown
                    boards={dispatchBoards}
                    location={location}
                    showArchivedLoads={canViewArchivedLoads}
                  />
                )}
                {shouldShowSafety && <SafetyDropdown location={location} />}
              </nav>
            </div>
          </div>

          <div className="flex w-[500px] items-center gap-4">
            <div className="flex w-full items-center">
              <GlobalSearch />
            </div>

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
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors duration-200 ease-in-out hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto w-full px-4 sm:px-6 ${
          location.pathname.includes('/files') || location.pathname.startsWith('/my-files')
            ? 'max-w-full py-0'
            : location.pathname.startsWith('/recruiting/boards')
              ? 'w-[95vw] max-w-[95vw] py-8'
              : location.pathname.startsWith('/dispatch/boards')
                ? 'w-[95vw] max-w-[95vw] py-8'
                : 'max-w-7xl py-8'
        }`}
      >
        <Outlet />
      </main>

      <UploadManager />
    </div>
  );
}
