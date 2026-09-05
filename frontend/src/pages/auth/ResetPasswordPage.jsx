import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../../api/client.js';

const resetSchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [serverError, setServerError] = useState(null);
  const [done, setDone] = useState(false);

  const token = params.get('token') || '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetSchema) });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.post('/auth/reset-password', { token, newPassword: values.newPassword });
      setDone(true);
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Failed to reset password.');
    }
  };

  if (done) {
    return (
      <div className="card">
        <h2 className="text-2xl font-bold text-slate-900">Password reset</h2>
        <p className="mt-2 text-sm text-slate-500">Your password has been updated successfully.</p>
        <Link to="/login" className="btn-primary mt-6 block w-full text-center">Go to sign in</Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="card">
        <h2 className="text-2xl font-bold text-slate-900">Invalid link</h2>
        <p className="mt-2 text-sm text-slate-500">This password reset link is missing its token. Please request a new one.</p>
        <Link to="/forgot-password" className="btn-primary mt-6 block w-full text-center">Request new link</Link>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-slate-900">Reset your password</h2>
      <p className="mt-1 text-sm text-slate-500">Choose a new, strong password.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>
        )}

        <div>
          <label className="label" htmlFor="newPassword">New password</label>
          <input id="newPassword" type="password" className="input" placeholder="••••••••" {...register('newPassword')} />
          {errors.newPassword && <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>}
        </div>

        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input id="confirm" type="password" className="input" placeholder="••••••••" {...register('confirm')} />
          {errors.confirm && <p className="mt-1 text-xs text-red-600">{errors.confirm.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}