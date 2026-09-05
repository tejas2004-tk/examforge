import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Command,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Rows3,
  Search,
  Settings,
  Sun,
  User,
  X,
} from 'lucide-react';
import { api } from '../api/client.js';
import { CommandPalette, useCommandPalette } from '../components/CommandPalette.jsx';
import { Avatar, Badge, cx } from '../components/ui.jsx';
import { navForRole, ROLE_LABEL } from '../config/navigation.js';
import {
  useClickOutside,
  useEscapeKey,
  useFocusTrap,
  usePageVisible,
  usePersistentState,
  useScrollLock,
} from '../lib/hooks.js';
import { useDensity, useTheme } from '../lib/theme.js';
import { useAuthStore } from '../store/authStore.js';

const POLL_INTERVAL_MS = 60_000;
const CONTENT_ID = 'main-content';

function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const visible = usePageVisible();

  const refresh = useCallback(async (signal) => {
    try {
      const { data } = await api.get('/notifications/unread-count', { signal });
      setUnreadCount(data.data.unreadCount ?? 0);
    } catch {
      // A failed count must never surface as a page-level error.
    }
  }, []);

  useEffect(() => {
    // Polling a hidden tab burns requests for a badge nobody can see, so the
    // interval is torn down entirely rather than skipped inside the callback.
    if (!visible) return undefined;
    const controller = new AbortController();
    refresh(controller.signal);
    const id = setInterval(() => refresh(controller.signal), POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, [visible, refresh]);

  return unreadCount;
}

function Brand({ compact = false }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-md px-1 py-1" aria-label="ExamForge home">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent font-mono text-[0.75rem] font-semibold text-accent-on">
        EF
      </span>
      {!compact && (
        <span className="text-[0.9375rem] font-semibold tracking-[-0.012em] text-ink">ExamForge</span>
      )}
    </Link>
  );
}

