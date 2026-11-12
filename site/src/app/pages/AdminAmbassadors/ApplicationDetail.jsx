import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatLocalDate, formatRelativeTime, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { APP_FIELDS, APP_STYLES } from '@/services/records';

export const route = { path: '/admin/ambassador-applications/:id', layout: 'owner', access: "profile === 'Admin_c'" };

export default function ApplicationDetail() {
  const { id } = useParams();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [notify, setNotify] = useState(true);

  const { data: app, loading, error, run } = useFetch(() => sdk.table('ambassadorApps_c').select(APP_FIELDS).get(id).then((r) => r.data), [id]);

  // Does the applicant's email already have a Lotmates account? Decides upgrade or invite.
  const { data: account, loading: accountLoading, run: runAccount } = useFetch(async () => {
    if (!app?.email_c) return null;
    const r = await sdk.neighbours.lookup(app.email_c);
    return r.ok ? r.value.data : null;
  }, [app?.email_c]);

  useEffect(() => {
    if (app) setNote(app.adminNote_c ?? '');
  }, [app]);

  const back = { to: '/admin/ambassador-applications', label: 'Back to applications' };
  if (loading && !app) {
    return (
      <div className="space-y-4">
        <PageHeader title="Application" back={back} />
        <DetailSkeleton />
      </div>
    );
  }
  if (error || !app) {
    return <PageHeader title="Application not found" back={back} description={error ? String(error.message ?? error) : 'It may have been removed.'} />;
  }

  async function act(action, extra = {}) {
    setBusy(action);
    try {
      const r = await sdk.ambassadors.decide(app.Id, action, { note: note.trim(), ...extra });
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      toast.success(r.value?.data?.message ?? 'Saved');
      setConfirm(null);
      run();
      runAccount();
    } finally {
      setBusy('');
    }
  }

  const open = app.status_c === 'New' || app.status_c === 'Contacted';
  const contacted = app.status_c === 'Contacted';
  const phone = app.phone_c;
  const prefersPhone = app.contactPref_c !== 'Email';
  const approveLabel = account?.profile === 'Customer_c' ? 'Approve and upgrade account' : 'Approve and send invite';

  const steps = [
    { label: 'Applied', done: true, at: app.CreatedOn },
    { label: 'Got in touch', done: Boolean(app.contactedOn_c), at: app.contactedOn_c },
    {
      label: app.status_c === 'Declined' ? 'Declined' : 'Approved',
      done: app.status_c === 'Approved' || app.status_c === 'Declined',
      at: app.decidedOn_c,
      stop: app.status_c === 'Declined',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={app.Name} back={back}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <StatusBadge value={app.status_c} styles={APP_STYLES} />
          <span>Applied {formatRelativeTime(app.CreatedOn)}</span>
        </div>
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-[22px] bg-card p-5 shadow-sm sm:p-6">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Fact icon="Home" label="Community">
                {app.communityName_c}
                <span className="mt-0.5 block font-sans text-sm font-normal text-muted-foreground">{app.localityName_c}</span>
              </Fact>
              <Fact icon="Users" label="Homes">
                <span className="font-heading text-3xl font-bold tabular-nums">{app.homes_c ?? '?'}</span>
                <span className="ml-1.5 font-sans text-sm font-normal text-muted-foreground">homes, roughly</span>
              </Fact>
              <Fact icon="Link" label="Connection">{app.relation_c}</Fact>
              <Fact icon="CalendarDays" label="Applied">
                {formatLocalDate(app.CreatedOn, DATE_FORMATS.SHORT)}
                <span className="mt-0.5 block font-sans text-sm font-normal text-muted-foreground">{formatLocalDate(app.CreatedOn, DATE_FORMATS.TIME_ONLY)}</span>
              </Fact>
            </dl>

            <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ApperIcon name={prefersPhone ? 'Phone' : 'Mail'} size={15} className="flex-none text-primary" />
                  Prefers {prefersPhone ? 'a phone call' : 'email'}
                </p>
                <p className="mt-1 truncate font-heading text-lg font-bold text-foreground">{prefersPhone ? phone : app.email_c}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{prefersPhone ? app.email_c : phone}</p>
              </div>
              <div className="flex flex-none gap-2">
                <Button asChild variant={prefersPhone ? 'default' : 'outline'}>
                  <a href={`tel:${String(phone).replace(/[\s-]/g, '')}`}>
                    <ApperIcon name="Phone" size={16} />
                    Call
                  </a>
                </Button>
                <Button asChild variant={prefersPhone ? 'outline' : 'default'}>
                  <a href={`mailto:${app.email_c}?subject=${encodeURIComponent('Your Lotmates ambassador application')}`}>
                    <ApperIcon name="Mail" size={16} />
                    Email
                  </a>
                </Button>
              </div>
            </div>

            <AccountMatch account={account} loading={accountLoading && account === null} approved={app.status_c === 'Approved'} />

            <div className="mt-6 border-t border-border pt-5">
              <h2 className="text-sm font-semibold text-foreground">How they&apos;d share deals</h2>
              <p className={cn('mt-1.5 whitespace-pre-line text-[15px] leading-6', app.about_c ? 'text-foreground' : 'text-muted-foreground')}>{app.about_c || 'Nothing added.'}</p>
            </div>
          </section>

          {app.status_c === 'Approved' && (
            <section className="rounded-[22px] bg-card p-5 shadow-sm sm:p-6">
              <h2 className="font-heading text-lg font-bold text-foreground">After approval</h2>
              <ul className="mt-3 space-y-2.5 text-[15px] text-foreground">
                <li className="flex gap-2.5">
                  <ApperIcon name={app.user_c?.Id ? 'CircleCheck' : 'Clock'} size={18} className="mt-0.5 flex-none text-primary" />
                  {app.user_c?.Id ? `Account ready: ${app.user_c.Name}` : 'Invite sent. Waiting for them to set up their account.'}
                </li>
                <li className="flex gap-2.5">
                  <ApperIcon name="Home" size={18} className="mt-0.5 flex-none text-primary" />
                  <span>
                    Add or open <span className="font-medium">{app.communityName_c}</span> in{' '}
                    <Link to="/admin/communities" className="font-medium text-primary underline-offset-2 hover:underline">Communities</Link> and link them as its ambassador.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <ApperIcon name="Landmark" size={18} className="mt-0.5 flex-none text-primary" />
                  Collect their ID and bank details before the first payout.
                </li>
              </ul>
            </section>
          )}
        </div>

        <section className="space-y-5 rounded-[22px] bg-card p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">Review</h2>
            <ol className="mt-4">
              {steps.map((s, i) => (
                <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < steps.length - 1 && <span aria-hidden className={cn('absolute left-[11px] top-7 h-[calc(100%-1.75rem)] w-0.5 rounded-full', s.done ? 'bg-primary' : 'bg-border')} />}
                  <span
                    className={cn(
                      'flex size-6 flex-none items-center justify-center rounded-full border-2',
                      s.stop ? 'border-muted-foreground bg-muted-foreground text-card' : s.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
                    )}
                  >
                    {s.done && <ApperIcon name={s.stop ? 'X' : 'Check'} size={13} />}
                  </span>
                  <div className="pt-0.5">
                    <p className={cn('text-sm', s.done ? 'font-medium text-foreground' : 'text-muted-foreground')}>{s.label}</p>
                    {s.at && <p className="text-sm text-muted-foreground">{formatLocalDate(s.at, DATE_FORMATS.WITH_TIME)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid gap-2 border-t border-border pt-5">
            <Label htmlFor="app-note">Team note</Label>
            <Textarea id="app-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Spoke on Tuesday. Runs the residents' group; keen on pest control and AC care." />
            <Button variant="outline" size="sm" className="justify-self-start" disabled={busy === 'note' || note.trim() === (app.adminNote_c ?? '')} onClick={() => act('note')}>
              {busy === 'note' ? 'Saving…' : 'Save note'}
            </Button>
          </div>

          <div className="space-y-2.5 border-t border-border pt-5">
            {app.status_c === 'New' && (
              <Button className="w-full" disabled={Boolean(busy)} onClick={() => act('contacted')}>
                <ApperIcon name="PhoneCall" size={16} />
                {busy === 'contacted' ? 'Saving…' : "I've got in touch"}
              </Button>
            )}
            {open && (
              <>
                <Button className="w-full" variant={contacted ? 'default' : 'outline'} disabled={!contacted || Boolean(busy)} onClick={() => setConfirm('approve')}>
                  <ApperIcon name="BadgeCheck" size={16} />
                  {approveLabel}
                </Button>
                {!contacted && <p className="text-center text-xs text-muted-foreground">Get in touch with them first, then approve.</p>}
                <Button className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" variant="ghost" disabled={Boolean(busy)} onClick={() => setConfirm('decline')}>
                  Decline
                </Button>
              </>
            )}
            {!open && (
              <Button className="w-full" variant="outline" disabled={Boolean(busy)} onClick={() => act('reopen')}>
                <ApperIcon name="RotateCcw" size={16} />
                {busy === 'reopen' ? 'Reopening…' : 'Reopen'}
              </Button>
            )}
          </div>
        </section>
      </div>

      <AlertDialog open={confirm === 'approve'} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve {app.Name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {account?.profile === 'Customer_c'
                ? `${account.name}'s neighbour account (${app.email_c}) becomes an ambassador account straight away, and we email them to say so. Their bookings stay as they are.`
                : `We'll email ${app.email_c} an invite to set up their ambassador account.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'approve'}>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                act('approve');
              }}
              disabled={busy === 'approve'}
            >
              {busy === 'approve' ? 'Approving…' : approveLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === 'decline'} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this application?</AlertDialogTitle>
            <AlertDialogDescription>You can reopen it later. Your team note is included in the email if you send one.</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm text-foreground">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="size-4 accent-primary" />
            Email {app.Name.split(' ')[0]} to let them know
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'decline'}>Keep it open</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                act('decline', { notify });
              }}
              disabled={busy === 'decline'}
            >
              {busy === 'decline' ? 'Declining…' : 'Decline'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Fact({ icon, label, children }) {
  return (
    <div className="rounded-2xl bg-muted/50 p-4">
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <ApperIcon name={icon} size={15} className="flex-none" />
        {label}
      </dt>
      <dd className="mt-1.5 font-heading text-lg font-bold leading-snug text-foreground">{children}</dd>
    </div>
  );
}

const ROLE_WORD = { Customer_c: 'a neighbour', Ambassador_c: 'an ambassador', Vendor_c: 'a vendor', Admin_c: 'a Lotmates team' };

/** Whether approving upgrades an existing account or sends an invite, shown before anyone clicks. */
function AccountMatch({ account, loading, approved }) {
  if (loading) {
    return <p className="mt-3 rounded-2xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">Checking for an existing account…</p>;
  }
  if (!account) {
    return (
      <div className="mt-3 flex items-start gap-3 rounded-2xl bg-muted/50 px-4 py-3">
        <ApperIcon name="UserPlus" size={18} className="mt-0.5 flex-none text-primary" />
        <p className="text-sm text-foreground">
          <span className="font-medium">No Lotmates account with this email yet.</span>{' '}
          {approved ? 'They were sent an invite to set one up.' : 'Approving emails them an invite to set one up.'}
        </p>
      </div>
    );
  }
  const blocked = account.profile === 'Vendor_c' || account.profile === 'Admin_c';
  const isNeighbour = account.profile === 'Customer_c';
  return (
    <div className={cn('mt-3 flex flex-col gap-3 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between', blocked ? 'border border-destructive/25 bg-destructive/[0.06]' : 'bg-muted/50')}>
      <div className="flex items-start gap-3">
        <ApperIcon name={blocked ? 'TriangleAlert' : 'UserCheck'} size={18} className={cn('mt-0.5 flex-none', blocked ? 'text-destructive' : 'text-primary')} />
        <p className="text-sm text-foreground">
          <span className="font-medium">
            This email is {ROLE_WORD[account.profile] ?? 'an existing'} account: {account.name}
          </span>
          {isNeighbour && `, joined ${formatLocalDate(account.joined, DATE_FORMATS.SHORT)}, ${account.bookings} paid ${account.bookings === 1 ? 'booking' : 'bookings'}.`}
          {isNeighbour && !approved && ' Approving upgrades this account to an ambassador account.'}
          {account.profile === 'Ambassador_c' && '. They already have ambassador access.'}
          {blocked && '. It can\'t be made an ambassador account. Ask them to apply with a different email.'}
        </p>
      </div>
      {(isNeighbour || account.profile === 'Ambassador_c') && (
        <Button asChild variant="outline" size="sm" className="flex-none self-start sm:self-center">
          <Link to={`/admin/neighbours/${account.id}`}>View account</Link>
        </Button>
      )}
    </div>
  );
}
