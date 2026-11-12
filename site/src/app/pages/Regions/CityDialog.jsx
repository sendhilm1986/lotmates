import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REGION_STATUS } from '@/services/dealRules';

export default function CityDialog({ open, onOpenChange, record, onSaved }) {
  const [form, setForm] = useState({ Name: '', state_c: 'Tamil Nadu', status_c: 'Coming soon' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      Name: record?.Name ?? '',
      state_c: record?.state_c ?? 'Tamil Nadu',
      status_c: record?.status_c ?? 'Coming soon',
    });
  }, [open, record]);

  async function submit(e) {
    e.preventDefault();
    if (!form.Name.trim()) {
      setError('City name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = { Name: form.Name.trim(), state_c: form.state_c.trim() || null, status_c: form.status_c };
      const res = record
        ? await sdk.table('cities_c').update({ Id: record.Id, ...payload })
        : await sdk.table('cities_c').create(payload);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length) return;
      toast.success(record ? 'City saved' : `${payload.Name} added`);
      onOpenChange(false);
      onSaved?.(res.data[0]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">{record ? `Edit ${record.Name}` : 'Add a city'}</DialogTitle>
          <DialogDescription>Any Indian city can go live once it has localities and vendors.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="city-name">City</Label>
            <Input id="city-name" value={form.Name} onChange={(e) => setForm((f) => ({ ...f, Name: e.target.value }))} placeholder="e.g. Tiruppur" autoFocus />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="city-state">State</Label>
            <Input id="city-state" value={form.state_c} onChange={(e) => setForm((f) => ({ ...f, state_c: e.target.value }))} placeholder="e.g. Tamil Nadu" />
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={form.status_c} onValueChange={(v) => setForm((f) => ({ ...f, status_c: v }))}>
              <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REGION_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <ApperIcon name="LoaderCircle" size={16} className="animate-spin" />
                  Saving…
                </>
              ) : record ? 'Save city' : 'Add city'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
