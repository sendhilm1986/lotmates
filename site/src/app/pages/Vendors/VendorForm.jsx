import { useState } from 'react';
import ApperIcon from '@/components/ApperIcon';
import LookupPicker from '@/components/LookupPicker';
import TagInput from '@/components/TagInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORY_VALUES, VENDOR_STATUS, VENDOR_CHECKS, categoryLabel } from '@/services/dealRules';

const toArray = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',') : []);

export function vendorToForm(v) {
  return {
    Name: v?.Name ?? '',
    category_c: v?.category_c ?? 'Cleaning',
    contactName_c: v?.contactName_c ?? '',
    phone_c: v?.phone_c ?? '',
    email_c: v?.email_c ?? '',
    locality_c: v?.locality_c?.Id ?? v?.locality_c ?? null,
    status_c: v?.status_c ?? 'Probation',
    checks_c: toArray(v?.checks_c),
    rating_c: v?.rating_c === null || v?.rating_c === undefined ? '' : String(v.rating_c),
    jobsDone_c: v?.jobsDone_c === null || v?.jobsDone_c === undefined ? '0' : String(v.jobsDone_c),
    notes_c: v?.notes_c ?? '',
  };
}

function Field({ label, htmlFor, error, hint, children }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default function VendorForm({ initial, saving, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  function submit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.Name.trim()) errs.Name = 'Business name is required';
    if (form.email_c && !/^\S+@\S+\.\S+$/.test(form.email_c)) errs.email_c = 'Enter a valid email';
    if (form.rating_c !== '' && (Number(form.rating_c) < 0 || Number(form.rating_c) > 5)) errs.rating_c = 'Rating is between 0 and 5';
    if (form.status_c === 'Active' && !form.checks_c.includes('ID proof')) errs.checks_c = 'An active vendor needs at least an ID check';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit({
      Name: form.Name.trim(),
      category_c: form.category_c,
      contactName_c: form.contactName_c.trim() || null,
      phone_c: form.phone_c.trim() || null,
      email_c: form.email_c.trim() || null,
      locality_c: form.locality_c || null,
      status_c: form.status_c,
      checks_c: form.checks_c.join(','),
      rating_c: form.rating_c === '' ? null : Number(form.rating_c),
      jobsDone_c: form.jobsDone_c === '' ? 0 : Number(form.jobsDone_c),
      notes_c: form.notes_c.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="grid gap-4 rounded-[22px] bg-card shadow-sm p-5 shadow-sm">
        <h2 className="font-heading text-base font-bold text-foreground">Business</h2>
        <Field label="Business name" htmlFor="vf-name" error={errors.Name}>
          <Input id="vf-name" value={form.Name} onChange={set('Name')} placeholder="e.g. Sparkle Home Care" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select value={form.category_c} onValueChange={set('category_c')}>
              <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_VALUES.map((c) => (
                  <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Main locality">
            <LookupPicker table="localities_c" searchField="Name" value={form.locality_c} onChange={set('locality_c')} placeholder="Choose a locality" aria-label="Main locality" clearable />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 rounded-[22px] bg-card shadow-sm p-5 shadow-sm">
        <h2 className="font-heading text-base font-bold text-foreground">Contact</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Contact person" htmlFor="vf-contact">
            <Input id="vf-contact" value={form.contactName_c} onChange={set('contactName_c')} placeholder="e.g. Ramesh Babu" />
          </Field>
          <Field label="Phone" htmlFor="vf-phone">
            <Input id="vf-phone" value={form.phone_c} onChange={set('phone_c')} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Email" htmlFor="vf-email" error={errors.email_c}>
            <Input id="vf-email" type="email" value={form.email_c} onChange={set('email_c')} placeholder="hello@business.in" />
          </Field>
        </div>
      </section>

      <section className="grid gap-4 rounded-[22px] bg-card shadow-sm p-5 shadow-sm">
        <h2 className="font-heading text-base font-bold text-foreground">Checks and standing</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status" hint="New vendors start on probation, capped at 20 orders.">
            <Select value={form.status_c} onValueChange={set('status_c')}>
              <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VENDOR_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Rating" htmlFor="vf-rating" error={errors.rating_c}>
            <Input id="vf-rating" type="number" step="0.1" min={0} max={5} value={form.rating_c} onChange={set('rating_c')} placeholder="4.5" />
          </Field>
          <Field label="Jobs done" htmlFor="vf-jobs">
            <Input id="vf-jobs" type="number" min={0} value={form.jobsDone_c} onChange={set('jobsDone_c')} placeholder="0" />
          </Field>
        </div>
        <Field label="Checks done" error={errors.checks_c}>
          <TagInput value={form.checks_c} onChange={set('checks_c')} availableTags={VENDOR_CHECKS} placeholder="Add checks" />
        </Field>
        <Field label="Notes" htmlFor="vf-notes">
          <Textarea id="vf-notes" rows={3} value={form.notes_c} onChange={set('notes_c')} placeholder="Crew size, daily capacity, anything the team should know" />
        </Field>
      </section>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <ApperIcon name="LoaderCircle" size={16} className="animate-spin" />
              Saving…
            </>
          ) : submitLabel}
        </Button>
      </div>
    </form>
  );
}
