import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { loadCategories } from '@/services/categories';
import ApperIcon from '@/components/ApperIcon';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORY_ICONS } from '@/services/dealRules';

const FULFILMENT = [
  ['service', 'Done at the home'],
  ['delivery', 'Delivered'],
  ['pickup', 'Collected by the buyer'],
  ['both', 'Buyer chooses delivery or pickup'],
];
const SCHEDULE = [
  ['none', 'Vendor calls to fix a time'],
  ['date', 'Buyer picks a day'],
  ['datetime', 'Buyer picks a day and a time slot'],
];

const makeKey = (label) =>
  label
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
    .slice(0, 30);

export default function CategoryDialog({ open, onOpenChange, record, existing, onSaved }) {
  const blank = { Name: '', icon_c: 'Tag', repeat_c: '0', fulfilment_c: 'service', schedule_c: 'date', status_c: 'Active' };
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      record
        ? {
            Name: record.Name ?? '',
            icon_c: record.icon_c || 'Tag',
            repeat_c: String(Number(record.repeat_c) === 1 ? 1 : 0),
            fulfilment_c: record.fulfilment_c || 'service',
            schedule_c: record.schedule_c || 'date',
            status_c: record.status_c || 'Active',
          }
        : blank
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    const name = form.Name.trim();
    if (!name) return setError('Give the category a name');
    if (!record) {
      const key = makeKey(name);
      if (!key) return setError('Use letters or numbers in the name');
      if ((existing ?? []).some((c) => c.key_c.toLowerCase() === key.toLowerCase() || c.Name.toLowerCase() === name.toLowerCase())) {
        return setError('There is already a category with that name');
      }
    }
    setSaving(true);
    try {
      const payload = {
        Name: name,
        icon_c: form.icon_c,
        repeat_c: Number(form.repeat_c),
        fulfilment_c: form.fulfilment_c,
        schedule_c: form.schedule_c,
        status_c: form.status_c,
      };
      if (!record) {
        payload.key_c = makeKey(name);
        payload.order_c = ((existing ?? []).reduce((m, c) => Math.max(m, Number(c.order_c) || 0), 0) || 0) + 10;
      }
      const res = record ? await sdk.table('categories_c').update({ Id: record.Id, ...payload }) : await sdk.table('categories_c').create(payload);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length) return;
      toast.success(record ? 'Category saved' : `${name} added. People can pick it now.`);
      await loadCategories(true);
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">{record ? `Edit ${record.Name}` : 'Add a category'}</DialogTitle>
          <DialogDescription>Vendors, deals and neighbours see this name everywhere. The settings below are just the starting point for new deals.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" value={form.Name} onChange={(e) => set('Name')(e.target.value)} placeholder="e.g. Home appliances" autoFocus />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label>Icon</Label>
            <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Icon">
              {CATEGORY_ICONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={form.icon_c === n}
                  aria-label={n}
                  title={n}
                  onClick={() => set('icon_c')(n)}
                  className={cn('flex h-9 items-center justify-center rounded-lg border transition-colors', form.icon_c === n ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary' : 'border-border text-muted-foreground hover:bg-accent/50')}
                >
                  <ApperIcon name={n} size={18} />
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>How the work reaches the buyer</Label>
            <Select value={form.fulfilment_c} onValueChange={set('fulfilment_c')}>
              <SelectTrigger aria-label="Delivery"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FULFILMENT.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Scheduling</Label>
            <Select value={form.schedule_c} onValueChange={set('schedule_c')}>
              <SelectTrigger aria-label="Scheduling"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCHEDULE.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Repeat bookings</Label>
            <Select value={form.repeat_c} onValueChange={set('repeat_c')}>
              <SelectTrigger aria-label="Repeat bookings"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">One booking per home</SelectItem>
                <SelectItem value="1">Allow more than one booking</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={form.status_c} onValueChange={set('status_c')}>
              <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active, people can pick it</SelectItem>
                <SelectItem value="Retired">Retired, hidden from pickers (old deals keep it)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? (<><ApperIcon name="LoaderCircle" size={16} className="animate-spin" />Saving…</>) : record ? 'Save category' : 'Add category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
