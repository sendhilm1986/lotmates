import { Link, useParams } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatLocalDate, formatRelativeTime, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { inr } from '@/services/dealRules';
import { unwrapList } from '@/services/records';
import { initials } from './NeighboursList';

export const route = { path: '/admin/neighbours/:id', layout: 'owner', access: "profile === 'Admin_c'" };

const { eq } = window.ApperSDK.CoreSDK;
const ROLE = { Customer_c: 'Neighbour', Ambassador_c: 'Ambassador', Vendor_c: 'Vendor', Admin_c: 'Lotmates team' };

export default function NeighbourDetail() {
  const { id } = useParams();
  const back = { to: '/admin/neighbours', label: 'Back to Neighbours' };

  const { data: n, loading, error, run } = useFetch(async () => {
    const r = await sdk.neighbours.get(id);
    if (!r.ok) throw new Error(r.error.message);
    return r.value.data;
  }, [id]);

  const { data: bookings, loading: bLoading } = useFetch(
    () =>
      sdk
        .table('bookings_c')
        .select(['Name', 'deal_c', 'homes_c', 'amountPaid_c', 'status_c', 'paymentStatus_c', 'refundStatus_c', 'CreatedOn'])
        .where(eq('Owner', id))
        .orderByDesc('CreatedOn')
        .page(1, 50)
        .fetch()
        .then(unwrapList),
    [id],
  );

  if (loading && !n) {
    return (
      <div className="space-y-4">
        <PageHeader title="Neighbour" back={back} />
        <DetailSkeleton />
      </div>
    );
  }
  if (error || !n) {
    return (
      <div className="space-y-4">
        <PageHeader title="Neighbour not found" back={back} description={error ? String(error.message ?? error) : 'They may have deleted their account.'} />
        {error && <Button variant="outline" onClick={run}>Try again</Button>}
      </div>
    );
  }

  const paidRows = (bookings ?? []).filter((b) => b.paymentStatus_c !== 'Pending');

  return (
    <div className="space-y-6">
      <PageHeader title={n.name} back={back}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <span className="rounded-md bg-muted px-2 py-0.5 text-[13px] font-medium text-foreground">{ROLE[n.profile] ?? 'Member'}</span>
          <span>Joined {formatLocalDate(n.joined, DATE_FORMATS.SHORT)} ({formatRelativeTime(n.joined)})</span>
        </div>
      </PageHeader>

      {n.deletionRequested && (
        <p className="flex items-start gap-2.5 rounded-2xl border border-destructive/25 bg-destructive/[0.06] px-4 py-3 text-sm text-foreground">
          <ApperIcon name="TriangleAlert" size={16} className="mt-0.5 flex-none text-destructive" />
          They asked for their account to be deleted on {formatLocalDate(n.deletionRequested, DATE_FORMATS.SHORT)}. Settle any open bookings or refunds, then remove the account from WordPress Users.
        </p>
      )}

      <section className="rounded-[22px] bg-card p-5 shadow-sm sm:p-6">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon="Home" label="Community">
            {n.community?.Name ?? <span className="text-muted-foreground">Not set</span>}
            {n.community?.locality && <span className="mt-0.5 block font-sans text-sm font-normal text-muted-foreground">{n.community.locality}</span>}
          </Fact>
          <Fact icon="Ticket" label="Paid bookings">
            <span className="font-heading text-3xl font-bold tabular-nums">{n.bookings}</span>
          </Fact>
          <Fact icon="Wallet" label="Paid in total">
            <span className="tabular-nums">{inr(n.paid)}</span>
          </Fact>
          <Fact icon="CalendarDays" label="Last booking">
            {n.lastBooking ? formatLocalDate(n.lastBooking, DATE_FORMATS.SHORT) : <span className="text-muted-foreground">None yet</span>}
            {n.lastBooking && <span className="mt-0.5 block font-sans text-sm font-normal text-muted-foreground">{formatRelativeTime(n.lastBooking)}</span>}
          </Fact>
        </dl>

        <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ApperIcon name="Contact" size={15} className="flex-none text-primary" />
              Contact
            </p>
            <p className="mt-1 truncate font-heading text-lg font-bold text-foreground">{n.phone || n.email}</p>
            {n.phone && <p className="mt-0.5 truncate text-sm text-muted-foreground">{n.email}</p>}
            {n.address && <p className="mt-0.5 truncate text-sm text-muted-foreground">{n.address}</p>}
          </div>
          <div className="flex flex-none gap-2">
            {n.phone && (
              <Button asChild>
                <a href={`tel:${n.phone.replace(/[\s-]/g, '')}`}>
                  <ApperIcon name="Phone" size={16} />
                  Call
                </a>
              </Button>
            )}
            <Button asChild variant={n.phone ? 'outline' : 'default'}>
              <a href={`mailto:${n.email}`}>
                <ApperIcon name="Mail" size={16} />
                Email
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[22px] bg-card shadow-sm">
        <div className="flex items-baseline justify-between gap-3 px-5 pt-5 sm:px-6">
          <h2 className="font-heading text-lg font-bold text-foreground">Bookings</h2>
          <span className="text-sm text-muted-foreground">{paidRows.length}</span>
        </div>
        {bLoading && !bookings ? (
          <p className="px-5 py-6 text-sm text-muted-foreground sm:px-6">Loading…</p>
        ) : paidRows.length === 0 ? (
          <p className="px-5 pb-6 pt-3 text-sm text-muted-foreground sm:px-6">No paid bookings yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-t border-border">
            {paidRows.map((b) => (
              <li key={b.Id}>
                <Link to={`/bookings/${b.Id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{b.deal_c?.Name ?? 'Deal'}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {b.Name}, {b.homes_c || 1} {Number(b.homes_c) > 1 ? 'homes' : 'home'}, {formatLocalDate(b.CreatedOn, DATE_FORMATS.SHORT)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-heading font-bold tabular-nums text-foreground">{inr(b.amountPaid_c)}</span>
                    <StatusBadge value={b.status_c} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Fact({ icon, label, children }) {
  return (
    <div className="rounded-2xl bg-muted/50 p-4">
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <ApperIcon name={icon} size={15} className="flex-none" />
        {label}
      </dt>
      <dd className="mt-1.5 font-heading text-lg font-bold leading-snug text-foreground">{children}</dd>
    </div>
  );
}
