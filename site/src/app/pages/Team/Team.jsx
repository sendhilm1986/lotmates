import { useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatRelativeTime } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import PageHeader from '@/components/PageHeader';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { PROFILES } from '@/services/userPermissions';

export const route = { path: '/admin/team', layout: 'owner', access: "profile === 'Admin_c'" };
export const nav = { icon: 'UsersRound', label: 'Team', order: 95, profiles: ['Admin_c'] };

const ROLE_OPTIONS = [
  { name: 'Admin_c', label: 'Lotmates team' },
  { name: 'Vendor_c', label: 'Vendor' },
  { name: 'Ambassador_c', label: 'Ambassador' },
];

const roleLabel = (name) => ROLE_OPTIONS.find((r) => r.name === name)?.label ?? PROFILES[name]?.label ?? String(name ?? '').replace(/_c$/, '');

function errText(e) {
  return e?.message || e?.error?.message || 'Something went wrong. Try again.';
}

export default function Team() {
  const me = useSelector((s) => s.user.user);
  const myEmail = String(me?.emailAddress ?? me?.email ?? '').toLowerCase();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Admin_c');
  const [emailError, setEmailError] = useState('');
  const [sending, setSending] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const members = useFetch(async () => {
    const r = await sdk.teams.getMembers(0, 100);
    return r?.data ?? [];
  }, []);

  const invites = useFetch(async () => {
    const r = await sdk.teams.getInvitedMembers(0, 100);
    return r?.data ?? [];
  }, []);

  async function invite(e) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError('Enter an email address, like hello@lotmates.in');
      return;
    }
    setSending(true);
    try {
      const res = await sdk.teams.inviteUsers({ invitations: [{ email: value, profileName: role }] });
      if (res?.existing) {
        toast.success(res.message);
        members.run();
      } else {
        toast.success(res?.resent ? `Invite sent again to ${value} as ${roleLabel(role)}` : `Invite sent to ${value} as ${roleLabel(role)}`);
        invites.run();
      }
      setEmail('');
    } catch (err) {
      toast.error(errText(err));
    } finally {
      setSending(false);
    }
  }

  async function changeRole(member, next) {
    setBusyId(member.id);
    try {
      await sdk.teams.updateMemberProfile(member.id, { profile: next });
      toast.success(`${member.name || member.email} is now ${roleLabel(next)}`);
      members.run();
    } catch (err) {
      toast.error(errText(err));
    } finally {
      setBusyId(null);
    }
  }

  async function resend(row) {
    setBusyId(`i-${row.invitationId}`);
    try {
      await sdk.teams.resendInvitation(row.invitationId);
      toast.success(`Invite resent to ${row.invitedEmail}`);
      invites.run();
    } catch (err) {
      toast.error(errText(err));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusyId('remove');
    try {
      if (removing.kind === 'member') {
        await sdk.teams.deleteMember(removing.row.id);
        toast.success(`Removed ${removing.row.name || removing.row.email}`);
        members.run();
      } else {
        await sdk.teams.deleteInvitation(removing.row.invitationId);
        toast.success(`Cancelled the invite to ${removing.row.invitedEmail}`);
        invites.run();
      }
      setRemoving(null);
    } catch (err) {
      toast.error(errText(err));
    } finally {
      setBusyId(null);
    }
  }

  const memberRows = members.data ?? [];
  const inviteRows = invites.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title="Team" description="Invite the Lotmates team, vendors and ambassadors, and choose what each can do. Neighbours sign up on their own." />

      <section className="rounded-[22px] bg-card p-6 shadow-sm md:p-7">
        <h2 className="font-heading text-lg font-bold text-foreground">Invite someone</h2>
        <p className="mt-1 text-sm text-muted-foreground">They get an email with a link to set their name and password. The link works once and lasts 7 days. Someone who already has an account gets the new access straight away.</p>
        <form onSubmit={invite} className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="team-email">Email</Label>
            <Input
              id="team-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              placeholder="hello@lotmates.in"
              aria-invalid={Boolean(emailError)}
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.name} value={r.name}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={sending}>
            {sending ? <ApperIcon name="LoaderCircle" size={16} className="animate-spin" /> : <ApperIcon name="Send" size={16} />}
            {sending ? 'Sending…' : 'Send invite'}
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          After a vendor or ambassador accepts, link them to their vendor record or community record so they see their jobs or communities.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-foreground">Members</h2>
        {members.error ? (
          <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-6 text-center">
            <p className="text-sm text-muted-foreground">Couldn't load members: {errText(members.error)}</p>
            <Button variant="outline" onClick={members.run}>Try again</Button>
          </div>
        ) : members.loading && members.data === undefined ? (
          <ListSkeleton rows={3} />
        ) : memberRows.length === 0 ? (
          <p className="rounded-[22px] bg-card shadow-sm p-6 text-center text-sm text-muted-foreground">No members yet. Invite someone above.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm">
            {memberRows.map((m) => {
              const isMe = myEmail && String(m.email ?? '').toLowerCase() === myEmail;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-3 px-5 py-4">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {(m.name || m.email || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-[10rem] flex-1">
                    <p className="truncate font-medium text-foreground">
                      {m.name || m.email}
                      {isMe ? <span className="ml-2 text-sm font-normal text-muted-foreground">You</span> : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{m.email}</p>
                  </div>
                  <Select value={m.profile?.name} onValueChange={(v) => changeRole(m, v)} disabled={isMe || m.isOwner || busyId === m.id}>
                    <SelectTrigger className="w-40" aria-label={`Role for ${m.email}`}>
                      <SelectValue placeholder={roleLabel(m.profile?.name)} />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.name} value={r.name}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setRemoving({ kind: 'member', row: m })}
                    disabled={isMe || m.isOwner}
                    aria-label={`Remove ${m.email}`}
                  >
                    <ApperIcon name="Trash2" size={16} />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-foreground">Pending invites</h2>
        {invites.error ? (
          <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-6 text-center">
            <p className="text-sm text-muted-foreground">Couldn't load invites: {errText(invites.error)}</p>
            <Button variant="outline" onClick={invites.run}>Try again</Button>
          </div>
        ) : invites.loading && invites.data === undefined ? (
          <ListSkeleton rows={2} />
        ) : inviteRows.length === 0 ? (
          <p className="rounded-[22px] bg-card shadow-sm p-6 text-center text-sm text-muted-foreground">No invites waiting.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm">
            {inviteRows.map((row) => (
              <li key={row.invitationId} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{row.invitedEmail}</p>
                  <p className="text-sm text-muted-foreground">
                    {roleLabel(row.profile?.name)}, invited {row.createdOn ? formatRelativeTime(row.createdOn) : 'recently'}
                    {row.invitationCount > 1 ? `, sent ${row.invitationCount} times` : ''}
                  </p>
                </div>
                <div className="flex flex-none gap-2">
                  <Button variant="outline" onClick={() => resend(row)} disabled={busyId === `i-${row.invitationId}`} className="h-10 rounded-full px-4">
                    Resend
                  </Button>
                  <Button variant="ghost" className="h-10 rounded-full px-4 text-muted-foreground hover:text-destructive" onClick={() => setRemoving({ kind: 'invite', row })}>
                    Cancel invite
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog open={Boolean(removing)} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removing?.kind === 'member' ? `Remove ${removing.row.name || removing.row.email}?` : `Cancel the invite to ${removing?.row.invitedEmail}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.kind === 'member'
                ? 'They lose this access straight away and are signed out. Their account stays as a neighbour account, so bookings and records keep their owner.'
                : 'The link in their email stops working. You can invite them again later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId === 'remove'}>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmRemove();
              }}
              disabled={busyId === 'remove'}
            >
              {removing?.kind === 'member' ? 'Remove member' : 'Cancel invite'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
