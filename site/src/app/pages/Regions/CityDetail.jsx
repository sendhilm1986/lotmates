import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
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
import { REGION_STYLES } from '@/services/dealRules';
import CityDialog from './CityDialog';

export const route = { path: '/admin/cities/:id', layout: 'owner', access: "profile === 'Admin_c'" };

const { eq } = window.ApperSDK.CoreSDK;

export default function CityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: city, loading, error, run } = useFetch(() => {
    return sdk.table('cities_c').select(['Name', 'state_c', 'status_c', 'CreatedOn']).get(id).then((r) => r.data);
  }, [id]);
  const { data: localities } = useFetch(() => {
    return sdk.table('localities_c').select(['Name', 'pincode_c', 'status_c', 'city_c']).where(eq('city_c', id)).orderBy('Name').fetch().then((r) => {
      if (!r.success) throw new Error(r.message);
      return r.data;
    });
  }, [id]);

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link to="/admin/cities"><ApperIcon name="ArrowLeft" size={16} />Back to Cities</Link>
    </Button>
  );
  if (loading && city === undefined) return <div className="space-y-4">{back}<DetailSkeleton /></div>;
  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load city: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!city) return <div className="space-y-4">{back}<div className="rounded-[22px] bg-card shadow-sm p-10 text-center text-muted-foreground">City not found.</div></div>;

  const locs = localities ?? [];

  async function remove() {
    setDeleting(true);
    try {
      const res = await sdk.table('cities_c').remove(city.Id);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (res.success === false && !res.data?.length) return;
      toast.success(`Deleted ${city.Name}`);
      setDeleteOpen(false);
      navigate('/admin/cities');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">{city.Name}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{city.state_c ?? '—'}</span>
            <StatusBadge value={city.status_c} styles={REGION_STYLES} />
            <span>· Added {city.CreatedOn ? formatLocalDate(city.CreatedOn, DATE_FORMATS.SHORT) : '—'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}><ApperIcon name="Pencil" size={16} />Edit</Button>
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)}><ApperIcon name="Trash2" size={16} />Delete</Button>
        </div>
      </div>
      <section className="rounded-[22px] bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-heading text-lg font-bold text-foreground">Localities in {city.Name}</h2>
          <Button size="sm" variant="outline" asChild><Link to="/admin/localities">Manage localities</Link></Button>
        </div>
        {locs.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No localities yet. Add the first one from Localities.</p>
        ) : (
          <ul>
            {locs.map((l) => (
              <li key={l.Id}>
                <Link to={`/admin/localities/${l.Id}`} className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-accent">
                  <span className="font-medium text-foreground">{l.Name}</span>
                  <span className="flex items-center gap-3 text-sm text-muted-foreground">{l.pincode_c}<StatusBadge value={l.status_c} styles={REGION_STYLES} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <CityDialog open={editOpen} onOpenChange={setEditOpen} record={city} onSaved={run} />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {city.Name}?</AlertDialogTitle>
            <AlertDialogDescription>{locs.length ? `${locs.length} localities point to this city. Set it to Coming soon instead to keep them.` : 'This removes the city for good.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep city</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting} onClick={(e) => { e.preventDefault(); remove(); }}>
              {deleting ? 'Deleting…' : 'Delete city'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
