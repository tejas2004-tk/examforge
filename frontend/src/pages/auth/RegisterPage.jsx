import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuthStore } from '../../store/authStore.js';

const registerSchema = z
  .object({
    fullName: z.string().min(1, 'Full name is required').max(120),
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
    email: z.string().email('Enter a valid email address'),
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
  const [successMessage, setSuccessMessage] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      await registerUser({
        fullName: values.fullName,
        username: values.username,
        email: values.email,
        password: values.password,
      });
      setSuccessMessage('Account created. You can now sign in.');
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-slate-900">Create an account</h2>
      <p className="mt-1 text-sm text-slate-500">Register as a student to get started.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</div>
        )}
        {successMessage && (
          <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{successMessage}</div>
        )}

        <div>
          <label className="label" htmlFor="fullName">Full name</label>
          <input id="fullName" className="input" placeholder="Jane Doe" {...register('fullName')} />
          {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>}
        </div>

        <div>
          <label className="label" htmlFor="username">Username</label>
          <input id="username" className="input" placeholder="jane_doe" {...register('username')} />
          {errors.username && <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>}
        </div>

        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" placeholder="you@example.com" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" placeholder="••••••••" {...register('password')} />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">Confirm password</label>
            <input id="confirmPassword" type="password" className="input" placeholder="••••••••" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
          </div>
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Creating account…' : 'Register'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
