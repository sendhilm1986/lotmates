import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useAuth } from '@/layouts/RootLayout';
import { getProfileMeta } from '@/services/userPermissions';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import { categoryLabel } from '@/services/dealRules';
import { cn } from '@/lib/utils';
import ApperIcon from '@/components/ApperIcon';
import UserAvatar from '@/components/UserAvatar';
import StatusBadge from '@/components/StatusBadge';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export const route = { path: '/account', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'UserRound', label: 'Profile', order: 98 };

const ROLE_COPY = {
  Customer_c: 'Neighbour',
  Vendor_c: 'Vendor partner',
  Ambassador_c: 'Community ambassador',
  Admin_c: 'Lotmates team',
};

function Section({ id, title, description, children }) {
  return (
    <section id={id} className="grid scroll-mt-24 gap-5 border-t border-border py-10 first:border-t-0 first:pt-2 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12">
      <div>
        <h2 className="font-heading text-lg font-bold text-foreground">{title}</h2>
        {description && <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Field({ id, label, hint, error, children }) {
  return (
    <div className="grid content-start gap-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const card = 'rounded-[22px] bg-card p-6 shadow-sm md:p-7';
const input = 'h-11 bg-background/60';

function SaveBar({ dirty, saving, onReset }) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-5">
      {dirty && (
        <button type="button" onClick={onReset} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Undo changes
        </button>
      )}
      <Button type="submit" disabled={!dirty || saving} className="h-11 rounded-full px-6">
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={onChange} className={cn(input, 'pr-12')} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <ApperIcon name={show ? 'EyeOff' : 'Eye'} size={18} />
      </button>
    </div>
  );
}

export default function Account() {
  const { logout } = useAuth();
  const { data: me, loading, error, run, setData } = useFetch(async () => {
    const r = await sdk.account.get();
    if (!r.ok) throw new Error(r.error?.message);
    return r.value;
  }, []);

  if (loading && !me) return <DetailSkeleton />;
  if (error && !me) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card p-10 text-center shadow-sm">
        <p className="text-muted-foreground">Your profile didn't load. {String(error)}</p>
        <Button variant="outline" onClick={run}>Try again</Button>
      </div>
    );
  }

  const update = (p) => setData(p);
  const name = [me.firstName, me.lastName].filter(Boolean).join(' ') || me.email;
  const initials = (`${me.firstName?.[0] ?? ''}${me.lastName?.[0] ?? ''}` || me.email?.[0] || '?').toUpperCase();
  const role = ROLE_COPY[me.profile] ?? getProfileMeta(me.profile)?.label ?? '';

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-col gap-5 pb-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
        <ProfilePhoto me={me} initials={initials} onSaved={update} />
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">{name}</h1>
          <p className="mt-1 text-muted-foreground">
            {role}
            {me.memberSince ? `, with Lotmates since ${formatLocalDate(me.memberSince, 'MMMM yyyy')}` : ''}
          </p>
        </div>
      </header>

      <div className="rounded-[28px]">
        <DetailsSection me={me} onSaved={update} />
        {['Customer_c', 'Ambassador_c'].includes(me.profile) && <HomeSection me={me} onSaved={update} />}
        {me.profile === 'Vendor_c' && <BusinessSection me={me} />}
        {me.profile === 'Ambassador_c' && <CommunitiesSection me={me} />}
        <MoreSection me={me} />
        <SignInSection me={me} onSaved={update} />
        <DataSection me={me} onSaved={update} logout={logout} />
      </div>
    </div>
  );
}

function DetailsSection({ me, onSaved }) {
  const isNeighbour = me.profile === 'Customer_c';
  const start = { firstName: me.firstName ?? '', lastName: me.lastName ?? '', phone: me.phone ?? '' };
  const [form, setForm] = useState(start);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const dirty = JSON.stringify(form) !== JSON.stringify(start);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'Add your first name';
    if (form.phone.trim() && !/^\+?[\d\s-]{10,16}$/.test(form.phone.trim())) errs.phone = 'Enter a 10-digit number, e.g. 98765 43210';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const r = await sdk.account.update({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim() });
    setSaving(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success('Details saved');
    onSaved(r.value.profile);
  }

  return (
    <Section
      id="details"
      title="Your details"
      description={isNeighbour ? 'How vendors and the Lotmates team know you, and the number they call about a job.' : 'Your name and the number the Lotmates team uses to reach you.'}
    >
      <form onSubmit={save} noValidate className={card}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="first" label="First name" error={errors.firstName}>
            <Input id="first" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} className={input} aria-invalid={Boolean(errors.firstName)} />
          </Field>
          <Field id="last" label="Last name">
            <Input id="last" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} className={input} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="phone" label="Phone" hint={isNeighbour ? "Shared with a vendor only for a job you've booked." : 'Only the Lotmates team sees this.'} error={errors.phone}>
              <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={form.phone} onChange={set('phone')} className={cn(input, 'sm:max-w-xs')} aria-invalid={Boolean(errors.phone)} />
            </Field>
          </div>
        </div>
        <SaveBar dirty={dirty} saving={saving} onReset={() => { setForm(start); setErrors({}); }} />
      </form>
    </Section>
  );
}

