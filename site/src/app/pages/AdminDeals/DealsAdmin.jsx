import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import StatusBadge from '@/components/StatusBadge';
import LookupPicker from '@/components/LookupPicker';
import PageHeader from '@/components/PageHeader';
import { ListSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEAL_FIELDS, DEAL_STATUS, DEAL_STYLES, CATEGORY_VALUES, categoryLabel, categoryIcon, dealState, inr } from '@/services/dealRules';

export const route = { path: '/admin/deals', layout: 'owner', access: "profile === 'Admin_c'" };
export const nav = { icon: 'Tag', label: 'Deals', order: 30, profiles: ['Admin_c'], count: { table: 'deals_c', where: null } };

const { eq, contains, and } = window.ApperSDK.CoreSDK;

const PAGE_SIZE = 10;

export default function DealsAdmin() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [locality, setLocality] = useState(null);
  const [sort, setSort] = useState('deadline');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [status, category, locality, sort, search]);

  const { data, loading, error, run } = useFetch(() => {
    const f = [];
    if (status !== 'all') f.push(eq('status_c', status));
    if (category !== 'all') f.push(eq('category_c', category));
    if (locality) f.push(eq('locality_c', locality));
    if (search) f.push(contains('Name', search));
    let q = sdk.table('deals_c').select(DEAL_FIELDS);
    if (f.length) q = q.where(and(...f));
    if (sort === 'deadline') q = q.orderBy('deadline_c');
    else if (sort === 'booked') q = q.orderByDesc('bookedHomes_c');
    else q = q.orderByDesc('CreatedOn');
    return q
      .page(page, PAGE_SIZE)
      .fetch()
      .then((r) => {
        if (!r.success) throw new Error(r.message);
        return { rows: r.data, total: r.total ?? r.data.length };
      });
  }, [status, category, locality, sort, search, page]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstLoad = loading && data === undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Deals"
        description="Every round across your communities."
        actions={
          <Button asChild>
            <Link to="/admin/deals/new">
              <ApperIcon name="Plus" size={16} />
              New deal
            </Link>
          </Button>
        }
      />

      <div data-filterbar className="space-y-3">
        <div className="relative">
          <ApperIcon name="Search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search deals, e.g. termite"
            className="pl-10"
            aria-label="Search deals"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full bg-card" aria-label="Status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {DEAL_STATUS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full bg-card" aria-label="Category"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORY_VALUES.map((c) => (
                <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <LookupPicker
            table="localities_c"
            searchField="Name"
            value={locality}
            onChange={setLocality}
            placeholder="Any locality"
            aria-label="Locality"
            clearable
          />
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full bg-card" aria-label="Sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="deadline">Closing first</SelectItem>
              <SelectItem value="booked">Most booked</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load deals: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : firstLoad ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-border p-10 text-center">
          <p className="font-medium text-foreground">No deals match</p>
          <p className="text-sm text-muted-foreground">Create a deal with a vendor's tier prices to open a new round.</p>
          <Button asChild>
            <Link to="/admin/deals/new">New deal</Link>
          </Button>
        </div>
      ) : (
        <ul
          aria-busy={loading}
          className={cn('divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm transition-opacity', loading && 'pointer-events-none opacity-60')}
        >
          {rows.map((d) => {
            const st = dealState(d);
            return (
              <li key={d.Id}>
                <div
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/admin/deals/${d.Id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/admin/deals/${d.Id}`);
                  }}
                  className="flex cursor-pointer gap-3 px-5 py-5 transition-colors md:px-6 duration-(--transition-fast) hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-5"
                >
                  <span className="mt-0.5 flex size-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ApperIcon name={categoryIcon(d.category_c)} size={16} />
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-medium leading-snug text-foreground">{d.Name}</p>
                      <span className="flex-none font-heading text-lg font-bold tabular-nums text-foreground">{inr(st.current?.price)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm text-muted-foreground">
                        {d.vendor_c?.Name ?? 'No vendor'}, {d.community_c?.Name ?? d.locality_c?.Name ?? 'no area'}
                      </p>
                      <StatusBadge value={d.status_c} className="flex-none" />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="relative h-2 flex-1 rounded-full bg-muted">
                        <div className={cn('absolute inset-y-0 left-0 rounded-full', st.unlocked ? 'bg-primary' : 'bg-primary/45')} style={{ width: `${Math.min(100, (st.booked / (st.cap || st.scaleMax || 1)) * 100)}%` }} />
                      </div>
                      <p className="flex-none text-[13px] tabular-nums text-muted-foreground">
                        {st.booked} of {st.cap || st.scaleMax}
                        {d.deadline_c ? `, closes ${formatLocalDate(d.deadline_c, DATE_FORMATS.SHORT)}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ApperIcon name="ChevronLeft" size={16} />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
            <ApperIcon name="ChevronRight" size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
