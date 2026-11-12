import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import StatusBadge from '@/components/StatusBadge';
import { ListSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REGION_STATUS, REGION_STYLES } from '@/services/dealRules';
import CityDialog from './CityDialog';

export const route = { path: '/admin/cities', layout: 'owner', access: "profile === 'Admin_c'" };
export const nav = { icon: 'Building2', label: 'Cities', order: 50, profiles: ['Admin_c'] };

const { eq, contains, and } = window.ApperSDK.CoreSDK;

export default function CitiesList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, loading, error, run } = useFetch(() => {
    const f = [];
    if (status !== 'all') f.push(eq('status_c', status));
    if (search) f.push(contains('Name', search));
    let q = sdk.table('cities_c').select(['Name', 'state_c', 'status_c', 'CreatedOn']);
    if (f.length) q = q.where(and(...f));
    return q.orderBy('Name').page(1, 50).fetch().then((r) => {
      if (!r.success) throw new Error(r.message);
      return r.data;
    });
  }, [status, search]);

  const rows = data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">Cities</h1>
          <p className="mt-1 text-muted-foreground">Where Lotmates runs, or will run next.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <ApperIcon name="Plus" size={16} />
          Add city
        </Button>
      </div>
      <div data-filterbar className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <ApperIcon name="Search" size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search cities" className="pl-10" aria-label="Search cities" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {REGION_STATUS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load cities: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && data === undefined ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <ApperIcon name="Building2" size={28} className="text-muted-foreground" />
          <p className="font-medium text-foreground">No cities match</p>
          <Button onClick={() => setCreateOpen(true)}>Add city</Button>
        </div>
      ) : (
        <div aria-busy={loading} className={cn('grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-4', loading && 'opacity-60')}>
          {rows.map((c) => (
            <div
              key={c.Id}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/admin/cities/${c.Id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/admin/cities/${c.Id}`);
              }}
              className="cursor-pointer rounded-[22px] bg-card shadow-sm p-6 transition-colors duration-(--transition-fast) hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ApperIcon name="Building2" size={22} className="text-primary" />
              <p className="mt-3 font-heading text-xl font-bold text-foreground">{c.Name}</p>
              <p className="text-sm text-muted-foreground">{c.state_c ?? '—'}</p>
              <div className="mt-3"><StatusBadge value={c.status_c} styles={REGION_STYLES} /></div>
            </div>
          ))}
        </div>
      )}
      <CityDialog open={createOpen} onOpenChange={setCreateOpen} record={null} onSaved={run} />
    </div>
  );
}
