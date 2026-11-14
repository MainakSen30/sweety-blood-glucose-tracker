import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../../context/auth.js';
import { roleHomePath } from '../../types/user.js';
import { Button } from '../ui/Button.js';
import { BrandMark, LogOutIcon } from '../ui/icons.js';

const PATIENT_NAV = [
  { to: '/today', label: 'Today' },
  { to: '/readings', label: 'Readings' },
  { to: '/reports', label: 'Reports' },
  { to: '/care-team', label: 'Care team' },
];

/** Patient application shell: brand, patient navigation, account. */
export function PatientLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const homePath = user ? roleHomePath(user.role) : '/';

  // Announce page changes to screen readers as the route swaps.
  useEffect(() => {
    const main = document.getElementById('main-content');
    main?.focus();
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <NavLink to={homePath} className="flex items-center gap-2.5">
            <BrandMark className="size-7" />
            <span className="text-lg font-semibold tracking-tight text-olive-dark">Sweety</span>
          </NavLink>

          <nav aria-label="Main" className="order-3 -mx-1 w-full sm:order-none sm:mx-0 sm:w-auto">
            <ul className="flex gap-1">
              {PATIENT_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center rounded-xl px-3.5 text-sm font-medium transition-colors duration-150 ${
                        isActive
                          ? 'bg-sage text-olive-dark'
                          : 'text-ink-soft hover:bg-sage/50 hover:text-ink'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-ink-soft sm:block">{user?.name}</span>
            <Button variant="ghost" size="sm" onClick={() => void logout()} className="min-h-11">
              <LogOutIcon className="size-4" />
              <span className="sr-only sm:not-sr-only">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6 outline-none sm:px-6"
      >
        <motion.div
          key={location.pathname}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
