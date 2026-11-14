import { useMemo } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { APP_CONFIG, AUTH_PROFILES, GENERIC_AUTH } from '@/config/app.config';
import { useFetch } from '@/hooks/useFetch';
import { sdk } from '@/services/sdk';

// Auto-discover nav items and footer pages from page exports
import { PAGES } from '@/router/manifest.generated';
const pageMods = Object.fromEntries(PAGES.map((p) => [p.file, { route: p.route ?? undefined, nav: p.nav ?? undefined }]));

const discoveredNavItems = Object.entries(pageMods)
  .filter(([, mod]) => mod.nav)
  .map(([, mod]) => { const to = mod.nav.to ?? mod.route?.path; return { ...mod.nav, to, path: to, href: to }; })
  .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

const navPaths = new Set(discoveredNavItems.map((n) => n.to));
const footerPages = Object.entries(pageMods)
  .filter(([, mod]) => mod.route && mod.route.layout === 'owner' && mod.route.access !== 'public' && !mod.route.path.includes(':') && !navPaths.has(mod.route.path))
  .map(([, mod]) => ({ ...mod.route, to: mod.route.path, href: mod.route.path }));

const countItems = discoveredNavItems.filter((item) => item.count?.table);

async function fetchCounts(user) {
  if (!countItems.length) return {};
  const { eq, and, isIn } = window.ApperSDK.CoreSDK;
  // Ambassadors can read their community's bookings too, but their badge counts only their own.
  const ownOnly = (table) => table === 'bookings_c' && user?.profile === 'Ambassador_c' && user?.userId;
  const results = await Promise.all(countItems.map((item) => {
    // Neighbours and ambassadors: the badge is their own bookings that are still on.
    const personal = item.count.table === 'bookings_c' && ['Customer_c', 'Ambassador_c'].includes(user?.profile) && user?.userId;
    const own = personal ? and(eq('Owner', user.userId), isIn('status_c', ['Booked', 'Confirmed'])) : ownOnly(item.count.table) ? eq('Owner', user.userId) : null;
    const where = own && item.count.where ? and(item.count.where, own) : own ?? item.count.where;
    return sdk.table(item.count.table)
      .select([{ field: 'Id' }])
      .aggregate([{ id: 'c', fields: [{ field: 'Id', fn: 'Count', alias: 'count' }], ...(where ? { where } : {}) }])
      .limit(1)
      .fetch();
  }));
  const counts = {};
  countItems.forEach((item, i) => {
    const bucket = results[i]?.aggregators?.find((a) => a.id === 'c');
    counts[item.to] = bucket?.data?.count ?? bucket?.count ?? bucket?.value ?? 0;
  });
  return counts;
}

// The single data source for OwnerLayout: auth, nav discovery, profile filtering,
// section grouping, footer pages, nav count badges, and the post-login home route.
export function useOwnerLayoutData() {
  const { logout, user } = useAuth();

  // "Home" for a signed-in user is their profile's post-login route, matching AuthPage.
  const homeRoute = useMemo(() => {
    const matched = AUTH_PROFILES?.find((p) => p.name === user?.profile);
    return matched?.redirectAfterAuth ?? GENERIC_AUTH?.redirectAfterAuth ?? '/';
  }, [user?.profile]);

  const navItems = useMemo(() => {
    const mine = user?.profile && user.profile !== 'Admin_c';
    const items = discoveredNavItems
      .filter((item) => !item.profiles || item.profiles.includes(user?.profile))
      // For everyone but the team, the bookings page holds only their own.
      .map((item) => (mine && item.to === '/bookings' ? { ...item, label: 'My bookings' } : item))
      .map((item) => (user?.profile === 'Ambassador_c' && item.to === '/proposals' ? { ...item, label: 'Suggest a deal' } : item))
      // An ambassador's own bookings sit under Profile; their menu is about their communities.
      .filter((item) => !(user?.profile === 'Ambassador_c' && item.to === '/bookings'))
      // A vendor's payouts are simply their money.
      .map((item) => (user?.profile === 'Vendor_c' && item.to === '/payouts' ? { ...item, label: 'Money' } : item));
    // Neighbours land in their bookings; a Deals tab keeps booking one tap away.
    if (user?.profile !== 'Customer_c') return items;
    const deals = { icon: 'Tag', label: 'Deals', order: 5, to: '/deals', path: '/deals', href: '/deals' };
    return [...items, deals].sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
  }, [user?.profile]);

  const navGroups = useMemo(() => {
    const groups = [];
    const byLabel = new Map();
    for (const item of navItems) {
      const groupLabel = item.section ?? null;
      let group = groupLabel != null ? byLabel.get(groupLabel) : null;
      if (!group) {
        group = { label: groupLabel, items: [] };
        groups.push(group);
        if (groupLabel != null) byLabel.set(groupLabel, group);
      }
      group.items.push(item);
    }
    return groups;
  }, [navItems]);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase()
    || APP_CONFIG.name.slice(0, 2).toUpperCase();
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.emailAddress;

  const { data: counts, run: refreshCounts } = useFetch(() => fetchCounts(user), [user?.userId, user?.profile]);

  return { user, logout, homeRoute, navItems, navGroups, footerPages, initials, displayName, counts: counts ?? {}, refreshCounts };
}
