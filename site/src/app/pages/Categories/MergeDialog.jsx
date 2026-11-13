import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { loadCategories } from '@/services/categories';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function MergeDialog({ open, onOpenChange, record, all, onDone }) {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setTo(''); }, [open]);
  const targets = (all ?? []).filter((c) => c.key_c !== record?.key_c && c.status_c === 'Active');

  async function go() {
    setBusy(true);
    try {
      const res = await sdk.categories.merge(record.key_c, to);
      if (!res.ok) return toast.error(res.error.message);
      const moved = (res.value?.data ?? res.value).moved;
      toast.success(`Moved ${moved} record${moved === 1 ? '' : 's'} into ${targets.find((c) => c.key_c === to)?.Name}`);
      await loadCategories(true);
      onOpenChange(false);
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Move {record?.Name} into another category</DialogTitle>
          <DialogDescription>
            Every deal, vendor and proposal in {record?.Name} switches to the category you pick. {record?.status_c === 'Pending' ? 'This suggestion is then removed.' : `${record?.Name} is then retired.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label>Move into</Label>
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger aria-label="Move into"><SelectValue placeholder="Pick a category" /></SelectTrigger>
            <SelectContent>
              {targets.map((c) => <SelectItem key={c.key_c} value={c.key_c}>{c.Name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!to || busy} onClick={go}>{busy ? 'Moving…' : 'Move everything'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
