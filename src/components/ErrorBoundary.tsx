import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Error captured in boundary state for accessible fallback rendering
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="bg-white border border-rose-200 rounded-xl p-8 text-center space-y-3 max-w-lg mx-auto my-12"
        >
          <AlertCircle className="w-8 h-8 text-rose-700 mx-auto" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
          <p className="text-sm text-slate-600">
            An unexpected display error occurred. Reload the workspace view to continue.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Reload View</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
