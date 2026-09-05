import { Component } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { RotateCcw, TriangleAlert } from 'lucide-react';

export class ErrorBoundaryBase extends Component {
  state = { error: null, info: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Surfacing the component stack is the only way to locate a render crash in
    // a production bundle, where the stack trace alone points at minified code.
    console.error('[ExamForge] render error', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // A crash is nearly always specific to one screen. Clearing on navigation
    // means the user can steer out of it instead of being stuck behind a wall.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, info: null });
    }
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-lg rounded-lg border border-line bg-surface p-6 shadow-card">
          <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md border border-critical/30 bg-critical-soft text-critical-ink">
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          </span>
          <h1 className="text-title text-ink">This screen failed to render</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            The rest of the application is still running. Reloading this screen usually clears the
            problem; if it returns, the message below is what the support team needs.
          </p>

          <pre className="scrollbar-slim mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface-sunken p-3 text-left font-mono text-xs text-ink-muted">
            {error.message || String(error)}
            {info?.componentStack ? `\n${info.componentStack.trim().split('\n').slice(0, 6).join('\n')}` : ''}
          </pre>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null, info: null })}
              className="btn-primary btn-md"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
            <button type="button" onClick={() => window.location.reload()} className="btn-secondary btn-md">
              Reload the page
            </button>
            <Link to="/" className="btn-ghost btn-md">
              Back to start
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Router-aware wrapper: the location key is what tells the boundary a new screen
 * is being shown, so it must be mounted inside the router.
 */
export function ErrorBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundaryBase resetKey={location.pathname}>{children}</ErrorBoundaryBase>;
}
