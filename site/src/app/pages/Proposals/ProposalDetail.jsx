import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { formatRelativeTime, formatLocalDate, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { categoryLabel, categoryIcon } from '@/services/dealRules';
import { cn } from '@/lib/utils';
import { PROPOSAL_FIELDS, PROPOSAL_STATUS, PROPOSAL_STYLES, userIdOf, sameId, proposalCategory } from '@/services/records';
import ProposalDialog from './ProposalDialog';

export const route = { path: '/proposals/:id', layout: 'owner', access: "['Admin_c','Ambassador_c'].includes(profile)" };

export default function ProposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const user = useSelector((s) => s.user.user);
  const isAdmin = profile === 'Admin_c';
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [status, setStatus] = useState('New');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');

  const { data: proposal, loading, error, run } = useFetch(() => {
    return sdk.table('proposals_c').select(PROPOSAL_FIELDS).get(id).then((r) => r.data);
  }, [id]);

  const { data: thread, run: runThread } = useFetch(async () => {
    const r = await sdk.proposals.thread(id);
    if (!r.ok) throw new Error(r.error.message);
    return r.value.data ?? [];
  }, [id]);

  useEffect(() => {
    if (!proposal) return;
    setStatus(proposal.status_c ?? 'New');
    setNote('');
  }, [proposal]);

  const back = { to: '/proposals', label: 'Back to Proposals' };

  if (loading && proposal === undefined) {
    return (
      <div className="space-y-4">
        <PageHeader title="Proposal" back={back} />
        <DetailSkeleton />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Proposal" back={back} />
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load this proposal: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!proposal) return <PageHeader title="Proposal not found" back={back} description="It may have been removed." />;

  const mine = sameId(proposal.Owner?.Id, userIdOf(user));
  const canEdit = isAdmin || (mine && proposal?.status_c === 'New');

  async function saveReview() {
    setBusy('review');
    try {
      const r = await sdk.proposals.reply(proposal.Id, { body: note.trim(), status });
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      toast.success('Added to the timeline and emailed to the ambassador.');
      setNote('');
      run();
      runThread();
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    setBusy('delete');
    try {
      const res = await sdk.table('proposals_c').remove(proposal.Id);
      if (res.messages?.length) toast.error(res.messages[0]);
      if (res.success === false && !res.data?.length) return;
      toast.success('Proposal deleted');
      setDeleteOpen(false);
      navigate('/proposals');
    } finally {
      setBusy('');
    }
  }

  const isNewCategory = proposal.category_c === 'Other';
  const unlisted = !proposal.community_c?.Id && Boolean(proposal.newCommunity_c);
  const who = mine ? 'You' : proposal.Owner?.Name ?? 'Ambassador';
  const changed = status !== (proposal.status_c ?? 'New') || note.trim() !== '';

  return (
    <div className="space-y-6">
      <PageHeader
        title={proposal.Name}
        back={back}
        actions={
          canEdit ? (
            <>
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <StatusBadge value={proposal.status_c} styles={PROPOSAL_STYLES} />
          <span>Proposed by <span className="font-medium text-foreground">{who}</span>, {formatRelativeTime(proposal.CreatedOn)}</span>
        </div>
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
        <section className="rounded-[22px] bg-card p-5 shadow-sm sm:p-6">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Fact icon="Users" label="Homes interested">
              <span className="font-heading text-3xl font-bold tabular-nums">{proposal.homesInterested_c ?? '?'}</span>
              <span className="ml-1.5 font-sans text-sm font-normal text-muted-foreground">homes</span>
            </Fact>
            <Fact icon={isNewCategory ? 'Tag' : categoryIcon(proposal.category_c)} label="Category" tag={isNewCategory ? 'New category' : null}>
              {proposalCategory(proposal, categoryLabel)}
            </Fact>
            <Fact icon="Home" label="Community" tag={unlisted ? 'Not on Lotmates yet' : null}>
              {proposal.community_c?.Id && isAdmin ? (
                <Link to={`/admin/communities/${proposal.community_c.Id}`} className="text-primary underline-offset-2 hover:underline">{proposal.community_c.Name}</Link>
              ) : (
                proposal.community_c?.Name ?? proposal.newCommunity_c ?? 'Not given'
              )}
              {unlisted && proposal.newLocality_c && <span className="mt-0.5 block font-sans text-sm font-normal text-muted-foreground">{proposal.newLocality_c}</span>}
            </Fact>
            <Fact icon="UserRound" label="Proposed by">
              {who}
              <span className="mt-0.5 block font-sans text-sm font-normal text-muted-foreground">{formatLocalDate(proposal.CreatedOn, DATE_FORMATS.SHORT)}</span>
            </Fact>
          </dl>

          <ContactPanel proposal={proposal} isAdmin={isAdmin} mine={mine} />

        </section>

        <Timeline
          proposal={proposal}
          thread={thread}
          mine={mine}
          isAdmin={isAdmin}
          onReplied={() => {
            run();
            runThread();
          }}
        />
        </div>

        {isAdmin ? (
          <section className="space-y-5 rounded-[22px] bg-card p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground">Reply to the ambassador</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your note goes on the timeline, and the ambassador gets it by email.</p>
            </div>
            <div className="grid gap-2">
              <Label id="pp-status">Status</Label>
              <div role="radiogroup" aria-labelledby="pp-status" className="grid grid-cols-2 gap-2">
                {PROPOSAL_STATUS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={status === s}
                    onClick={() => setStatus(s)}
                    className={cn(
                      'h-10 rounded-full border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      status === s ? PROPOSAL_STYLES[s] : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pp-note">Add a note</Label>
              <Textarea id="pp-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Asking two vendors for tier prices" />
            </div>
            <Button className="w-full" onClick={saveReview} disabled={busy === 'review' || !changed}>{busy === 'review' ? 'Sending…' : 'Send reply'}</Button>

            {(unlisted || isNewCategory || proposal.status_c === 'Accepted') && (
              <div className="space-y-3 border-t border-border pt-5">
                <h3 className="text-sm font-semibold text-foreground">Before a deal can go live</h3>
                <ul className="space-y-2.5 text-sm text-foreground">
                  {unlisted && (
                    <li className="flex gap-2.5">
                      <ApperIcon name="Home" size={16} className="mt-0.5 flex-none text-primary" />
                      <span>Add <span className="font-medium">{proposal.newCommunity_c}</span> to <Link to="/admin/communities" className="font-medium text-primary underline-offset-2 hover:underline">Communities</Link> and link this ambassador to it.</span>
                    </li>
                  )}
                  {isNewCategory && (
                    <li className="flex gap-2.5">
                      <ApperIcon name="Tag" size={16} className="mt-0.5 flex-none text-primary" />
                      <span>"{proposal.newCategory_c}" isn't a category yet. Run it under the closest one, or ask for the category to be added.</span>
                    </li>
                  )}
                </ul>
                {proposal.status_c === 'Accepted' && (
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/admin/deals/new">
                      <ApperIcon name="Plus" size={16} />
                      Draft the deal
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-6 rounded-[22px] bg-card p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
            <div>
              <h2 className="font-heading text-lg font-bold text-foreground">Where it stands</h2>
              <StatusSteps proposal={proposal} />
            </div>
            {proposal.status_c === 'New' && (
              <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">You can edit or delete it until the team starts reviewing.</p>
            )}
          </section>
        )}
      </div>

      {canEdit && (
        <>
          <ProposalDialog open={editOpen} onOpenChange={setEditOpen} record={proposal} onSaved={run} />
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this proposal?</AlertDialogTitle>
                <AlertDialogDescription>The team's notes on it are deleted too.</AlertDialogDescription>
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
                  {busy === 'delete' ? 'Deleting…' : 'Delete proposal'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
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

function ContactPanel({ proposal, isAdmin, mine }) {
  const phone = proposal.contactPref_c === 'Phone' && proposal.contactPhone_c;
  const email = proposal.contactEmail_c;
  if (!phone && !email) return null;
  const who = mine ? 'you' : proposal.Owner?.Name ?? 'them';
  return (
    <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ApperIcon name={phone ? 'Phone' : 'Mail'} size={15} className="flex-none text-primary" />
          {isAdmin ? `Prefers ${phone ? 'a phone call' : 'email'}` : `The team will reach ${who} by ${phone ? 'phone' : 'email'}`}
        </p>
        <p className="mt-1 truncate font-heading text-lg font-bold text-foreground">{phone || email}</p>
        {phone && email && <p className="mt-0.5 truncate text-sm text-muted-foreground">Email: {email}</p>}
      </div>
      {isAdmin && (
        <div className="flex flex-none gap-2">
          {phone && (
            <Button asChild>
              <a href={`tel:${phone.replace(/[\s-]/g, '')}`}>
                <ApperIcon name="Phone" size={16} />
                Call
              </a>
            </Button>
          )}
          {email && (
            <Button variant={phone ? 'outline' : 'default'} asChild>
              <a href={`mailto:${email}?subject=${encodeURIComponent(`Your Lotmates proposal: ${proposal.Name}`)}`}>
                <ApperIcon name="Mail" size={16} />
                Email
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function StatusSteps({ proposal }) {
  const declined = proposal.status_c === 'Declined';
  const cur = { New: 0, Reviewing: 1, Accepted: 2, Declined: 2 }[proposal.status_c] ?? 0;
  const steps = [
    { label: 'Sent to the team', sub: formatLocalDate(proposal.CreatedOn, DATE_FORMATS.SHORT) },
    { label: 'Under review', sub: 'The team talks to vendors about prices' },
    declined
      ? { label: 'Not going ahead', sub: 'The team isn\'t taking it forward this time' }
      : { label: 'Accepted', sub: 'The team sets up the deal for your community' },
  ];
  return (
    <ol className="mt-4">
      {steps.map((st, i) => {
        const done = i < cur;
        const now = i === cur;
        const stop = now && declined;
        return (
          <li key={st.label} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className={cn('absolute left-[11px] top-7 h-[calc(100%-1.75rem)] w-0.5 rounded-full', done ? 'bg-primary' : 'bg-border')} />}
            <span
              className={cn(
                'relative flex size-6 flex-none items-center justify-center rounded-full border-2',
                stop ? 'border-muted-foreground bg-muted-foreground text-card' : done || now ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
                now && !stop && 'ring-4 ring-primary/15',
              )}
            >
              {stop ? <ApperIcon name="X" size={13} /> : done || (now && i === steps.length - 1) ? <ApperIcon name="Check" size={13} /> : now ? <span className="size-2 rounded-full bg-primary-foreground" /> : null}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn('text-sm', now ? 'font-semibold text-foreground' : done ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {st.label}
                {now && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Now</span>}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{st.sub}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const STATUS_WORDS = { New: 'Back in the queue', Reviewing: 'Under review', Accepted: 'Accepted', Declined: 'Not going ahead' };

/** Everything that happened on a proposal, oldest first, with a box for the ambassador to add an update. */
function Timeline({ proposal, thread, mine, isAdmin, onReplied }) {
  const [body, setBody] = useState('');
  const [homes, setHomes] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  const items = thread ?? [];
  const firstChange = items.find((e) => e.homesTo != null);
  const startHomes = firstChange ? firstChange.homesFrom : proposal.homesInterested_c;
  const sender = mine ? 'You' : proposal.Owner?.Name ?? 'Ambassador';
  const entries = [
    { id: 'sent', kind: 'sent', author: sender, role: 'Ambassador', at: proposal.CreatedOn, body: proposal.notes_c, homesTo: startHomes },
    ...items.map((e) => ({ ...e, kind: 'note' })),
  ];
  const canUpdate = mine && !isAdmin;

  async function send(e) {
    e.preventDefault();
    setErr('');
    const h = homes.trim();
    if (!body.trim() && !h) {
      setErr('Write an update or enter the new number of homes.');
      return;
    }
    if (h && (!/^\d+$/.test(h) || Number(h) < 1)) {
      setErr('Enter how many homes are interested now, at least 1.');
      return;
    }
    setSending(true);
    try {
      const r = await sdk.proposals.reply(proposal.Id, { body: body.trim(), homes: h ? Number(h) : null });
      if (!r.ok) {
        setErr(r.error.message);
        return;
      }
      toast.success('Update sent to the Lotmates team');
      setBody('');
      setHomes('');
      onReplied?.();
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-[22px] bg-card p-5 shadow-sm sm:p-6" aria-labelledby="pp-timeline">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="pp-timeline" className="font-heading text-lg font-bold text-foreground">Timeline</h2>
        <span className="text-sm text-muted-foreground">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
      </div>

      <ol className="mt-5">
        {entries.map((e, i) => {
          const team = e.role === 'Team';
          const you = !team && mine;
          const icon = e.kind === 'sent' ? 'Send' : team ? 'MessageSquare' : e.body ? 'MessageCircle' : 'Users';
          return (
            <li key={e.id} className="relative flex gap-3.5 pb-6 last:pb-0">
              {i < entries.length - 1 && <span aria-hidden className="absolute left-[17px] top-10 h-[calc(100%-2.5rem)] w-0.5 rounded-full bg-border" />}
              <span
                aria-hidden
                className={cn(
                  'flex size-9 flex-none items-center justify-center rounded-full',
                  team ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                )}
              >
                <ApperIcon name={icon} size={16} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-foreground">{team ? e.author || 'Lotmates team' : you ? 'You' : e.author}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', team ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                    {team ? 'Lotmates team' : 'Ambassador'}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  <time dateTime={e.at} title={e.at ? formatRelativeTime(e.at) : undefined}>{e.at ? formatLocalDate(e.at, DATE_FORMATS.WITH_TIME) : ''}</time>
                  {e.kind === 'sent' ? ', sent the proposal' : ''}
                </p>

                {(e.status || (e.kind === 'note' && e.homesTo != null) || (e.kind === 'sent' && e.homesTo != null)) && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {e.status && (
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', PROPOSAL_STYLES[e.status])}>
                        <ApperIcon name="Flag" size={12} />
                        {STATUS_WORDS[e.status] ?? e.status}
                      </span>
                    )}
                    {e.kind === 'note' && e.homesTo != null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-highlight/30 px-2.5 py-1 text-xs font-semibold text-foreground">
                        <ApperIcon name={e.homesFrom != null && e.homesTo < e.homesFrom ? 'TrendingDown' : 'TrendingUp'} size={12} />
                        Homes interested: {e.homesFrom ?? '?'} → {e.homesTo}
                      </span>
                    )}
                    {e.kind === 'sent' && e.homesTo != null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
                        <ApperIcon name="Users" size={12} />
                        {e.homesTo} homes interested
                      </span>
                    )}
                  </div>
                )}

                {e.body ? (
                  <p
                    className={cn(
                      'mt-2.5 whitespace-pre-line rounded-2xl border px-4 py-3 text-[15px] leading-6 text-foreground',
                      team ? 'border-primary/20 bg-primary/[0.06]' : 'border-border bg-muted/40',
                    )}
                  >
                    {e.body}
                  </p>
                ) : e.kind === 'sent' ? (
                  <p className="mt-2 text-sm text-muted-foreground">No notes with the proposal.</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {!items.some((e) => e.role === 'Team') && (
        <p className="mt-5 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
          {isAdmin ? 'No reply from the team yet. Use the panel on the right to reply.' : "No reply from the team yet. You'll get an email when they reply."}
        </p>
      )}

      {canUpdate && (
        <form onSubmit={send} className="mt-6 space-y-3 border-t border-border pt-5">
          <div className="grid gap-1.5">
            <Label htmlFor="pp-update">Add an update</Label>
            <Textarea
              id="pp-update"
              rows={3}
              value={body}
              onChange={(ev) => setBody(ev.target.value)}
              placeholder="e.g. Two more blocks want to join, or a few homes have dropped out"
              maxLength={2000}
            />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pp-homes-now">Homes interested now (optional)</Label>
              <Input
                id="pp-homes-now"
                type="number"
                min={1}
                inputMode="numeric"
                value={homes}
                onChange={(ev) => setHomes(ev.target.value)}
                placeholder={proposal.homesInterested_c ? String(proposal.homesInterested_c) : 'e.g. 40'}
                className="w-44"
              />
            </div>
            <Button type="submit" disabled={sending}>
              <ApperIcon name="Send" size={16} />
              {sending ? 'Sending…' : 'Send update'}
            </Button>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <p className="text-xs text-muted-foreground">The Lotmates team gets your update by email.</p>
        </form>
      )}
    </section>
  );
}
