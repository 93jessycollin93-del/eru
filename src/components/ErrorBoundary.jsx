import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * ErrorBoundary catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of unmounting the entire app.
 *
 * Wrap the root layout and individual routes so a single component crash
 * cannot take down the whole app.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-12 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            An unexpected error occurred while rendering this view. You can try
            again, or reload the page if the issue persists.
          </p>
          {this.state.error?.message && (
            <pre className="text-xs font-mono text-muted-foreground bg-secondary border border-border rounded-lg px-3 py-2 mb-6 max-w-full overflow-x-auto">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 bg-secondary border border-border rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
