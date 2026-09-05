import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { z } from 'zod';
import { useAuthStore } from '../../store/authStore.js';
import { ErrorAlert, Field } from '../../components/ui.jsx';

const registerSchema = z
  .object({
    fullName: z.string().min(1, 'Full name is required').max(120, 'Full name is too long'),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export function RegisterPage() {
  const { register: registerUser } = useAuthStore();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await registerUser({
        fullName: values.fullName,
        username: values.username,
        email: values.email,
        password: values.password,
      });
      // The confirmation is shown by the login page via router state; setting a
      // local success message here could never render, since we navigate away
      // in the same tick and this component unmounts.
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Registration failed. Please try again.');
    }
  };

  return (
    <div>
      <h1 className="text-display text-ink">Create an account</h1>
      <p className="mt-1.5 text-sm text-ink-muted">Register as a student to get started.</p>

      <form className="mt-7 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && <ErrorAlert error={serverError} />}

        <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
          <input
            id="fullName"
            autoComplete="name"
            autoFocus
            className="input"
            placeholder="Jane Doe"
            aria-invalid={Boolean(errors.fullName)}
            {...register('fullName')}
          />
        </Field>

        <Field
          label="Username"
          htmlFor="username"
          error={errors.username?.message}
          hint="Letters, numbers and underscores only."
        >
          <input
            id="username"
            autoComplete="username"
            className="input"
            placeholder="jane_doe"
            aria-invalid={Boolean(errors.username)}
            {...register('username')}
          />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Password"
            htmlFor="password"
            error={errors.password?.message}
            hint={errors.password ? undefined : 'At least 8 characters.'}
          >
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
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

          <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message}>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="input"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
            />
          </Field>
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg w-full">
          {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="link">
          Sign in
        </Link>
      </p>
    </div>
  );
}
