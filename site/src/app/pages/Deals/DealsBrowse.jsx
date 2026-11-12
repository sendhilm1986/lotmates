import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import DealCard from '@/components/DealCard';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DEAL_FIELDS, CATEGORY_VALUES, CATEGORY_META } from '@/services/dealRules';

export const route = { path: '/deals', layout: 'public', access: 'public' };

const { eq, isIn, contains, and, or, isNull } = window.ApperSDK.CoreSDK;

const PAGE_SIZE = 9;
const STORE_KEY = 'lotmates.locality';
const SORTS = [
  { key: 'closing', label: 'Closing soonest' },
  { key: 'popular', label: 'Most booked' },
  { key: 'newest', label: 'Newest' },
];

function readStored() {
  try {
    return window.localStorage.getItem(STORE_KEY) || 'all';
  } catch {
    return 'all';
  }
}

function writeStored(v) {
  try {
    window.localStorage.setItem(STORE_KEY, v);
  } catch {
    // storage unavailable; the filter still works for this visit
  }
}

function OptionRow({ label, note, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 text-left transition-colors duration-(--transition-fast)',
        active ? 'bg-accent font-semibold text-foreground' : 'text-foreground hover:bg-accent',
      )}
    >
      <span className="truncate">{label}</span>
      <span className="flex flex-none items-center gap-2 text-sm text-muted-foreground">
        {note}
        {active && <ApperIcon name="Check" size={18} className="text-primary" />}
      </span>
    </button>
  );
}

