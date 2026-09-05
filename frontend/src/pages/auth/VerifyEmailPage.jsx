import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('');

  const token = params.get('token') || '';

  const verify = async () => {
    setState('loading');
    try {
      await api.post('/auth/verify-email', { token });
      setState('success');
    } catch (err) {
      setState('error');
      setMessage(err.response?.data?.message ?? 'Verification failed.');
    }
  };

  if (state === 'loading' && token) verify();

  return (
    <div className="card text-center">
      <h2 className="text-2xl font-bold text-ink">Email verification</h2>

      {state === 'loading' && (
        <p className="mt-4 text-sm text-ink-muted">Verifying your email…</p>
      )}

      {state === 'success' && (
        <>
          <p className="mt-4 text-sm text-positive-ink">Your email has been verified successfully.</p>
          <Link to="/login" className="btn-primary mt-6 block w-full text-center">Go to sign in</Link>
        </>
      )}

      {state === 'error' && (
        <>
          <p className="mt-4 text-sm text-critical-ink">{message}</p>
          <Link to="/login" className="btn-primary mt-6 block w-full text-center">Go to sign in</Link>
        </>
      )}

      {state === 'loading' && !token && (
        <>
          <p className="mt-4 text-sm text-critical-ink">Missing verification token.</p>
          <Link to="/login" className="btn-primary mt-6 block w-full text-center">Go to sign in</Link>
        </>
      )}
    </div>
  );
}