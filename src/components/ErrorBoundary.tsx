import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the error card (e.g. "Combat View") */
  label?: string;
  /** Render custom fallback UI instead of the default error card */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ` – ${this.props.label}` : ''}]`, error, info.componentStack);
  }

  private reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-500/30 bg-red-950/40 p-6 text-center">
        <span className="text-2xl">💥</span>
        <p className="text-sm font-semibold text-red-300">
          {this.props.label ? `${this.props.label} crashed` : 'Something went wrong'}
        </p>
        <p className="max-w-xs text-xs text-red-400/70">
          {this.state.error?.message ?? 'An unexpected error occurred.'}
        </p>
        <button
          onClick={this.reset}
          className="mt-1 rounded-lg bg-red-800/60 px-4 py-1.5 text-xs text-red-200 hover:bg-red-700/60 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }
}
