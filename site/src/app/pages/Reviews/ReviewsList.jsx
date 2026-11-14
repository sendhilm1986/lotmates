import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { formatRelativeTime } from '@/utils/date';
import PageHeader from '@/components/PageHeader';
import RatingStars from '@/components/RatingStars';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { REVIEW_FIELDS, userIdOf, sameId, unwrapList } from '@/services/records';

export const route = { path: '/reviews', layout: 'owner', access: "['Admin_c','Vendor_c','Customer_c'].includes(profile)" };
export const nav = { icon: 'Star', label: 'Reviews', order: 70, profiles: ['Admin_c', 'Vendor_c'] };

const { eq } = window.ApperSDK.CoreSDK;

export default function ReviewsList() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const user = useSelector((s) => s.user.user);
  const uid = userIdOf(user);

  const { data, loading, error, run } = useFetch(async () => {
    let q = sdk.table('reviews_c').select(REVIEW_FIELDS);
    let vendor = null;
    if (profile === 'Vendor_c') {
      const v = await sdk.table('vendors_c').select(['Name']).where(eq('user_c', uid)).limit(1).fetch();
      vendor = unwrapList(v)[0] ?? null;
      if (!vendor) return { rows: [], vendor: null };
      q = q.where(eq('vendor_c', vendor.Id));
    }
    const r = await q.orderByDesc('CreatedOn').page(1, 50).fetch();
    return { rows: unwrapList(r), vendor };
  }, [profile, uid]);

  const rows = data?.rows ?? [];
  const avg = rows.length ? rows.reduce((s, r) => s + Number(r.rating_c || 0), 0) / rows.length : 0;

  const description =
    profile === 'Vendor_c'
      ? `What neighbours say about ${data?.vendor?.Name ?? 'your work'}.`
      : profile === 'Customer_c'
        ? 'Reviews from your neighbourhood. Rate a job from its booking once it is done.'
        : 'Every review across vendors.';

  return (
    <div className="space-y-8">
      <PageHeader title="Reviews" description={description}>
        {rows.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RatingStars value={avg} />
            <span className="tabular-nums">{avg.toFixed(1)} from {rows.length} reviews</span>
          </div>
        )}
      </PageHeader>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load reviews: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && data === undefined ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <p className="rounded-[22px] bg-card shadow-sm p-8 text-center text-sm text-muted-foreground">
          No reviews yet.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm">
          {rows.map((r) => (
            <li key={r.Id}>
              <div
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/reviews/${r.Id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/reviews/${r.Id}`);
                }}
                className="cursor-pointer space-y-1 px-5 py-5 transition-colors md:px-6 duration-(--transition-fast) hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-3">
                  <RatingStars value={r.rating_c} size={14} />
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(r.CreatedOn)}</span>
                </div>
                <p className="font-medium text-foreground">{r.Name}</p>
                {r.comment_c && <p className="line-clamp-2 text-sm text-muted-foreground">{r.comment_c}</p>}
                <p className="text-xs text-muted-foreground">
                  {sameId(r.Owner?.Id, uid) ? 'You' : r.Owner?.Name ?? 'A neighbour'}
                  {profile !== 'Vendor_c' && r.vendor_c?.Name ? ` on ${r.vendor_c.Name}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
