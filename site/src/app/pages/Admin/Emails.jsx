import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatRelativeTime } from '@/utils/date';
import { cn } from '@/lib/utils';
import ApperIcon from '@/components/ApperIcon';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const route = { path: '/admin/emails', layout: 'owner', access: "profile === 'Admin_c'" };
export const nav = { icon: 'Mail', label: 'Emails', order: 92, profiles: ['Admin_c'] };

const GROUPS = [
  { role: 'Customer_c', label: 'Neighbours' },
  { role: 'Vendor_c', label: 'Vendors' },
  { role: 'Ambassador_c', label: 'Ambassadors' },
  { role: 'All', label: 'Everyone' },
  { role: 'Admin_c', label: 'Lotmates team' },
];
const EDITABLE = ['enabled', 'subject', 'heading', 'body', 'button', 'link', 'footnote', 'delay'];
const pickEditable = (t) => Object.fromEntries(EDITABLE.map((k) => [k, t?.[k] ?? (k === 'enabled' ? true : '')]));
const same = (a, b) => JSON.stringify(pickEditable(a)) === JSON.stringify(pickEditable(b));

export default function Emails() {
  const [tab, setTab] = useState('templates');
  const { data, loading, error, run, setData } = useFetch(async () => {
    const r = await sdk.emails.list();
    if (!r.ok) throw new Error(r.error.message);
    return r.value.templates;
  }, []);
  const [active, setActive] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [mobileEditor, setMobileEditor] = useState(false);
  const templates = data ?? [];

  useEffect(() => {
    if (!active && templates.length) setActive(templates[0].event);
  }, [templates, active]);

  const current = templates.find((t) => t.event === active);
  const draft = (current && drafts[current.event]) || current;

  function replace(t) {
    setData((list) => (list ?? []).map((x) => (x.event === t.event ? { ...x, ...t } : x)));
    setDrafts((d) => {
      const n = { ...d };
      delete n[t.event];
      return n;
    });
  }

  async function toggle(t, enabled) {
    const r = await sdk.emails.save(t.event, { ...pickEditable(t), enabled });
    if (!r.ok) return toast.error(r.error.message);
    replace(r.value);
    toast.success(enabled ? `“${t.name}” will be sent` : `“${t.name}” is switched off`);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-[1.875rem] font-bold leading-[1.05] tracking-tight text-foreground md:text-[2.5rem]">Emails</h1>
        <p className="mt-2 max-w-prose text-base text-muted-foreground">Everything Lotmates sends, and when. Change the wording, switch an email off, or send yourself a test.</p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'sent' ? (
        <SentLog templates={templates} />
      ) : error && !data ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card p-10 text-center shadow-sm">
          <p className="text-muted-foreground">The emails didn't load. {String(error)}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && !data ? (
        <ListSkeleton rows={6} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
          <nav aria-label="Email templates" className={cn('space-y-6', mobileEditor && 'hidden lg:block')}>
            {GROUPS.map((g) => {
              const list = templates.filter((t) => t.role === g.role);
              if (!list.length) return null;
              return (
                <section key={g.role}>
                  <h2 className="px-1 pb-2 text-sm text-muted-foreground">{g.label}</h2>
                  <ul className="divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm">
                    {list.map((t) => {
                      const isActive = t.event === active;
                      const unsaved = drafts[t.event] && !same(drafts[t.event], t);
                      return (
                        <li key={t.event} className={cn('flex items-center gap-3 px-4 py-3.5 transition-colors', isActive ? 'bg-primary/[0.06]' : 'hover:bg-accent/50')}>
                          <button
                            type="button"
                            onClick={() => {
                              setActive(t.event);
                              setMobileEditor(true);
                            }}
                            className="min-w-0 flex-1 text-left focus-visible:outline-none"
                            aria-current={isActive ? 'true' : undefined}
                          >
                            <p className={cn('flex items-center gap-2 truncate font-medium', t.enabled ? 'text-foreground' : 'text-muted-foreground')}>
                              {t.name}
                              {unsaved && <span title="Unsaved changes" className="size-2 flex-none rounded-full bg-highlight" />}
                            </p>
                            <p className="truncate text-[13px] text-muted-foreground">
                              {t.enabled ? (t.sent30 ? `${t.sent30} sent in 30 days` : 'Not sent recently') : 'Off'}
                              {t.edited ? ', edited' : ''}
                            </p>
                          </button>
                          <Switch checked={t.enabled} onCheckedChange={(v) => toggle(t, v)} aria-label={`Send “${t.name}”`} />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </nav>

          {current && (
            <div className={cn('lg:sticky lg:top-6', !mobileEditor && 'hidden lg:block')}>
              <button type="button" onClick={() => setMobileEditor(false)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden">
                <ApperIcon name="ChevronLeft" size={16} />
                All emails
              </button>
              <Editor
                key={current.event}
                saved={current}
                draft={draft}
                onDraft={(d) => setDrafts((all) => ({ ...all, [current.event]: d }))}
                onSaved={replace}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Editor({ saved, draft, onDraft, onSaved }) {
  const [mode, setMode] = useState('edit');
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState(null);
  const lastField = useRef({ name: 'body', el: null });
  const dirty = !same(draft, saved);
  const set = (k) => (e) => onDraft({ ...draft, [k]: e?.target ? e.target.value : e });
  const locked = (k) => (saved.locked ?? []).includes(k);

  const focusTrack = (name) => ({
    onFocus: (e) => {
      lastField.current = { name, el: e.target };
    },
  });

  function insertTag(tag) {
    const { name, el } = lastField.current;
    const text = `{${tag}}`;
    const value = String(draft[name] ?? '');
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onDraft({ ...draft, [name]: value.slice(0, start) + text + value.slice(end) });
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(start + text.length, start + text.length);
      }
    });
  }

  useEffect(() => {
    if (mode !== 'preview') return;
    let stop = false;
    setPreview(null);
    sdk.emails.preview({ event: saved.event, ...pickEditable(draft) }).then((r) => {
      if (!stop) setPreview(r.ok ? r.value : { error: r.error.message });
    });
    return () => {
      stop = true;
    };
  }, [mode, draft, saved.event]);

  async function save() {
    setBusy('save');
    const r = await sdk.emails.save(saved.event, pickEditable(draft));
    setBusy('');
    if (!r.ok) return toast.error(r.error.message);
    onSaved(r.value);
    toast.success('Saved. The next email uses this wording.');
  }

  async function test() {
    setBusy('test');
    const r = await sdk.emails.test({ event: saved.event, ...pickEditable(draft) });
    setBusy('');
    if (!r.ok) return toast.error(r.error.message);
    toast.success(`Test sent to ${r.value.to}`);
  }

  async function reset() {
    setBusy('reset');
    const r = await sdk.emails.reset(saved.event);
    setBusy('');
    if (!r.ok) return toast.error(r.error.message);
    onSaved(r.value);
    toast.success('Back to the original wording');
  }

  const field = 'h-11 bg-background/60';

  return (
    <section className="rounded-[22px] bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6">
        <div className="min-w-0">
          <h2 className="font-heading text-xl font-bold text-foreground">{saved.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{saved.when}</p>
          {saved.attachment && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[13px] text-foreground">
              <ApperIcon name="Paperclip" size={13} />
              {saved.attachment} attached
            </p>
          )}
        </div>
        <div className="w-full sm:w-56">
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {mode === 'edit' ? (
        <div className="grid gap-5 p-6">
          {!draft.enabled && (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">This email is switched off, so it won't send on its own. Invoices and notices you send by hand still go out.</p>
          )}
          {saved.delay != null && (
            <div className="grid gap-2">
              <label htmlFor="em-delay" className="text-sm font-medium text-foreground">When it sends</label>
              <div className="flex items-center gap-3">
                <Input id="em-delay" type="number" min={1} max={saved.delayMax ?? 168} value={draft.delay ?? ''} onChange={set('delay')} className={cn(field, 'w-24')} />
                <span className="text-sm text-muted-foreground">{saved.delayLabel}</span>
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <label htmlFor="em-subject" className="text-sm font-medium text-foreground">Subject</label>
            <Input id="em-subject" value={draft.subject} onChange={set('subject')} className={field} {...focusTrack('subject')} />
          </div>
          <div className="grid gap-2">
            <label htmlFor="em-heading" className="text-sm font-medium text-foreground">Heading</label>
            <Input id="em-heading" value={draft.heading} onChange={set('heading')} className={field} {...focusTrack('heading')} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="em-body" className="text-sm font-medium text-foreground">Message</label>
              <span className="text-[13px] text-muted-foreground">A blank line starts a new paragraph. Start lines with “- ” for a list.</span>
            </div>
            <Textarea id="em-body" rows={9} value={draft.body} onChange={set('body')} className="bg-background/60 text-[15px] leading-6" {...focusTrack('body')} />
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium text-foreground">Fill-ins</p>
            <p className="text-[13px] text-muted-foreground">Click one to add it where your cursor is. Each is replaced with the real detail when the email goes out.</p>
            <div className="flex flex-wrap gap-1.5">
              {saved.tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertTag(t)}
                  className="rounded-md bg-muted px-2 py-1 text-[13px] text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {`{${t}}`}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="em-button" className="text-sm font-medium text-foreground">Button</label>
              <Input id="em-button" value={draft.button} onChange={set('button')} placeholder="Leave empty for no button" className={field} {...focusTrack('button')} />
            </div>
            <div className="grid gap-2">
              <label htmlFor="em-link" className="text-sm font-medium text-foreground">Button goes to</label>
              <Input id="em-link" value={draft.link} onChange={set('link')} readOnly={locked('link')} className={cn(field, locked('link') && 'text-muted-foreground')} {...focusTrack('link')} />
            </div>
          </div>
          <div className="grid gap-2">
            <label htmlFor="em-foot" className="text-sm font-medium text-foreground">Small print</label>
            <Textarea id="em-foot" rows={2} value={draft.footnote} onChange={set('footnote')} className="bg-background/60" {...focusTrack('footnote')} />
          </div>
        </div>
      ) : (
        <div className="p-6">
          {!preview ? (
            <div className="flex h-[520px] items-center justify-center rounded-2xl bg-muted/50 text-sm text-muted-foreground">
              <ApperIcon name="LoaderCircle" size={18} className="mr-2 animate-spin" />
              Building the preview
            </div>
          ) : preview.error ? (
            <p className="text-sm text-destructive">{preview.error}</p>
          ) : (
            <>
              <p className="mb-3 text-sm">
                <span className="text-muted-foreground">Subject: </span>
                <span className="font-medium text-foreground">{preview.subject}</span>
              </p>
              <iframe title="Email preview" srcDoc={preview.html} sandbox="" className="h-[620px] w-full rounded-2xl border border-border bg-[#f3f6f2]" />
              <p className="mt-2 text-[13px] text-muted-foreground">Filled in with sample details. Real emails use each person's own.</p>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          {saved.edited && (
            <button type="button" onClick={reset} disabled={busy === 'reset'} className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Back to original wording
            </button>
          )}
          {dirty && (
            <button type="button" onClick={() => onDraft(saved)} className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Undo changes
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={test} disabled={busy === 'test'} className="h-11 rounded-full px-5">
            <ApperIcon name={busy === 'test' ? 'LoaderCircle' : 'Send'} size={16} className={busy === 'test' ? 'animate-spin' : ''} />
            Send me a test
          </Button>
          <Button onClick={save} disabled={!dirty || busy === 'save'} className="h-11 rounded-full px-6">
            {busy === 'save' ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </section>
  );
}

function SentLog({ templates }) {
  const [event, setEvent] = useState('');
  const names = useMemo(() => Object.fromEntries(templates.map((t) => [t.event, t.name])), [templates]);
  const { data, loading, error, run } = useFetch(async () => {
    const r = await sdk.emails.log(event);
    if (!r.ok) throw new Error(r.error.message);
    return r.value.log;
  }, [event]);
  const rows = data ?? [];
  const tone = { sent: 'text-[oklch(0.46_0.12_150)]', failed: 'text-destructive', test: 'text-muted-foreground' };
  const label = { sent: 'Sent', failed: "Didn't send", test: 'Test' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          aria-label="Filter by email"
          className="h-11 rounded-full border border-input bg-card px-4 text-sm text-foreground"
        >
          <option value="">All emails</option>
          {templates.map((t) => (
            <option key={t.event} value={t.event}>{t.name}</option>
          ))}
        </select>
        <Button variant="ghost" onClick={run} className="h-11 rounded-full">
          <ApperIcon name="RefreshCw" size={16} />
          Refresh
        </Button>
      </div>
      {error ? (
        <p className="text-muted-foreground">The list didn't load. {String(error)}</p>
      ) : loading && !data ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <p className="rounded-[22px] bg-card p-8 text-center text-muted-foreground shadow-sm">Nothing sent yet.</p>
      ) : (
        <div className="overflow-hidden rounded-[22px] bg-card shadow-sm">
          <div className="hidden grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,0.6fr)] gap-4 border-b border-border px-6 py-3 text-[13px] text-muted-foreground md:grid">
            <span>Email</span>
            <span>To</span>
            <span>Subject</span>
            <span className="text-right">When</span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((r, i) => (
              <li key={i} className="grid gap-x-4 gap-y-0.5 px-6 py-3.5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,0.6fr)] md:items-center">
                <p className="truncate font-medium text-foreground">
                  {names[r.event] ?? r.event}
                  <span className={cn('ml-2 text-[13px] font-normal', tone[r.status])}>{label[r.status] ?? r.status}</span>
                </p>
                <p className="truncate text-sm text-muted-foreground">{r.toEmail}</p>
                <p className="truncate text-sm text-foreground">{r.subject}</p>
                <p className="text-[13px] text-muted-foreground md:text-right">{formatRelativeTime(r.createdOn)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
