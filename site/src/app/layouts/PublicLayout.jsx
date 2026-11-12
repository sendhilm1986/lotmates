import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { startTour } from '@/components/GuidedTour';
import LocalityMenu from '@/components/LocalityMenu';
import { useProfile } from '@/hooks/useProfile';
import { cn } from '@/lib/utils';
import ApperIcon from '@/components/ApperIcon';
import ThemeToggle from '@/components/ThemeToggle';
import MarkLogo from '@/components/MarkLogo';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { COMPANY } from '@/services/legal';

const FOOTER_COLUMNS = [
  {
    title: 'Lotmates',
    links: [
      ['/deals', 'Deals'],
      ['/contact', 'Contact us'],
      ['/legal', 'All policies'],
    ],
  },
  {
    title: 'Policies',
    links: [
      ['/legal/terms', 'Terms of use'],
      ['/legal/privacy', 'Privacy policy'],
      ['/legal/refunds', 'Refunds and cancellations'],
      ['/legal/delivery', 'Service and delivery'],
      ['/legal/grievance', 'Complaints and grievances'],
    ],
  },
  {
    title: 'Partners',
    links: [
      ['/vendors', 'Become a vendor'],
      ['/vendor/login', 'Vendor sign in'],
      ['/ambassadors', 'Become an ambassador'],
      ['/ambassador/login', 'Ambassador sign in'],
      ['/legal/vendors', 'Vendor terms'],
      ['/legal/ambassadors', 'Ambassador terms'],
      ['/admin/login', 'Team sign in'],
    ],
  },
];

const HOME = {
  Admin_c: ['/admin', 'Admin dashboard'],
  Vendor_c: ['/vendor', 'My jobs'],
  Ambassador_c: ['/ambassador', 'My communities'],
};

export default function PublicLayout() {
  const { profile, isAuthenticated } = useProfile();
  const [dashboard, dashboardLabel] = HOME[profile] ?? ['/bookings', 'My bookings'];
  // Clear over the top of the page, solid once you scroll.
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // Replay the tour for the page you're on; anywhere else, the home tour.
  const takeTour = () => {
    if (/^\/deals\/\d+/.test(location.pathname)) startTour('deal');
    else if (location.pathname === '/') startTour('home');
    else navigate('/?tour=1');
  };
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const navClass = (active) =>
    cn(
      'relative inline-flex h-11 items-center rounded-lg px-2 text-[15px] font-medium sm:px-3 transition-colors duration-(--transition-fast)',
      active ? 'text-foreground' : 'text-foreground/75 hover:text-foreground',
    );
  const dot = <span aria-hidden="true" className="absolute bottom-1.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-highlight" />;

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header
        className={cn(
          'sticky top-0 z-(--z-sticky) transition-[background-color,box-shadow] duration-(--transition-normal)',
          scrolled ? 'bg-background/85 shadow-[0_1px_0_var(--border)] backdrop-blur-xl backdrop-saturate-150' : 'bg-transparent',
        )}
      >
        <div className="mx-auto flex h-[4.5rem] w-full max-w-6xl items-center gap-0.5 px-4 sm:gap-1 md:px-8">
          <Link to="/" className="mr-1 flex flex-none items-center sm:mr-3" aria-label="Lotmates home">
            <MarkLogo withName className="[&_svg]:h-7 sm:[&_svg]:h-8" nameClassName="text-lg text-primary sm:text-[1.35rem]" />
          </Link>
          <NavLink to="/deals" data-tour="deals-link" className={({ isActive }) => navClass(isActive)}>
            {({ isActive }) => (
              <>
                Deals
                {isActive && dot}
              </>
            )}
          </NavLink>
          <Link to="/#how-it-works" className={cn(navClass(false), 'hidden sm:inline-flex')}>
            How it works
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <LocalityMenu className="mr-1 hidden md:inline-flex" data-tour="locality" />
            {isAuthenticated ? (
              <Button asChild variant="ghost" className="h-11 gap-2 px-2.5 text-[15px]">
                <Link to={dashboard} aria-label={dashboardLabel}>
                  <ApperIcon name="CircleUserRound" size={22} />
                  <span className="hidden sm:inline">{dashboardLabel}</span>
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="h-11 px-2 text-[15px] sm:px-3">
                  <Link to="/customer/login">Sign in</Link>
                </Button>
                <Button asChild className="h-11 rounded-full px-4 text-[15px] sm:px-5">
                  <Link to="/customer/signup" data-tour="join">Join</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-5 py-12 text-sm text-muted-foreground md:px-8 md:py-16">
          <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <div className="space-y-3">
              <MarkLogo withName nameClassName="text-lg text-primary" />
              <p className="max-w-xs">Buy together. Pay less. Group deals for your locality, from checked local vendors.</p>
            </div>
            <div className="grid grid-cols-2 gap-8 md:col-span-3 md:grid-cols-3">
              {FOOTER_COLUMNS.map((col) => (
                <nav key={col.title} aria-label={col.title} className={col.title === 'Lotmates' ? 'col-span-2 md:col-span-1' : ''}>
                  <p className="font-medium text-foreground">{col.title}</p>
                  <ul className={cn('mt-2 gap-y-0', col.title === 'Lotmates' ? 'flex flex-wrap gap-x-5 md:block md:space-y-0' : 'space-y-0')}>
                    {col.links.map(([to, label]) => (
                      <li key={to}>
                        <Link to={to} className="inline-block py-1.5 hover:text-foreground">{label}</Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 md:flex-row md:items-center md:justify-between">
            <p className="text-xs">
              © 2026 {COMPANY.legalName}. Lotmates is a marketplace: each deal is provided by the independent vendor named on it.
            </p>
            <div className="flex items-center gap-4">
              <button type="button" onClick={takeTour} className="text-xs font-medium text-foreground underline-offset-4 hover:underline">
                Take the tour
              </button>
              <p className="text-xs">Photos from Unsplash</p>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
