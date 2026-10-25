import { Component } from 'react';
import { TriangleAlert } from 'lucide-react';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-bad/40 bg-bad/10 text-bad">
          <TriangleAlert className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="font-display text-lg font-semibold text-ink">This view hit an unexpected error</h2>
        <p className="mt-1.5 text-sm text-muted">
          Your analysis is still loaded. Try this view again, or head back to the dashboard.
        </p>
        <p className="mt-3 max-w-full truncate rounded bg-raised px-2 py-1 font-mono text-xs text-faint">
          {String(this.state.error?.message || this.state.error)}
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="h-9 rounded-lg border border-line bg-raised px-4 text-sm font-medium text-ink hover:border-faint"
          >
            Try again
          </button>
          <a href="/" className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:brightness-110">
            Go to dashboard
          </a>
        </div>
      </div>
    );
  }
}
