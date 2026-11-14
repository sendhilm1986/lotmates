import { Link } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';
import { ListSkeleton } from '@/components/PageSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// The home page every role shares: a greeting with one main action, what needs you, then a few numbers.

const leadTone = {
  money: 'text-[oklch(0.5_0.13_70)]',
  urgent: 'text-destructive',
  calm: 'text-primary',
};

export function HomeHeader({ firstName, action }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-muted-foreground">{today}</p>
        <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
      </div>
      {action && (
        <Button asChild className="h-11 rounded-full px-5">
          <Link to={action.to}>
            <ApperIcon name={action.icon ?? 'Plus'} size={16} />
            {action.label}
          </Link>
        </Button>
      )}
    </header>
  );
}

/** tasks: [{ key, to, lead, tone: 'money' | 'urgent' | 'calm', title, note, cta }] */
export function NeedsYou({ tasks, loading, empty = 'Nothing is waiting on you.' }) {
  return (
    <section>
      <h2 className="font-heading text-xl font-bold text-foreground">Needs you</h2>
      {loading ? (
        <div className="mt-3"><ListSkeleton rows={2} /></div>
      ) : tasks.length === 0 ? (
        <p className="mt-3 text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-px overflow-hidden rounded-[22px] bg-border shadow-sm md:grid-cols-2">
          {tasks.map((t) => (
            <li key={t.key} className="bg-card">
              <Link to={t.to} className="group flex h-full min-h-[76px] items-center gap-4 px-5 py-3.5 transition-colors duration-(--transition-fast) hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none">
                <span className={cn('w-[4.5rem] flex-none font-heading text-lg font-bold tabular-nums', leadTone[t.tone] ?? leadTone.calm)}>{t.lead}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{t.title}</p>
                  <p className="truncate text-sm text-muted-foreground">{t.note}</p>
                </div>
                {t.cta ? (
                  <span className="flex-none rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary group-hover:bg-primary group-hover:text-primary-foreground">{t.cta}</span>
                ) : (
                  <ApperIcon name="ChevronRight" size={18} className="flex-none text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                )}
              </Link>
            </li>
          ))}
          {tasks.length % 2 === 1 && <li aria-hidden className="hidden bg-card md:block" />}
        </ul>
      )}
    </section>
  );
}

/** stats: up to four of { label, value, sub, to, title }. Each one opens the list behind its number. */
export function StatRow({ stats, loading }) {
  const cols = stats.length >= 4 ? 'sm:grid-cols-4' : stats.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <dl className={cn('grid grid-cols-2 overflow-hidden rounded-[22px] bg-card shadow-sm', cols)}>
      {stats.map((s, i) => {
        const body = (
          <>
            <dt className="flex items-center gap-1 text-sm text-muted-foreground">
              <span className="truncate">{s.label}</span>
              {s.to && <ApperIcon name="ChevronRight" size={14} className="flex-none opacity-0 transition-opacity group-hover:opacity-100" />}
            </dt>
            <dd className="mt-1 font-heading text-[1.75rem] font-bold leading-tight tabular-nums text-foreground">
              {loading ? <Skeleton className="h-8 w-20" /> : s.value}
            </dd>
            {!loading && s.sub && <dd className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{s.sub}</dd>}
          </>
        );
        const cell = cn('group block min-w-0 px-5 py-5', i % 2 === 1 && 'border-l border-border', i >= 2 && 'border-t border-border sm:border-t-0', i >= 1 && 'sm:border-l', s.to && 'transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none');
        return s.to ? (
          <Link key={s.label} to={s.to} title={s.title} className={cell}>{body}</Link>
        ) : (
          <div key={s.label} title={s.title} className={cell}>{body}</div>
        );
      })}
    </dl>
  );
}
