import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useSelector } from 'react-redux';
import PhotoPicker, { usePhotoUploads } from '@/components/PhotoPicker';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JOB_FIELDS, unwrapList } from '@/services/records';

const { isIn, eq, and } = window.ApperSDK.CoreSDK;

export default function ComplaintDialog({ open, onOpenChange, record, booking, onSaved }) {
  const [bookings, setBookings] = useState([]);
  const [bookingId, setBookingId] = useState('');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const uploads = usePhotoUploads(4);
  const uid = useSelector((s) => s.user.user?.userId);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSubject(record?.Name ?? '');
    setDetails(record?.details_c ?? '');
    setBookingId(record?.booking_c?.Id ?? booking?.Id ?? '');
    uploads.reset(record);
    if (record || booking) return;
    sdk
      .table('bookings_c')
      .select(JOB_FIELDS)
      .where(uid ? and(isIn('status_c', ['Booked', 'Confirmed', 'Done', 'Failed', 'Cancelled']), eq('Owner', uid)) : isIn('status_c', ['Booked', 'Confirmed', 'Done', 'Failed', 'Cancelled']))
      .orderByDesc('CreatedOn')
      .page(1, 50)
      .fetch()
      .then((r) => setBookings(r.success ? r.data : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record, booking]);

  function close(v) {
    if (!v) uploads.discardUnsaved();
    onOpenChange(v);
  }

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!record && !bookingId) errs.booking = 'Pick the booking this is about';
    if (!subject.trim()) errs.subject = 'Add a short subject';
    if (!details.trim()) errs.details = 'Tell us what happened';
    if (uploads.working) errs.photos = 'Wait for the photos to finish uploading';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      // The server works out the deal and vendor from the booking.
      const res = record
        ? await sdk.table('complaints_c').update({ Id: record.Id, Name: subject.trim(), details_c: details.trim(), photos_c: uploads.ids })
        : await sdk.table('complaints_c').create({ Name: subject.trim(), booking_c: bookingId, details_c: details.trim(), photos_c: uploads.ids });
      if (res.messages?.length || res.message) setErrors({ form: res.messages?.[0] ?? res.message });
      if (!res.data?.length) return;
      uploads.markSaved();
      toast.success(record ? 'Complaint updated' : 'Sent to the Lotmates team and the vendor.');
      onOpenChange(false);
      onSaved?.(res.data[0]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">{record ? 'Edit complaint' : 'Report a problem'}</DialogTitle>
          <DialogDescription>The Lotmates team reads every one. The vendor sees it too, so they can reply.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          {!record && !booking && (
            <div className="grid gap-1.5">
              <Label>Booking</Label>
              <Select value={bookingId} onValueChange={setBookingId}>
                <SelectTrigger aria-label="Booking">
                  <SelectValue placeholder="Choose the booking" />
                </SelectTrigger>
                <SelectContent>
                  {bookings.map((b) => (
                    <SelectItem key={b.Id} value={b.Id}>
                      {b.Name}, {b.deal_c?.Name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.booking && <p className="text-xs text-destructive">{errors.booking}</p>}
            </div>
          )}
          {booking && <p className="text-sm text-muted-foreground">About booking {booking.Name}, {booking.deal_c?.Name}</p>}
          <div className="grid gap-1.5">
            <Label htmlFor="cp-subject">Subject</Label>
            <Input id="cp-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Crew arrived two hours late" />
            {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cp-details">What happened</Label>
            <Textarea id="cp-details" rows={4} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Dates, times and what you expected help us sort it faster" />
            {errors.details && <p className="text-xs text-destructive">{errors.details}</p>}
          </div>
          <PhotoPicker uploads={uploads} label="Photos (optional)" hint="A photo of the problem helps the team and the vendor sort it faster." />
          {errors.photos && <p className="text-xs text-destructive">{errors.photos}</p>}
          {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || uploads.working}>
              {saving ? (
                <>
                  <ApperIcon name="LoaderCircle" size={16} className="animate-spin" />
                  Sending…
                </>
              ) : record ? 'Save changes' : 'Send complaint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
