import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
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
import { inr } from '@/services/dealRules';
import { PAYOUT_FIELDS, PAYOUT_STYLES, todayISO } from '@/services/records';
import PayoutDialog from './PayoutDialog';

export const route = { path: '/payouts/:id', layout: 'owner', access: "['Admin_c','Vendor_c'].includes(profile)" };

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

export default function PayoutDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const isAdmin = profile === 'Admin_c';
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState('');

  const { data: payout, loading, error, run } = useFetch(() => {
    return sdk.table('payouts_c').select(PAYOUT_FIELDS).get(id).then((r) => r.data);
  }, [id]);

  const back = { to: '/payouts', label: 'Back to Payouts' };

  if (loading && payout === undefined) {
    return (
      <div className="space-y-4">
        <PageHeader title="Payout" back={back} />
        <DetailSkeleton />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Payout" back={back} />
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load this payout: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!payout) {
    return <PageHeader title="Payout not found" back={back} description="It may have been removed." />;
  }

  async function markPaid() {
    setBusy('paid');
    try {
      const res = await sdk.table('payouts_c').update({ Id: payout.Id, status_c: 'Paid', paidOn_c: todayISO() });
      if (res.messages?.length) toast.error(res.messages[0]);
      if (!res.data?.length) return;
      toast.success(`${payout.Name} marked paid`);
      run();
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    setBusy('delete');
    try {
      const res = await sdk.table('payouts_c').remove(payout.Id);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (res.success === false && !res.data?.length) return;
      toast.success(`Deleted ${payout.Name}`);
      setDeleteOpen(false);
      navigate('/payouts');
    } finally {
      setBusy('');
    }
  }

  const dealLink = payout.deal_c?.Id ? (isAdmin ? `/admin/deals/${payout.deal_c.Id}` : `/deals/${payout.deal_c.Id}`) : null;
  const vendorLink = payout.vendor_c?.Id ? (isAdmin ? `/admin/vendors/${payout.vendor_c.Id}` : `/partners/${payout.vendor_c.Id}`) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={inr(payout.net_c)}
        back={back}
        description={`Payout ${payout.Name}`}
        actions={
          isAdmin ? (
            <>
              {payout.status_c === 'Pending' && (
                <Button onClick={markPaid} disabled={busy === 'paid'}>
                  {busy === 'paid' ? <ApperIcon name="LoaderCircle" size={16} className="animate-spin" /> : <ApperIcon name="Check" size={16} />}
                  {busy === 'paid' ? 'Saving…' : 'Mark paid'}
                </Button>
              )}
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <ApperIcon name="Pencil" size={16} />
                Edit
              </Button>
              <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <ApperIcon name="Trash2" size={16} />
                Delete
              </Button>
            </>
          ) : null
        }
      >
        <StatusBadge value={payout.status_c} styles={PAYOUT_STYLES} />
      </PageHeader>

      <section className="max-w-xl rounded-[22px] bg-card shadow-sm px-4">
        <div className="divide-y divide-border">
          <Row label="Vendor">{vendorLink ? <Link to={vendorLink} className="text-primary hover:underline">{payout.vendor_c?.Name}</Link> : '—'}</Row>
          <Row label="Deal">{dealLink ? <Link to={dealLink} className="text-primary hover:underline">{payout.deal_c?.Name}</Link> : '—'}</Row>
          <Row label="Bookings value">{inr(payout.gross_c)}</Row>
          <Row label="Lotmates commission">− {inr(payout.commission_c)}</Row>
          <Row label="Paid to vendor">{inr(payout.net_c)}</Row>
          <Row label="Paid on">{payout.paidOn_c ? formatLocalDate(payout.paidOn_c, DATE_FORMATS.SHORT) : 'Not yet'}</Row>
          <Row label="Reference">{payout.reference_c ?? '—'}</Row>
        </div>
      </section>

      {isAdmin && (
        <>
          <PayoutDialog open={editOpen} onOpenChange={setEditOpen} record={payout} onSaved={run} />
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete payout {payout.Name}?</AlertDialogTitle>
                <AlertDialogDescription>The vendor will no longer see it. Money already sent is not affected.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy === 'delete'}>Keep it</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(e) => {
                    e.preventDefault();
                    remove();
                  }}
                  disabled={busy === 'delete'}
                >
                  {busy === 'delete' ? 'Deleting…' : 'Delete payout'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
