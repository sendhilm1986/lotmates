import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useProfile } from '@/hooks/useProfile';
import ApperIcon from '@/components/ApperIcon';
import LookupPicker from '@/components/LookupPicker';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import FullScreenModal from '@/components/FullScreenModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORY_VALUES, categoryLabel } from '@/services/dealRules';
import { userIdOf } from '@/services/records';
import { cn } from '@/lib/utils';

const { eq } = window.ApperSDK.CoreSDK;

export default function ProposalDialog({ open, onOpenChange, record, onSaved }) {
  const { profile } = useProfile();
  const user = useSelector((s) => s.user.user);
  const uid = userIdOf(user);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [unlisted, setUnlisted] = useState(false);
  const [myEmail, setMyEmail] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setUnlisted(Boolean(record && !record.community_c?.Id && record.newCommunity_c));
    setForm({
      Name: record?.Name ?? '',
      category_c: record?.category_c ?? 'Cleaning',
      community_c: record?.community_c?.Id ?? null,
      newCategory_c: record?.newCategory_c ?? '',
      newCommunity_c: record?.newCommunity_c ?? '',
      newLocality_c: record?.newLocality_c ?? '',
      homesInterested_c: record?.homesInterested_c == null ? '' : String(record.homesInterested_c),
      notes_c: record?.notes_c ?? '',
      contactPref_c: record?.contactPref_c ?? 'Email',
      contactPhone_c: record?.contactPhone_c ?? '',
    });
    // Fill the phone from the profile, so most people only pick how they want to be reached.
    sdk.account.get().then((r) => {
      const me = r.ok ? r.value : null;
      if (!me) return;
      setMyEmail(me.email ?? '');
      setForm((f) => ({ ...f, contactPhone_c: f.contactPhone_c || me.phone || '' }));
    });
  }, [open, record]);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.Name?.trim()) errs.Name = 'Say what neighbours want';
    if (form.category_c === 'Other' && !form.newCategory_c?.trim()) errs.newCategory_c = 'Name the service or product';
    if (unlisted && !form.newCommunity_c?.trim()) errs.newCommunity_c = 'Name the community';
    if (!unlisted && !form.community_c) errs.community_c = 'Pick the community, or choose "It isn\'t listed"';
    if (form.homesInterested_c !== '' && Number(form.homesInterested_c) < 1) errs.homesInterested_c = 'At least 1 home';
    if (form.contactPref_c === 'Phone' && !/^\+?[\d\s-]{10,16}$/.test(form.contactPhone_c?.trim() ?? '')) errs.contactPhone_c = 'Enter a 10-digit phone number, e.g. 98765 43210';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const payload = {
        Name: form.Name.trim(),
        category_c: form.category_c,
        community_c: unlisted ? null : form.community_c,
        newCategory_c: form.category_c === 'Other' ? form.newCategory_c.trim() : null,
        newCommunity_c: unlisted ? form.newCommunity_c.trim() : null,
        newLocality_c: unlisted ? form.newLocality_c.trim() || null : null,
        homesInterested_c: form.homesInterested_c === '' ? null : Number(form.homesInterested_c),
        notes_c: form.notes_c.trim() || null,
        contactPref_c: form.contactPref_c,
        contactPhone_c: form.contactPhone_c?.trim() || null,
      };
      const res = record
        ? await sdk.table('proposals_c').update({ Id: record.Id, ...payload })
        : await sdk.table('proposals_c').create({ ...payload, status_c: 'New', adminNote_c: null });
      if (res.messages?.length || res.message) toast.error(res.messages?.[0] ?? res.message);
      if (!res.data?.length) return;
      toast.success(record ? 'Proposal saved' : 'Sent to the Lotmates team');
      onOpenChange(false);
      onSaved?.(res.data[0]);
    } finally {
      setSaving(false);
    }
  }

  const communityFilter = profile === 'Ambassador_c' && uid ? { filter: eq('ambassadorUser_c', uid) } : undefined;

  const field = 'h-12 rounded-xl text-base';
  const err = (k) => errors[k] && <p className="mt-1.5 text-sm text-destructive">{errors[k]}</p>;
  const aside = (
    <div className="space-y-5">
      <div className="rounded-[22px] bg-card p-6 shadow-sm">
        <h3 className="font-heading text-lg font-bold text-foreground">What happens next</h3>
        <ol className="mt-4 space-y-4">
          {[
            ['The team reviews it', 'You get a reply on the proposal\'s timeline, and by email.'],
            ['Vendors quote tier prices', 'The more homes, the lower the price each home pays.'],
            ['The deal opens', 'Share it in your community group to get it going.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex size-7 flex-none items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary">{i + 1}</span>
              <div>
                <p className="text-[15px] font-medium text-foreground">{t}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <p className="flex items-start gap-2.5 rounded-2xl bg-primary/[0.07] px-4 py-3 text-sm text-foreground">
        <ApperIcon name="Users" size={16} className="mt-0.5 flex-none text-primary" />
        <span>A rough head count is enough. You can update it later from the proposal's timeline.</span>
      </p>
    </div>
  );

  return (
    <FullScreenModal
      open={open}
      onOpenChange={onOpenChange}
      busy={saving}
      icon="Lightbulb"
      label={record ? 'Edit proposal' : 'New proposal'}
      closeLabel="Close proposal"
      title={record ? 'Edit proposal' : 'Propose a deal'}
      description="Tell the team what your neighbours keep asking for."
      aside={aside}
    >
      <form onSubmit={submit} noValidate className="max-w-2xl">
        <Section first title="What do neighbours want?" hint="Name the service or product in a few words.">
          <Input id="pp-name" className={field} value={form.Name ?? ''} onChange={set('Name')} placeholder="e.g. Overhead water tank cleaning" aria-label="What neighbours want" />
          {err('Name')}
        </Section>

        <Section title="Category">
          <Select value={form.category_c ?? 'Cleaning'} onValueChange={set('category_c')}>
            <SelectTrigger id="pp-category" className="!h-12 w-full rounded-xl text-base" aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORY_VALUES.map((c) => (
                <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
              ))}
              <SelectItem value="Other">Something else</SelectItem>
            </SelectContent>
          </Select>
          {form.category_c === 'Other' && (
            <div className="mt-3">
              <Input className={field} value={form.newCategory_c ?? ''} onChange={set('newCategory_c')} placeholder="e.g. Water tank cleaning, home tutoring" maxLength={80} aria-label="New category" />
              <p className="mt-1.5 text-sm text-muted-foreground">The team will look at adding it as a new category.</p>
              {err('newCategory_c')}
            </div>
          )}
        </Section>

        <Section
          title="Which community?"
          hint={unlisted ? 'Name it, and the team will add it.' : 'Pick the community the homes are in.'}
          action={
            <button type="button" onClick={() => setUnlisted((u) => !u)} className="min-h-9 flex-none text-sm font-medium text-primary underline-offset-2 hover:underline">
              {unlisted ? 'Pick from the list' : "It isn't listed"}
            </button>
          }
        >
          {unlisted ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Input id="pp-newcommunity" className={field} value={form.newCommunity_c ?? ''} onChange={set('newCommunity_c')} placeholder="Community name" maxLength={120} aria-label="Community name" />
                {err('newCommunity_c')}
              </div>
              <Input className={field} value={form.newLocality_c ?? ''} onChange={set('newLocality_c')} placeholder="Area or locality" maxLength={120} aria-label="Area or locality" />
            </div>
          ) : (
            <>
              <LookupPicker
                table="communities_c"
                searchField="Name"
                fetchParams={communityFilter}
                value={form.community_c ?? null}
                onChange={set('community_c')}
                placeholder="Choose your community"
                aria-label="Community"
                className="[&>button]:h-12 [&>button]:rounded-xl [&>button]:bg-card [&>button]:text-base"
                clearable
              />
              {err('community_c')}
            </>
          )}
        </Section>

        <Section title="How many homes are interested?" hint="A rough count is fine.">
          <Input id="pp-homes" className={cn(field, 'sm:max-w-56')} type="number" min={1} inputMode="numeric" value={form.homesInterested_c ?? ''} onChange={set('homesInterested_c')} placeholder="e.g. 40" aria-label="Homes interested" />
          {err('homesInterested_c')}
        </Section>

        <Section title="Anything else?" hint="Optional. Timing, budget, anything the vendor should know.">
          <Textarea id="pp-notes" rows={4} className="rounded-xl text-base" value={form.notes_c ?? ''} onChange={set('notes_c')} placeholder="e.g. Most blocks want it before the monsoon" aria-label="Notes" />
        </Section>

        <Section title="How should the team reach you?">
          <div role="radiogroup" aria-label="Contact preference" className="grid grid-cols-2 gap-3">
            {[
              { v: 'Email', icon: 'Mail', label: 'Email' },
              { v: 'Phone', icon: 'Phone', label: 'Phone call' },
            ].map((o) => {
              const on = form.contactPref_c === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setForm((f) => ({ ...f, contactPref_c: o.v }))}
                  className={cn(
                    'flex h-14 items-center justify-center gap-2 rounded-xl border text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    on ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card text-foreground hover:border-foreground/30',
                  )}
                >
                  <ApperIcon name={o.icon} size={18} />
                  {o.label}
                </button>
              );
            })}
          </div>
          {form.contactPref_c === 'Phone' ? (
            <div className="mt-3">
              <Input type="tel" inputMode="tel" autoComplete="tel" className={field} value={form.contactPhone_c ?? ''} onChange={set('contactPhone_c')} placeholder="98765 43210" aria-label="Phone number" />
              {err('contactPhone_c')}
            </div>
          ) : (
            <p className="mt-3 text-[15px] text-muted-foreground">
              The team will write to <span className="font-medium text-foreground">{record?.contactEmail_c || myEmail || 'your account email'}</span>.
            </p>
          )}
        </Section>

        <div className="mt-10 border-t border-border pt-7">
          <button
            type="submit"
            disabled={saving}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-sm transition-[background-color,transform] duration-150 hover:bg-primary/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-80"
          >
            {saving ? (
              <>
                <ApperIcon name="LoaderCircle" size={18} className="animate-spin" />
                Sending…
              </>
            ) : record ? (
              'Save proposal'
            ) : (
              <>
                <ApperIcon name="Send" size={18} />
                Send proposal
              </>
            )}
          </button>
          <p className="mt-3 text-center text-sm text-muted-foreground">The Lotmates team gets it straight away, and you get a copy by email.</p>
        </div>
      </form>
    </FullScreenModal>
  );
}

/** One question on the form, laid out like the checkout's sections. Kept outside the dialog so inputs keep focus. */
function Section({ title, hint, action, children, first }) {
  return (
    <section className={cn(!first && 'mt-9 border-t border-border pt-7')}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[17px] font-medium text-foreground">{title}</h3>
          {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
