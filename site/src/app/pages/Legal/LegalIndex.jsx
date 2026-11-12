import { Link } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';
import { POLICIES, LAST_UPDATED } from '@/services/legal';

export const route = { path: '/legal', layout: 'public', access: 'public' };

const GROUPS = [
  { key: 'neighbours', title: 'For neighbours' },
  { key: 'partners', title: 'For vendors and ambassadors' },
];

function PolicyCard({ policy }) {
  return (
    <Link
      to={policy.to ?? `/legal/${policy.slug}`}
      className="group flex flex-col rounded-[24px] bg-card p-6 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ApperIcon name={policy.icon} size={20} />
        </span>
        <ApperIcon name="ArrowUpRight" size={18} className="mt-1 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      <h3 className="mt-5 font-heading text-xl font-bold leading-tight tracking-tight text-foreground">{policy.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{policy.summary}</p>
    </Link>
  );
}

export default function LegalIndex() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-24">
      <div className="max-w-2xl">
        <h1 className="font-heading text-[2.5rem] font-bold leading-[1.02] tracking-tight text-foreground md:text-6xl">Policies</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          The rules for neighbours, vendors and ambassadors, written in plain words. Last updated {LAST_UPDATED}.
        </p>
      </div>

      {GROUPS.map((g) => (
        <section key={g.key} className="mt-14 md:mt-20">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">{g.title}</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {POLICIES.filter((p) => p.group === g.key).map((p) => (
              <PolicyCard key={p.slug} policy={p} />
            ))}
            {g.key === 'neighbours' && (
              <PolicyCard
                policy={{
                  slug: 'contact',
                  to: '/contact',
                  icon: 'Mail',
                  title: 'Contact us',
                  summary: 'Our business details, support hours and the Grievance Officer.',
                }}
              />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
