import { Link, NavLink, useParams } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { POLICIES, LAST_UPDATED, COMPANY, policyBySlug } from '@/services/legal';

export const route = { path: '/legal/:slug', layout: 'public', access: 'public' };

function Block({ block }) {
  if (typeof block === 'string') {
    return <p className="text-base leading-7 text-foreground/85">{block}</p>;
  }
  if (block?.list) {
    return (
      <ul className="space-y-2.5">
        {block.list.map((item) => (
          <li key={item} className="flex gap-3 text-base leading-7 text-foreground/85">
            <span className="mt-[0.7rem] h-1.5 w-1.5 flex-none rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  return null;
}

function PolicyNav({ active }) {
  return (
    <nav aria-label="Policies" className="space-y-1">
      {POLICIES.map((p) => (
        <NavLink
          key={p.slug}
          to={`/legal/${p.slug}`}
          className={cn(
            'block rounded-xl px-3 py-2 text-sm transition-colors duration-(--transition-fast)',
            p.slug === active ? 'bg-card font-medium text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {p.title}
        </NavLink>
      ))}
      <NavLink
        to="/contact"
        className="block rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors duration-(--transition-fast) hover:text-foreground"
      >
        Contact us
      </NavLink>
    </nav>
  );
}

export default function LegalPage() {
  const { slug } = useParams();
  const policy = policyBySlug(slug);

  if (!policy) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 py-24 text-center">
        <h1 className="font-heading text-3xl font-bold text-foreground">We couldn't find that policy</h1>
        <p className="mt-3 text-muted-foreground">The link may be out of date.</p>
        <Button asChild className="mt-8">
          <Link to="/legal">See all policies</Link>
        </Button>
      </div>
    );
  }

  const others = POLICIES.filter((p) => p.slug !== policy.slug);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-8 md:py-16">
      <div className="grid gap-12 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <Link to="/legal" className="mb-4 inline-flex items-center gap-1.5 px-3 text-sm font-medium text-primary hover:underline">
              <ApperIcon name="ArrowLeft" size={14} />
              All policies
            </Link>
            <PolicyNav active={policy.slug} />
          </div>
        </aside>

        <article className="min-w-0 max-w-2xl">
          <Link to="/legal" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline lg:hidden">
            <ApperIcon name="ArrowLeft" size={14} />
            All policies
          </Link>
          <h1 className="font-heading text-[2.25rem] font-bold leading-[1.05] tracking-tight text-foreground md:text-5xl">{policy.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
          <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
            <ApperIcon name="Info" size={16} className="mt-0.5 flex-none" />
            Demo draft. Details in [brackets] are placeholders until the company details are filled in.
          </p>

          <div className="mt-8 rounded-[24px] bg-card p-6 shadow-md md:p-8">
            <h2 className="font-heading text-lg font-bold text-foreground">In short</h2>
            <ul className="mt-4 space-y-3">
              {policy.inShort.map((line) => (
                <li key={line} className="flex gap-3 text-base leading-7 text-foreground">
                  <ApperIcon name="Check" size={18} className="mt-1 flex-none text-primary" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12 space-y-10">
            {policy.sections.map((s) => (
              <section key={s.heading} className="space-y-3">
                <h2 className="font-heading text-xl font-bold tracking-tight text-foreground md:text-2xl">{s.heading}</h2>
                {s.body.map((b, i) => (
                  <Block key={i} block={b} />
                ))}
                {s.links?.length > 0 && (
                  <p className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
                    {s.links.map((l) => (
                      <Link key={l.to} to={l.to} className="text-base font-medium text-primary hover:underline">
                        Read {l.label}
                      </Link>
                    ))}
                  </p>
                )}
              </section>
            ))}
          </div>

          <div className="mt-14 rounded-[24px] bg-card p-6 shadow-md md:p-8">
            <h2 className="font-heading text-lg font-bold text-foreground">Questions about this policy?</h2>
            <p className="mt-2 text-base text-muted-foreground">
              Write to {COMPANY.email}, or contact our Grievance Officer. We reply within 24 hours on working days.
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link to="/contact">Contact us</Link>
            </Button>
          </div>

          <div className="mt-14 lg:hidden">
            <h2 className="font-heading text-lg font-bold text-foreground">Other policies</h2>
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[20px] bg-card shadow-md">
              {others.map((p) => (
                <li key={p.slug}>
                  <Link to={`/legal/${p.slug}`} className="flex items-center justify-between gap-3 px-5 py-4 text-base text-foreground">
                    {p.title}
                    <ApperIcon name="ChevronRight" size={16} className="text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>
    </div>
  );
}
