import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatRelativeTime } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { ListSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { APP_FIELDS, APP_STATUS, APP_STYLES, unwrapList } from '@/services/records';

export const route = { path: '/admin/ambassador-applications', layout: 'owner', access: "profile === 'Admin_c'" };
export const nav = {
  icon: 'Megaphone',
  label: 'New ambassadors',
  order: 53,
  profiles: ['Admin_c'],
  count: { table: 'ambassadorApps_c', where: { op: 'eq', f: 'status_c', v: 'New' } },
};

const { eq, isIn } = window.ApperSDK.CoreSDK;

export default function ApplicationsList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('open');

  const { data, loading, error, run } = useFetch(() => {
    let q = sdk.table('ambassadorApps_c').select(APP_FIELDS);
    if (status === 'open') q = q.where(isIn('status_c', ['New', 'Contacted']));
    else if (status !== 'all') q = q.where(eq('status_c', status));
    return q.orderByDesc('CreatedOn').page(1, 100).fetch().then(unwrapList);
  }, [status]);

  const rows = data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title="Ambassador applications" description="People who applied from the ambassadors page. Get in touch with each one before approving.">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="open">To review</TabsTrigger>
            {APP_STATUS.map((s) => (
              <TabsTrigger key={s} value={s}>{s}</TabsTrigger>
            ))}
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load applications: {String(error.message ?? error)}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && !data ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <div className="rounded-[22px] bg-card p-10 text-center shadow-sm">
          <p className="font-medium text-foreground">No applications here</p>
          <p className="mt-1 text-sm text-muted-foreground">New ones arrive from lotmates.in/ambassadors, and the team gets an email for each.</p>
        </div>
      ) : (
        <ul aria-busy={loading} className={cn('divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm transition-opacity', loading && 'opacity-60')}>
          {rows.map((a) => (
            <li key={a.Id}>
              <div
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/admin/ambassador-applications/${a.Id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/admin/ambassador-applications/${a.Id}`);
                }}
                className="flex min-h-[72px] cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-accent"
              >
                <span className="flex size-10 flex-none items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary">
                  {(a.Name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{a.Name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {a.communityName_c}, {a.localityName_c}
                    {a.homes_c ? `, ${a.homes_c} homes` : ''}
                  </p>
                </div>
                <div className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
                  <ApperIcon name={a.contactPref_c === 'Email' ? 'Mail' : 'Phone'} size={14} />
                  {a.contactPref_c === 'Email' ? 'Email' : 'Phone'}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge value={a.status_c} styles={APP_STYLES} />
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(a.CreatedOn)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
