import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { formatRelativeTime } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { ListSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { COMPLAINT_FIELDS, COMPLAINT_STATUS, COMPLAINT_STYLES, unwrapList } from '@/services/records';
import ComplaintDialog from './ComplaintDialog';

export const route = { path: '/complaints', layout: 'owner', access: "['Admin_c','Vendor_c','Customer_c'].includes(profile)" };
export const nav = { icon: 'MessageSquareWarning', label: 'Complaints', order: 71, profiles: ['Admin_c', 'Vendor_c'] };

const { eq } = window.ApperSDK.CoreSDK;

export default function ComplaintsList() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [status, setStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, loading, error, run } = useFetch(() => {
    let q = sdk.table('complaints_c').select(COMPLAINT_FIELDS);
    if (status !== 'all') q = q.where(eq('status_c', status));
    return q.orderByDesc('CreatedOn').page(1, 50).fetch().then(unwrapList);
  }, [status]);

  const rows = data ?? [];
  const description =
    profile === 'Vendor_c'
      ? 'Problems neighbours raised about your jobs. Reply so the team can close them.'
      : profile === 'Customer_c'
        ? 'Something went wrong with a booking? Tell us here.'
        : 'Open issues first. Each one links to its booking and vendor.';

  return (
    <div className="space-y-8">
      <PageHeader
        title="Complaints"
        description={description}
        actions={
          profile === 'Customer_c' ? (
            <Button onClick={() => setCreateOpen(true)}>
              <ApperIcon name="Plus" size={16} />
              Report a problem
            </Button>
          ) : null
        }
      >
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {COMPLAINT_STATUS.map((s) => (
              <TabsTrigger key={s} value={s}>{s}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </PageHeader>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load complaints: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && data === undefined ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <p className="rounded-[22px] bg-card shadow-sm p-8 text-center text-sm text-muted-foreground">
          {status === 'all' ? 'Nothing reported. Good.' : `No ${status.toLowerCase()} complaints.`}
        </p>
      ) : (
        <ul aria-busy={loading} className={cn('divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm transition-opacity', loading && 'opacity-60')}>
          {rows.map((c) => (
            <li key={c.Id}>
              <div
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/complaints/${c.Id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/complaints/${c.Id}`);
                }}
                className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-(--transition-fast) hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{c.Name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {profile === 'Customer_c' ? c.deal_c?.Name : `${c.Owner?.Name ?? 'Neighbour'}, ${c.deal_c?.Name ?? 'no deal'}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge value={c.status_c} styles={COMPLAINT_STYLES} />
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(c.CreatedOn)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {profile === 'Customer_c' && (
        <ComplaintDialog open={createOpen} onOpenChange={setCreateOpen} record={null} onSaved={run} />
      )}
    </div>
  );
}
