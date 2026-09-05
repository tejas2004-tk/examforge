import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { ToastProvider } from './components/toast.jsx';
import { ErrorBoundary, ErrorBoundaryBase } from './components/ErrorBoundary.jsx';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A failed request is retried once; beyond that the page shows its error
      // state rather than hammering an API that is plainly down.
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* The outer boundary catches a crash in the providers themselves, which
        happens before any router context exists. The inner one is router-aware
        and clears itself when the user navigates to another screen. */}
    <ErrorBoundaryBase>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ErrorBoundary>
            <ToastProvider>
              <App />
            </ToastProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundaryBase>
  </React.StrictMode>,
);
