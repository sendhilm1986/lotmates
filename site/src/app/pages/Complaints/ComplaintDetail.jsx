import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { formatLocalDate, formatRelativeTime, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import ReviewPhotos from '@/components/ReviewPhotos';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { COMPLAINT_FIELDS, COMPLAINT_STATUS, COMPLAINT_STYLES, userIdOf, sameId } from '@/services/records';
import ComplaintDialog from './ComplaintDialog';

export const route = { path: '/complaints/:id', layout: 'owner', access: "['Admin_c','Vendor_c','Customer_c'].includes(profile)" };

export default function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const user = useSelector((s) => s.user.user);
  const isAdmin = profile === 'Admin_c';
  const isVendor = profile === 'Vendor_c';
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState('Open');
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState('');

  const { data: complaint, loading, error, run } = useFetch(() => {
    return sdk.table('complaints_c').select(COMPLAINT_FIELDS).get(id).then((r) => r.data);
  }, [id]);

  useEffect(() => {
    if (!complaint) return;
    setReply(complaint.response_c ?? '');
    setStatus(complaint.status_c ?? 'Open');
    setResolution(complaint.resolution_c ?? '');
  }, [complaint]);

  const back = { to: '/complaints', label: 'Back to Complaints' };

  if (loading && complaint === undefined) {
    return (
      <div className="space-y-4">
        <PageHeader title="Complaint" back={back} />
        <DetailSkeleton />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Complaint" back={back} />
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load this complaint: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!complaint) return <PageHeader title="Complaint not found" back={back} description="It may have been removed." />;

  const mine = sameId(complaint.Owner?.Id, userIdOf(user));
  const canEdit = mine && complaint.status_c === 'Open';

  async function save(payload, okMessage, key) {
    setBusy(key);
    try {
      const res = await sdk.table('complaints_c').update({ Id: complaint.Id, ...payload });
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length) return;
      toast.success(okMessage);
      run();
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    setBusy('delete');
    try {
      const res = await sdk.table('complaints_c').remove(complaint.Id);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (res.success === false && !res.data?.length) return;
      toast.success('Complaint deleted');
      setDeleteOpen(false);
      navigate('/complaints');
    } finally {
      setBusy('');
    }
  }

  const bookingLink = complaint.booking_c?.Id
    ? isVendor
      ? `/vendor/jobs/${complaint.booking_c.Id}`
      : `/bookings/${complaint.booking_c.Id}`
    : null;
  const vendorLink = complaint.vendor_c?.Id ? (isAdmin ? `/admin/vendors/${complaint.vendor_c.Id}` : `/partners/${complaint.vendor_c.Id}`) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={complaint.Name}
        back={back}
        description={`Raised by ${mine ? 'you' : complaint.Owner?.Name ?? 'a neighbour'} ${formatRelativeTime(complaint.CreatedOn)}`}
        actions={
          <>
            {canEdit && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <ApperIcon name="Pencil" size={16} />
                Edit
              </Button>
            )}
            {isAdmin && (
              <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <ApperIcon name="Trash2" size={16} />
                Delete
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <StatusBadge value={complaint.status_c} styles={COMPLAINT_STYLES} />
          {bookingLink && <Link to={bookingLink} className="font-medium text-primary hover:underline">Booking {complaint.booking_c.Name}</Link>}
          {complaint.deal_c?.Id && <Link to={`/deals/${complaint.deal_c.Id}`} className="font-medium text-primary hover:underline">{complaint.deal_c.Name}</Link>}
          {vendorLink && <Link to={vendorLink} className="font-medium text-primary hover:underline">{complaint.vendor_c.Name}</Link>}
        </div>
      </PageHeader>

      <ol className="max-w-2xl space-y-4">
        <li className="rounded-[22px] bg-card shadow-sm p-4">
          <p className="text-sm font-semibold text-foreground">{mine ? 'You wrote' : `${complaint.Owner?.Name ?? 'The neighbour'} wrote`}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-foreground">{complaint.details_c}</p>
          <ReviewPhotos review={complaint} className="mt-3" />
        </li>
        {complaint.response_c && !isVendor && (
          <li className="rounded-[22px] bg-card shadow-sm p-4">
            <p className="text-sm font-semibold text-foreground">{complaint.vendor_c?.Name ?? 'Vendor'} replied</p>
            <p className="mt-1 whitespace-pre-line text-sm text-foreground">{complaint.response_c}</p>
          </li>
        )}
        {complaint.resolution_c && (
          <li className="rounded-(--radius) border border-success-border bg-success-muted p-4">
            <p className="text-sm font-semibold text-foreground">Lotmates team</p>
            <p className="mt-1 whitespace-pre-line text-sm text-foreground">{complaint.resolution_c}</p>
            <p className="mt-2 text-xs text-muted-foreground">Updated {formatLocalDate(complaint.ModifiedOn ?? complaint.CreatedOn, DATE_FORMATS.SHORT)}</p>
          </li>
        )}
      </ol>

      {isVendor && complaint.status_c !== 'Resolved' && (
        <section className="max-w-2xl space-y-3 rounded-[22px] bg-card shadow-sm p-4">
          <Label htmlFor="cp-reply">Your reply</Label>
          <Textarea id="cp-reply" rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Say what happened and what you will do about it" />
          <Button onClick={() => save({ response_c: reply.trim() || null }, 'Reply sent', 'reply')} disabled={busy === 'reply' || !reply.trim()}>
            {busy === 'reply' ? 'Sending…' : 'Send reply'}
          </Button>
        </section>
      )}

      {isAdmin && (
        <section className="max-w-2xl space-y-3 rounded-[22px] bg-card shadow-sm p-4">
          <h2 className="font-heading text-base font-bold text-foreground">Team action</h2>
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPLAINT_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cp-res">Resolution the neighbour will see</Label>
            <Textarea id="cp-res" rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. Partial refund of 500 rupees sent, vendor warned" />
          </div>
          <Button
            onClick={() => save({ status_c: status, resolution_c: resolution.trim() || null }, 'Complaint updated', 'team')}
            disabled={busy === 'team'}
          >
            {busy === 'team' ? 'Saving…' : 'Save'}
          </Button>
        </section>
      )}

      {canEdit && <ComplaintDialog open={editOpen} onOpenChange={setEditOpen} record={complaint} onSaved={run} />}

      {isAdmin && (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this complaint?</AlertDialogTitle>
              <AlertDialogDescription>Use Resolved instead if it was handled. Deleting removes the history.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy === 'delete'}>Keep it</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  remove();
                }}
                disabled={busy === 'delete'}
              >
                {busy === 'delete' ? 'Deleting…' : 'Delete complaint'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
