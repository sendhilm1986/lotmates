import ApperIcon from '@/components/ApperIcon';
import { APP_CONFIG } from '@/config/app.config';

// Shared frame for the smaller account pages (forgot and reset password, email checks),
// matching the sign-in page: heading on the page, the form in one card.
export default function AuthLayout({ children, title, description, icon }) {
  return (
    <div className="flex min-h-[calc(100svh-4.5rem)] flex-col items-center px-4 pb-16 pt-8 md:pt-14">
      <div className="w-full max-w-md">
        <div className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ApperIcon name={icon ?? APP_CONFIG.icon} size={22} />
          </span>
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mx-auto mt-2 max-w-sm text-base text-muted-foreground">{description}</p>}
        </div>
        <div className="mt-7 rounded-[24px] bg-card p-6 shadow-md md:p-8">{children}</div>
      </div>
    </div>
  );
}
