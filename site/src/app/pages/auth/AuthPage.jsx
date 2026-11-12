import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { sdk } from '@/services/sdk';
import { setUser } from '@/store/userSlice';
import { AUTH_PROFILES } from '@/config/app.config';
import { cn } from '@/lib/utils';
import ApperIcon from '@/components/ApperIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// One sign-in form for everyone. The role tabs only change the wording and where you land;
// the account itself decides which portal opens.
const ROLES = [
  { key: 'customer', label: 'Neighbour', icon: 'Home', blurb: 'Book deals and follow your refunds.', canSignup: true },
  { key: 'vendor', label: 'Vendor', icon: 'Store', blurb: 'See your jobs, deals and payouts.', invite: 'Want to run deals on Lotmates?', apply: { to: '/vendors', label: 'Apply as a vendor' } },
  { key: 'ambassador', label: 'Ambassador', icon: 'Megaphone', blurb: "Follow your community's deals and earnings.", invite: 'Want to be an ambassador?', apply: { to: '/ambassadors', label: 'Apply to join' } },
  { key: 'admin', label: 'Team', icon: 'ShieldCheck', blurb: 'Run deals, vendors and refunds.' },
];
const LAST_ROLE = 'lotmates.lastRole';

function readLastRole() {
  try {
    return window.localStorage.getItem(LAST_ROLE);
  } catch {
    return null;
  }
}

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { profile: profileParam } = useParams();
  const { search } = useLocation();

  // Signing up is for neighbours only; other roles are invited.
  const roleKey = mode === 'signup' ? 'customer' : (ROLES.find((r) => r.key === profileParam)?.key ?? readLastRole() ?? 'customer');
  const role = ROLES.find((r) => r.key === roleKey) ?? ROLES[0];
  const profileCfg = AUTH_PROFILES.find((p) => p.key === role.key);
  // Someone who came from a deal is a buyer: skip the four-role chooser, and carry the deal through sign-in and sign-up.
  const redirectTo = new URLSearchParams(search).get('redirect');
  const buyerIntent = role.key === 'customer' && Boolean(redirectTo && redirectTo.startsWith('/deals/'));

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => setError(null), [roleKey, mode]);

  const pickRole = (key) => navigate(`/${key}/login${window.location.search}`, { replace: true });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let result;
      if (mode === 'login') {
        result = await sdk.session.login({ email, password });
      } else {
        const [firstName, ...rest] = name.trim().split(/\s+/);
        result = await sdk.session.register({ email, password, firstName: firstName ?? '', lastName: rest.join(' ') });
      }
      if (result.ok) {
        try {
          window.localStorage.setItem(LAST_ROLE, AUTH_PROFILES.find((p) => p.name === result.value?.profile)?.key ?? role.key);
        } catch {
          /* only used to preselect the tab next time */
        }
        dispatch(setUser(result.value));
        // Your own portal, whichever tab you used; or back to the page that sent you here.
        const own = AUTH_PROFILES.find((p) => p.name === result.value?.profile)?.redirectAfterAuth;
        const back = new URLSearchParams(window.location.search).get('redirect');
        navigate(back && back.startsWith('/') ? back : own ?? profileCfg?.redirectAfterAuth ?? '/');
      } else {
        setError(result.error?.message || 'Something went wrong. Try again.');
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100svh-4.5rem)] flex-col items-center px-4 pb-16 pt-8 md:pt-14">
      <div className="w-full max-w-md">
        <div className="text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {mode === 'login' ? 'Sign in to Lotmates' : 'Join your neighbours'}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            {mode === 'login' ? (buyerIntent ? 'Sign in to book your place.' : 'Choose who you are signing in as.') : 'Create a neighbour account to book deals in your locality.'}
          </p>
        </div>

        {mode === 'login' && !buyerIntent && (
          <div role="tablist" aria-label="Sign in as" className="mt-7 grid grid-cols-4 gap-1 rounded-2xl bg-muted p-1">
            {ROLES.map((r) => {
              const active = r.key === role.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => pickRole(r.key)}
                  className={cn(
                    'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <ApperIcon name={r.icon} size={18} />
                  {r.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 rounded-[24px] bg-card p-6 shadow-md md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-11 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
              <ApperIcon name={role.icon} size={20} />
            </span>
            <div>
              <p className="font-heading text-lg font-bold leading-tight text-foreground">
                {mode === 'login' ? `${role.label} sign in` : 'Neighbour account'}
              </p>
              <p className="text-sm text-muted-foreground">{role.blurb}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            {mode === 'signup' && (
              <div className="grid gap-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className="h-11" placeholder="First and last name" />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete={mode === 'login' ? 'username' : 'email'}
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={mode === 'login'}
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === 'login' && (
                  <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'signup' ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <ApperIcon name={showPassword ? 'EyeOff' : 'Eye'} size={18} />
                </button>
              </div>
              {mode === 'signup' && <p className="text-sm text-muted-foreground">At least 8 characters.</p>}
            </div>
            {error && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="mt-1 h-12 w-full rounded-full text-base">
              {loading ? 'Please wait…' : mode === 'login' ? `Sign in as ${role.label.toLowerCase() === 'team' ? 'the team' : role.label.toLowerCase()}` : 'Create account'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-base text-muted-foreground">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <Link to={`/customer/login${search}`} className="font-medium text-primary hover:underline">Sign in</Link>
            </>
          ) : role.canSignup ? (
            <>
              New to Lotmates?{' '}
              <Link to={`/customer/signup${search}`} className="font-medium text-primary hover:underline">Create a neighbour account</Link>
            </>
          ) : role.invite ? (
            <>
              {role.invite}{' '}
              <Link to={role.apply?.to ?? '/contact'} className="font-medium text-primary hover:underline">{role.apply?.label ?? 'Contact us'}</Link>
            </>
          ) : (
            'Team accounts are invited by an admin.'
          )}
        </p>
        {buyerIntent && (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Vendor, ambassador or team member?{' '}
            <Link to={`/vendor/login${search}`} className="font-medium text-primary hover:underline">Choose your role</Link>
          </p>
        )}
      </div>
    </div>
  );
}

