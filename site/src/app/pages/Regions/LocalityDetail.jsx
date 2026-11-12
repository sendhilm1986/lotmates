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
import { REGION_STYLES, DEAL_STYLES, DEAL_FIELDS, dealState } from '@/services/dealRules';
import LocalityDialog from './LocalityDialog';

export const route = { path: '/admin/localities/:id', layout: 'owner', access: "profile === 'Admin_c'" };

const { eq } = window.ApperSDK.CoreSDK;

export default function LocalityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: loc, loading, error, run } = useFetch(() => {
    return sdk.table('localities_c').select(['Name', 'city_c', 'pincode_c', 'status_c']).get(id).then((r) => r.data);
  }, [id]);
  const { data: communities } = useFetch(() => {
    return sdk.table('communities_c').select(['Name', 'type_c', 'homes_c', 'status_c', 'locality_c']).where(eq('locality_c', id)).orderBy('Name').fetch().then((r) => {
      if (!r.success) throw new Error(r.message);
      return r.data;
    });
  }, [id]);
  const { data: deals } = useFetch(() => {
    return sdk.table('deals_c').select(DEAL_FIELDS).where(eq('locality_c', id)).orderByDesc('CreatedOn').page(1, 20).fetch().then((r) => {
      if (!r.success) throw new Error(r.message);
      return r.data;
    });
  }, [id]);

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link to="/admin/localities"><ApperIcon name="ArrowLeft" size={16} />Back to Localities</Link>
    </Button>
  );
  if (loading && loc === undefined) return <div className="space-y-4">{back}<DetailSkeleton /></div>;
  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load locality: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!loc) return <div className="space-y-4">{back}<div className="rounded-[22px] bg-card shadow-sm p-10 text-center text-muted-foreground">Locality not found.</div></div>;

  const coms = communities ?? [];
  const dls = deals ?? [];
  const homes = coms.reduce((s, c) => s + Number(c.homes_c || 0), 0);

  async function remove() {
    setDeleting(true);
    try {
      const res = await sdk.table('localities_c').remove(loc.Id);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (res.success === false && !res.data?.length) return;
      toast.success(`Deleted ${loc.Name}`);
      setDeleteOpen(false);
      navigate('/admin/localities');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">{loc.Name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {loc.city_c?.Id ? <Link to={`/admin/cities/${loc.city_c.Id}`} className="text-primary hover:underline">{loc.city_c.Name}</Link> : '—'}
            <span>· {loc.pincode_c ?? 'no pincode'}</span>
            <StatusBadge value={loc.status_c} styles={REGION_STYLES} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}><ApperIcon name="Pencil" size={16} />Edit</Button>
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)}><ApperIcon name="Trash2" size={16} />Delete</Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-[22px] bg-card shadow-sm p-4 shadow-sm"><p className="font-heading text-2xl font-extrabold">{coms.length}</p><p className="text-xs text-muted-foreground">Communities</p></div>
        <div className="rounded-[22px] bg-card shadow-sm p-4 shadow-sm"><p className="font-heading text-2xl font-extrabold">{homes}</p><p className="text-xs text-muted-foreground">Homes reachable</p></div>
        <div className="rounded-[22px] bg-card shadow-sm p-4 shadow-sm"><p className="font-heading text-2xl font-extrabold">{dls.filter((d) => d.status_c === 'Live').length}</p><p className="text-xs text-muted-foreground">Live deals</p></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[22px] bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-heading text-lg font-bold text-foreground">Communities</h2>
            <Button size="sm" variant="outline" asChild><Link to="/admin/communities">Manage</Link></Button>
          </div>
          {coms.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No communities yet.</p> : (
            <ul>
              {coms.map((c) => (
                <li key={c.Id}>
                  <Link to={`/admin/communities/${c.Id}`} className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-accent">
                    <span className="min-w-0 truncate font-medium text-foreground">{c.Name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">{c.type_c} · {c.homes_c} homes<StatusBadge value={c.status_c} styles={REGION_STYLES} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-[22px] bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4"><h2 className="font-heading text-lg font-bold text-foreground">Deals here</h2></div>
          {dls.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No deals yet.</p> : (
            <ul>
              {dls.map((d) => {
                const st = dealState(d);
                return (
                  <li key={d.Id}>
                    <Link to={`/admin/deals/${d.Id}`} className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-accent">
                      <span className="min-w-0 truncate font-medium text-foreground">{d.Name}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">{st.booked}/{st.cap}<StatusBadge value={d.status_c} styles={DEAL_STYLES} /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <LocalityDialog open={editOpen} onOpenChange={setEditOpen} record={loc} onSaved={run} />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {loc.Name}?</AlertDialogTitle>
            <AlertDialogDescription>{coms.length || dls.length ? `${coms.length} communities and ${dls.length} deals use this locality. Set it to Coming soon instead to keep them.` : 'This removes the locality for good.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep locality</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting} onClick={(e) => { e.preventDefault(); remove(); }}>
              {deleting ? 'Deleting…' : 'Delete locality'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
