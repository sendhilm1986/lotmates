import { cn } from '@/lib/utils';

export default function MarkLogo({ className, tone = 'brand', withName = false, nameClassName }) {
  const ring = tone === 'light' ? 'var(--primary-foreground)' : 'var(--primary)';
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 1000 718"
        className="h-7 w-auto flex-none"
        role="img"
        aria-label="Lotmates"
      >
        <path
          d="M500 97.9 A297 297 0 0 0 500 620.1 A297 297 0 0 0 500 97.9 Z"
          fill="var(--highlight)"
        />
        <circle cx="358.5" cy="359" r="328" fill="none" stroke={ring} strokeWidth="62" />
        <circle cx="641.5" cy="359" r="328" fill="none" stroke={ring} strokeWidth="62" />
      </svg>
      {withName && (
        <span className={cn('font-heading text-xl font-extrabold tracking-tight', nameClassName)}>
          lotmates
        </span>
      )}
    </span>
  );
}
