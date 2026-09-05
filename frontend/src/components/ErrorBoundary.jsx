import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <h2 className="text-xl font-bold text-ink">Something went wrong</h2>
          <p className="mt-2 max-w-md text-sm text-ink-muted">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <pre className="mt-4 max-w-lg whitespace-pre-wrap rounded-lg bg-critical-soft p-3 text-left text-xs text-critical-ink">
            {this.state.error.message}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
            className="btn-primary mt-6"
          >
            Go to homepage
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
