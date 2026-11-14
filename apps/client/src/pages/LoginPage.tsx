import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { RoleMismatchError, useAuth } from '../context/auth.js';
import { ApiError } from '../services/http.js';
import { roleHomePath, type UserRole } from '../types/user.js';
import { Button } from '../components/ui/Button.js';
import { Field, Input } from '../components/ui/Input.js';
import { RoleSelector } from '../components/auth/RoleSelector.js';
import { AuthLayout } from '../components/layout/AuthLayout.js';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

interface LoginLocationState {
  from?: string;
  role?: UserRole;
}

function roleLabel(role: UserRole): string {
  return role === 'doctor' ? 'Doctor' : 'Patient';
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LoginLocationState | null) ?? {};
  const [role, setRole] = useState<UserRole>(state.role === 'doctor' ? 'doctor' : 'patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleRoleChange(nextRole: UserRole) {
    setRole(nextRole);
    setFormError('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');

    const errors: FieldErrors = {};

    if (!email.trim()) {
      errors.email = 'Please enter your email.';
    }
    if (!password) {
      errors.password = 'Please enter your password.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      const user = await login({ email: email.trim(), password }, role);
      navigate(state.from ?? roleHomePath(user.role), { replace: true });
    } catch (error) {
      if (error instanceof RoleMismatchError) {
        setFormError(
          `This is a ${roleLabel(error.actualRole).toLowerCase()} account. Select ${roleLabel(
            error.actualRole,
          )} to sign in.`,
        );
      } else {
        setFormError(
          error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
        );
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={
        role === 'doctor'
          ? 'Sign in to review your assigned patients.'
          : 'Sign in to continue tracking your glucose readings.'
      }
      footer={
        <>
          New to Sweety?{' '}
          <Link
            to="/register"
            state={{ role }}
            className="font-medium text-olive underline underline-offset-2 hover:text-olive-dark"
          >
            Create an account
          </Link>
        </>
      }
    >
      <RoleSelector value={role} onChange={handleRoleChange} label="Sign in as" />

      <form
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        className="mt-5 space-y-4 border-t border-line pt-5"
      >
        <Field label="Email" error={fieldErrors.email}>
          {(fieldProps) => (
            <Input
              fieldProps={fieldProps}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          )}
        </Field>

        <Field label="Password" error={fieldErrors.password}>
          {(fieldProps) => (
            <div className="relative">
              <Input
                fieldProps={fieldProps}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                className="pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-2 my-auto rounded-lg px-2 text-xs font-medium text-ink-soft transition-colors duration-150 hover:text-ink"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          )}
        </Field>

        {formError ? (
          <p
            role="alert"
            className="rounded-xl bg-terracotta/10 px-3 py-2 text-sm text-terracotta-ink"
          >
            {formError}
          </p>
        ) : null}

        <Button type="submit" loading={submitting} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
