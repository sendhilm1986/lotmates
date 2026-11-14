import { useEffect, useRef, useState } from 'react';
import { sdk } from '@/services/sdk';
import { Link, NavLink, Outlet, matchPath, useLocation } from 'react-router-dom';
import { useOwnerLayoutData } from '@/hooks/useOwnerLayoutData';
import { getProfileMeta } from '@/services/userPermissions';
import { cn } from '@/lib/utils';
import ApperIcon from '@/components/ApperIcon';
import UserMenu from '@/components/UserMenu';
import MarkLogo from '@/components/MarkLogo';
import { ErrorBoundary } from '@/components/ui/error-boundary';

const EXACT = ['/', '/admin', '/vendor', '/ambassador'];
const NAV_KEY = 'lotmates.navCollapsed';

function readCollapsed(user) {
  const saved = user?.prefs?.navCollapsed;
  if (Array.isArray(saved)) return saved;
  try {
    const local = JSON.parse(localStorage.getItem(NAV_KEY) ?? 'null');
    return Array.isArray(local) ? local : [];
  } catch {
    return [];
  }
}

/**
 * Which menu groups are folded away. Saved to the person's account (so it follows them across
 * devices) and to this browser (so it's instant on the next load).
 */
function useCollapsedGroups(user) {
  const [collapsed, setCollapsed] = useState(() => new Set(readCollapsed(user)));
  const saveTimer = useRef(null);
  const loadedFor = useRef(user?.userId);

  // A different person signed in: load their choice.
  useEffect(() => {
    if (user?.userId && loadedFor.current !== user.userId) {
      loadedFor.current = user.userId;
      setCollapsed(new Set(readCollapsed(user)));
    }
  }, [user]);

  function save(next) {
    setCollapsed(next);
    const list = [...next];
    try {
      localStorage.setItem(NAV_KEY, JSON.stringify(list));
    } catch {
      /* private mode: the account copy still saves */
    }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (user?.userId) sdk.account.update({ prefs: { navCollapsed: list } });
    }, 700);
  }
  return [collapsed, save];
}

// The team's sections, grouped by the job they're for. Other roles have few enough to list flat.
const ADMIN_GROUPS = [
  { label: null, paths: ['/admin'] },
  { label: 'Selling', paths: ['/admin/deals', '/admin/categories', '/bookings', '/payouts'] },
  { label: 'Partners', paths: ['/admin/neighbours', '/admin/vendors', '/admin/vendor-applications', '/admin/communities', '/admin/ambassador-applications', '/proposals'] },
  { label: 'Quality', paths: ['/reviews', '/complaints'] },
  { label: 'Setup', paths: ['/admin/emails', '/admin/cities', '/admin/localities', '/admin/team', '/account'] },
];

function groupForAdmin(items) {
  const used = new Set();
  const groups = ADMIN_GROUPS.map((g) => ({
    label: g.label,
    items: g.paths.map((p) => items.find((i) => i.to === p)).filter((i) => i && !used.has(i.to) && used.add(i.to)),
  }));
  const rest = items.filter((i) => !used.has(i.to));
  if (rest.length) groups.push({ label: 'More', items: rest });
  return groups.filter((g) => g.items.length);
}

function profileLabel(profile) {
  if (!profile) return '';
  try {
    return getProfileMeta(profile)?.label ?? '';
  } catch {
    return '';
  }
}

