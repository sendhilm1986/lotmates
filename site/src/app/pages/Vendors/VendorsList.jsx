import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import StatusBadge from '@/components/StatusBadge';
import { ListSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORY_VALUES, VENDOR_STATUS, VENDOR_STYLES, VENDOR_CHECKS, categoryLabel, categoryIcon } from '@/services/dealRules';

export const route = { path: '/admin/vendors', layout: 'owner', access: "profile === 'Admin_c'" };
export const nav = { icon: 'Store', label: 'Vendors', order: 40, profiles: ['Admin_c'], count: { table: 'vendors_c', where: null } };

const { eq, contains, and } = window.ApperSDK.CoreSDK;

export const VENDOR_FIELDS = ['Name', 'category_c', 'contactName_c', 'phone_c', 'email_c', 'locality_c', 'status_c', 'checks_c', 'rating_c', 'jobsDone_c', 'notes_c', 'CreatedOn'];

const PAGE_SIZE = 10;
const toArray = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',') : []);

export default function VendorsList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('rating');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [status, category, sort, search]);

  const { data, loading, error, run } = useFetch(() => {
    const f = [];
    if (status !== 'all') f.push(eq('status_c', status));
    if (category !== 'all') f.push(eq('category_c', category));
    if (search) f.push(contains('Name', search));
    let q = sdk.table('vendors_c').select(VENDOR_FIELDS);
    if (f.length) q = q.where(and(...f));
    if (sort === 'rating') q = q.orderByDesc('rating_c');
    else if (sort === 'jobs') q = q.orderByDesc('jobsDone_c');
    else q = q.orderBy('Name');
    return q
      .page(page, PAGE_SIZE)
      .fetch()
      .then((r) => {
        if (!r.success) throw new Error(r.message);
        return { rows: r.data, total: r.total ?? r.data.length };
      });
  }, [status, category, sort, search, page]);

  const rows = data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const firstLoad = loading && data === undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">Vendors</h1>
          <p className="mt-1 text-muted-foreground">Checked local businesses that deliver your deals.</p>
        </div>
        <Button asChild>
          <Link to="/admin/vendors/new">
            <ApperIcon name="Plus" size={16} />
            Add vendor
          </Link>
        </Button>
      </div>

      <div data-filterbar className="grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-1">
          <ApperIcon name="Search" size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search vendors" className="pl-10" aria-label="Search vendors" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {VENDOR_STATUS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_VALUES.map((c) => (
              <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rating">Highest rated</SelectItem>
            <SelectItem value="jobs">Most jobs</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load vendors: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : firstLoad ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <ApperIcon name="Store" size={28} className="text-muted-foreground" />
          <p className="font-medium text-foreground">No vendors match</p>
          <p className="text-sm text-muted-foreground">Add a vendor after their ID check and a test job.</p>
          <Button asChild><Link to="/admin/vendors/new">Add vendor</Link></Button>
        </div>
      ) : (
        <div aria-busy={loading} className={cn('grid gap-5 transition-opacity md:grid-cols-2', loading && 'pointer-events-none opacity-60')}>
          {rows.map((v) => {
            const checks = toArray(v.checks_c);
            return (
              <div
                key={v.Id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/admin/vendors/${v.Id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/admin/vendors/${v.Id}`);
                }}
                className="cursor-pointer rounded-[22px] bg-card shadow-sm p-6 transition-colors duration-(--transition-fast) hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ApperIcon name={categoryIcon(v.category_c)} size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{v.Name}</p>
                      <p className="text-sm text-muted-foreground">{categoryLabel(v.category_c)}, {v.locality_c?.Name ?? '—'}</p>
                    </div>
                  </div>
                  <StatusBadge value={v.status_c} />
                </div>
                <div className="mt-5 flex items-center gap-5 text-sm">
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                    <ApperIcon name="Star" size={14} className="text-highlight" />
                    {v.rating_c ?? '—'}
                  </span>
                  <span className="text-muted-foreground">{v.jobsDone_c ?? 0} jobs</span>
                  <span className="truncate text-muted-foreground">{v.contactName_c}</span>
                </div>
                {(() => {
                  const missing = VENDOR_CHECKS.filter((c) => !checks.includes(c));
                  return (
                    <p className={cn('mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm', missing.length ? 'text-[oklch(0.5_0.13_50)]' : 'text-muted-foreground')}>
                      <ApperIcon name={missing.length ? 'CircleAlert' : 'ShieldCheck'} size={16} className={missing.length ? '' : 'text-success'} />
                      {missing.length ? `Still to check: ${missing.join(', ').toLowerCase()}` : 'All checks done'}
                    </p>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
