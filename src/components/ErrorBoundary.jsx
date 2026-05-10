import React from 'react';

/**
 * ErrorBoundary — catches React component errors and prevents app-wide crashes.
 * Logs the error and displays a user-friendly fallback UI.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <MyComponent />
 *   </ErrorBoundary>
 *
 * Fixes: Single component crash no longer unmounts entire app.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('[ErrorBoundary] Component error caught:', {
      error: error?.toString(),
      errorInfo: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
    });

    // Store error info for potential error reporting service (e.g., Sentry)
    this.setState({
      error,
      errorInfo,
    });

    // Optional: Send to error tracking service
    // reportErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-2xl">⚠️</div>
              <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              An unexpected error occurred. The app will recover when you try again.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 p-3 bg-destructive/10 rounded text-xs font-mono overflow-auto max-h-40">
                <summary className="cursor-pointer font-semibold text-destructive mb-2">
                  Error details (dev only)
                </summary>
                <pre className="whitespace-pre-wrap break-words text-muted-foreground">
                  {this.state.error?.toString()}
                  {'\n\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleReset}
              className="w-full bg-primary text-primary-foreground px-4 py-2 rounded font-medium hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
