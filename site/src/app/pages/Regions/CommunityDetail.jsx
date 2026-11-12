import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import StatusBadge from '@/components/StatusBadge';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { REGION_STYLES, DEAL_STYLES, DEAL_FIELDS, dealState, inr } from '@/services/dealRules';
import CommunityDialog from './CommunityDialog';

export const route = { path: '/admin/communities/:id', layout: 'owner', access: "profile === 'Admin_c'" };

const { eq, or, isNull, and } = window.ApperSDK.CoreSDK;

export default function CommunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: com, loading, error, run } = useFetch(() => {
    return sdk.table('communities_c').select(['Name', 'locality_c', 'type_c', 'homes_c', 'ambassadorName_c', 'status_c']).get(id).then((r) => r.data);
  }, [id]);

  const localityId = com?.locality_c?.Id;
  const { data: deals } = useFetch(() => {
    if (!localityId) return Promise.resolve([]);
    return sdk
      .table('deals_c')
      .select(DEAL_FIELDS)
      .where(and(eq('locality_c', localityId), or(eq('community_c', id), isNull('community_c'))))
      .orderByDesc('CreatedOn')
      .page(1, 20)
      .fetch()
      .then((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      });
  }, [localityId, id]);

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link to="/admin/communities"><ApperIcon name="ArrowLeft" size={16} />Back to Communities</Link>
    </Button>
  );
  if (loading && com === undefined) return <div className="space-y-4">{back}<DetailSkeleton /></div>;
  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load community: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!com) return <div className="space-y-4">{back}<div className="rounded-[22px] bg-card shadow-sm p-10 text-center text-muted-foreground">Community not found.</div></div>;

  const dls = deals ?? [];
  const liveDeals = dls.filter((d) => d.status_c === 'Live');

  async function remove() {
    setDeleting(true);
    try {
      const res = await sdk.table('communities_c').remove(com.Id);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (res.success === false && !res.data?.length) return;
      toast.success(`Deleted ${com.Name}`);
      setDeleteOpen(false);
      navigate('/admin/communities');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">{com.Name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{com.type_c}</span>
            <span>·</span>
            {com.locality_c?.Id ? <Link to={`/admin/localities/${com.locality_c.Id}`} className="text-primary hover:underline">{com.locality_c.Name}</Link> : '—'}
            <StatusBadge value={com.status_c} styles={REGION_STYLES} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}><ApperIcon name="Pencil" size={16} />Edit</Button>
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)}><ApperIcon name="Trash2" size={16} />Delete</Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[22px] bg-card shadow-sm p-4 shadow-sm"><p className="font-heading text-2xl font-extrabold">{com.homes_c ?? '—'}</p><p className="text-xs text-muted-foreground">Homes</p></div>
        <div className="rounded-[22px] bg-card shadow-sm p-4 shadow-sm"><p className="font-heading text-2xl font-extrabold">{liveDeals.length}</p><p className="text-xs text-muted-foreground">Live deals open to them</p></div>
        <div className="rounded-[22px] bg-card shadow-sm p-4 shadow-sm"><p className="truncate font-heading text-lg font-extrabold">{com.ambassadorName_c ?? 'None yet'}</p><p className="text-xs text-muted-foreground">Ambassador</p></div>
      </div>
      <section className="rounded-[22px] bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4"><h2 className="font-heading text-lg font-bold text-foreground">Deals open to this community</h2></div>
        {dls.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No deals yet.</p> : (
          <ul>
            {dls.map((d) => {
              const st = dealState(d);
              return (
                <li key={d.Id}>
                  <Link to={`/admin/deals/${d.Id}`} className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-accent">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{d.Name}</p>
                      <p className="text-xs text-muted-foreground">{d.community_c?.Id ? 'Only this community' : `All of ${d.locality_c?.Name}`} · {inr(st.current?.price)}</p>
                    </div>
                    <StatusBadge value={d.status_c} styles={DEAL_STYLES} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <CommunityDialog open={editOpen} onOpenChange={setEditOpen} record={com} onSaved={run} />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {com.Name}?</AlertDialogTitle>
            <AlertDialogDescription>Bookings that name this community keep their history, but it won't appear in filters any more.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep community</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting} onClick={(e) => { e.preventDefault(); remove(); }}>
              {deleting ? 'Deleting…' : 'Delete community'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
