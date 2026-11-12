import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { toPeopleWrite } from '@/components/PeoplePicker';
import ApperIcon from '@/components/ApperIcon';
import LookupPicker from '@/components/LookupPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { inr } from '@/services/dealRules';
import { PAYOUT_STATUS, newRef } from '@/services/records';

const { eq } = window.ApperSDK.CoreSDK;

const str = (v) => (v === null || v === undefined ? '' : String(v));

function toForm(record, initial) {
  const src = record ?? initial ?? {};
  return {
    vendor_c: src.vendor_c?.Id ?? src.vendor_c ?? null,
    deal_c: src.deal_c?.Id ?? src.deal_c ?? null,
    gross_c: str(src.gross_c),
    commission_c: str(src.commission_c),
    status_c: src.status_c ?? 'Pending',
    paidOn_c: src.paidOn_c ?? '',
    reference_c: src.reference_c ?? '',
  };
}

export default function PayoutDialog({ open, onOpenChange, record, initial, onSaved }) {
  const [form, setForm] = useState(toForm(record, initial));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(toForm(record, initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  const gross = Number(form.gross_c || 0);
  const commission = Number(form.commission_c || 0);
  const net = Math.max(0, gross - commission);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.vendor_c) errs.vendor_c = 'Pick the vendor being paid';
    if (!gross || gross <= 0) errs.gross_c = 'Enter the bookings value';
    if (commission < 0 || commission > gross) errs.commission_c = 'Commission must be between 0 and the bookings value';
    if (form.status_c === 'Paid' && !form.paidOn_c) errs.paidOn_c = 'Add the date it was paid';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const v = await sdk.table('vendors_c').select(['Name', 'user_c']).get(form.vendor_c);
      const payload = {
        vendor_c: form.vendor_c,
        deal_c: form.deal_c || null,
        vendorUser_c: toPeopleWrite(v.data?.user_c ?? []),
        gross_c: gross,
        commission_c: commission,
        net_c: Math.round(net * 100) / 100,
        status_c: form.status_c,
        paidOn_c: form.paidOn_c || null,
        reference_c: form.reference_c.trim() || null,
      };
      const res = record
        ? await sdk.table('payouts_c').update({ Id: record.Id, ...payload })
        : await sdk.table('payouts_c').create({ Name: newRef('PO'), ...payload });
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length) return;
      toast.success(record ? 'Payout saved' : `Payout of ${inr(payload.net_c)} created`);
      onOpenChange(false);
      onSaved?.(res.data[0]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">{record ? `Edit payout ${record.Name}` : 'New payout'}</DialogTitle>
          <DialogDescription>What the vendor receives after Lotmates' commission.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Vendor</Label>
              <LookupPicker
                table="vendors_c"
                searchField="Name"
                value={form.vendor_c}
                onChange={(v) => setForm((f) => ({ ...f, vendor_c: v, deal_c: null }))}
                placeholder="Choose a vendor"
                aria-label="Vendor"
                clearable
              />
              {errors.vendor_c && <p className="text-xs text-destructive">{errors.vendor_c}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Deal (optional)</Label>
              <LookupPicker
                key={form.vendor_c ?? 'none'}
                table="deals_c"
                searchField="Name"
                fetchParams={form.vendor_c ? { filter: eq('vendor_c', form.vendor_c) } : undefined}
                value={form.deal_c}
                onChange={(v) => setForm((f) => ({ ...f, deal_c: v }))}
                placeholder="Choose a deal"
                aria-label="Deal"
                disabled={!form.vendor_c}
                clearable
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="po-gross">Bookings value (₹)</Label>
              <Input id="po-gross" type="number" min={0} step="0.01" value={form.gross_c} onChange={(e) => setForm((f) => ({ ...f, gross_c: e.target.value }))} placeholder="57582" />
              {errors.gross_c && <p className="text-xs text-destructive">{errors.gross_c}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="po-comm">Commission (₹)</Label>
              <Input id="po-comm" type="number" min={0} step="0.01" value={form.commission_c} onChange={(e) => setForm((f) => ({ ...f, commission_c: e.target.value }))} placeholder="10364.76" />
              {errors.commission_c && <p className="text-xs text-destructive">{errors.commission_c}</p>}
            </div>
          </div>
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
            Vendor receives <span className="font-semibold tabular-nums">{inr(net)}</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status_c} onValueChange={(v) => setForm((f) => ({ ...f, status_c: v }))}>
                <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYOUT_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="po-paid">Paid on</Label>
              <Input id="po-paid" type="date" value={form.paidOn_c} onChange={(e) => setForm((f) => ({ ...f, paidOn_c: e.target.value }))} />
              {errors.paidOn_c && <p className="text-xs text-destructive">{errors.paidOn_c}</p>}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="po-ref">Bank reference or note</Label>
            <Input id="po-ref" value={form.reference_c} onChange={(e) => setForm((f) => ({ ...f, reference_c: e.target.value }))} placeholder="e.g. UTR 4021 7781 0093" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <ApperIcon name="LoaderCircle" size={16} className="animate-spin" />
                  Saving…
                </>
              ) : record ? 'Save payout' : 'Create payout'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
