import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { sdk } from '@/services/sdk';
import { setUser } from '@/store/userSlice';
import { AUTH_PROFILES } from '@/config/app.config';
import ApperIcon from '@/components/ApperIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const ICON = { Admin_c: 'ShieldCheck', Vendor_c: 'Store', Ambassador_c: 'Megaphone' };
const WHAT = {
  Admin_c: 'Run deals, vendors and refunds.',
  Vendor_c: 'See your jobs, deals and payouts.',
  Ambassador_c: "Follow your community's deals and earnings.",
};

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [invite, setInvite] = useState(null);
  const [problem, setProblem] = useState(token ? null : 'This link is missing its invite code. Open the link from your email again.');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    sdk.teams.getInvite(token).then((r) => (r.ok ? setInvite(r.value) : setProblem(r.error.message)));
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    const r = await sdk.teams.acceptInvite({ token, firstName: first.trim(), lastName: last.trim(), password });
    setBusy(false);
    if (!r.ok) return setError(r.error.message);
    dispatch(setUser(r.value));
    const home = AUTH_PROFILES.find((p) => p.name === r.value?.profile)?.redirectAfterAuth ?? '/';
    navigate(home, { replace: true });
  }

  return (
    <div className="flex min-h-[calc(100svh-4.5rem)] flex-col items-center px-4 pb-16 pt-8 md:pt-14">
      <div className="w-full max-w-md">
        {problem ? (
          <div className="rounded-[24px] bg-card p-8 text-center shadow-md">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ApperIcon name="Link2Off" size={22} />
            </span>
            <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">This invite can't be used</h1>
            <p className="mt-2 text-muted-foreground">{problem}</p>
            <Button asChild variant="outline" className="mt-6 h-11 rounded-full px-5">
              <Link to="/contact">Contact the Lotmates team</Link>
            </Button>
          </div>
        ) : !invite ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <ApperIcon name="LoaderCircle" size={20} className="mr-2 animate-spin" />
            Checking your invite
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">Join Lotmates</h1>
              <p className="mt-2 text-base text-muted-foreground">You've been invited as {invite.role.toLowerCase() === 'lotmates team' ? 'part of the Lotmates team' : `a ${invite.role.toLowerCase()}`}.</p>
            </div>
            <div className="mt-7 rounded-[24px] bg-card p-6 shadow-md md:p-8">
              <div className="mb-6 flex items-center gap-3">
                <span className="flex size-11 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ApperIcon name={ICON[invite.profile] ?? 'UserPlus'} size={20} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-heading text-lg font-bold leading-tight text-foreground">{invite.email}</p>
                  <p className="text-sm text-muted-foreground">{WHAT[invite.profile]}</p>
                </div>
              </div>
              <form onSubmit={submit} className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="inv-first">First name</Label>
                    <Input id="inv-first" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} required autoFocus className="h-11" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="inv-last">Last name</Label>
                    <Input id="inv-last" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} className="h-11" />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="inv-pw">Choose a password</Label>
                  <div className="relative">
                    <Input id="inv-pw" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 pr-11" />
                    <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground">
                      <ApperIcon name={show ? 'EyeOff' : 'Eye'} size={18} />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground">At least 8 characters.</p>
                </div>
                {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={busy} className="mt-1 h-12 w-full rounded-full text-base">
                  {busy ? 'Setting up your account…' : 'Join and sign in'}
                </Button>
              </form>
            </div>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account? <Link to="/customer/login" className="font-medium text-primary hover:underline">Sign in</Link> and ask the team to give it access.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
