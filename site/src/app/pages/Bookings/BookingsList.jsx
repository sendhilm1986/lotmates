import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useSelector } from 'react-redux';
import { useProfile } from '@/hooks/useProfile';
import { formatRelativeTime } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import StatusBadge from '@/components/StatusBadge';
import { ListSkeleton, StatsSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BOOKING_FIELDS,
  BOOKING_STATUS,
  BOOKING_STYLES,
  REFUND_STATUS,
  REFUND_STYLES,
  DEAL_FIELDS,
  dealState,
  inr,
  timeLeft,
  windowText,
  dealSchedule,
  scheduleLine,
} from '@/services/dealRules';

export const route = { path: '/bookings', layout: 'owner', access: "['Admin_c','Customer_c','Ambassador_c'].includes(profile)" };
export const nav = { icon: 'Ticket', label: 'Bookings', order: 20, profiles: ['Admin_c', 'Customer_c', 'Ambassador_c'], count: { table: 'bookings_c', where: null } };

const { eq, isIn, contains, and } = window.ApperSDK.CoreSDK;

const PAGE_SIZE = 10;

// What a neighbour sees on a row: plain words for what happened to their money.
function statusLabel(b) {
  if (b.status_c === 'Failed') return "Didn't go ahead";
  if (b.status_c === 'Cancelled') return 'You cancelled';
  return undefined;
}

function serviceLine(b, d) {
  if (!d || !['Booked', 'Confirmed'].includes(b.status_c)) return '';
  if (b.preferredDate_c && dealSchedule(d) !== 'none') return scheduleLine(b, d);
  const win = windowText(d);
  return win ? `Service ${win}` : '';
}

