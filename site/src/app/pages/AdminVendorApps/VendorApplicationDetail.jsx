import { useEffect, useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
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
import { categoryLabel } from '@/services/dealRules';
import { VAPP_FIELDS, VENDOR_QA, unwrapList } from '@/services/records';

export const route = { path: '/admin/vendor-applications/:id', layout: 'owner', access: "profile === 'Admin_c'" };

const { isIn } = window.ApperSDK.CoreSDK;
const STATE_COPY = { passed: 'Passed', failed: 'Failed', na: 'Not needed', pending: 'Not done' };

export default function VendorApplicationDetail() {
  const { id } = useParams();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [notify, setNotify] = useState(true);

  const { data: app, loading, error, run } = useFetch(() => sdk.table('vendorApps_c').select(VAPP_FIELDS).get(id).then((r) => r.data), [id]);

  const { data: account, run: runAccount } = useFetch(async () => {
    if (!app?.email_c) return null;
    const r = await sdk.neighbours.lookup(app.email_c);
    return r.ok ? r.value.data : null;
  }, [app?.email_c]);

  const locIds = (app?.localityIds_c ? String(app.localityIds_c).split(',') : []).filter(Boolean);
  const { data: localities } = useFetch(() => (locIds.length ? sdk.table('localities_c').select(['Name']).where(isIn('Id', locIds)).fetch().then(unwrapList) : Promise.resolve([])), [locIds.join(',')]);

  useEffect(() => {
    if (app) setNote(app.adminNote_c ?? '');
  }, [app]);

  const qa = useMemo(() => {
    try {
      return JSON.parse(app?.qa_c || '{}');
    } catch {
      return {};
    }
  }, [app?.qa_c]);

  const back = { to: '/admin/vendor-applications', label: 'Back to vendor applications' };
  if (loading && !app) {
    return (
      <div className="space-y-4">
        <PageHeader title="Vendor application" back={back} />
        <DetailSkeleton />
      </div>
    );
  }
  if (error || !app) {
    return <PageHeader title="Application not found" back={back} description={error ? String(error.message ?? error) : 'It may have been removed.'} />;
  }

  async function act(action, extra = {}) {
    setBusy(action + (extra.key ?? ''));
    try {
      const r = await sdk.vendorApps.decide(app.Id, action, { note: action === 'check' ? extra.note : note.trim(), ...extra });
      if (!r.ok) {
        toast.error(r.error.message);
        return false;
      }
      toast.success(r.value?.data?.message ?? 'Saved');
      setConfirm(null);
      run();
      runAccount();
      return true;
    } finally {
      setBusy('');
    }
  }

  const open = ['New', 'Contacted', 'Checking'].includes(app.status_c);
  const contacted = Boolean(app.contactedOn_c);
  const settled = VENDOR_QA.filter((c) => ['passed', 'na'].includes(qa[c.key]?.state)).length;
  const failed = VENDOR_QA.some((c) => qa[c.key]?.state === 'failed');
  const ready = contacted && settled === VENDOR_QA.length;
  const prefersPhone = app.contactPref_c !== 'Email';
  const category = app.category_c === 'Other' ? app.newCategory_c : categoryLabel(app.category_c);
  const areas = [...(localities ?? []).map((l) => l.Name), app.areasOther_c].filter(Boolean).join(', ');
  const blocked = account && ['Admin_c', 'Ambassador_c'].includes(account.profile);
  const upgrading = account?.profile === 'Customer_c';

  return (
    <div className="space-y-6">
      <PageHeader title={app.Name} back={back}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <StatusBadge value={app.status_c} />
          <span>{category}</span>
          <span>Applied {formatRelativeTime(app.CreatedOn)}</span>
        </div>
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-[22px] bg-card p-5 shadow-sm sm:p-6">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Fact icon="Tag" label="Offers" tag={app.category_c === 'Other' ? 'New category' : null}>{category}</Fact>
              <Fact icon="MapPin" label="Areas">{areas || <span className="text-muted-foreground">Not given</span>}</Fact>
              <Fact icon="Users" label="Team and capacity">
                {app.teamSize_c ? `${app.teamSize_c} people` : 'Team size not given'}
                <span className="mt-0.5 block font-sans text-sm font-normal text-muted-foreground">
                  {app.capacity_c ? `${app.capacity_c} homes a week` : 'Capacity not given'}
                  {app.years_c != null ? `, ${app.years_c} ${app.years_c === 1 ? 'year' : 'years'} in business` : ''}
                </span>
              </Fact>
              <Fact icon="Receipt" label="GST">
                {app.gstin_c || <span className="text-muted-foreground">Not registered or not given</span>}
                {app.website_c && (
                  <a href={app.website_c} target="_blank" rel="noreferrer noopener" className="mt-0.5 block truncate font-sans text-sm font-normal text-primary underline-offset-2 hover:underline">
                    {app.website_c.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </Fact>
            </dl>

            <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ApperIcon name={prefersPhone ? 'Phone' : 'Mail'} size={15} className="flex-none text-primary" />
                  {app.contactName_c} prefers {prefersPhone ? 'a phone call' : 'email'}
                </p>
                <p className="mt-1 truncate font-heading text-lg font-bold text-foreground">{prefersPhone ? app.phone_c : app.email_c}</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{prefersPhone ? app.email_c : app.phone_c}</p>
              </div>
              <div className="flex flex-none gap-2">
                <Button asChild variant={prefersPhone ? 'default' : 'outline'}>
                  <a href={`tel:${String(app.phone_c).replace(/[\s-]/g, '')}`}>
                    <ApperIcon name="Phone" size={16} />
                    Call
                  </a>
                </Button>
                <Button asChild variant={prefersPhone ? 'outline' : 'default'}>
                  <a href={`mailto:${app.email_c}?subject=${encodeURIComponent('Your Lotmates vendor application')}`}>
                    <ApperIcon name="Mail" size={16} />
                    Email
                  </a>
                </Button>
              </div>
            </div>

            {account && (
              <div className={cn('mt-3 flex items-start gap-3 rounded-2xl px-4 py-3', blocked ? 'border border-destructive/25 bg-destructive/[0.06]' : 'bg-muted/50')}>
                <ApperIcon name={blocked ? 'TriangleAlert' : 'UserCheck'} size={18} className={cn('mt-0.5 flex-none', blocked ? 'text-destructive' : 'text-primary')} />
                <p className="text-sm text-foreground">
                  <span className="font-medium">This email already has a Lotmates account: {account.name}.</span>{' '}
                  {upgrading && 'Approving turns it into a vendor account, so they won\'t be able to book deals as a neighbour with it.'}
                  {account.profile === 'Vendor_c' && 'It is already a vendor account.'}
                  {blocked && 'It is a team or ambassador account and can\'t become a vendor. Ask them to apply with a different email.'}
                </p>
              </div>
            )}

            <div className="mt-6 grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">What they do</h2>
                <p className="mt-1.5 whitespace-pre-line text-[15px] leading-6 text-foreground">{app.services_c}</p>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Licences they listed</h2>
                <p className={cn('mt-1.5 whitespace-pre-line text-[15px] leading-6', app.licences_c ? 'text-foreground' : 'text-muted-foreground')}>{app.licences_c || 'None listed.'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[22px] bg-card p-5 shadow-sm sm:p-6" aria-labelledby="qa-title">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 id="qa-title" className="font-heading text-lg font-bold text-foreground">Quality checks</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">Every check must pass, or be marked not needed, before approval.</p>
              </div>
              <span className={cn('rounded-full px-3 py-1 text-sm font-semibold tabular-nums', failed ? 'bg-destructive/10 text-destructive' : settled === VENDOR_QA.length ? 'bg-success/12 text-success' : 'bg-muted text-foreground')}>
                {settled} of {VENDOR_QA.length} done
              </span>
            </div>
            {!contacted && open && (
              <p className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">Get in touch with them first. The checks unlock once you mark the application as contacted.</p>
            )}
            <ul className="mt-5 divide-y divide-border">
              {VENDOR_QA.map((c) => (
                <QaRow key={c.key} check={c} entry={qa[c.key]} disabled={!open || !contacted} busy={busy === `check${c.key}`} onSet={(state, n) => act('check', { key: c.key, state, note: n })} />
              ))}
            </ul>
          </section>

          {app.status_c === 'Approved' && (
            <section className="rounded-[22px] bg-card p-5 shadow-sm sm:p-6">
              <h2 className="font-heading text-lg font-bold text-foreground">After approval</h2>
              <ul className="mt-3 space-y-2.5 text-[15px] text-foreground">
                <li className="flex gap-2.5">
                  <ApperIcon name="Store" size={18} className="mt-0.5 flex-none text-primary" />
                  <span>
                    Vendor record created on probation.{' '}
                    {app.vendor_c?.Id && <Link to={`/admin/vendors/${app.vendor_c.Id}`} className="font-medium text-primary underline-offset-2 hover:underline">Open {app.vendor_c.Name}</Link>}
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <ApperIcon name={app.user_c?.Id ? 'CircleCheck' : 'Clock'} size={18} className="mt-0.5 flex-none text-primary" />
                  {app.user_c?.Id ? `Account ready: ${app.user_c.Name}` : 'Invite sent. Waiting for them to set up their account.'}
                </li>
                <li className="flex gap-2.5">
                  <ApperIcon name="Tag" size={18} className="mt-0.5 flex-none text-primary" />
                  Plan a smaller first deal with them from Deals.
                </li>
              </ul>
            </section>
          )}
        </div>

        <section className="space-y-5 rounded-[22px] bg-card p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">Review</h2>
            <ol className="mt-4">
              {[
                { label: 'Applied', done: true, at: app.CreatedOn },
                { label: 'Got in touch', done: contacted, at: app.contactedOn_c },
                { label: `Checks ${settled}/${VENDOR_QA.length}`, done: settled === VENDOR_QA.length, warn: failed },
                { label: app.status_c === 'Declined' ? 'Declined' : 'Approved', done: ['Approved', 'Declined'].includes(app.status_c), at: app.decidedOn_c, stop: app.status_c === 'Declined' },
              ].map((s, i, arr) => (
                <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < arr.length - 1 && <span aria-hidden className={cn('absolute left-[11px] top-7 h-[calc(100%-1.75rem)] w-0.5 rounded-full', s.done ? 'bg-primary' : 'bg-border')} />}
                  <span
                    className={cn(
                      'flex size-6 flex-none items-center justify-center rounded-full border-2',
                      s.stop || s.warn ? 'border-destructive bg-destructive text-white' : s.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
                    )}
                  >
                    {(s.done || s.warn) && <ApperIcon name={s.stop || s.warn ? 'X' : 'Check'} size={13} />}
                  </span>
                  <div className="pt-0.5">
                    <p className={cn('text-sm', s.done ? 'font-medium text-foreground' : 'text-muted-foreground')}>{s.label}</p>
                    {s.at && <p className="text-sm text-muted-foreground">{formatLocalDate(s.at, DATE_FORMATS.WITH_TIME)}</p>}
                    {s.warn && <p className="text-sm text-destructive">A check failed</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid gap-2 border-t border-border pt-5">
            <Label htmlFor="vapp-note">Team note</Label>
            <Textarea id="vapp-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called on Monday. Test job booked for Thursday at Green Meadows." />
            <Button variant="outline" size="sm" className="justify-self-start" disabled={busy === 'note' || note.trim() === (app.adminNote_c ?? '')} onClick={() => act('note')}>
              {busy === 'note' ? 'Saving…' : 'Save note'}
            </Button>
          </div>

          <div className="space-y-2.5 border-t border-border pt-5">
            {open && !contacted && (
              <Button className="w-full" disabled={Boolean(busy)} onClick={() => act('contacted')}>
                <ApperIcon name="PhoneCall" size={16} />
                {busy === 'contacted' ? 'Saving…' : "I've got in touch"}
              </Button>
            )}
            {open && (
              <>
                <Button className="w-full" variant={ready ? 'default' : 'outline'} disabled={!ready || blocked || Boolean(busy)} onClick={() => setConfirm('approve')}>
                  <ApperIcon name="BadgeCheck" size={16} />
                  Approve vendor
                </Button>
                {!ready && <p className="text-center text-xs text-muted-foreground">{contacted ? 'Finish every check to approve.' : 'Get in touch, then run the checks.'}</p>}
                <Button className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" variant="ghost" disabled={Boolean(busy)} onClick={() => setConfirm('decline')}>
                  Decline
                </Button>
              </>
            )}
            {app.status_c === 'Declined' && (
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
              We&apos;ll add {app.Name} to Vendors on probation and{' '}
              {upgrading ? `turn ${account.name}'s account into a vendor account.` : `email ${app.email_c} an invite to set up their vendor account.`}
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
              {busy === 'approve' ? 'Approving…' : 'Approve vendor'}
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
            Email {String(app.contactName_c || '').split(' ')[0] || 'them'} to let them know
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

/** One check: its state, who recorded it and when, a short note, and buttons to change it. */
function QaRow({ check, entry, disabled, busy, onSet }) {
  const state = entry?.state ?? 'pending';
  const [noteOpen, setNoteOpen] = useState(false);
  const [n, setN] = useState(entry?.note ?? '');
  useEffect(() => setN(entry?.note ?? ''), [entry?.note]);

  const options = [
    { v: 'passed', label: 'Pass', icon: 'Check', on: 'border-success/40 bg-success/12 text-success' },
    { v: 'failed', label: 'Fail', icon: 'X', on: 'border-destructive/40 bg-destructive/10 text-destructive' },
    ...(check.optional ? [{ v: 'na', label: 'Not needed', icon: 'Minus', on: 'border-border bg-muted text-foreground' }] : []),
  ];

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span
            className={cn(
              'flex size-9 flex-none items-center justify-center rounded-full',
              state === 'passed' ? 'bg-success/12 text-success' : state === 'failed' ? 'bg-destructive/10 text-destructive' : state === 'na' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
            )}
          >
            <ApperIcon name={state === 'passed' ? 'Check' : state === 'failed' ? 'X' : check.icon} size={17} />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-foreground">
              {check.label}
              {check.optional && <span className="ml-2 text-xs font-normal text-muted-foreground">Can be not needed</span>}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{check.hint}</p>
            {entry && (
              <p className="mt-1 text-sm text-foreground">
                <span className="font-medium">{STATE_COPY[state]}</span>
                <span className="text-muted-foreground"> by {entry.by}, {formatLocalDate(entry.at, DATE_FORMATS.WITH_TIME)}</span>
              </p>
            )}
            {entry?.note && !noteOpen && <p className="mt-1 whitespace-pre-line rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground">{entry.note}</p>}
          </div>
        </div>
        <div className="flex flex-none flex-wrap gap-1.5 sm:justify-end">
          {options.map((o) => (
            <button
              key={o.v}
              type="button"
              disabled={disabled || busy}
              aria-pressed={state === o.v}
              onClick={() => onSet(state === o.v ? 'pending' : o.v, n.trim())}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                state === o.v ? o.on : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <ApperIcon name={o.icon} size={14} />
              {o.label}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setNoteOpen((v) => !v)}
            aria-label={`Note on ${check.label}`}
            className="inline-flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ApperIcon name="StickyNote" size={15} />
          </button>
        </div>
      </div>
      {noteOpen && (
        <div className="mt-3 flex gap-2 sm:pl-12">
          <Input value={n} onChange={(e) => setN(e.target.value)} placeholder="e.g. Licence no. TN-PC-2291, valid to March 2028" className="h-10" maxLength={300} />
          <Button
            size="sm"
            className="h-10"
            disabled={busy || state === 'pending'}
            title={state === 'pending' ? 'Pass or fail the check first' : undefined}
            onClick={() => {
              onSet(state, n.trim());
              setNoteOpen(false);
            }}
          >
            Save
          </Button>
        </div>
      )}
    </li>
  );
}

function Fact({ icon, label, tag, children }) {
  return (
    <div className="rounded-2xl bg-muted/50 p-4">
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <ApperIcon name={icon} size={15} className="flex-none" />
        {label}
      </dt>
      <dd className="mt-1.5 font-heading text-lg font-bold leading-snug text-foreground">{children}</dd>
      {tag && <dd className="mt-2"><span className="inline-block rounded-md bg-highlight/30 px-2 py-0.5 text-xs font-semibold text-foreground">{tag}</span></dd>}
    </div>
  );
}
