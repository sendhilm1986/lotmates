import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import RatingStars from '@/components/RatingStars';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PhotoPicker, { usePhotoUploads } from '@/components/PhotoPicker';

const MAX_PHOTOS = 4;

export default function ReviewDialog({ open, onOpenChange, record, context, onSaved }) {
  const [rating, setRating] = useState(0);
  const [headline, setHeadline] = useState('');
  const [comment, setComment] = useState('');
  const uploads = usePhotoUploads(MAX_PHOTOS);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setRating(Number(record?.rating_c ?? 0));
    setHeadline(record?.Name ?? '');
    setComment(record?.comment_c ?? '');
    uploads.reset(record);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  // Closing without saving: drop the photos uploaded in this sitting, so they don't linger.
  function close(v) {
    if (!v) uploads.discardUnsaved();
    onOpenChange(v);
  }

  const working = uploads.working;

  async function submit(e) {
    e.preventDefault();
    if (!rating) {
      setError('Tap a star to rate the job');
      return;
    }
    if (!headline.trim()) {
      setError('Add a short headline');
      return;
    }
    if (working) {
      setError('Wait for the photos to finish uploading');
      return;
    }
    setSaving(true);
    try {
      const base = { Name: headline.trim(), rating_c: rating, comment_c: comment.trim() || null, photos_c: uploads.ids };
      const res = record
        ? await sdk.table('reviews_c').update({ Id: record.Id, ...base })
        : await sdk.table('reviews_c').create({ ...base, booking_c: context?.bookingId ?? null });
      if (res.messages?.length || res.message) setError(res.messages?.[0] ?? res.message);
      if (!res.data?.length) return;
      uploads.markSaved();
      toast.success(record ? 'Review updated' : 'Thanks. Your review is on the vendor page.');
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
          <DialogTitle className="font-heading">{record ? 'Edit your review' : 'Rate this job'}</DialogTitle>
          <DialogDescription>Neighbours read these before they book. Your review shows your first name and initial, marked as a verified booking.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-5">
          <RatingStars value={rating} onChange={setRating} />
          <div className="grid gap-1.5">
            <Label htmlFor="rv-head">Headline</Label>
            <Input id="rv-head" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Crew on time, kitchen spotless" maxLength={120} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rv-comment">What went well or not (optional)</Label>
            <Textarea id="rv-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="A sentence or two helps your neighbours decide" maxLength={1500} />
          </div>

          <PhotoPicker uploads={uploads} />

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => close(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || working}>
              {saving ? (
                <>
                  <ApperIcon name="LoaderCircle" size={16} className="animate-spin" />
                  Saving…
                </>
              ) : working ? (
                'Uploading photos…'
              ) : record ? (
                'Save review'
              ) : (
                'Post review'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
