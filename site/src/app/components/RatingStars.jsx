import ApperIcon from '@/components/ApperIcon';
import { cn } from '@/lib/utils';

export default function RatingStars({ value = 0, onChange, size = 16, className }) {
  const n = Math.round(Number(value) || 0);
  if (!onChange) {
    return (
      <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${n} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <ApperIcon
            key={i}
            name="Star"
            size={size}
            className={i <= n ? 'fill-primary text-primary' : 'text-border'}
          />
        ))}
      </span>
    );
  }
  return (
    <div className={cn('flex items-center gap-1', className)} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={n === i}
          aria-label={`${i} star${i > 1 ? 's' : ''}`}
          onClick={() => onChange(i)}
          className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-(--transition-fast) hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ApperIcon name="Star" size={26} className={i <= n ? 'fill-primary text-primary' : 'text-muted-foreground'} />
        </button>
      ))}
    </div>
  );
}
