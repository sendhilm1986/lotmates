import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import ApperIcon from '@/components/ApperIcon';
import PageHeader from '@/components/PageHeader';
import { ListSkeleton } from '@/components/PageSkeleton';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JOB_FIELDS, unwrapList } from '@/services/records';

export const route = { path: '/vendor', layout: 'owner', access: "profile === 'Vendor_c'" };
export const nav = { icon: 'CalendarCheck', label: 'Jobs', order: 5, profiles: ['Vendor_c'] };

const { isIn } = window.ApperSDK.CoreSDK;

const VIEWS = {
  todo: { label: 'To do', statuses: ['Confirmed', 'Booked'] },
  done: { label: 'Done', statuses: ['Done'] },
};

export default function Jobs() {
  const navigate = useNavigate();
  const [view, setView] = useState('todo');

  const { data, loading, error, run } = useFetch(() => {
    let q = sdk
      .table('bookings_c')
      .select(JOB_FIELDS)
      .where(isIn('status_c', VIEWS[view].statuses));
    q = view === 'done' ? q.orderByDesc('doneOn_c') : q.orderBy('preferredDate_c');
    return q.page(1, 60).fetch().then(unwrapList);
  }, [view]);

  const rows = data ?? [];
  const ready = rows.filter((r) => r.status_c === 'Confirmed').length;
  const waiting = rows.filter((r) => r.status_c === 'Booked').length;

  const groups = [];
  rows.forEach((r) => {
    const key = (view === 'done' ? r.doneOn_c : r.preferredDate_c) ?? 'none';
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(r);
    else groups.push({ key, items: [r] });
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Jobs"
        description={
          view === 'todo'
            ? `${ready} ready to do. ${waiting} waiting for their deal to close.`
            : 'Finished jobs, newest first.'
        }
      >
        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="todo">To do</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card shadow-sm p-8 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load jobs: {error.message}</p>
          <Button variant="outline" onClick={run}>Try again</Button>
        </div>
      ) : loading && data === undefined ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <div className="rounded-[22px] bg-card shadow-sm p-8 text-center">
          <ApperIcon name="CalendarCheck" size={26} className="mx-auto text-muted-foreground" />
          <p className="mt-2 font-medium text-foreground">
            {view === 'todo' ? 'No jobs scheduled' : 'No finished jobs yet'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Jobs appear here as neighbours book your deals.</p>
        </div>
      ) : (
        <div aria-busy={loading} className={cn('space-y-5 transition-opacity', loading && 'opacity-60')}>
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                {g.key === 'none' ? 'Any day in the service window' : formatLocalDate(g.key, DATE_FORMATS.SHORT)}
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-[22px] bg-card shadow-sm">
                {g.items.map((job) => (
                  <li key={job.Id}>
                    <div
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(`/vendor/jobs/${job.Id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') navigate(`/vendor/jobs/${job.Id}`);
                      }}
                      className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-(--transition-fast) hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span
                        className={cn(
                          'h-10 w-1 flex-none rounded-full',
                          job.status_c === 'Confirmed' ? 'bg-primary' : job.status_c === 'Done' ? 'bg-success' : 'bg-border',
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{job.deal_c?.Name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {job.preferredSlot_c ? `${job.preferredSlot_c.split(',')[0]}, ` : ''}
                          {job.community_c?.Name ?? job.locality_c?.Name ?? 'Area not set'}, {job.homes_c ?? 1} {Number(job.homes_c) > 1 ? 'units' : 'unit'}
                        </p>
                      </div>
                      <span className="text-right text-xs text-muted-foreground">
                        {job.status_c === 'Booked' ? 'Deal still open' : job.status_c === 'Done' ? 'Done' : 'Ready'}
                      </span>
                      <ApperIcon name="ChevronRight" size={18} className="flex-none text-muted-foreground" />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
