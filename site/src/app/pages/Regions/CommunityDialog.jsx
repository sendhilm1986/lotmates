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
import { COMMUNITY_TYPES, COMMUNITY_STATUS } from '@/services/dealRules';

export default function CommunityDialog({ open, onOpenChange, record, onSaved }) {
  const [form, setForm] = useState({ Name: '', locality_c: null, type_c: 'Apartment', homes_c: '', ambassadorName_c: '', status_c: 'Onboarding' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm({
      Name: record?.Name ?? '',
      locality_c: record?.locality_c?.Id ?? record?.locality_c ?? null,
      type_c: record?.type_c ?? 'Apartment',
      homes_c: record?.homes_c === null || record?.homes_c === undefined ? '' : String(record.homes_c),
      ambassadorName_c: record?.ambassadorName_c ?? '',
      status_c: record?.status_c ?? 'Onboarding',
    });
  }, [open, record]);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.Name.trim()) errs.Name = 'Community name is required';
    if (!form.locality_c) errs.locality_c = 'Pick the locality';
    if (form.homes_c !== '' && Number(form.homes_c) < 1) errs.homes_c = 'At least 1 home';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const payload = {
        Name: form.Name.trim(),
        locality_c: form.locality_c,
        type_c: form.type_c,
        homes_c: form.homes_c === '' ? null : Number(form.homes_c),
        ambassadorName_c: form.ambassadorName_c.trim() || null,
        status_c: form.status_c,
      };
      const res = record
        ? await sdk.table('communities_c').update({ Id: record.Id, ...payload })
        : await sdk.table('communities_c').create(payload);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length) return;
      toast.success(record ? 'Community saved' : `${payload.Name} added`);
      onOpenChange(false);
      onSaved?.(res.data[0]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">{record ? `Edit ${record.Name}` : 'Add a community'}</DialogTitle>
          <DialogDescription>An apartment complex, gated community, or street of houses.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="com-name">Community</Label>
            <Input id="com-name" value={form.Name} onChange={(e) => setForm((f) => ({ ...f, Name: e.target.value }))} placeholder="e.g. Palm Grove Residency" autoFocus />
            {errors.Name && <p className="text-xs text-destructive">{errors.Name}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label>Locality</Label>
            <LookupPicker table="localities_c" searchField="Name" value={form.locality_c} onChange={(v) => setForm((f) => ({ ...f, locality_c: v }))} placeholder="Choose a locality" aria-label="Locality" clearable />
            {errors.locality_c && <p className="text-xs text-destructive">{errors.locality_c}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={form.type_c} onValueChange={(v) => setForm((f) => ({ ...f, type_c: v }))}>
                <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMMUNITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="com-homes">Homes</Label>
              <Input id="com-homes" type="number" min={1} value={form.homes_c} onChange={(e) => setForm((f) => ({ ...f, homes_c: e.target.value }))} placeholder="120" />
              {errors.homes_c && <p className="text-xs text-destructive">{errors.homes_c}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="com-amb">Ambassador</Label>
              <Input id="com-amb" value={form.ambassadorName_c} onChange={(e) => setForm((f) => ({ ...f, ambassadorName_c: e.target.value }))} placeholder="e.g. Priya R." />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status_c} onValueChange={(v) => setForm((f) => ({ ...f, status_c: v }))}>
                <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMMUNITY_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? (<><ApperIcon name="LoaderCircle" size={16} className="animate-spin" />Saving…</>) : record ? 'Save community' : 'Add community'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
