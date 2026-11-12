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
import { COMMUNITY_TYPES, COMMUNITY_STATUS, REGION_STYLES } from '@/services/dealRules';
import CommunityDialog from './CommunityDialog';

export const route = { path: '/admin/communities', layout: 'owner', access: "profile === 'Admin_c'" };
export const nav = { icon: 'Home', label: 'Communities', order: 52, profiles: ['Admin_c'], count: { table: 'communities_c', where: null } };

const { eq, contains, and } = window.ApperSDK.CoreSDK;

const TYPE_ICON = { Apartment: 'Building', Gated: 'Castle', Street: 'Signpost' };

export default function CommunitiesList() {
  const navigate = useNavigate();
  const [locality, setLocality] = useState(null);
  const [type, setType] = useState('all');
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
    if (locality) f.push(eq('locality_c', locality));
    if (type !== 'all') f.push(eq('type_c', type));
    if (status !== 'all') f.push(eq('status_c', status));
    if (search) f.push(contains('Name', search));
    let q = sdk.table('communities_c').select(['Name', 'locality_c', 'type_c', 'homes_c', 'ambassadorName_c', 'status_c']);
    if (f.length) q = q.where(and(...f));
    return q.orderByDesc('homes_c').page(1, 50).fetch().then((r) => {
      if (!r.success) throw new Error(r.message);
      return r.data;
    });
  }, [locality, type, status, search]);

  const rows = data ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">Communities</h1>
          <p className="mt-1 text-muted-foreground">The neighbourhood groups that book together.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><ApperIcon name="Plus" size={16} />Add community</Button>
      </div>
      <div data-filterbar className="grid gap-3 sm:grid-cols-4">
        <div className="relative">
          <ApperIcon name="Search" size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search communities" className="pl-10" aria-label="Search communities" />
        </div>
        <LookupPicker table="localities_c" searchField="Name" value={locality} onChange={setLocality} placeholder="Any locality" aria-label="Locality" clearable />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {COMMUNITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {COMMUNITY_STATUS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load communities: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && data === undefined ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <ApperIcon name="Home" size={28} className="text-muted-foreground" />
          <p className="font-medium text-foreground">No communities match</p>
          <Button onClick={() => setCreateOpen(true)}>Add community</Button>
        </div>
      ) : (
        <div aria-busy={loading} className={cn('grid gap-5 transition-opacity sm:grid-cols-2 lg:grid-cols-3', loading && 'opacity-60')}>
          {rows.map((c) => (
            <div
              key={c.Id}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/admin/communities/${c.Id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/admin/communities/${c.Id}`);
              }}
              className="cursor-pointer rounded-[22px] bg-card shadow-sm p-6 transition-colors duration-(--transition-fast) hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><ApperIcon name={TYPE_ICON[c.type_c] ?? 'Home'} size={18} /></span>
                <StatusBadge value={c.status_c} />
              </div>
              <p className="mt-4 font-semibold text-foreground">{c.Name}</p>
              <p className="text-sm text-muted-foreground">{c.type_c}, {c.locality_c?.Name ?? '—'}</p>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                <span className="font-semibold tabular-nums text-foreground">{c.homes_c ?? '—'} homes</span>
                <span className="text-muted-foreground">{c.ambassadorName_c ? `Ambassador: ${c.ambassadorName_c}` : 'No ambassador yet'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <CommunityDialog open={createOpen} onOpenChange={setCreateOpen} record={null} onSaved={run} />
    </div>
  );
}
