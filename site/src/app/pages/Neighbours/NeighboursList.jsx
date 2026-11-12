import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatLocalDate, formatRelativeTime, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import UserAvatar from '@/components/UserAvatar';
import PageHeader from '@/components/PageHeader';
import { ListSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { inr } from '@/services/dealRules';
import { unwrapList } from '@/services/records';

export const route = { path: '/admin/neighbours', layout: 'owner', access: "profile === 'Admin_c'" };
export const nav = { icon: 'Users', label: 'Neighbours', order: 51, profiles: ['Admin_c'] };

export const initials = (name) => (name || '?').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

export default function NeighboursList() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [community, setCommunity] = useState('all');
  const [booked, setBooked] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => setPage(1), [search, community, booked, sort]);

  const { data: communities } = useFetch(() => sdk.table('communities_c').select(['Name']).orderBy('Name').page(1, 200).fetch().then(unwrapList), []);

  const { data, loading, error, run } = useFetch(async () => {
    const r = await sdk.neighbours.list({ search, community, booked, sort, page });
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  }, [search, community, booked, sort, page]);

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const size = data?.size ?? 25;
  const pages = Math.max(1, Math.ceil(total / size));
  const sum = data?.summary;
  const filtered = Boolean(search) || community !== 'all' || booked !== 'all';

  return (
    <div className="space-y-8">
      <PageHeader title="Neighbours" description="Everyone with a neighbour account: where they live, how to reach them, and what they've booked." />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Neighbours', value: sum?.all, note: 'with an account' },
          { label: 'Joined this month', value: sum?.thisMonth, note: 'new sign-ups' },
          { label: 'Have booked', value: sum?.booked, note: sum?.all ? `${Math.round(((sum?.booked ?? 0) / sum.all) * 100)}% of neighbours` : 'at least once' },
        ].map((s) => (
          <div key={s.label} className="rounded-[22px] bg-card p-4 shadow-sm sm:p-5">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-foreground sm:text-3xl">{s.value ?? '–'}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.note}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <ApperIcon name="Search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search by name, email or phone" className="h-11 rounded-full bg-card pl-10" aria-label="Search neighbours" />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <Select value={community} onValueChange={setCommunity}>
            <SelectTrigger className="!h-11 col-span-2 w-full rounded-full bg-card lg:w-52" aria-label="Community"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All communities</SelectItem>
              {(communities ?? []).map((c) => (
                <SelectItem key={c.Id} value={String(c.Id)}>{c.Name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={booked} onValueChange={setBooked}>
            <SelectTrigger className="!h-11 w-full rounded-full bg-card lg:w-40" aria-label="Bookings"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="yes">Have booked</SelectItem>
              <SelectItem value="no">Not booked yet</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="!h-11 w-full rounded-full bg-card lg:w-44" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="bookings">Most bookings</SelectItem>
              <SelectItem value="name">Name, A to Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load neighbours: {String(error.message ?? error)}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && !data ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <div className="rounded-[22px] bg-card p-10 text-center shadow-sm">
          <p className="font-medium text-foreground">{filtered ? 'No neighbours match' : 'No neighbours yet'}</p>
          <p className="mt-1 text-sm text-muted-foreground">{filtered ? 'Try a different search or filter.' : 'Neighbours appear here when they create an account.'}</p>
        </div>
      ) : (
        <div className={cn('overflow-hidden rounded-[22px] bg-card shadow-sm transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-border px-5 py-3 text-sm text-muted-foreground md:grid">
            <span>Neighbour</span>
            <span>Phone</span>
            <span>Community</span>
            <span>Joined</span>
            <span className="text-right">Bookings</span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((n) => (
              <li key={n.id}>
                <div
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/admin/neighbours/${n.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/admin/neighbours/${n.id}`);
                  }}
                  className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-5 py-4 transition-colors hover:bg-accent md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-4"
                >
                  <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                    <UserAvatar person={n} className="size-10 flex-none" fallbackClassName="bg-primary/10 font-heading text-sm text-primary" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate font-medium text-foreground">
                        <span className="truncate">{n.name}</span>
                        {n.deletionRequested && <span className="flex-none rounded-md bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">Deletion asked</span>}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{n.email}</p>
                    </div>
                  </div>
                  <span className="hidden truncate text-sm tabular-nums text-foreground md:block">{n.phone || <span className="text-muted-foreground">Not added</span>}</span>
                  <span className="hidden min-w-0 text-sm md:block">
                    {n.community ? (
                      <>
                        <span className="block truncate text-foreground">{n.community.Name}</span>
                        {n.community.locality && <span className="block truncate text-muted-foreground">{n.community.locality}</span>}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </span>
                  <span className="hidden text-sm text-foreground md:block" title={formatRelativeTime(n.joined)}>{formatLocalDate(n.joined, DATE_FORMATS.SHORT)}</span>
                  <div className="row-span-1 text-right">
                    <p className={cn('font-heading text-lg font-bold tabular-nums', n.bookings ? 'text-foreground' : 'text-muted-foreground')}>{n.bookings}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">{n.bookings ? inr(n.paid) : 'none yet'}</p>
                  </div>
                  <p className="col-span-3 pl-[52px] text-sm text-muted-foreground md:hidden">
                    {[n.community?.Name, n.phone].filter(Boolean).join(', ') || 'No community or phone yet'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {total > size && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {(page - 1) * size + 1} to {Math.min(page * size, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              <ApperIcon name="ChevronLeft" size={16} />
              Previous
            </Button>
            <Button variant="outline" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)}>
              Next
              <ApperIcon name="ChevronRight" size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
