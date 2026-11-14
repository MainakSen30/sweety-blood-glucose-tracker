import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth.js';
import { ApiError } from '../services/http.js';
import { roleHomePath } from '../types/user.js';
import { Button } from '../components/ui/Button.js';
import { Field, Input } from '../components/ui/Input.js';
import { AuthLayout } from '../components/layout/AuthLayout.js';

type FieldErrors = Partial<Record<'email' | 'password', string>>;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      const user = await login({ email: email.trim(), password });
      navigate((location.state as { from?: string } | null)?.from ?? roleHomePath(user.role), {
        replace: true,
      });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue tracking your glucose readings."
      footer={
        <>
          New to Sweety?{' '}
          <Link
            to="/register"
            className="font-medium text-olive underline underline-offset-2 hover:text-olive-dark"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-4">
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
