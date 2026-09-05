import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { z } from 'zod';
import { roleHome } from '../../routes/index.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { ErrorAlert, Field } from '../../components/ui.jsx';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export function LoginPage() {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState(null);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    const role = useAuthStore.getState().user?.role;
    if (role) navigate(roleHome[role] ?? '/', { replace: true });
  }, [navigate]);

  const doLogin = async (values, code) => {
    setServerError(null);
    try {
      const user = await login(values.email, values.password, code);
      const destination = location.state?.from ?? roleHome[user.role] ?? '/';
      navigate(destination, { replace: true });
    } catch (err) {
      if (err.response?.status === 428) {
        setTwoFactorRequired(true);
        return;
      }
      if (err.response?.status === 429) {
        setServerError('Too many sign-in attempts. Please wait a few minutes and try again.');
        return;
      }
      setServerError(err.response?.data?.message ?? 'Login failed. Please try again.');
    }
  };

  const onSubmit = async (values) => {
    if (twoFactorRequired) {
      await doLogin(getValues(), twoFactorCode);
      return;
    }
    await doLogin(values);
  };

  return (
    <div>
      <h1 className="text-display text-ink">
        {twoFactorRequired ? 'Two-factor verification' : 'Sign in'}
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {twoFactorRequired
          ? 'Enter the six-digit code from your authenticator app.'
          : 'Use your ExamForge account to continue.'}
      </p>

      <form className="mt-7 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && <ErrorAlert error={serverError} />}

        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus={!twoFactorRequired}
            className="input"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="input pr-10"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-canvas hover:text-ink-muted"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        {twoFactorRequired && (
          <Field
            label="Authentication code"
            htmlFor="twoFactorCode"
            hint="Six digits from your authenticator app."
          >
            <input
              id="twoFactorCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              className="input text-center text-lg font-semibold tracking-[0.4em]"
              placeholder="000000"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        )}

        {!twoFactorRequired && (
          <div className="flex justify-end">
            <Link to="/forgot-password" className="link text-[0.8125rem]">
              Forgot password?
            </Link>
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg w-full">
          {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Signing in…' : twoFactorRequired ? 'Verify and sign in' : 'Sign in'}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-ink-muted">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="link">
          Create one
        </Link>
      </p>
    </div>
  );
}
