import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { roleHome } from '../../routes/index.jsx';
import { useAuthStore } from '../../store/authStore.js';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export function LoginPage() {
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState(null);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');

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
    } else {
      await doLogin(values);
    }
  };

  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
      <p className="mt-1 text-sm text-slate-500">Welcome back! Log in to your account.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>
        )}

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" placeholder="you@example.com" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" placeholder="••••••••" {...register('password')} />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        {twoFactorRequired && (
          <div>
            <label className="label" htmlFor="twoFactorCode">Two-factor code</label>
            <input
              id="twoFactorCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="input"
              placeholder="6-digit code"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
            />
            <p className="mt-1 text-xs text-amber-600">Enter the code from your authenticator app.</p>
          </div>
        )}

        <div className="flex items-center justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting
            ? 'Signing in…'
            : twoFactorRequired
              ? 'Verify & sign in'
              : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don't have an account?{' '}
        <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Register
        </Link>
      </p>
    </div>
  );
}