function NavItem({ item, rail, unreadCount }) {
  const { to, label, icon: Icon, end, badge } = item;
  const count = badge === 'notifications' ? unreadCount : 0;

  return (
    <NavLink
      to={to}
      end={end}
      // In rail mode the label is the only thing identifying the icon, so it has
      // to survive as an accessible name and as a hover hint.
      title={rail ? label : undefined}
      aria-label={rail ? (count > 0 ? `${label}, ${count} unread` : label) : undefined}
      className={({ isActive }) =>
        cx(
          'group relative flex items-center gap-2.5 rounded-md py-1.5 text-[0.8125rem] font-medium transition-colors',
          rail ? 'justify-center px-0' : 'px-2.5',
          isActive
            ? 'bg-accent-soft text-accent-ink'
            : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={cx(
              'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icon
            className={cx(
              'h-4 w-4 shrink-0',
              isActive ? 'text-accent' : 'text-ink-subtle group-hover:text-ink-muted',
            )}
            aria-hidden="true"
          />
          {!rail && <span className="min-w-0 flex-1 truncate">{label}</span>}
          {count > 0 &&
            (rail ? (
              <span
                className="absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full bg-critical"
                aria-hidden="true"
              />
            ) : (
              <Badge tone="critical">{count > 99 ? '99+' : count}</Badge>
            ))}
        </>
      )}
    </NavLink>
  );
}

function NavGroup({ group, rail, collapsed, onToggle, unreadCount }) {
  const contentId = `nav-group-${group.id}`;

  if (rail) {
    return (
      <div className="space-y-0.5 border-b border-line pb-2 last:border-b-0" role="group" aria-label={group.label}>
        {group.items.map((item) => (
          <NavItem key={item.to + item.label} item={item} rail unreadCount={unreadCount} />
        ))}
      </div>
    );
  }

  return (
    <div className="pb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={contentId}
        className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-ink-subtle transition-colors hover:text-ink-muted"
      >
        <ChevronRight
          className={cx('h-3 w-3 shrink-0 transition-transform', !collapsed && 'rotate-90')}
          aria-hidden="true"
        />
        <span className="eyebrow">{group.label}</span>
      </button>
      <div id={contentId} hidden={collapsed} className="mt-0.5 space-y-0.5">
        {group.items.map((item) => (
          <NavItem key={item.to + item.label} item={item} unreadCount={unreadCount} />
        ))}
      </div>
    </div>
  );
}

function UserMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const { theme, setTheme } = useTheme();
  const { density, setDensity } = useDensity();

  useClickOutside(containerRef, open, () => setOpen(false));
  useEscapeKey(open, () => {
    setOpen(false);
    triggerRef.current?.focus();
  });

  const focusItem = (index) => {
    const items = menuRef.current?.querySelectorAll('[role="menuitem"]');
    if (!items?.length) return;
    const next = (index + items.length) % items.length;
    items[next].focus();
  };

  // Roving focus: the menu owns arrow keys so a pointer-free user can walk the
  // list without Tab escaping into the page behind the dropdown.
  const onMenuKeyDown = (event) => {
    const items = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem(items.length - 1);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (open) requestAnimationFrame(() => focusItem(0));
  }, [open]);

  const name = user?.fullName || user?.username || 'Account';

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 transition-colors hover:bg-surface-sunken"
      >
        <Avatar name={name} size="sm" />
        <span className="hidden max-w-[9rem] truncate text-[0.8125rem] font-medium text-ink sm:block">
          {name}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className="animate-fade-up absolute right-0 z-50 mt-1.5 w-64 overflow-hidden rounded-lg border border-line bg-surface-raised shadow-overlay"
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-[0.8125rem] font-semibold text-ink">{name}</p>
            <p className="truncate text-xs text-ink-subtle">{user?.email}</p>
            <p className="mt-1.5">
              <Badge tone="accent">{ROLE_LABEL[user?.role] ?? 'Member'}</Badge>
            </p>
          </div>

          <div className="p-1">
            <Link
              to="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <User className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
              Profile
            </Link>
            <Link
              to="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <Settings className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
              Settings
            </Link>
          </div>

          <div className="border-t border-line p-2">
            <p className="eyebrow mb-1.5 px-1">Appearance</p>
            <SegmentedControl
              value={theme}
              onChange={setTheme}
              ariaLabel="Theme"
              options={[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
              ]}
            />
            <p className="eyebrow mb-1.5 mt-2.5 px-1">Density</p>
            <SegmentedControl
              value={density}
              onChange={setDensity}
              ariaLabel="Density"
              options={[
                { value: 'comfortable', label: 'Comfortable', icon: Monitor },
                { value: 'compact', label: 'Compact', icon: Rows3 },
              ]}
            />
          </div>

          <div className="border-t border-line p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.8125rem] text-ink-muted hover:bg-critical-soft hover:text-critical-ink"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SegmentedControl({ value, onChange, options, ariaLabel }) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid grid-cols-2 gap-1 rounded-md border border-line bg-surface-sunken p-0.5"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cx(
              'flex items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium transition-colors',
              selected ? 'bg-surface text-ink shadow-card' : 'text-ink-subtle hover:text-ink-muted',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Shell-level trail: which navigation group and entry the route belongs to. */
function useShellTrail(groups, pathname) {
  return useMemo(() => {
    let best = null;
    groups.forEach((group) => {
      group.items.forEach((item) => {
        const matches = item.end ? pathname === item.to : pathname.startsWith(item.to);
        if (matches && (!best || item.to.length > best.item.to.length)) best = { group, item };
      });
    });
    return best;
  }, [groups, pathname]);
}

export function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const groups = useMemo(() => navForRole(user?.role), [user?.role]);
  const unreadCount = useUnreadCount();
  const palette = useCommandPalette();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rail, setRail] = usePersistentState('examforge-sidebar-rail', false);
  const [collapsedGroups, setCollapsedGroups] = usePersistentState('examforge-nav-collapsed', {});
  const drawerRef = useRef(null);

  const trail = useShellTrail(groups, location.pathname);

  useScrollLock(drawerOpen);
  useEscapeKey(drawerOpen, () => setDrawerOpen(false));
  useFocusTrap(drawerRef, drawerOpen);

  // Leaving the drawer open after a click would cover the page just chosen.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const toggleGroup = (id) =>
    setCollapsedGroups((current) => ({ ...current, [id]: !current[id] }));

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const sidebarBody = (asRail) => (
    <nav
      className={cx('scrollbar-slim flex-1 overflow-y-auto', asRail ? 'space-y-2 px-2 py-3' : 'space-y-1 p-3')}
      aria-label="Main navigation"
    >
      {groups.map((group) => (
        <NavGroup
          key={group.id}
          group={group}
          rail={asRail}
          collapsed={Boolean(collapsedGroups[group.id])}
          onToggle={() => toggleGroup(group.id)}
          unreadCount={unreadCount}
        />
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href={`#${CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-on"
      >
        Skip to content
      </a>

      {/* Desktop sidebar. The rail keeps icons and their tooltips so the map of
          the product is still readable when horizontal space is scarce. */}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex',
          rail ? 'w-[3.75rem]' : 'w-60',
        )}
      >
        <div className={cx('flex h-14 shrink-0 items-center border-b border-line', rail ? 'justify-center px-2' : 'px-4')}>
          <Brand compact={rail} />
        </div>

        {sidebarBody(rail)}

        <div className="shrink-0 border-t border-line p-2">
          <button
            type="button"
            onClick={() => setRail((value) => !value)}
            className={cx(
              'btn btn-sm w-full text-ink-subtle hover:bg-surface-sunken hover:text-ink',
              rail && 'px-0',
            )}
            aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {rail ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-[rgb(var(--shadow))]/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="animate-slide-in relative flex h-full w-[17rem] flex-col border-r border-line bg-surface shadow-overlay"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
              <Brand />
              <button
                type="button"
                className="btn btn-sm px-1.5 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {sidebarBody(false)}
          </div>
        </div>
      )}

      <div className={cx('transition-[padding] duration-200', rail ? 'lg:pl-[3.75rem]' : 'lg:pl-60')}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur-md sm:px-5">
          <button
            type="button"
            className="btn btn-sm px-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
          >
            <Menu className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />
          </button>

          <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
            <ol className="flex items-center gap-1.5 text-[0.8125rem] text-ink-subtle">
              <li className="shrink-0">{ROLE_LABEL[user?.role] ?? 'Workspace'}</li>
              {trail && (
                <>
                  <li aria-hidden="true">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </li>
                  <li className="shrink-0">{trail.group.label}</li>
                  <li aria-hidden="true">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </li>
                  <li className="min-w-0 truncate font-medium text-ink" aria-current="page">
                    {trail.item.label}
                  </li>
                </>
              )}
            </ol>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => palette.setOpen(true)}
              className="btn btn-sm gap-2 border border-line-strong bg-surface text-ink-subtle hover:border-ink-subtle hover:text-ink-muted"
              aria-label="Open command palette"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden text-[0.8125rem] sm:inline">Search</span>
              <kbd className="hidden items-center gap-0.5 rounded-sm border border-line bg-surface-sunken px-1 font-mono text-[0.625rem] text-ink-subtle sm:flex">
                <Command className="h-2.5 w-2.5" aria-hidden="true" />K
              </kbd>
            </button>

            <Link
              to="/notifications"
              className="btn btn-sm relative px-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink"
              aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-critical px-1 text-[0.625rem] font-semibold leading-none text-critical-on">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <UserMenu user={user} onSignOut={handleSignOut} />
          </div>
        </header>

        <main id={CONTENT_ID} tabIndex={-1} className="mx-auto max-w-[88rem] p-4 sm:p-6 lg:px-8 lg:py-7">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={palette.open} onClose={palette.close} />
    </div>
  );
}
