import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function initialsOf(person) {
  const name = person?.name || [person?.firstName, person?.lastName].filter(Boolean).join(' ') || person?.emailAddress || person?.email || '';
  return name.split(/[\s@.]+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

/**
 * A person's picture: the photo they uploaded, else their Gravatar, else their initials.
 * Gravatar answers "not found" for people without one, and the initials show instead.
 */
export default function UserAvatar({ person, className, fallbackClassName, initials }) {
  const src = person?.avatar || person?.gravatar || undefined;
  return (
    <Avatar className={cn('size-9', className)}>
      {src && <AvatarImage src={src} alt="" className="object-cover" referrerPolicy="no-referrer" />}
      <AvatarFallback className={cn('bg-primary font-semibold text-primary-foreground', fallbackClassName)}>{initials || initialsOf(person)}</AvatarFallback>
    </Avatar>
  );
}
