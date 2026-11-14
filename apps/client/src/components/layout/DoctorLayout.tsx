import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../../context/auth.js';
import { roleHomePath } from '../../types/user.js';
import { Button } from '../ui/Button.js';
import {
  BrandMark,
  CloseIcon,
  GridIcon,
  LogOutIcon,
  MailIcon,
  MenuIcon,
  UsersIcon,
} from '../ui/icons.js';

const DOCTOR_NAV = [
  { to: '/doctor/dashboard', label: 'Dashboard', Icon: GridIcon },
  { to: '/doctor/patients', label: 'Patients', Icon: UsersIcon },
  { to: '/doctor/invitations', label: 'Invitations', Icon: MailIcon },
];

/**
 * Doctor application shell. Denser than the patient shell: a persistent
 * sidebar on desktop and a disclosure menu on small screens.
 */
export function DoctorLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [navOpen, setNavOpen] = useState(false);
  const homePath = user ? roleHomePath(user.role) : '/';

  // Announce page changes to screen readers as the route swaps.
  useEffect(() => {
    const main = document.getElementById('main-content');
    main?.focus();
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-cream lg:flex">
      <header className="sticky top-0 z-40 border-b border-line bg-surface lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <NavLink to={homePath} className="flex items-center gap-2.5">
            <BrandMark className="size-7" />
            <span className="text-lg font-semibold tracking-tight text-olive-dark">Sweety</span>
            <span className="text-xs font-medium text-ink-soft">Doctor</span>
          </NavLink>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto min-h-10"
            aria-expanded={navOpen}
            aria-controls="doctor-navigation"
            onClick={() => setNavOpen((open) => !open)}
          >
            {navOpen ? <CloseIcon className="size-4" /> : <MenuIcon className="size-4" />}
            <span>{navOpen ? 'Close' : 'Menu'}</span>
          </Button>
        </div>

        {navOpen ? (
          <nav
            id="doctor-navigation"
            aria-label="Doctor"
            className="border-t border-line px-3 py-3"
          >
            <ul className="space-y-1">
              {DOCTOR_NAV.map(({ to, label, Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={() => setNavOpen(false)}
                    className={({ isActive }) =>
                      `flex min-h-10 items-center gap-2.5 rounded-lg border-l-2 px-3 text-sm font-medium transition-colors duration-150 ${
                        isActive
                          ? 'border-olive-dark bg-sage/60 text-olive-dark'
                          : 'border-transparent text-ink-soft hover:bg-sage/40 hover:text-ink'
                      }`
                    }
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line px-3 pt-3">
              <span className="truncate text-sm text-ink-soft">{user?.name}</span>
              <Button variant="ghost" size="sm" onClick={() => void logout()}>
                <LogOutIcon className="size-4" />
                Log out
              </Button>
            </div>
          </nav>
        ) : null}
      </header>

      <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:flex-col xl:w-64">
        <NavLink to={homePath} className="flex items-center gap-2.5 px-5 pb-6 pt-5">
          <BrandMark className="size-7" />
          <span className="leading-tight">
            <span className="block text-lg font-semibold tracking-tight text-olive-dark">
              Sweety
            </span>
            <span className="block text-xs font-medium text-ink-soft">Doctor console</span>
          </span>
        </NavLink>

        <nav aria-label="Doctor" className="flex-1 px-3">
          <p className="px-3 text-xs font-medium text-ink-soft">Clinical access</p>
          <ul className="mt-2 space-y-1">
            {DOCTOR_NAV.map(({ to, label, Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex min-h-9 items-center gap-2.5 rounded-lg border-l-2 px-3 text-sm font-medium transition-colors duration-150 ${
                      isActive
                        ? 'border-olive-dark bg-sage/60 text-olive-dark'
                        : 'border-transparent text-ink-soft hover:bg-sage/40 hover:text-ink'
                    }`
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-line px-5 py-4">
          <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
          <p className="mt-0.5 text-xs text-ink-soft">Doctor · read-only access</p>
          <Button variant="ghost" size="sm" onClick={() => void logout()} className="mt-2 -ml-3">
            <LogOutIcon className="size-4" />
            Log out
          </Button>
        </div>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6 outline-none sm:px-6 lg:px-8 lg:py-8"
      >
        <motion.div
          key={location.pathname}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
