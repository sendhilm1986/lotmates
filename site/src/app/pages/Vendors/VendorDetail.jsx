import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import StatusBadge from '@/components/StatusBadge';
import VendorReviews from '@/components/VendorReviews';
import { DetailSkeleton, ListSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { VENDOR_STATUS, VENDOR_STYLES, VENDOR_CHECKS, DEAL_FIELDS, DEAL_STYLES, categoryLabel, categoryIcon, dealState, inr } from '@/services/dealRules';
import { VENDOR_FIELDS } from './VendorsList';

export const route = { path: '/admin/vendors/:id', layout: 'owner', access: "profile === 'Admin_c'" };

const { eq } = window.ApperSDK.CoreSDK;
const toArray = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',') : []);

export default function VendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState('');

  const { data: vendor, loading, error, run } = useFetch(() => {
    return sdk.table('vendors_c').select(VENDOR_FIELDS).get(id).then((r) => r.data);
  }, [id]);

  const { data: deals, loading: dLoading } = useFetch(() => {
    return sdk
      .table('deals_c')
      .select(DEAL_FIELDS)
      .where(eq('vendor_c', id))
      .orderByDesc('CreatedOn')
      .page(1, 20)
      .fetch()
      .then((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      });
  }, [id]);

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2">
      <Link to="/admin/vendors">
        <ApperIcon name="ArrowLeft" size={16} />
        Back to Vendors
      </Link>
    </Button>
  );

  if (loading && vendor === undefined) return <div className="space-y-4">{back}<DetailSkeleton /></div>;
  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-10 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load vendor: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!vendor) return <div className="space-y-4">{back}<div className="rounded-[22px] bg-card shadow-sm p-10 text-center text-muted-foreground">Vendor not found.</div></div>;

  const checks = toArray(vendor.checks_c);
  const dealRows = deals ?? [];

  async function changeStatus(next) {
    const prev = vendor.status_c;
    setBusy('status');
    try {
      const res = await sdk.table('vendors_c').update({ Id: vendor.Id, status_c: next });
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length) {
        toast.error(`Status stayed ${prev}`);
        return;
      }
      toast.success(`Status set to ${next}`);
      run();
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    setBusy('delete');
    try {
      const res = await sdk.table('vendors_c').remove(vendor.Id);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (res.success === false && !res.data?.length) return;
      toast.success(`Deleted ${vendor.Name}`);
      setDeleteOpen(false);
      navigate('/admin/vendors');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-6">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
            <ApperIcon name={categoryIcon(vendor.category_c)} size={24} />
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">{vendor.Name}</h1>
            <p className="text-sm text-muted-foreground">{categoryLabel(vendor.category_c)}, {vendor.locality_c?.Name ?? 'no locality set'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={vendor.status_c} onValueChange={changeStatus} disabled={busy === 'status'}>
            <SelectTrigger className="w-40" aria-label="Vendor status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {VENDOR_STATUS.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" asChild>
            <Link to={`/admin/vendors/${vendor.Id}/edit`}>
              <ApperIcon name="Pencil" size={16} />
              Edit
            </Link>
          </Button>
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)}>
            <ApperIcon name="Trash2" size={16} />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[22px] bg-card shadow-sm p-4 text-center shadow-sm">
              <p className="font-heading text-2xl font-extrabold">{vendor.rating_c ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Rating</p>
            </div>
            <div className="rounded-[22px] bg-card shadow-sm p-4 text-center shadow-sm">
              <p className="font-heading text-2xl font-extrabold">{vendor.jobsDone_c ?? 0}</p>
              <p className="text-xs text-muted-foreground">Jobs done</p>
            </div>
            <div className="rounded-[22px] bg-card shadow-sm p-4 text-center shadow-sm">
              <StatusBadge value={vendor.status_c} styles={VENDOR_STYLES} />
              <p className="mt-2 text-xs text-muted-foreground">Standing</p>
            </div>
          </div>
          <div className="rounded-[22px] bg-card shadow-sm p-5 shadow-sm">
            <h2 className="font-heading text-base font-bold text-foreground">Checks</h2>
            <ul className="mt-3 space-y-2">
              {VENDOR_CHECKS.map((c) => (
                <li key={c} className="flex items-center gap-2 text-sm">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full', checks.includes(c) ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                    <ApperIcon name={checks.includes(c) ? 'Check' : 'Minus'} size={14} />
                  </span>
                  <span className={checks.includes(c) ? 'text-foreground' : 'text-muted-foreground'}>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[22px] bg-card shadow-sm p-5 shadow-sm">
            <h2 className="font-heading text-base font-bold text-foreground">Contact</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Person</dt><dd className="font-medium">{vendor.contactName_c ?? '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Phone</dt><dd className="font-medium">{vendor.phone_c ? <a href={`tel:${vendor.phone_c.replace(/\s/g, '')}`} className="text-primary hover:underline">{vendor.phone_c}</a> : '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Email</dt><dd className="truncate font-medium">{vendor.email_c ? <a href={`mailto:${vendor.email_c}`} className="text-primary hover:underline">{vendor.email_c}</a> : '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">On Lotmates since</dt><dd className="font-medium">{vendor.CreatedOn ? formatLocalDate(vendor.CreatedOn, DATE_FORMATS.SHORT) : '—'}</dd></div>
            </dl>
            {vendor.notes_c && <p className="mt-4 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{vendor.notes_c}</p>}
          </div>
        </div>

        <div className="min-w-0 space-y-6">
        <div className="rounded-[22px] bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-heading text-lg font-bold text-foreground">Deals by this vendor</h2>
            <Button size="sm" variant="outline" asChild>
              <Link to="/admin/deals/new">New deal</Link>
            </Button>
          </div>
          {dLoading && deals === undefined ? (
            <div className="p-5"><ListSkeleton rows={3} /></div>
          ) : dealRows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No deals yet for this vendor.</p>
          ) : (
            <ul>
              {dealRows.map((d) => {
                const st = dealState(d);
                return (
                  <li key={d.Id}>
                    <Link to={`/admin/deals/${d.Id}`} className="flex items-center gap-3 border-b border-border px-5 py-3 last:border-b-0 transition-colors duration-(--transition-fast) hover:bg-accent">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{d.Name}</p>
                        <p className="text-xs text-muted-foreground">{st.booked}/{st.cap} booked, {inr(st.current?.price)}</p>
                      </div>
                      <StatusBadge value={d.status_c} styles={DEAL_STYLES} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <VendorReviews vendorId={vendor.Id} moderate />
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {vendor.Name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {dealRows.length ? `This vendor has ${dealRows.length} deals. Consider setting them to Removed instead, so history stays intact.` : 'This removes the vendor for good.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'delete'}>Keep vendor</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
              disabled={busy === 'delete'}
            >
              {busy === 'delete' ? 'Deleting…' : 'Delete vendor'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
