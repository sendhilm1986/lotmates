import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import FilePicker from '@/components/FilePicker';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import RatingStars from '@/components/RatingStars';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BOOKING_STYLES } from '@/services/dealRules';
import {
  JOB_FIELDS,
  JOB_PHOTOS_CONFIG,
  REVIEW_FIELDS,
  COMPLAINT_FIELDS,
  COMPLAINT_STYLES,
  todayISO,
  unwrapList,
} from '@/services/records';

export const route = { path: '/vendor/jobs/:id', layout: 'owner', access: "profile === 'Vendor_c'" };

const { eq } = window.ApperSDK.CoreSDK;

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const [doneOpen, setDoneOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: job, loading, error, run } = useFetch(() => {
    return sdk.table('bookings_c').select(JOB_FIELDS).get(id).then((r) => r.data);
  }, [id]);

  const dealId = job?.deal_c?.Id;
  const { data: deal } = useFetch(() => {
    if (!dealId) return Promise.resolve(null);
    return sdk
      .table('deals_c')
      .select(['Name', 'deadline_c', 'serviceStart_c', 'serviceEnd_c', 'status_c'])
      .get(dealId)
      .then((r) => r.data);
  }, [dealId]);

  const { data: reviews } = useFetch(() => {
    return sdk.table('reviews_c').select(REVIEW_FIELDS).where(eq('booking_c', id)).fetch().then(unwrapList);
  }, [id]);

  const { data: complaints } = useFetch(() => {
    return sdk.table('complaints_c').select(COMPLAINT_FIELDS).where(eq('booking_c', id)).fetch().then(unwrapList);
  }, [id]);

  const back = { to: '/vendor', label: 'Back to Jobs' };

  if (loading && job === undefined) {
    return (
      <div className="space-y-4">
        <PageHeader title="Job" back={back} />
        <DetailSkeleton />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Job" back={back} />
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load this job: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="space-y-4">
        <PageHeader title="Job not found" back={back} description="It may belong to another vendor or have been removed." />
      </div>
    );
  }

  const photosList = Array.isArray(job.jobPhotos_c) ? job.jobPhotos_c : [];

  async function markDone(e) {
    e.preventDefault();
    if (!photos.length) {
      toast.error('Add at least one photo of the finished job');
      return;
    }
    setSaving(true);
    try {
      const res = await sdk.table('bookings_c').update({
        Id: job.Id,
        status_c: 'Done',
        jobPhotos_c: sdk.storage.toUpdateFormat(photos),
        jobNote_c: note.trim() || null,
        doneOn_c: todayISO(),
      });
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length) return;
      toast.success('Marked done. The neighbour can now rate the job.');
      setDoneOpen(false);
      setPhotos([]);
      setNote('');
      run();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.deal_c?.Name ?? 'Job'}
        back={back}
        description={`Booking ${job.Name}`}
        actions={
          job.status_c === 'Confirmed' ? (
            <Button onClick={() => setDoneOpen(true)}>
              <ApperIcon name="CheckCheck" size={16} />
              Mark job done
            </Button>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={job.status_c} styles={BOOKING_STYLES} />
          {job.deal_c?.Id && (
            <Link to={`/deals/${job.deal_c.Id}`} className="text-sm font-medium text-primary hover:underline">
              Open the deal page
            </Link>
          )}
        </div>
      </PageHeader>

      {job.status_c === 'Booked' && (
        <p className="rounded-(--radius) border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          This deal is still taking bookings
          {deal?.deadline_c ? ` until ${formatLocalDate(deal.deadline_c, DATE_FORMATS.SHORT)}` : ''}. You can mark the job done
          after it closes and the booking is confirmed.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-[22px] bg-card shadow-sm px-4">
          <h2 className="pt-4 font-heading text-base font-bold text-foreground">Where and when</h2>
          <div className="divide-y divide-border">
            <Row label="Preferred day">
              {job.preferredDate_c ? formatLocalDate(job.preferredDate_c, DATE_FORMATS.SHORT) : 'Any day in the window. Call to agree one.'}
            </Row>
            {job.preferredSlot_c && <Row label="Preferred time">{job.preferredSlot_c}</Row>}
            <Row label="Area">{[job.community_c?.Name, job.locality_c?.Name].filter(Boolean).join(', ') || '—'}</Row>
            {job.fulfilment_c === 'pickup' ? (
              <Row label="How">The neighbour collects it from you. No address to visit.</Row>
            ) : (
              <Row label={job.fulfilment_c === 'delivery' ? 'Deliver to' : 'Address'}>{job.address_c ?? '—'}</Row>
            )}
            <Row label="Quantity">{job.homes_c ?? 1}</Row>
            <Row label="Notes from the neighbour">{job.notes_c ?? 'None'}</Row>
          </div>
          {job.phone_c && (
            <div className="pb-4">
              <Button variant="outline" className="w-full" asChild>
                <a href={`tel:${job.phone_c.replace(/\s/g, '')}`}>
                  <ApperIcon name="Phone" size={16} />
                  Call {job.phone_c}
                </a>
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-[22px] bg-card shadow-sm p-4">
          <h2 className="font-heading text-base font-bold text-foreground">Proof of work</h2>
          {job.status_c === 'Done' ? (
            <>
              <p className="text-sm text-muted-foreground">
                Done {job.doneOn_c ? formatLocalDate(job.doneOn_c, DATE_FORMATS.SHORT) : ''}
              </p>
              {job.jobNote_c && <p className="whitespace-pre-line text-sm text-foreground">{job.jobNote_c}</p>}
              {photosList.length ? (
                <div className="grid grid-cols-3 gap-2">
                  {photosList.map((f, i) => (
                    <a
                      key={f.Id ?? f.id ?? i}
                      href={f.url ?? f.Url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                    >
                      {f.url || f.Url ? (
                        <img src={f.url ?? f.Url} alt={f.name ?? f.Name ?? 'Job photo'} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                          {f.name ?? f.Name ?? 'Photo'}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No photos on this demo job.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              When the job is finished, add a few photos and a short note. The neighbour sees them and can rate the job.
            </p>
          )}
        </section>
      </div>

      {((reviews ?? []).length > 0 || (complaints ?? []).length > 0) && (
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-foreground">Feedback on this job</h2>
          <ul className="divide-y divide-border rounded-[22px] bg-card shadow-sm">
            {(reviews ?? []).map((r) => (
              <li key={r.Id} className="p-4">
                <Link to={`/reviews/${r.Id}`} className="block space-y-1">
                  <RatingStars value={r.rating_c} />
                  <p className="font-medium text-foreground">{r.Name}</p>
                  {r.comment_c && <p className="text-sm text-muted-foreground">{r.comment_c}</p>}
                </Link>
              </li>
            ))}
            {(complaints ?? []).map((c) => (
              <li key={c.Id} className="flex items-center justify-between gap-3 p-4">
                <Link to={`/complaints/${c.Id}`} className="min-w-0 font-medium text-foreground hover:text-primary">
                  {c.Name}
                </Link>
                <StatusBadge value={c.status_c} styles={COMPLAINT_STYLES} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Mark job done</DialogTitle>
            <DialogDescription>Photos of the finished work protect you if there is a dispute.</DialogDescription>
          </DialogHeader>
          <form onSubmit={markDone} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Photos</Label>
              <FilePicker fieldConfig={JOB_PHOTOS_CONFIG} value={photos} onChange={setPhotos} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="job-note">Note for the neighbour (optional)</Label>
              <Textarea
                id="job-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Chimney degreased, both bathrooms descaled"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setDoneOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <ApperIcon name="LoaderCircle" size={16} className="animate-spin" />
                    Saving…
                  </>
                ) : 'Mark done'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
