import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { ListSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { inr } from '@/services/dealRules';
import { PAYOUT_FIELDS, PAYOUT_STYLES, unwrapList } from '@/services/records';
import PayoutDialog from './PayoutDialog';

export const route = { path: '/payouts', layout: 'owner', access: "['Admin_c','Vendor_c'].includes(profile)" };
export const nav = { icon: 'Banknote', label: 'Payouts', order: 60, profiles: ['Admin_c', 'Vendor_c'] };

const { eq } = window.ApperSDK.CoreSDK;

export default function PayoutsList() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const isAdmin = profile === 'Admin_c';
  const [status, setStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, loading, error, run } = useFetch(() => {
    let q = sdk.table('payouts_c').select(PAYOUT_FIELDS);
    if (status !== 'all') q = q.where(eq('status_c', status));
    return q.orderByDesc('CreatedOn').page(1, 50).fetch().then(unwrapList);
  }, [status]);

  const { data: totals, run: refetchTotals } = useFetch(async () => {
    const res = await sdk
      .table('payouts_c')
      .select([{ field: 'Id' }])
      .aggregate([
        { id: 'paid', fields: [{ field: 'net_c', fn: 'Sum', alias: 'count' }], where: eq('status_c', 'Paid') },
        { id: 'pending', fields: [{ field: 'net_c', fn: 'Sum', alias: 'count' }], where: eq('status_c', 'Pending') },
      ])
      .limit(1)
      .fetch();
    if (!res.success) throw new Error(res.message);
    const pick = (id) => {
      const b = res.aggregators?.find((a) => a.id === id);
      return b?.data?.count ?? b?.count ?? b?.value ?? 0;
    };
    return { paid: pick('paid'), pending: pick('pending') };
  }, []);

  const rows = data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={isAdmin ? 'Payouts' : 'Money'}
        description={isAdmin ? 'Money sent to vendors after commission.' : 'What Lotmates has paid you, and what is on its way.'}
        actions={
          isAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>
              <ApperIcon name="Plus" size={16} />
              New payout
            </Button>
          ) : null
        }
      />

      <dl className="grid grid-cols-2 overflow-hidden rounded-[22px] bg-card shadow-sm">
        <div className="px-5 py-4">
          <dt className="text-sm text-muted-foreground">Paid</dt>
          <dd className="mt-1 font-heading text-2xl font-bold tabular-nums text-foreground">{inr(totals?.paid ?? 0)}</dd>
        </div>
        <div className="border-l border-border px-5 py-4">
          <dt className="text-sm text-muted-foreground">On its way</dt>
          <dd className="mt-1 font-heading text-2xl font-bold tabular-nums text-foreground">{inr(totals?.pending ?? 0)}</dd>
        </div>
      </dl>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="Pending">Pending</TabsTrigger>
          <TabsTrigger value="Paid">Paid</TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load payouts: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && data === undefined ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <div className="rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="font-medium text-foreground">No payouts here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? 'Create one from a closed deal, or with New payout.' : 'Payouts appear once a deal you deliver closes.'}
          </p>
        </div>
      ) : (
        <ul aria-busy={loading} className={cn('divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm transition-opacity', loading && 'opacity-60')}>
          {rows.map((p) => (
            <li key={p.Id}>
              <div
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/payouts/${p.Id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/payouts/${p.Id}`);
                }}
                className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-(--transition-fast) hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{isAdmin ? p.vendor_c?.Name : p.deal_c?.Name ?? p.Name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {p.Name}
                    {isAdmin && p.deal_c?.Name ? `, ${p.deal_c.Name}` : ''}
                    {p.paidOn_c ? `, paid ${formatLocalDate(p.paidOn_c, DATE_FORMATS.SHORT)}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold tabular-nums text-foreground">{inr(p.net_c)}</span>
                  <StatusBadge value={p.status_c} styles={PAYOUT_STYLES} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <PayoutDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          record={null}
          onSaved={() => {
            run();
            refetchTotals();
          }}
        />
      )}
    </div>
  );
}
