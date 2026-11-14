import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../services/authApi.js';
import { SESSION_EXPIRED_EVENT } from '../services/http.js';
import {
  roleHomePath,
  type LoginInput,
  type RegisterInput,
  type SafeUser,
  type UserRole,
} from '../types/user.js';
import { Spinner } from '../components/ui/Button.js';
import {
  AuthContext,
  RoleMismatchError,
  useAuth,
  type AuthContextValue,
  type AuthStatus,
} from './auth.js';

/**
 * Session state for the cookie-based backend. The cookie is the session —
 * nothing is stored in web storage; the provider merely asks the server who
 * the cookie belongs to.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('unauthenticated');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Any authenticated API call can discover an expired cookie. Reset the
  // session so RequireAuth sends the user to /login on the next render.
  useEffect(() => {
    const expire = () => {
      setUser(null);
      setStatus('unauthenticated');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, []);

  const value: AuthContextValue = {
    user,
    status,
    login: async (input: LoginInput, expectedRole: UserRole) => {
      const nextUser = await loginUser(input);

      if (nextUser.role !== expectedRole) {
        // The login call already set the cookie. Revoke it before reporting the
        // mismatch so the visitor is never half-signed-in as the other role.
        await logoutUser().catch(() => undefined);
        throw new RoleMismatchError(nextUser.role);
      }

      setUser(nextUser);
      setStatus('authenticated');
      return nextUser;
    },
    register: async (input: RegisterInput) => {
      const nextUser = await registerUser(input);
      setUser(nextUser);
      setStatus('authenticated');
      return nextUser;
    },
    logout: async () => {
      await logoutUser();
      setUser(null);
      setStatus('unauthenticated');
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Renders children only for authenticated users; visitors go to /login. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullPageSpinner />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

/** Keeps signed-in users out of guest pages, landing included. */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return <FullPageSpinner />;
  }

  if (status === 'authenticated' && user) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  return children;
}

/**
 * Role gate for a branch of authenticated routes. A user who signs in with
 * the other role is sent to their own home rather than shown a dead end.
 */
export function RequireRole({ role }: { role: UserRole }) {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return <FullPageSpinner />;
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  return <Outlet />;
}

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="size-6 text-olive" />
    </div>
  );
}
