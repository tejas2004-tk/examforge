import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { api } from '../api/client.js';
import { navForRole, ROLE_LABEL } from '../config/navigation.js';
import { useTheme } from '../lib/theme.js';
import { cx } from '../components/ui.jsx';

const POLL_INTERVAL_MS = 30_000;

function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  // One fetcher, used for both the initial load and the poll. Previously the
  // same request block was written out twice and drifted independently.
  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setUnreadCount(data.data.unreadCount ?? 0);
    } catch {
      // A failed count must never surface as a page-level error.
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);

    // Polling a hidden tab burns requests for a badge nobody can see.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  return unreadCount;
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg px-1 py-1">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[0.8125rem] font-bold text-white shadow-card">
        EF
      </span>
      <span className="text-[0.9375rem] font-semibold tracking-tight text-ink">ExamForge</span>
    </Link>
  );
}

export function AppLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const unreadCount = useUnreadCount();
  const { theme, toggle } = useTheme();

  const navItems = navForRole(user?.role);

  // Close the mobile drawer on navigation; leaving it open covered the page
  // the user had just chosen.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const query = event.target.q.value.trim();
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const initial = (user?.fullName || user?.username || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-canvas">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[rgb(var(--shadow))]/50 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface',
          'transition-transform duration-200 ease-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <Brand />
          <button
            className="btn btn-sm px-1.5 text-ink-subtle hover:bg-canvas hover:text-ink lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="scrollbar-slim flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Main">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={`${to}:${label}`}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium transition-colors',
                  isActive
                    ? 'bg-accent-soft text-accent-ink'
                    : 'text-ink-muted hover:bg-canvas hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cx('h-[1.05rem] w-[1.05rem] shrink-0', isActive ? 'text-accent' : 'text-ink-subtle group-hover:text-ink-muted')}
                    aria-hidden="true"
                  />
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 border-t border-line p-3">
          <Link
            to="/profile"
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-canvas"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-ink">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8125rem] font-medium text-ink">
                {user?.fullName || user?.username}
              </span>
              <span className="block truncate text-xs text-ink-subtle">{user?.email}</span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6">
          <button
            className="btn btn-sm px-1.5 text-ink-muted hover:bg-canvas hover:text-ink lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-[1.125rem] w-[1.125rem]" />
          </button>

          <p className="hidden text-[0.8125rem] font-medium text-ink-muted sm:block">
            {ROLE_LABEL[user?.role] ?? 'Workspace'}
          </p>

          <form className="ml-auto hidden md:block" onSubmit={handleSearch} role="search">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
                aria-hidden="true"
              />
              <input
                name="q"
                type="search"
                aria-label="Search"
                className="input h-8 w-56 bg-canvas pl-8 transition-[width] focus:w-72"
                placeholder="Search…"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <button
              onClick={toggle}
              className="btn btn-sm px-1.5 text-ink-muted hover:bg-canvas hover:text-ink"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <Link
              to="/notifications"
              className="btn btn-sm relative px-1.5 text-ink-muted hover:bg-canvas hover:text-ink"
              aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold leading-none text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <button
              onClick={handleLogout}
              className="btn btn-sm px-1.5 text-ink-muted hover:bg-critical-soft hover:text-critical-ink"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[90rem] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
