import { useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { loadCategories } from '@/services/categories';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import CategoryDialog from './CategoryDialog';

export const route = { path: '/admin/categories', layout: 'owner', access: "profile === 'Admin_c'" };
export const nav = { icon: 'Tags', label: 'Categories', order: 55, profiles: ['Admin_c'] };

const FUL = { service: 'At the home', delivery: 'Delivered', pickup: 'Pickup', both: 'Delivery or pickup' };
const SCH = { none: 'Vendor fixes time', date: 'Pick a day', datetime: 'Day and slot' };

export default function CategoriesList() {
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);
  const { data, loading, error, run } = useFetch(() =>
    sdk
      .table('categories_c')
      .select(['Name', 'key_c', 'icon_c', 'repeat_c', 'fulfilment_c', 'schedule_c', 'status_c', 'order_c'])
      .orderBy('order_c')
      .page(1, 200)
      .fetch()
      .then((r) => {
        if (!r.success) throw new Error(r.message);
        return r.data;
      })
  );
  const rows = data ?? [];

  async function move(i, dir) {
    const a = rows[i];
    const b = rows[i + dir];
    if (!a || !b) return;
    // Give every row a clean position, then swap the two.
    const order = rows.map((r) => r.Id);
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    const res = await Promise.all(order.map((id, n) => sdk.table('categories_c').update({ Id: id, order_c: (n + 1) * 10 })));
    if (res.some((r) => !r.data?.length)) toast.error("Couldn't reorder");
    await loadCategories(true);
    run();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">Categories</h1>
          <p className="mt-1 text-muted-foreground">The kinds of deals on Lotmates. Add one whenever a new kind of vendor or product comes along.</p>
        </div>
        <Button onClick={() => { setEdit(null); setOpen(true); }}>
          <ApperIcon name="Plus" size={16} />
          Add category
        </Button>
      </div>
      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card p-10 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Couldn't load categories: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && data === undefined ? (
        <ListSkeleton rows={4} />
      ) : (
        <div className="grid gap-3">
          {rows.map((c, i) => (
            <div key={c.Id} className="flex flex-wrap items-center gap-4 rounded-[22px] bg-card p-4 shadow-sm sm:p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ApperIcon name={c.icon_c || 'Tag'} size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-lg font-bold text-foreground">
                  {c.Name}
                  {c.status_c === 'Retired' && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 align-middle text-xs font-medium text-muted-foreground">Retired</span>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {FUL[c.fulfilment_c] ?? 'At the home'}, {SCH[c.schedule_c] ?? 'Pick a day'}, {Number(c.repeat_c) === 1 ? 'repeat bookings allowed' : 'one booking per home'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" aria-label={`Move ${c.Name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ApperIcon name="ChevronUp" size={18} />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Move ${c.Name} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                  <ApperIcon name="ChevronDown" size={18} />
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setEdit(c); setOpen(true); }}>Edit</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <CategoryDialog open={open} onOpenChange={setOpen} record={edit} existing={rows} onSaved={run} />
    </div>
  );
}
