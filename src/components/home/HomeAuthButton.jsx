import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * HomeAuthButton — top-right account control, styled like high-level apps.
 * Guests see a "Sign in" CTA; authenticated users get an avatar dropdown with
 * their identity, quick links (Profile, Settings) and Sign out. Pure auth UI —
 * login/logout are handled entirely by the Base44 platform.
 */
function initialsOf(user) {
  const name = user?.full_name?.trim();
  if (name) {
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }
  return (user?.email?.[0] || 'U').toUpperCase();
}

export default function HomeAuthButton() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    base44.auth
      .me()
      .then((me) => mounted && setUser(me))
      .catch(() => mounted && setUser(null))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="h-9 w-9 rounded-full bg-secondary/60 animate-pulse" />;
  }

  if (!user) {
    return (
      <button
        onClick={() => base44.auth.redirectToLogin()}
        className="eru-neon-cta inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold"
      >
        <LogIn className="h-3.5 w-3.5" />
        <span>Sign in</span>
      </button>
    );
  }

  const name = user.full_name || user.email || 'Account';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 p-0.5 pr-2 text-foreground transition-colors hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          aria-label="Account menu"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {initialsOf(user)}
          </span>
          <span className="hidden max-w-[120px] truncate text-xs font-semibold sm:block">
            {user.full_name?.split(' ')[0] || 'Account'}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 eru-theme-modal">
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initialsOf(user)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
            {user.email && (
              <span className="block truncate text-[11px] font-normal text-muted-foreground">{user.email}</span>
            )}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/profile-preferences" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => base44.auth.logout()}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}