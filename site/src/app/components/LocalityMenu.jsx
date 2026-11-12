import { useNavigate } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { saveLocality, useLocality } from '@/services/locality';

/** Header chip: shows your locality and lets you pick or change it from any page. */
export default function LocalityMenu({ className, ...rest }) {
  const navigate = useNavigate();
  const { id, name, list } = useLocality();

  function choose(l) {
    saveLocality(String(l.Id));
    navigate(`/deals?locality=${l.Id}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn('inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card/70 px-3.5 text-sm font-medium text-foreground outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring', className)}
        aria-label={name ? `Your locality: ${name}. Change it` : 'Choose your locality'}
        {...rest}
      >
        <ApperIcon name="MapPin" size={16} className="text-primary" />
        {name ?? 'Choose your locality'}
        <ApperIcon name="ChevronDown" size={14} className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground">Where do you live?</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {list.length === 0 && <DropdownMenuItem disabled>Loading areas…</DropdownMenuItem>}
        {list.map((l) => {
          const live = l.status_c === 'Live';
          const active = String(l.Id) === String(id);
          return (
            <DropdownMenuItem key={l.Id} disabled={!live} onSelect={() => choose(l)} className="justify-between">
              <span>
                {l.Name.replace(/\s*\(demo\)$/, '')}
                {l.pincode_c ? <span className="text-muted-foreground">, {l.pincode_c}</span> : null}
              </span>
              {active ? <ApperIcon name="Check" size={16} className="text-primary" /> : !live ? <span className="text-xs">Soon</span> : null}
            </DropdownMenuItem>
          );
        })}
        {id && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                saveLocality('');
                navigate('/deals');
              }}
            >
              Show all areas
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
