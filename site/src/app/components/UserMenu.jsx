import { Link } from 'react-router-dom';
import { useAuth } from '@/layouts/RootLayout';
import { getProfileMeta } from '@/services/userPermissions';
import ThemeToggle from '@/components/ThemeToggle';
import UserAvatar from '@/components/UserAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Default account menu — ships with the template so every shell has one.
 * Overwrite it to restyle. Keep: the four optional props (user, initials,
 * displayName, logout — all derived from useAuth() when omitted), the
 * ThemeToggle in a plain container (never inside a DropdownMenuItem, which
 * closes on pointer-down and swallows the click), and the sign-out item.
 */
export default function UserMenu({ user: userProp, initials: initialsProp, displayName: displayNameProp, logout: logoutProp }) {
  const auth = useAuth();
  const user = userProp ?? auth.user;
  const logout = logoutProp ?? auth.logout;
  const displayName =
    displayNameProp ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.emailAddress ||
    'Account';
  const initials =
    initialsProp ||
    displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() ||
    'U';
  const profileLabel = String(user?.profile ?? '').replace(/_c$/, '');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full outline-none ring-ring focus-visible:ring-2"
          aria-label="Account menu"
        >
          <UserAvatar person={user} initials={initials} className="size-9" fallbackClassName="text-xs" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="text-sm font-medium text-foreground">{displayName}</p>
          {user?.emailAddress && <p className="text-xs text-muted-foreground">{user.emailAddress}</p>}
          {profileLabel && <p className="text-xs text-muted-foreground">{profileLabel}</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <ThemeToggle className="w-full justify-between" />
        </div>
        <DropdownMenuSeparator />
        {getProfileMeta(user?.profile).canManageTeam && (
          <DropdownMenuItem asChild>
            <Link to="/admin/team">Team</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/account">Your profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/account#sign-in">Change password</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
