import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { readLocality, saveLocality, useLocality } from '@/services/locality';
import { cn } from '@/lib/utils';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** "Where do you live?" on the homepage: pick a locality, see its deals. */
export default function AreaPicker({ className }) {
  const navigate = useNavigate();
  const [area, setArea] = useState(readLocality);
  const { list } = useLocality();

  function go(e) {
    e.preventDefault();
    saveLocality(area);
    navigate(area ? `/deals?locality=${area}` : '/deals');
  }

  return (
    <form onSubmit={go} className={cn('flex w-full flex-col gap-2 sm:flex-row', className)}>
      <label htmlFor="home-area" className="sr-only">Your locality</label>
      <Select value={area} onValueChange={setArea}>
        <SelectTrigger id="home-area" className="h-12 w-full flex-1 rounded-full bg-card px-5 text-base shadow-sm data-[size=default]:h-12">
          <span className="flex min-w-0 items-center gap-2">
            <ApperIcon name="MapPin" size={18} className="flex-none text-primary" />
            <SelectValue placeholder="Where do you live?" />
          </span>
        </SelectTrigger>
        <SelectContent>
          {list.map((l) => (
            <SelectItem key={l.Id} value={String(l.Id)} disabled={l.status_c !== 'Live'}>
              {l.Name}
              {l.pincode_c ? `, ${l.pincode_c}` : ''}
              {l.status_c !== 'Live' ? ' (coming soon)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" size="lg" className="h-12 rounded-full px-7 text-base">
        {area ? 'See deals here' : 'See all deals'}
      </Button>
    </form>
  );
}
