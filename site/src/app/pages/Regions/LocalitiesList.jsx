import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import StatusBadge from '@/components/StatusBadge';
import LookupPicker from '@/components/LookupPicker';
import { ListSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REGION_STATUS, REGION_STYLES } from '@/services/dealRules';
import LocalityDialog from './LocalityDialog';

export const route = { path: '/admin/localities', layout: 'owner', access: "profile === 'Admin_c'" };
export const nav = { icon: 'MapPin', label: 'Localities', order: 51, profiles: ['Admin_c'] };

const { eq, contains, and } = window.ApperSDK.CoreSDK;

export default function LocalitiesList() {
  const navigate = useNavigate();
  const [city, setCity] = useState(null);
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
    if (city) f.push(eq('city_c', city));
    if (status !== 'all') f.push(eq('status_c', status));
    if (search) f.push(contains('Name', search));
    let q = sdk.table('localities_c').select(['Name', 'city_c', 'pincode_c', 'status_c']);
    if (f.length) q = q.where(and(...f));
    return q.orderBy('Name').page(1, 50).fetch().then((r) => {
      if (!r.success) throw new Error(r.message);
      return r.data;
    });
  }, [city, status, search]);

  const rows = data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">Localities</h1>
          <p className="mt-1 text-muted-foreground">Neighbourhoods within each city. Deals are scoped to a locality.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><ApperIcon name="Plus" size={16} />Add locality</Button>
      </div>
      <div data-filterbar className="grid gap-3 sm:grid-cols-3">
        <div className="relative">
          <ApperIcon name="Search" size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search localities" className="pl-10" aria-label="Search localities" />
        </div>
        <LookupPicker table="cities_c" searchField="Name" value={city} onChange={setCity} placeholder="Any city" aria-label="City" clearable />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
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
          <p className="text-sm text-muted-foreground">Couldn't load localities: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && data === undefined ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <ApperIcon name="MapPin" size={28} className="text-muted-foreground" />
          <p className="font-medium text-foreground">No localities match</p>
          <Button onClick={() => setCreateOpen(true)}>Add locality</Button>
        </div>
      ) : (
        <div aria-busy={loading} className={cn('overflow-hidden rounded-[22px] bg-card shadow-sm transition-opacity', loading && 'opacity-60')}>
          {rows.map((l) => (
            <div
              key={l.Id}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/admin/localities/${l.Id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/admin/localities/${l.Id}`);
              }}
              className="flex cursor-pointer items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 transition-colors duration-(--transition-fast) hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/10 text-primary"><ApperIcon name="MapPin" size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{l.Name}</p>
                <p className="text-xs text-muted-foreground">{l.city_c?.Name ?? '—'}, {l.pincode_c ?? 'no pincode'}</p>
              </div>
              <StatusBadge value={l.status_c} styles={REGION_STYLES} />
            </div>
          ))}
        </div>
      )}
      <LocalityDialog open={createOpen} onOpenChange={setCreateOpen} record={null} onSaved={run} />
    </div>
  );
}