export default function DealsBrowse() {
  const [params, setParams] = useSearchParams();
  const [localityId, setLocalityId] = useState(params.get('locality') || readStored());
  const [communityId, setCommunityId] = useState('all');
  const [category, setCategory] = useState(params.get('category') || 'all');
  const [past, setPast] = useState(false);
  const [sort, setSort] = useState('closing');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [areaOpen, setAreaOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [localityId, communityId, category, past, sort, search]);

  useEffect(() => {
    writeStored(localityId);
    window.dispatchEvent(new Event('lotmates:locality'));
    const next = new URLSearchParams();
    if (localityId !== 'all') next.set('locality', localityId);
    if (category !== 'all') next.set('category', category);
    setParams(next, { replace: true });
  }, [localityId, category, setParams]);

  const { data: localities } = useFetch(() => {
    return sdk
      .table('localities_c')
      .select(['Name', 'city_c', 'status_c'])
      .orderBy('Name')
      .fetch()
      .then((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      });
  }, []);

  const { data: communities } = useFetch(() => {
    if (localityId === 'all') return Promise.resolve([]);
    return sdk
      .table('communities_c')
      .select(['Name', 'locality_c', 'status_c'])
      .where(eq('locality_c', localityId))
      .orderBy('Name')
      .fetch()
      .then((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      });
  }, [localityId]);

  const { data, loading, error, run } = useFetch(() => {
    const f = [];
    if (past) f.push(isIn('status_c', ['Closed', 'Failed']));
    else f.push(eq('status_c', 'Live'));
    if (category !== 'all') f.push(eq('category_c', category));
    if (localityId !== 'all') f.push(eq('locality_c', localityId));
    if (communityId !== 'all') f.push(or(eq('community_c', communityId), isNull('community_c')));
    if (search) f.push(contains('Name', search));
    let q = sdk.table('deals_c').select(DEAL_FIELDS).where(and(...f));
    if (sort === 'closing') q = past ? q.orderByDesc('deadline_c') : q.orderBy('deadline_c');
    else if (sort === 'popular') q = q.orderByDesc('bookedHomes_c');
    else q = q.orderByDesc('CreatedOn');
    return q
      .page(page, PAGE_SIZE)
      .fetch()
      .then((r) => {
        if (!r.success) throw new Error(r.message);
        return { rows: r.data, total: r.total ?? r.data.length };
      });
  }, [past, category, localityId, communityId, search, sort, page]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstLoad = loading && data === undefined;

  const area = (localities ?? []).find((l) => String(l.Id) === String(localityId));
  const community = (communities ?? []).find((c) => String(c.Id) === String(communityId));
  const areaLabel = community ? community.Name : area ? area.Name : 'All areas';
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? 'Sort';

  const cities = [];
  (localities ?? []).forEach((l) => {
    const name = l.city_c?.Name ?? 'Other';
    const g = cities.find((c) => c.name === name);
    if (g) g.items.push(l);
    else cities.push({ name, items: [l] });
  });

  function pickArea(id) {
    setLocalityId(id);
    setCommunityId('all');
    if (id === 'all') setAreaOpen(false);
  }

  const tabs = [['all', 'All'], ...CATEGORY_VALUES.map((c) => [c, CATEGORY_META[c].label])];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 md:px-8">
      <div className="sticky top-16 z-(--z-dropdown) -mx-4 border-b border-border bg-background/95 px-4 pt-2 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAreaOpen(true)}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg pr-2 text-left sm:flex-none"
            aria-label={`Area: ${areaLabel}. Change area`}
          >
            <ApperIcon name="MapPin" size={18} className="flex-none text-primary" />
            <span className="truncate font-semibold text-foreground">{areaLabel}</span>
            <ApperIcon name="ChevronDown" size={16} className="flex-none text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={() => setSortOpen(true)}
            className="flex min-h-11 flex-none items-center gap-1 rounded-full px-3 text-sm text-muted-foreground transition-colors duration-(--transition-fast) hover:bg-accent sm:ml-auto"
          >
            {sortLabel}
            <ApperIcon name="ChevronDown" size={14} />
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen((o) => !o)}
            aria-label={searchOpen ? 'Close search' : 'Search deals'}
            aria-expanded={searchOpen}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-foreground transition-colors duration-(--transition-fast) hover:bg-accent"
          >
            <ApperIcon name={searchOpen ? 'X' : 'Search'} size={20} />
          </button>
        </div>
        {searchOpen && (
          <div className="pb-2">
            <Input
              autoFocus
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search deals, e.g. cleaning"
              aria-label="Search deals"
            />
          </div>
        )}
        <div className="-mx-4 flex gap-6 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-8 md:px-8" role="tablist" aria-label="Category">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={category === key}
              onClick={() => setCategory(key)}
              className={cn(
                'relative whitespace-nowrap py-3 text-sm font-medium transition-colors duration-(--transition-fast)',
                category === key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              {category === key && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3 pb-5 pt-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">{past ? 'Past deals' : 'Live deals'}</h1>
        {!firstLoad && !error && (
          <span className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'deal' : 'deals'}
          </span>
        )}
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <ApperIcon name="CloudOff" size={28} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Couldn't load deals: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : firstLoad ? (
        <div className="grid gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-4 rounded-[24px] bg-card p-3 shadow-md">
              <Skeleton className="aspect-[16/10] w-full rounded-[18px]" />
              <div className="space-y-3 px-2 pb-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-6 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="font-medium text-foreground">No deals match</p>
          <p className="max-w-sm text-sm text-muted-foreground">Try another area or category. New rounds open most weeks.</p>
          <Button
            variant="outline"
            onClick={() => {
              setCategory('all');
              setCommunityId('all');
              setSearchInput('');
              setLocalityId('all');
            }}
          >
            Show all deals
          </Button>
        </div>
      ) : (
        <div
          aria-busy={loading}
          className={cn('grid gap-5 transition-opacity sm:grid-cols-2 md:gap-6 lg:grid-cols-3', loading && 'pointer-events-none opacity-60')}
        >
          {rows.map((d) => (
            <DealCard key={d.Id} record={d} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-3">
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

      <div className="mt-12 border-t border-border pt-6 text-center">
        <button type="button" className="min-h-11 text-sm font-medium text-primary hover:underline" onClick={() => setPast((p) => !p)}>
          {past ? 'Back to live deals' : 'See past deals'}
        </button>
      </div>

      <Sheet open={areaOpen} onOpenChange={setAreaOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] gap-2 overflow-y-auto rounded-t-[24px] px-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader className="px-4 pt-5 pb-0 pr-16 md:pr-28">
            <SheetTitle className="font-heading text-lg">Choose your area</SheetTitle>
            <SheetDescription>Each deal runs in one neighbourhood.</SheetDescription>
          </SheetHeader>
          <div className="px-2">
            <OptionRow label="All areas" active={localityId === 'all'} onClick={() => pickArea('all')} />
            {cities.map((c) => (
              <div key={c.name}>
                <p className="px-3 pb-1 pt-4 text-sm font-medium text-muted-foreground">{c.name}</p>
                {c.items.map((l) => (
                  <OptionRow
                    key={l.Id}
                    label={l.Name}
                    note={l.status_c === 'Coming soon' ? 'Coming soon' : null}
                    active={String(l.Id) === String(localityId)}
                    onClick={() => pickArea(l.Id)}
                  />
                ))}
              </div>
            ))}
          </div>
          {localityId !== 'all' && (communities ?? []).length > 0 && (
            <div className="px-4 pt-3">
              <p className="pb-2 text-sm font-medium text-muted-foreground">Your community (optional)</p>
              <div className="flex flex-wrap gap-2">
                {[{ Id: 'all', Name: 'Whole area' }, ...communities].map((c) => {
                  const active = String(c.Id) === String(communityId);
                  return (
                    <button
                      key={c.Id}
                      type="button"
                      onClick={() => setCommunityId(c.Id)}
                      className={cn(
                        'min-h-10 rounded-full border px-3 text-sm transition-colors duration-(--transition-fast)',
                        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:border-primary',
                      )}
                    >
                      {c.Name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="px-4 pt-4">
            <Button className="w-full" size="lg" onClick={() => setAreaOpen(false)}>
              Show deals
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={sortOpen} onOpenChange={setSortOpen}>
        <SheetContent side="bottom" className="gap-2 rounded-t-[24px] px-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader className="px-4 pt-5 pb-0 pr-16 md:pr-28">
            <SheetTitle className="font-heading text-lg">Sort deals</SheetTitle>
            <SheetDescription>Closing soonest shows what needs you first.</SheetDescription>
          </SheetHeader>
          <div className="px-2">
            {SORTS.map((s) => (
              <OptionRow
                key={s.key}
                label={s.label}
                active={sort === s.key}
                onClick={() => {
                  setSort(s.key);
                  setSortOpen(false);
                }}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
