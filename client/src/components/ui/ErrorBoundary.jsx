import { Component } from 'react';

/**
 * App-level error boundary. Catches render errors so the whole app does not
 * white-screen, and offers a reload.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-6 text-center text-white">
          <h1 className="font-heading text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 max-w-md text-white/70">
            An unexpected error occurred. Please reload the page. If the problem persists,
            contact DOPA support.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-600"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
