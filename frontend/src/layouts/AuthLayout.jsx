import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef4f0] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center text-slate-900">
          <h1 className="text-3xl font-bold tracking-tight text-brand-800">ExamForge</h1>
          <p className="mt-2 text-sm text-slate-600">
            Test, Quiz & Assignment Management Platform
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
