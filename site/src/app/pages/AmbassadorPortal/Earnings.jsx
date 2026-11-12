import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import PageHeader from '@/components/PageHeader';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { inr } from '@/services/dealRules';
import { JOB_FIELDS, AMBASSADOR_SHARE, unwrapList } from '@/services/records';

export const route = { path: '/ambassador/earnings', layout: 'owner', access: "profile === 'Ambassador_c'" };
export const nav = { icon: 'Wallet', label: 'Earnings', order: 41, profiles: ['Ambassador_c'] };

const { isIn } = window.ApperSDK.CoreSDK;

export default function Earnings() {
  const { data, loading, error, run } = useFetch(async () => {
    const b = await sdk
      .table('bookings_c')
      .select(JOB_FIELDS)
      .where(isIn('status_c', ['Confirmed', 'Done']))
      .orderByDesc('CreatedOn')
      .page(1, 200)
      .fetch();
    const bookings = unwrapList(b);
    const dealIds = [...new Set(bookings.map((x) => x.deal_c?.Id).filter(Boolean))];
    let deals = [];
    if (dealIds.length) {
      const d = await sdk.table('deals_c').select(['Name', 'commission_c']).where(isIn('Id', dealIds)).fetch();
      deals = unwrapList(d);
    }
    const rate = (id) => Number(deals.find((x) => String(x.Id) === String(id))?.commission_c || 0) / 100;
    const rows = bookings.map((x) => {
      const value = Number(x.finalPrice_c ?? x.unitPrice_c ?? 0) * Number(x.homes_c || 1);
      const share = value * rate(x.deal_c?.Id) * AMBASSADOR_SHARE;
      return { ...x, value, share };
    });
    return rows;
  }, []);

  const rows = data ?? [];
  const earned = rows.filter((r) => r.status_c === 'Done').reduce((s, r) => s + r.share, 0);
  const coming = rows.filter((r) => r.status_c === 'Confirmed').reduce((s, r) => s + r.share, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Earnings"
        description={`You get ${Math.round(AMBASSADOR_SHARE * 100)}% of Lotmates' commission on every job in your communities. Demo rate.`}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[22px] bg-card shadow-sm p-5">
          <p className="text-sm text-muted-foreground">Earned</p>
          <p className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-foreground">{inr(earned)}</p>
          <p className="text-xs text-muted-foreground">from finished jobs</p>
        </div>
        <div className="rounded-[22px] bg-card shadow-sm p-5">
          <p className="text-sm text-muted-foreground">Coming</p>
          <p className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-foreground">{inr(coming)}</p>
          <p className="text-xs text-muted-foreground">once confirmed jobs are done</p>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load earnings: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && data === undefined ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <p className="rounded-[22px] bg-card shadow-sm p-8 text-center text-sm text-muted-foreground">
          Nothing yet. Earnings start when a deal in your community closes.{' '}
          <Link to="/ambassador" className="text-primary hover:underline">Share a live deal</Link>
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm">
          {rows.map((r) => (
            <li key={r.Id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {r.deal_c?.Id ? <Link to={`/deals/${r.deal_c.Id}`} className="hover:text-primary">{r.deal_c.Name}</Link> : 'Deal'}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {r.community_c?.Name}, {r.Name}
                  {r.doneOn_c ? `, done ${formatLocalDate(r.doneOn_c, DATE_FORMATS.SHORT)}` : ', not done yet'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums text-foreground">{inr(r.share)}</p>
                <p className="text-xs text-muted-foreground">on {inr(r.value)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
