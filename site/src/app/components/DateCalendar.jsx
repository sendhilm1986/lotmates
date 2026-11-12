import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import ApperIcon from '@/components/ApperIcon';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => (s ? new Date(`${s}T00:00:00`) : null);
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * A month calendar in the Lotmates style, for picking one day inside a window.
 * Days before `min` or after `max` can't be chosen. Arrow keys move between days.
 */
export default function DateCalendar({ value, onChange, min, max, className, label = 'Choose a date', isDisabled }) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const minD = parse(min);
  const maxD = parse(max);
  const start = parse(value) ?? (minD && minD > today ? minD : today);
  const [view, setView] = useState(new Date(start.getFullYear(), start.getMonth(), 1));

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const daysIn = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))];
  const blocked = (d) => (minD && d < minD) || (maxD && d > maxD) || Boolean(isDisabled?.(iso(d)));
  const canPrev = !minD || new Date(view.getFullYear(), view.getMonth(), 0) >= minD;
  const canNext = !maxD || new Date(view.getFullYear(), view.getMonth() + 1, 1) <= maxD;
  const move = (n) => setView(new Date(view.getFullYear(), view.getMonth() + n, 1));
  const title = view.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  function onKey(e, d) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = new Date(d);
    next.setDate(d.getDate() + step);
    if (blocked(next)) return;
    if (next.getMonth() !== view.getMonth()) setView(new Date(next.getFullYear(), next.getMonth(), 1));
    onChange(iso(next));
    requestAnimationFrame(() => document.querySelector(`[data-day="${iso(next)}"]`)?.focus());
  }

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5', className)} role="group" aria-label={label}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={!canPrev}
          aria-label="Previous month"
          className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted disabled:text-muted-foreground/30 disabled:hover:bg-transparent"
        >
          <ApperIcon name="ChevronLeft" size={18} />
        </button>
        <p className="font-heading text-base font-bold text-foreground" aria-live="polite">{title}</p>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={!canNext}
          aria-label="Next month"
          className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted disabled:text-muted-foreground/30 disabled:hover:bg-transparent"
        >
          <ApperIcon name="ChevronRight" size={18} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center" role="row">
        {WEEK.map((w) => (
          <span key={w} className="py-1 text-xs text-muted-foreground">{w}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1" role="grid">
        {cells.map((d, i) => {
          if (!d) return <span key={`b${i}`} />;
          const key = iso(d);
          const off = blocked(d);
          const selected = key === value;
          const isToday = d.getTime() === today.getTime();
          return (
            <button
              key={key}
              type="button"
              data-day={key}
              disabled={off}
              onClick={() => onChange(key)}
              onKeyDown={(e) => onKey(e, d)}
              tabIndex={selected || (!value && isToday) ? 0 : -1}
              aria-pressed={selected}
              aria-label={d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
              className={cn(
                'relative flex aspect-square w-full items-center justify-center rounded-xl text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                selected
                  ? 'bg-primary font-semibold text-primary-foreground shadow-sm'
                  : off
                    ? 'cursor-not-allowed text-muted-foreground/35'
                    : 'font-medium text-foreground hover:bg-primary/10',
              )}
            >
              {d.getDate()}
              {isToday && <span aria-hidden className={cn('absolute bottom-1.5 size-1 rounded-full', selected ? 'bg-primary-foreground' : 'bg-primary')} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
