import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth.js';
import { ApiError } from '../services/http.js';
import { roleHomePath, type UserRole } from '../types/user.js';
import { Button } from '../components/ui/Button.js';
import { Field, Input } from '../components/ui/Input.js';
import { RoleSelector } from '../components/auth/RoleSelector.js';
import { AuthLayout } from '../components/layout/AuthLayout.js';

type FieldErrors = Partial<Record<'name' | 'email' | 'password' | 'confirmPassword', string>>;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialRole = (location.state as { role?: UserRole } | null)?.role;
  const [role, setRole] = useState<UserRole>(initialRole === 'doctor' ? 'doctor' : 'patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleRoleChange(nextRole: UserRole) {
    setRole(nextRole);
    setFieldErrors({});
    setFormError('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError('');

    // Public registration only ever creates patients. The doctor branch renders
    // the provisioning notice instead of this form, and the server ignores any
    // role field regardless.
    if (role !== 'patient') {
      return;
    }

    const errors: FieldErrors = {};

    if (!name.trim()) {
      errors.name = 'Please enter your name.';
    }
    if (!email.trim()) {
      errors.email = 'Please enter your email.';
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    if (confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      const user = await register({ name: name.trim(), email: email.trim(), password });
      navigate(roleHomePath(user.role), { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.details && error.details.length > 0) {
        setFieldErrors(
          Object.fromEntries(error.details.map((detail) => [detail.path, detail.message])),
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
      title="Create your account"
      subtitle="A calm place to keep track of your glucose readings."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            state={{ role }}
            className="font-medium text-olive underline underline-offset-2 hover:text-olive-dark"
          >
            Sign in
          </Link>
        </>
      }
    >
      <RoleSelector value={role} onChange={handleRoleChange} label="Create account as" />

      {role === 'doctor' ? (
        <div className="mt-5 border-t border-line pt-5">
          <div className="rounded-xl border border-line bg-beige/40 px-4 py-3">
            <p className="text-sm font-medium text-ink">
              Doctor accounts are created by invitation
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">
              SWEETy doesn't offer public doctor sign-up. A doctor account has to be provisioned by
              your clinic or an administrator. If yours is already set up, sign in with the
              credentials you were given; otherwise you can continue as a patient.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleRoleChange('patient')}
            >
              Continue as a patient
            </Button>
            <Link
              to="/login"
              state={{ role: 'doctor' }}
              className="inline-flex min-h-9 items-center rounded-xl px-3 text-sm font-medium text-olive underline underline-offset-2 hover:text-olive-dark"
            >
              Sign in instead
            </Link>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="mt-5 space-y-4 border-t border-line pt-5"
        >
          <Field label="Name" error={fieldErrors.name}>
            {(fieldProps) => (
              <Input
                fieldProps={fieldProps}
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            )}
          </Field>

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

          <Field label="Password" error={fieldErrors.password} hint="At least 8 characters.">
            {(fieldProps) => (
              <Input
                fieldProps={fieldProps}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Create a password"
              />
            )}
          </Field>

          <Field label="Confirm password" error={fieldErrors.confirmPassword}>
            {(fieldProps) => (
              <Input
                fieldProps={fieldProps}
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your password"
              />
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
            Create account
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
