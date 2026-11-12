import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import LookupPicker from '@/components/LookupPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REGION_STATUS } from '@/services/dealRules';

export default function LocalityDialog({ open, onOpenChange, record, onSaved }) {
  const [form, setForm] = useState({ Name: '', city_c: null, pincode_c: '', status_c: 'Coming soon' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm({
      Name: record?.Name ?? '',
      city_c: record?.city_c?.Id ?? record?.city_c ?? null,
      pincode_c: record?.pincode_c ?? '',
      status_c: record?.status_c ?? 'Coming soon',
    });
  }, [open, record]);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.Name.trim()) errs.Name = 'Locality name is required';
    if (!form.city_c) errs.city_c = 'Pick the city';
    if (form.pincode_c && !/^\d{6}$/.test(form.pincode_c.trim())) errs.pincode_c = 'Pincodes have 6 digits';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const payload = { Name: form.Name.trim(), city_c: form.city_c, pincode_c: form.pincode_c.trim() || null, status_c: form.status_c };
      const res = record
        ? await sdk.table('localities_c').update({ Id: record.Id, ...payload })
        : await sdk.table('localities_c').create(payload);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length) return;
      toast.success(record ? 'Locality saved' : `${payload.Name} added`);
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
          <DialogTitle className="font-heading">{record ? `Edit ${record.Name}` : 'Add a locality'}</DialogTitle>
          <DialogDescription>A locality groups nearby communities within a city.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="loc-name">Locality</Label>
            <Input id="loc-name" value={form.Name} onChange={(e) => setForm((f) => ({ ...f, Name: e.target.value }))} placeholder="e.g. Lakeview" autoFocus />
            {errors.Name && <p className="text-xs text-destructive">{errors.Name}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label>City</Label>
            <LookupPicker table="cities_c" searchField="Name" value={form.city_c} onChange={(v) => setForm((f) => ({ ...f, city_c: v }))} placeholder="Choose a city" aria-label="City" clearable />
            {errors.city_c && <p className="text-xs text-destructive">{errors.city_c}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="loc-pin">Pincode</Label>
              <Input id="loc-pin" inputMode="numeric" value={form.pincode_c} onChange={(e) => setForm((f) => ({ ...f, pincode_c: e.target.value }))} placeholder="6-digit pincode" />
              {errors.pincode_c && <p className="text-xs text-destructive">{errors.pincode_c}</p>}
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
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? (<><ApperIcon name="LoaderCircle" size={16} className="animate-spin" />Saving…</>) : record ? 'Save locality' : 'Add locality'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
