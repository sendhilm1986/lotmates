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
import { categoryIcon, categoryLabel } from '@/services/dealRules';
import { PROPOSAL_FIELDS, PROPOSAL_STATUS, PROPOSAL_STYLES, unwrapList, proposalCategory, proposalPlace } from '@/services/records';
import ProposalDialog from './ProposalDialog';

export const route = { path: '/proposals', layout: 'owner', access: "['Admin_c','Ambassador_c'].includes(profile)" };
export const nav = { icon: 'Lightbulb', label: 'Proposals', order: 40, profiles: ['Admin_c', 'Ambassador_c'] };

const { eq } = window.ApperSDK.CoreSDK;

export default function ProposalsList() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const isAmbassador = profile === 'Ambassador_c';
  const [status, setStatus] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, loading, error, run } = useFetch(() => {
    let q = sdk.table('proposals_c').select(PROPOSAL_FIELDS);
    if (status !== 'all') q = q.where(eq('status_c', status));
    return q.orderByDesc('CreatedOn').page(1, 50).fetch().then(unwrapList);
  }, [status]);

  const rows = data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Proposals"
        description={isAmbassador ? 'Deals your communities are asking for. The team replies on each one.' : 'Ideas from ambassadors. Accepted ones become next round’s deals.'}
        actions={
          isAmbassador ? (
            <Button onClick={() => setCreateOpen(true)}>
              <ApperIcon name="Plus" size={16} />
              Propose a deal
            </Button>
          ) : null
        }
      >
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {PROPOSAL_STATUS.map((s) => (
              <TabsTrigger key={s} value={s}>{s}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </PageHeader>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load proposals: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && data === undefined ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <div className="rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="font-medium text-foreground">No proposals here</p>
          {isAmbassador && (
            <Button className="mt-3" onClick={() => setCreateOpen(true)}>Propose a deal</Button>
          )}
        </div>
      ) : (
        <ul aria-busy={loading} className={cn('divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm transition-opacity', loading && 'opacity-60')}>
          {rows.map((p) => (
            <li key={p.Id}>
              <div
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/proposals/${p.Id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/proposals/${p.Id}`);
                }}
                className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-(--transition-fast) hover:bg-accent"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ApperIcon name={categoryIcon(p.category_c)} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{p.Name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {proposalCategory(p, categoryLabel)}, {proposalPlace(p)}, {p.homesInterested_c ?? '?'} homes
                    {!isAmbassador && p.Owner?.Name ? `, from ${p.Owner.Name}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge value={p.status_c} styles={PROPOSAL_STYLES} />
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(p.CreatedOn)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isAmbassador && <ProposalDialog open={createOpen} onOpenChange={setCreateOpen} record={null} onSaved={run} />}
    </div>
  );
}
