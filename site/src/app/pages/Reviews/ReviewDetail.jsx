import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import PageHeader from '@/components/PageHeader';
import RatingStars from '@/components/RatingStars';
import ReviewPhotos from '@/components/ReviewPhotos';
import { VerifiedTag, shortName } from '@/components/VendorReviews';
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
import { REVIEW_FIELDS, userIdOf, sameId } from '@/services/records';
import ReviewDialog from './ReviewDialog';

export const route = { path: '/reviews/:id', layout: 'owner', access: "['Admin_c','Vendor_c','Customer_c'].includes(profile)" };

export default function ReviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const user = useSelector((s) => s.user.user);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: review, loading, error, run } = useFetch(() => {
    return sdk.table('reviews_c').select(REVIEW_FIELDS).get(id).then((r) => r.data);
  }, [id]);

  const back = { to: '/reviews', label: 'Back to Reviews' };

  if (loading && review === undefined) {
    return (
      <div className="space-y-4">
        <PageHeader title="Review" back={back} />
        <DetailSkeleton />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Review" back={back} />
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load this review: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!review) return <PageHeader title="Review not found" back={back} description="It may have been removed." />;

  const mine = sameId(review.Owner?.Id, userIdOf(user));
  const canEdit = mine || profile === 'Admin_c';
  const bookingLink = review.booking_c?.Id && (mine || profile === 'Admin_c') ? `/bookings/${review.booking_c.Id}` : null;

  async function remove() {
    setDeleting(true);
    try {
      const res = await sdk.table('reviews_c').remove(review.Id);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (res.success === false && !res.data?.length) return;
      toast.success('Review deleted');
      setDeleteOpen(false);
      navigate('/reviews');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={review.Name}
        back={back}
        actions={
          canEdit ? (
            <>
              {/* Only the person who wrote it can change the words. The team can remove a review. */}
              {mine && (
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <ApperIcon name="Pencil" size={16} />
                  Edit
                </Button>
              )}
              <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <ApperIcon name="Trash2" size={16} />
                Delete
              </Button>
            </>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <RatingStars value={review.rating_c} size={20} />
          <VerifiedTag />
        </div>
      </PageHeader>

      <section className="max-w-2xl space-y-4 rounded-[22px] bg-card shadow-sm p-5">
        <p className="whitespace-pre-line text-foreground">{review.comment_c || 'No comment added.'}</p>
        <ReviewPhotos review={review} size="lg" />
        <p className="text-sm text-muted-foreground">
          {mine ? 'You' : profile === 'Admin_c' ? review.Owner?.Name ?? 'A neighbour' : shortName(review.Owner?.Name)}, reviewed {formatLocalDate(review.CreatedOn, DATE_FORMATS.SHORT)}
          {review.serviceDone_c ? `, after the job was done on ${formatLocalDate(review.serviceDone_c, DATE_FORMATS.SHORT)}` : ''}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4 text-sm">
          {review.vendor_c?.Id && (
            <Link to={`/partners/${review.vendor_c.Id}`} className="font-medium text-primary hover:underline">
              {review.vendor_c.Name}
            </Link>
          )}
          {review.deal_c?.Id && (
            <Link to={`/deals/${review.deal_c.Id}`} className="font-medium text-primary hover:underline">
              {review.deal_c.Name}
            </Link>
          )}
          {bookingLink && (
            <Link to={bookingLink} className="font-medium text-primary hover:underline">
              Booking {review.booking_c.Name}
            </Link>
          )}
        </div>
      </section>

      {canEdit && (
        <>
          <ReviewDialog open={editOpen} onOpenChange={setEditOpen} record={review} onSaved={run} />
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this review?</AlertDialogTitle>
                <AlertDialogDescription>It disappears from the vendor page straight away.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(e) => {
                    e.preventDefault();
                    remove();
                  }}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Delete review'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
