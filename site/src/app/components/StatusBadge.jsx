import { cn } from '@/lib/utils';

// One colour per meaning, used for every status in the app.
const TONE = {
  active: 'bg-primary/10 text-primary [--dot:var(--primary)]',
  positive: 'bg-success/12 text-[oklch(0.46_0.12_150)] [--dot:var(--success)] dark:text-success',
  waiting: 'bg-warning/12 text-[oklch(0.5_0.13_50)] [--dot:var(--warning)] dark:text-warning',
  info: 'bg-[oklch(0.6_0.12_250)]/12 text-[oklch(0.46_0.12_255)] [--dot:oklch(0.6_0.12_250)] dark:text-[oklch(0.75_0.1_250)]',
  negative: 'bg-destructive/10 text-destructive [--dot:var(--destructive)]',
  neutral: 'bg-muted text-muted-foreground [--dot:color-mix(in_oklch,var(--muted-foreground)_60%,transparent)]',
};

const TONE_OF = {
  Live: 'active', Booked: 'active', Open: 'active',
  Closed: 'positive', Confirmed: 'positive', Done: 'positive', Paid: 'positive', Active: 'positive', Resolved: 'positive', Approved: 'positive',
  'Awaiting vendor': 'waiting', 'Awaiting team': 'waiting', 'Changes requested': 'info',
  Pending: 'waiting', Due: 'waiting', Probation: 'waiting', 'In review': 'waiting', New: 'waiting', Onboarding: 'waiting', 'Coming soon': 'waiting',
  Refunded: 'info', Contacted: 'info', Reviewing: 'info', Checking: 'info',
  Failed: 'negative', Removed: 'negative', Rejected: 'negative',
  Draft: 'neutral', Cancelled: 'neutral', None: 'neutral', Paused: 'neutral', Declined: 'neutral',
};

export default function StatusBadge({ value, className, label }) {
  if (!value) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[13px] font-medium leading-5', TONE[TONE_OF[value] ?? 'neutral'], className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-(--dot)" />
      {label ?? value}
    </span>
  );
}
