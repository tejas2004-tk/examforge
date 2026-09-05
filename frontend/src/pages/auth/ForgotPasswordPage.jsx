import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../../api/client.js';

const forgotSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export function ForgotPasswordPage() {
  const [status, setStatus] = useState(null);
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (values) => {
    setServerError(null);
    setStatus(null);
    try {
      await api.post('/auth/forgot-password', values);
      setStatus('If an account exists with that email, a password reset link has been sent.');
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-slate-900">Forgot password</h2>
      <p className="mt-1 text-sm text-slate-500">Enter your email and we'll send you a reset link.</p>

      {status && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</div>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>
        )}

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" placeholder="you@example.com" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">Sign in</Link>
      </p>
    </div>
  );
}