function HomeSection({ me, onSaved }) {
  const start = { localityId: me.locality?.Id ?? me.community?.locality?.Id ?? '', communityId: me.community?.Id ?? '', address: me.address ?? '' };
  const [form, setForm] = useState(start);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(start);

  const { data: communities } = useFetch(() =>
    sdk
      .table('communities_c')
      .select(['Name', 'locality_c'])
      .orderBy('Name')
      .fetch()
      .then((r) => (r.success ? r.data : [])),
  []);
  const { data: localities } = useFetch(() =>
    sdk
      .table('localities_c')
      .select(['Name', 'city_c', 'status_c'])
      .orderBy('Name')
      .fetch()
      .then((r) => (r.success ? r.data : [])),
  []);
  const inLocality = (communities ?? []).filter((c) => !form.localityId || String(c.locality_c?.Id) === String(form.localityId));

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const r = await sdk.account.update({ localityId: form.localityId || null, communityId: form.communityId || null, address: form.address.trim() });
    setSaving(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success('Home saved. Checkout will fill it in for you.');
    onSaved(r.value.profile);
  }

  return (
    <Section id="home" title="Your home" description="Houses and apartments both work. Filled in for you at checkout, so booking takes a few taps.">
      <form onSubmit={save} className={card}>
        <div className="grid gap-5">
          <Field id="locality" label="Locality" hint="Your area, like Kovaipudur or Anna Nagar.">
            <Select value={form.localityId ? String(form.localityId) : ''} onValueChange={(v) => setForm((f) => ({ ...f, localityId: v, communityId: '' }))}>
              <SelectTrigger id="locality" className={cn(input, 'h-11! w-full')}>
                <SelectValue placeholder="Choose your locality" />
              </SelectTrigger>
              <SelectContent>
                {(localities ?? []).map((l) => (
                  <SelectItem key={l.Id} value={String(l.Id)}>
                    {l.Name}
                    {l.city_c?.Name ? `, ${l.city_c.Name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="community" label="Apartment or community (optional)" hint="Skip this if you live in an individual house.">
            <Select value={form.communityId ? String(form.communityId) : 'none'} onValueChange={(v) => setForm((f) => ({ ...f, communityId: v === 'none' ? '' : v }))}>
              <SelectTrigger id="community" className={cn(input, 'h-11! w-full')}>
                <SelectValue placeholder="I live in an individual house" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">I live in an individual house</SelectItem>
                {inLocality.map((c) => (
                  <SelectItem key={c.Id} value={String(c.Id)}>
                    {c.Name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="address" label="Address" hint="House or flat number, street and a landmark help the vendor find you.">
            <Input id="address" autoComplete="address-line1" placeholder="e.g. 12, Lakshmi Nagar 2nd Street, near the temple" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={input} />
          </Field>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <p className="text-sm text-muted-foreground">
            {me.counts?.bookings ? (
              <>
                {me.counts.bookings} {me.counts.bookings === 1 ? 'booking' : 'bookings'} so far.{' '}
                <Link to="/bookings" className="font-medium text-primary hover:underline">See them</Link>
              </>
            ) : (
              <Link to="/deals" className="font-medium text-primary hover:underline">Browse deals in your locality</Link>
            )}
          </p>
          <div className="flex items-center gap-3">
            {dirty && (
              <button type="button" onClick={() => setForm(start)} className="text-sm font-medium text-muted-foreground hover:text-foreground">Undo changes</button>
            )}
            <Button type="submit" disabled={!dirty || saving} className="h-11 rounded-full px-6">{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </div>
      </form>
    </Section>
  );
}

function BusinessSection({ me }) {
  const v = me.vendor;
  return (
    <Section id="business" title="Your business" description="Business details are checked by the Lotmates team, so changes go through them.">
      <div className={card}>
        {v ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-heading text-lg font-bold text-foreground">{v.Name}</p>
                <p className="text-sm text-muted-foreground">{[categoryLabel(v.category), v.locality].filter(Boolean).join(', ')}</p>
              </div>
              <StatusBadge value={v.status} />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              <Link to={`/partners/${v.Id}`} className="text-sm font-medium text-primary hover:underline">See your public page</Link>
              <Button variant="outline" asChild className="h-11 rounded-full px-5">
                <Link to="/contact">Ask for a change</Link>
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Your account isn't linked to a business yet. The Lotmates team will link it once your checks are done.</p>
        )}
      </div>
    </Section>
  );
}

function CommunitiesSection({ me }) {
  return (
    <Section id="communities" title="Your communities" description="The groups you represent. The team assigns these.">
      <div className="overflow-hidden rounded-[22px] bg-card shadow-sm">
        {me.communities.length ? (
          <ul className="divide-y divide-border">
            {me.communities.map((c) => (
              <li key={c.Id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{c.Name}</p>
                  <p className="text-sm text-muted-foreground">{c.locality}</p>
                </div>
                <p className="flex-none text-sm tabular-nums text-muted-foreground">{c.homes} homes</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-muted-foreground">No communities assigned yet.</p>
        )}
      </div>
    </Section>
  );
}

// Pages that don't need their own menu item, kept one tap away.
const MORE_LINKS = {
  Vendor_c: [
    ['/reviews', 'Star', 'Your reviews', 'What neighbours said about your jobs, and your rating.'],
    ['/complaints', 'MessageSquareWarning', 'Complaints', 'Problems neighbours raised about a job. Reply so the team can close them.'],
  ],
  Customer_c: [
    ['/complaints', 'MessageSquareWarning', 'Report a problem', 'Something went wrong with a booking? Tell us and follow the reply.'],
    ['/reviews', 'Star', 'Reviews', 'What your neighbours said about the vendors. Rate your own jobs from each booking.'],
  ],
};

function MoreSection({ me }) {
  const links = MORE_LINKS[me.profile];
  if (!links) return null;
  return (
    <Section id="more" title="Help and more" description="Less-used pages, all in one place.">
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map(([to, icon, label, note]) => (
          <li key={to}>
            <Link to={to} className="flex h-full items-start gap-3 rounded-2xl bg-card p-4 shadow-sm transition-colors hover:bg-accent/50">
              <ApperIcon name={icon} size={20} className="mt-0.5 flex-none text-primary" />
              <span>
                <span className="block font-medium text-foreground">{label}</span>
                <span className="block text-sm text-muted-foreground">{note}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function SignInSection({ me, onSaved }) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [emailPw, setEmailPw] = useState('');
  const [busy, setBusy] = useState('');
  const [pw, setPw] = useState({ current: '', next: '' });

  useEffect(() => {
    if (window.location.hash === '#sign-in') document.getElementById('sign-in')?.scrollIntoView();
  }, []);

  async function changeEmail(e) {
    e.preventDefault();
    setBusy('email');
    const r = await sdk.account.changeEmail({ email: email.trim(), password: emailPw });
    setBusy('');
    if (!r.ok) return toast.error(r.error.message);
    toast.success(`Email changed to ${email.trim()}. Use it next time you sign in.`);
    setEmailOpen(false);
    setEmail('');
    setEmailPw('');
    onSaved({ ...me, email: email.trim() });
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pw.next.length < 8) return toast.error('Use at least 8 characters for your new password.');
    setBusy('password');
    const r = await sdk.account.changePassword({ currentPassword: pw.current, newPassword: pw.next });
    setBusy('');
    if (!r.ok) return toast.error(r.error.message);
    toast.success('Password changed. Other devices have been signed out.');
    setPw({ current: '', next: '' });
  }

  async function signOutOthers() {
    setBusy('others');
    const r = await sdk.account.signOutOthers();
    setBusy('');
    if (!r.ok) return toast.error(r.error.message);
    toast.success('Signed out everywhere else. This device stays signed in.');
  }

  return (
    <Section id="sign-in" title="Sign-in and security" description="Your email is how you sign in and where receipts and refund notes go.">
      <div className="grid gap-5">
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="truncate font-medium text-foreground">{me.email}</p>
            </div>
            {!emailOpen && (
              <Button variant="outline" onClick={() => setEmailOpen(true)} className="h-11 rounded-full px-5">Change email</Button>
            )}
          </div>
          {emailOpen && (
            <form onSubmit={changeEmail} className="mt-6 grid gap-5 border-t border-border pt-6 sm:grid-cols-2">
              <Field id="new-email" label="New email">
                <Input id="new-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
              </Field>
              <Field id="email-pw" label="Your password" hint="To confirm it's you.">
                <PasswordInput id="email-pw" autoComplete="current-password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} />
              </Field>
              <div className="flex justify-end gap-3 sm:col-span-2">
                <Button type="button" variant="ghost" onClick={() => setEmailOpen(false)} className="h-11 rounded-full px-5">Cancel</Button>
                <Button type="submit" disabled={!email || !emailPw || busy === 'email'} className="h-11 rounded-full px-6">{busy === 'email' ? 'Changing…' : 'Change email'}</Button>
              </div>
            </form>
          )}
        </div>

        <form onSubmit={changePassword} className={card}>
          <p className="font-medium text-foreground">Password</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field id="pw-current" label="Current password">
              <PasswordInput id="pw-current" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
            </Field>
            <Field id="pw-new" label="New password" hint="At least 8 characters.">
              <PasswordInput id="pw-new" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
            </Field>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <Link to="/forgot-password" className="text-sm font-medium text-muted-foreground hover:text-foreground">Forgot your password?</Link>
            <Button type="submit" disabled={!pw.current || !pw.next || busy === 'password'} className="h-11 rounded-full px-6">{busy === 'password' ? 'Changing…' : 'Change password'}</Button>
          </div>
        </form>

        <div className={cn(card, 'flex flex-wrap items-center justify-between gap-4')}>
          <div className="max-w-md">
            <p className="font-medium text-foreground">Signed in on another phone or computer?</p>
            <p className="mt-1 text-sm text-muted-foreground">Sign out everywhere except here, for example after using a shared device.</p>
          </div>
          <Button variant="outline" onClick={signOutOthers} disabled={busy === 'others'} className="h-11 rounded-full px-5">
            {busy === 'others' ? 'Signing out…' : 'Sign out other devices'}
          </Button>
        </div>
      </div>
    </Section>
  );
}

function DataSection({ me, onSaved, logout }) {
  const [busy, setBusy] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function download(kind) {
    setBusy(kind);
    try {
      const r = await sdk.account.exportData();
      if (!r.ok) throw new Error(r.error.message);
      const { downloadPdf, downloadCsvZip } = await import('@/services/dataExport');
      await (kind === 'pdf' ? downloadPdf(r.value) : downloadCsvZip(r.value));
    } catch (err) {
      toast.error(err?.message || "The download didn't work. Try again.");
    } finally {
      setBusy('');
    }
  }

  async function requestDeletion() {
    setBusy('delete');
    const r = await sdk.account.requestDeletion();
    setBusy('');
    if (!r.ok) return toast.error(r.error.message);
    setConfirmOpen(false);
    toast.success("Request sent. We'll email you once it's done.");
    onSaved(r.value.profile);
  }

  async function cancelDeletion() {
    setBusy('cancel');
    const r = await sdk.account.cancelDeletion();
    setBusy('');
    if (!r.ok) return toast.error(r.error.message);
    toast.success('Deletion request cancelled');
    onSaved(r.value.profile);
  }

  return (
    <Section id="data" title="Your data" description="Take a copy of everything Lotmates holds about you, or ask us to delete your account.">
      <div className="overflow-hidden rounded-[22px] bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 p-6 md:p-7">
          <div className="max-w-md">
            <p className="font-medium text-foreground">Download your data</p>
            <p className="mt-1 text-sm text-muted-foreground">A PDF of your details, bookings, payments, refunds, reviews and complaints, ready to read or print.</p>
            <button
              type="button"
              onClick={() => download('csv')}
              disabled={busy === 'csv'}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-60"
            >
              <ApperIcon name={busy === 'csv' ? 'LoaderCircle' : 'Sheet'} size={15} className={busy === 'csv' ? 'animate-spin' : ''} />
              {busy === 'csv' ? 'Preparing spreadsheet files…' : 'Or get spreadsheet files (CSV)'}
            </button>
          </div>
          <Button variant="outline" onClick={() => download('pdf')} disabled={busy === 'pdf'} className="h-11 rounded-full px-5">
            <ApperIcon name={busy === 'pdf' ? 'LoaderCircle' : 'Download'} size={16} className={busy === 'pdf' ? 'animate-spin' : ''} />
            {busy === 'pdf' ? 'Preparing…' : 'Download PDF'}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-6 md:p-7">
          <div className="max-w-md">
            <p className="font-medium text-foreground">Delete your account</p>
            {me.deletionRequested ? (
              <p className="mt-1 text-sm text-muted-foreground">
                You asked on {formatLocalDate(me.deletionRequested, DATE_FORMATS.SHORT)}. We settle any open bookings and refunds first, then delete it and email you.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">We settle any open bookings and refunds first, then remove your account and personal details.</p>
            )}
          </div>
          {me.isOwner ? (
            <p className="text-sm text-muted-foreground">The site owner account stays.</p>
          ) : me.deletionRequested ? (
            <Button variant="outline" onClick={cancelDeletion} disabled={busy === 'cancel'} className="h-11 rounded-full px-5">Keep my account</Button>
          ) : (
            <Button variant="outline" onClick={() => setConfirmOpen(true)} className="h-11 rounded-full border-destructive/30 px-5 text-destructive hover:bg-destructive/5 hover:text-destructive">
              Ask to delete
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-muted/40 px-6 py-4 md:px-7">
          <p className="text-sm text-muted-foreground">
            See how we use your data in the <Link to="/legal/privacy" className="font-medium text-foreground hover:underline">privacy policy</Link>.
          </p>
          <button type="button" onClick={logout} className="text-sm font-medium text-foreground hover:text-primary">Sign out</button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your Lotmates account?</AlertDialogTitle>
            <AlertDialogDescription>
              We'll settle any open bookings and refunds, then delete your account and personal details. Payment records we must keep by law stay, without your name. You can change your mind until then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'delete'}>Keep my account</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                requestDeletion();
              }}
              disabled={busy === 'delete'}
            >
              {busy === 'delete' ? 'Sending…' : 'Ask to delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}

/** The profile photo: upload your own, remove it, or fall back to Gravatar and then initials. */
function ProfilePhoto({ me, initials, onSaved }) {
  const [busy, setBusy] = useState('');
  const inputRef = useRef(null);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error('Use a JPG, PNG or WebP photo.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('That photo is over 3 MB. Choose a smaller one.');
      return;
    }
    setBusy('upload');
    try {
      const r = await sdk.account.uploadAvatar(file);
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      onSaved(r.value.profile);
      toast.success('Profile photo updated');
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    setBusy('remove');
    try {
      const r = await sdk.account.removeAvatar();
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      onSaved(r.value.profile);
      toast.success('Profile photo removed');
    } finally {
      setBusy('');
    }
  }

  async function toggleGravatar() {
    setBusy('gravatar');
    try {
      const r = await sdk.account.update({ useGravatar: !me.useGravatar });
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      onSaved(r.value.profile);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <UserAvatar person={me} initials={initials} className="size-20 md:size-24" fallbackClassName="font-heading text-2xl font-bold md:text-3xl" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={Boolean(busy)}
          aria-label={me.avatar ? 'Change profile photo' : 'Add a profile photo'}
          className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full bg-card text-foreground shadow-md ring-1 ring-border transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <ApperIcon name={busy === 'upload' ? 'LoaderCircle' : 'Camera'} size={16} className={busy === 'upload' ? 'animate-spin' : ''} />
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pick} tabIndex={-1} aria-hidden />
      </div>
      <div className="flex flex-col items-start gap-1">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(busy)} className="text-sm font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60">
          {me.avatar ? 'Change photo' : 'Add a photo'}
        </button>
        {me.avatar ? (
          <button type="button" onClick={remove} disabled={Boolean(busy)} className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60">
            {busy === 'remove' ? 'Removing…' : 'Remove photo'}
          </button>
        ) : (
          <button type="button" onClick={toggleGravatar} disabled={Boolean(busy)} className="text-left text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60" title="Gravatar shows the picture linked to your email address on gravatar.com">
            {me.useGravatar ? 'Don\'t use my Gravatar' : 'Use my Gravatar'}
          </button>
        )}
      </div>
    </div>
  );
}