function RowProgress({ deal }) {
  const st = dealState(deal);
  const need = !st.unlocked && st.toMin > 0 ? `${st.toMin} more to go ahead` : st.next ? `${st.toNext} more for ${inr(st.next.price)}` : 'Best price reached';
  const hoursLeft = (new Date(deal.deadline_c).getTime() - Date.now()) / 36e5;
  return (
    <div className="mt-2">
      <div
        className="h-1.5 rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={st.scaleMax}
        aria-valuenow={st.booked}
        aria-label={`${st.booked} of ${st.scaleMax} homes booked`}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${st.progressPct}%` }} />
      </div>
      <p className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{st.booked} booked, {need}</span>
        <span className={cn('whitespace-nowrap', hoursLeft > 0 && hoursLeft < 24 && 'font-medium text-[oklch(0.5_0.13_50)]')}>{timeLeft(deal.deadline_c)}</span>
      </p>
    </div>
  );
}

export default function BookingsList() {
  const { profile } = useProfile();
  const isAdmin = profile === 'Admin_c';
  const uid = useSelector((st) => st.user.user?.userId);
  // Ambassadors can also read their community's bookings; this page shows only their own.
  const own = (w) => (isAdmin || !uid ? w : and(w, eq('Owner', uid)));
  const [status, setStatus] = useState('all');
  const [params] = useSearchParams();
  const [refund, setRefund] = useState(REFUND_STATUS.includes(params.get('refund')) ? params.get('refund') : 'all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // Neighbours start on what is still open; past bookings are one tap away.
  const [group, setGroup] = useState(isAdmin || params.get('refund') ? 'all' : 'open');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [status, refund, search, group]);

  const { data, loading, error, run } = useFetch(() => {
    const f = [];
    if (status !== 'all') f.push(eq('status_c', status));
    if (refund !== 'all') f.push(eq('refundStatus_c', refund));
    if (search) f.push(contains('Name', search));
    if (!isAdmin && group === 'open') f.push(isIn('status_c', ['Booked', 'Confirmed']));
    if (!isAdmin && group === 'past') f.push(isIn('status_c', ['Failed', 'Done', 'Cancelled']));
    if (!isAdmin && uid) f.push(eq('Owner', uid));
    let q = sdk.table('bookings_c').select(BOOKING_FIELDS);
    if (f.length) q = q.where(and(...f));
    return q
      .orderByDesc('CreatedOn')
      .page(page, PAGE_SIZE)
      .fetch()
      .then((r) => {
        if (!r.success) throw new Error(r.message);
        return { rows: r.data, total: r.total ?? r.data.length };
      });
  }, [status, refund, search, page, group]);

  const rows = data?.rows ?? [];
  const dealIds = [...new Set(rows.map((b) => b.deal_c?.Id).filter(Boolean))].sort().join(',');

  const { data: dealMap } = useFetch(() => {
    if (!dealIds) return Promise.resolve({});
    return sdk
      .table('deals_c')
      .select(DEAL_FIELDS)
      .where(isIn('Id', dealIds.split(',')))
      .fetch()
      .then((r) => {
        const map = {};
        (r.success ? r.data : []).forEach((d) => {
          map[String(d.Id)] = d;
        });
        return map;
      });
  }, [dealIds]);

  const { data: money, loading: moneyLoading, run: refetchMoney } = useFetch(async () => {
    const res = await sdk
      .table('bookings_c')
      .select([{ field: 'Id' }])
      .aggregate([
        { id: 'paid', fields: [{ field: 'amountPaid_c', fn: 'Sum', alias: 'count' }], where: own(isIn('paymentStatus_c', ['Paid', 'Refunded'])) },
        { id: 'due', fields: [{ field: 'refundDue_c', fn: 'Sum', alias: 'count' }], where: own(eq('refundStatus_c', 'Due')) },
        { id: 'back', fields: [{ field: 'refundDue_c', fn: 'Sum', alias: 'count' }], where: own(eq('refundStatus_c', 'Paid')) },
        { id: 'open', fields: [{ field: 'Id', fn: 'Count', alias: 'count' }], where: own(eq('status_c', 'Booked')) },
      ])
      .limit(1)
      .fetch();
    if (!res.success) throw new Error(res.message);
    const pick = (id) => {
      const b = res.aggregators?.find((a) => a.id === id);
      return b?.data?.count ?? b?.count ?? b?.value ?? 0;
    };
    return { paid: pick('paid'), due: pick('due'), back: pick('back'), open: pick('open') };
  }, [uid]);

  // Money building up on open bookings: it is not "due" yet, because the final price is set when each deal closes.
  const { data: building } = useFetch(async () => {
    if (isAdmin || !uid) return 0;
    const bk = await sdk.table('bookings_c').select(BOOKING_FIELDS).where(and(eq('Owner', uid), eq('status_c', 'Booked'))).page(1, 100).fetch();
    if (!bk.success) return 0;
    const ids = [...new Set(bk.data.map((b) => b.deal_c?.Id).filter(Boolean))];
    if (!ids.length) return 0;
    const dl = await sdk.table('deals_c').select(DEAL_FIELDS).where(isIn('Id', ids)).fetch();
    const map = {};
    (dl.success ? dl.data : []).forEach((d) => {
      map[String(d.Id)] = d;
    });
    return bk.data.reduce((sum, b) => {
      const d = map[String(b.deal_c?.Id)];
      if (!d) return sum;
      const st = dealState(d);
      return sum + Math.max(0, (Number(b.unitPrice_c || 0) - (st.current?.price ?? 0)) * Number(b.homes_c || 1));
    }, 0);
  }, [uid, isAdmin]);

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstLoad = loading && data === undefined;

  function refundSoFar(b) {
    const d = dealMap?.[String(b.deal_c?.Id)];
    if (!d || b.status_c !== 'Booked') return 0;
    const st = dealState(d);
    return Math.max(0, (Number(b.unitPrice_c || 0) - (st.current?.price ?? 0)) * Number(b.homes_c || 1));
  }

  const filtered = status !== 'all' || refund !== 'all' || Boolean(search);
  const emptyOpen = !isAdmin && group === 'open' && !filtered;
  const stats = isAdmin
    ? [
        { label: 'Paid in', value: inr(money?.paid ?? 0), hint: 'Before refunds' },
        { label: 'Refunds due', value: inr(money?.due ?? 0), action: Number(money?.due) > 0 ? () => setRefund('Due') : null },
        { label: 'Refunds sent', value: inr(money?.back ?? 0) },
        { label: 'Open bookings', value: money?.open ?? 0 },
      ]
    : [
        { label: 'You paid', value: inr(money?.paid ?? 0) },
        { label: 'Coming back so far', value: inr((building ?? 0) + Number(money?.due ?? 0)), hint: 'Final amount is set when each deal closes' },
        { label: 'Already returned', value: inr(money?.back ?? 0) },
        { label: 'Open bookings', value: money?.open ?? 0 },
      ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
            {isAdmin ? 'Bookings' : 'My bookings'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isAdmin ? 'Every booking across communities, with payment and refund status.' : 'What you paid, what is coming back, and when your service is.'}
          </p>
        </div>
        {!isAdmin && (
          <Button asChild className="h-11 rounded-full px-5">
            <Link to="/deals">
              <ApperIcon name="Plus" size={16} />
              Book a deal
            </Link>
          </Button>
        )}
      </div>

      {moneyLoading && !money ? (
        <StatsSkeleton count={4} />
      ) : (
        <dl className="grid grid-cols-2 overflow-hidden rounded-[22px] bg-card shadow-sm lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={cn('min-w-0 px-5 py-4', i % 2 === 1 && 'border-l border-border', i >= 2 && 'border-t border-border lg:border-t-0', i === 2 && 'lg:border-l')}>
              <dt className="text-sm text-muted-foreground">{s.label}</dt>
              <dd className="mt-1 flex items-baseline gap-2">
                <span className="font-heading text-2xl font-bold tabular-nums text-foreground">{s.value}</span>
                {s.action && (
                  <button type="button" onClick={s.action} className="text-sm font-medium text-primary hover:underline">
                    Show
                  </button>
                )}
              </dd>
              {s.hint && <dd className="mt-0.5 text-xs text-muted-foreground">{s.hint}</dd>}
            </div>
          ))}
        </dl>
      )}

      {!isAdmin && (
        <div role="tablist" aria-label="Show bookings" className="flex gap-2">
          {[['open', 'Open'], ['past', 'Past'], ['all', 'All']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={group === key}
              onClick={() => setGroup(key)}
              className={cn(
                'min-h-11 rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                group === key ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div data-filterbar className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <ApperIcon name="Search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by booking ref, e.g. LM-1041"
            className="h-11 rounded-full bg-card pl-10"
            aria-label="Search bookings"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 rounded-full bg-card sm:w-44" aria-label="Status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {BOOKING_STATUS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={refund} onValueChange={setRefund}>
          <SelectTrigger className="h-11 rounded-full bg-card sm:w-44" aria-label="Refund">
            <SelectValue placeholder="Refund" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any refund</SelectItem>
            <SelectItem value="Due">Refund due</SelectItem>
            <SelectItem value="Paid">Refund sent</SelectItem>
            <SelectItem value="None">No refund</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load bookings: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : firstLoad ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card p-10 text-center shadow-sm">
          <p className="font-medium text-foreground">{filtered ? 'No bookings match these filters' : emptyOpen ? 'No open bookings right now' : 'No bookings yet'}</p>
          {filtered ? (
            <Button variant="outline" onClick={() => { setStatus('all'); setRefund('all'); setSearchInput(''); }}>Clear filters</Button>
          ) : emptyOpen ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild><Link to="/deals">Book a deal</Link></Button>
              <Button variant="outline" onClick={() => setGroup('past')}>See past bookings</Button>
            </div>
          ) : isAdmin ? (
            <p className="text-sm text-muted-foreground">Bookings appear here as neighbours pay for live deals.</p>
          ) : (
            <Button asChild><Link to="/deals">Browse deals</Link></Button>
          )}
        </div>
      ) : (
        <div
          aria-busy={loading}
          className={cn('overflow-hidden rounded-[22px] bg-card shadow-sm transition-opacity', loading && 'pointer-events-none opacity-60')}
        >
          <div className="hidden grid-cols-[1.6fr_1fr_0.8fr_1fr_0.9fr] gap-4 border-b border-border px-5 py-3 text-[13px] text-muted-foreground md:grid">
            <span>Deal</span>
            <span>{isAdmin ? 'Neighbour' : 'Community'}</span>
            <span className="text-right">Paid</span>
            <span className="text-right">Refund</span>
            <span className="text-right">Status</span>
          </div>
          {rows.map((b) => {
            const soFar = refundSoFar(b);
            const d = dealMap?.[String(b.deal_c?.Id)];
            const service = isAdmin ? '' : serviceLine(b, d);
            return (
              <Link
                key={b.Id}
                to={`/bookings/${b.Id}`}
                className={cn(
                  'grid cursor-pointer grid-cols-2 gap-x-4 gap-y-2 border-b border-border px-5 py-4 last:border-b-0 transition-colors duration-(--transition-fast) hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[1.6fr_1fr_0.8fr_1fr_0.9fr] md:items-center',
                  b.status_c === 'Cancelled' && 'text-muted-foreground',
                )}
              >
                <div className="col-span-2 min-w-0 md:col-span-1">
                  <p className="truncate font-medium text-foreground">{b.deal_c?.Name ?? 'Deal'}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {b.Name}, {b.homes_c ?? 1} × {inr(b.unitPrice_c)}, {formatRelativeTime(b.CreatedOn)}
                  </p>
                  {service && <p className="text-[13px] text-muted-foreground">{service}</p>}
                  {!isAdmin && b.status_c === 'Booked' && d && <RowProgress deal={d} />}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {isAdmin ? b.Owner?.Name ?? '—' : b.community_c?.Name ?? b.locality_c?.Name ?? '—'}
                </p>
                <p className="text-right text-sm font-semibold tabular-nums text-foreground">{inr(b.amountPaid_c)}</p>
                <div className="text-sm md:text-right">
                  {b.refundStatus_c === 'Due' ? (
                    <span className="tabular-nums"><span className="font-medium text-foreground">{inr(b.refundDue_c)}</span> <span className="text-[oklch(0.5_0.13_50)]">to send</span></span>
                  ) : b.refundStatus_c === 'Paid' ? (
                    <span className="tabular-nums text-muted-foreground">{inr(b.refundDue_c)} {isAdmin ? 'sent' : 'returned'}</span>
                  ) : soFar > 0 ? (
                    <span className="tabular-nums text-muted-foreground">{inr(soFar)} so far</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="text-right">
                  <StatusBadge value={b.status_c} label={isAdmin ? undefined : statusLabel(b)} />
                </div>
              </Link>
            );
          })}
        </div>
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
      <button type="button" className="sr-only" onClick={() => { run(); refetchMoney(); }}>
        Refresh bookings
      </button>
    </div>
  );
}
