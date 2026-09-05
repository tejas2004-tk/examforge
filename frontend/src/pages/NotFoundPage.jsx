import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-8 text-center">
      <p className="text-8xl font-bold text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Go to homepage
      </Link>
    </div>
  );
}