export default function OwnerLayout() {
  const { user, logout, homeRoute, navItems, navGroups, initials, displayName, counts } = useOwnerLayoutData();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const isTeam = user?.profile === 'Admin_c';
  const grouped = isTeam ? groupForAdmin(navItems) : navGroups.length ? navGroups : [{ label: null, items: navItems }];
  const ordered = grouped.flatMap((g) => g.items);
  const hasMore = ordered.length > 5;
  const tabs = hasMore ? ordered.slice(0, 4) : ordered;
  const role = profileLabel(user?.profile);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const [collapsed, saveCollapsed] = useCollapsedGroups(user);
  const isActiveItem = (item) => Boolean(matchPath({ path: item.to, end: EXACT.includes(item.to) }, location.pathname));
  const activeGroup = grouped.find((g) => g.label && g.items.some(isActiveItem))?.label ?? null;
  // The group holding the page you're on opens when you arrive, without changing your saved choice.
  const [peek, setPeek] = useState(activeGroup);
  useEffect(() => {
    setPeek(activeGroup);
  }, [activeGroup]);
  const labelled = grouped.filter((g) => g.label).map((g) => g.label);
  const isOpen = (label) => !label || !collapsed.has(label) || peek === label;
  const allClosed = labelled.length > 0 && labelled.every((l) => collapsed.has(l));

  function toggleGroup(label) {
    const next = new Set(collapsed);
    if (isOpen(label)) {
      next.add(label);
      if (peek === label) setPeek(null);
    } else {
      next.delete(label);
    }
    saveCollapsed(next);
  }
  function toggleAll() {
    setPeek(null);
    saveCollapsed(allClosed ? new Set() : new Set(labelled));
  }

  // dark: the desktop rail; light: the phone "More" sheet.
  const railLink = (item, dark) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={EXACT.includes(item.to)}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-[38px] items-center gap-3 rounded-xl px-3 text-[15px] transition-colors duration-(--transition-fast) focus-visible:outline-none focus-visible:ring-2',
          dark
            ? isActive
              ? 'bg-white/[0.11] font-medium text-white focus-visible:ring-white/50'
              : 'text-white/70 hover:bg-white/[0.06] hover:text-white focus-visible:ring-white/50'
            : isActive
              ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground focus-visible:ring-ring'
              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 focus-visible:ring-ring',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && dark && <span aria-hidden className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-highlight" />}
          <ApperIcon name={item.icon ?? 'Circle'} size={17} className={dark ? (isActive ? 'text-highlight' : 'text-white/50') : ''} />
          <span className="flex-1 truncate">{item.label}</span>
          {counts[item.to] != null && Number(counts[item.to]) > 0 && (
            <span className={cn('text-xs tabular-nums', dark ? 'text-white/45' : 'text-muted-foreground')}>{counts[item.to]}</span>
          )}
        </>
      )}
    </NavLink>
  );

  const fullNav = (dark) => (
    <nav className="flex flex-col gap-1" aria-label="Sections">
      {labelled.length > 1 && (
        <div className="flex justify-end px-1 pb-1">
          <button
            type="button"
            onClick={toggleAll}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2',
              dark ? 'text-white/45 hover:bg-white/[0.06] hover:text-white focus-visible:ring-white/50' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:ring-ring',
            )}
          >
            <ApperIcon name={allClosed ? 'ChevronsUpDown' : 'ChevronsDownUp'} size={14} />
            {allClosed ? 'Expand all' : 'Collapse all'}
          </button>
        </div>
      )}
      {grouped.map((g, i) => {
        const open = isOpen(g.label);
        const id = `nav-group-${i}-${dark ? 'd' : 'l'}`;
        const total = g.items.reduce((n, item) => n + (Number(counts[item.to]) || 0), 0);
        const hasActive = g.label === activeGroup;
        return (
          <div key={g.label ?? `group-${i}`} className={cn('flex flex-col', g.label && 'pt-2')}>
            {g.label && (
              <button
                type="button"
                onClick={() => toggleGroup(g.label)}
                aria-expanded={open}
                aria-controls={id}
                aria-current={!open && hasActive ? 'location' : undefined}
                className={cn(
                  'group/nav relative flex min-h-8 items-center gap-2 rounded-lg px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2',
                  // Folded with the current page inside: light the heading up like a selected page.
                  !open && hasActive
                    ? dark
                      ? 'bg-white/[0.11] font-medium text-white focus-visible:ring-white/50'
                      : 'bg-sidebar-accent font-medium text-sidebar-accent-foreground focus-visible:ring-ring'
                    : dark
                      ? 'text-white/45 hover:text-white/80 focus-visible:ring-white/50'
                      : 'text-muted-foreground hover:text-foreground focus-visible:ring-ring',
                )}
              >
                {!open && hasActive && dark && <span aria-hidden className="absolute -left-3 top-1.5 bottom-1.5 w-1 rounded-r-full bg-highlight" />}
                <span className="flex-1 text-left">{g.label}</span>
                {!open && total > 0 && <span className={cn('text-xs tabular-nums', dark ? 'text-white/45' : 'text-muted-foreground')}>{total}</span>}
                <ApperIcon name="ChevronDown" size={14} className={cn('transition-transform duration-200', !open && '-rotate-90', dark ? (!open && hasActive ? 'text-white/80' : 'text-white/35 group-hover/nav:text-white/70') : '')} />
              </button>
            )}
            <div id={id} className={cn('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
              <div className={cn('-mx-3 flex min-h-0 flex-col gap-0.5 overflow-hidden px-3', open && g.label && 'pt-0.5')} inert={!open}>
                {g.items.map((item) => railLink(item, dark))}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-svh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-(--z-sticky) hidden w-(--spacing-sidebar) flex-col bg-[oklch(0.29_0.05_166)] text-white lg:flex">
        <div className="flex h-(--spacing-header) items-center gap-2 px-6">
          <Link to={homeRoute} aria-label="Lotmates home" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
            <MarkLogo withName tone="light" nameClassName="text-white" />
          </Link>
          {role && <span className="ml-1 rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/75">{role}</span>}
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-3">{fullNav(true)}</div>
        <div className="flex items-center gap-2 border-t border-white/10 px-3 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5">
            <UserMenu user={user} initials={initials} displayName={displayName} logout={logout} />
            <Link to="/account" className="min-w-0 flex-1 rounded-md hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50">
              <p className="truncate text-sm text-white/85">{displayName}</p>
              <p className="truncate text-xs text-white/45">Your profile</p>
            </Link>
          </div>
          <Link
            to="/deals"
            title="Open the public site"
            aria-label="Open the public site"
            className="flex size-10 flex-none items-center justify-center rounded-xl text-white/60 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <ApperIcon name="Globe" size={18} />
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-(--z-sticky) flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar/95 px-4 backdrop-blur lg:hidden">
        <Link to={homeRoute} aria-label="Lotmates home">
          <MarkLogo withName nameClassName="text-sidebar-foreground text-lg" />
        </Link>
        {role && <span className="text-xs text-muted-foreground">{role}</span>}
        <div className="ml-auto">
          <UserMenu user={user} initials={initials} displayName={displayName} logout={logout} />
        </div>
      </header>

      <main className="pb-28 lg:pb-0 lg:pl-(--spacing-sidebar)">
        <div className="mx-auto w-full max-w-6xl px-5 py-7 md:px-10 md:py-10">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-sidebar-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {tabs.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={EXACT.includes(item.to)}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" />}
                  <ApperIcon name={item.icon ?? 'Circle'} size={21} />
                  <span className="max-w-full truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium text-muted-foreground"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
            >
              <ApperIcon name="LayoutGrid" size={21} />
              More
            </button>
          )}
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-(--z-modal) flex flex-col justify-end lg:hidden" role="dialog" aria-modal="true" aria-label="All sections">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setMoreOpen(false)}
          />
          <div className="relative max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-sidebar-border bg-sidebar px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            {fullNav(false)}
            <Link
              to="/deals"
              className="mt-4 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-primary hover:bg-sidebar-accent/60"
            >
              <ApperIcon name="Search" size={18} />
              Browse live deals
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
