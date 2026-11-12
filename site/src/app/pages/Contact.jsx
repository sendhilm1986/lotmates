import { Link } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { COMPANY, LAST_UPDATED } from '@/services/legal';

export const route = { path: '/contact', layout: 'public', access: 'public' };

function Row({ icon, label, children }) {
  return (
    <div className="flex gap-4 py-4">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
        <ApperIcon name={icon} size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="mt-0.5 break-words text-base text-foreground">{children}</div>
      </div>
    </div>
  );
}

export default function Contact() {
  const g = COMPANY.grievance;
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14 md:px-8 md:py-24">
      <div className="max-w-2xl">
        <h1 className="font-heading text-[2.5rem] font-bold leading-[1.02] tracking-tight text-foreground md:text-6xl">Contact us</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          For a problem with a booking, the fastest way is "Report a problem" on the booking itself. For anything else, reach us here.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:mt-16 lg:grid-cols-2">
        <section className="rounded-[24px] bg-card p-6 shadow-md md:p-8">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">Lotmates support</h2>
          <div className="mt-2 divide-y divide-border">
            <Row icon="Mail" label="Email">
              <a href={`mailto:${COMPANY.email}`} className="text-primary hover:underline">{COMPANY.email}</a>
            </Row>
            <Row icon="Phone" label="Phone">{COMPANY.phone}</Row>
            <Row icon="Clock" label="Hours">{COMPANY.hours}</Row>
          </div>
          <Button asChild className="mt-4">
            <Link to="/bookings">Go to my bookings</Link>
          </Button>
        </section>

        <section className="rounded-[24px] bg-card p-6 shadow-md md:p-8">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">Grievance Officer</h2>
          <p className="mt-2 text-sm text-muted-foreground">We acknowledge complaints within 24 hours and resolve them within 15 days.</p>
          <div className="mt-2 divide-y divide-border">
            <Row icon="UserRound" label={g.designation}>{g.name}</Row>
            <Row icon="Mail" label="Email">
              <a href={`mailto:${g.email}`} className="text-primary hover:underline">{g.email}</a>
            </Row>
            <Row icon="Phone" label="Phone">{g.phone}</Row>
          </div>
          <Link to="/legal/grievance" className="mt-4 inline-block text-base font-medium text-primary hover:underline">
            How complaints are handled
          </Link>
        </section>

        <section className="rounded-[24px] bg-card p-6 shadow-md md:p-8 lg:col-span-2">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">Business details</h2>
          <div className="mt-2 grid divide-y divide-border md:grid-cols-2 md:gap-x-10 md:divide-y-0">
            <Row icon="Building2" label="Registered name">{COMPANY.legalName}</Row>
            <Row icon="MapPin" label="Registered office">{COMPANY.address}</Row>
            <Row icon="Receipt" label="GSTIN">{COMPANY.gstin}</Row>
            <Row icon="FileText" label="Company number">{COMPANY.cin}</Row>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Demo draft, last updated {LAST_UPDATED}. Details in [brackets] are placeholders. Each deal names the vendor who provides it.
          </p>
        </section>
      </div>
    </div>
  );
}
