import { Link } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';

export default function PageHeader({ title, description, back, actions, children }) {
  return (
    <header className="space-y-4 pb-2">
      {back && (
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link to={back.to}>
            <ApperIcon name="ArrowLeft" size={16} />
            {back.label}
          </Link>
        </Button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-[1.875rem] font-bold leading-[1.05] tracking-tight text-foreground md:text-[2.5rem]">
            {title}
          </h1>
          {description && <p className="mt-2 max-w-prose text-base text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
