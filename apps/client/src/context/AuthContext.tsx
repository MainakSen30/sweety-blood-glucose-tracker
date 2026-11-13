import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../services/authApi.js';
import type { LoginInput, RegisterInput, SafeUser } from '../types/user.js';
import { Spinner } from '../components/ui/Button.js';
import { AuthContext, useAuth, type AuthContextValue, type AuthStatus } from './auth.js';

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

  const value: AuthContextValue = {
    user,
    status,
    login: async (input: LoginInput) => {
      setUser(await loginUser(input));
      setStatus('authenticated');
    },
    register: async (input: RegisterInput) => {
      setUser(await registerUser(input));
      setStatus('authenticated');
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

/** Keeps signed-in users out of the auth screens. */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return <FullPageSpinner />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return children;
}

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="size-6 text-olive" />
    </div>
  );
}
