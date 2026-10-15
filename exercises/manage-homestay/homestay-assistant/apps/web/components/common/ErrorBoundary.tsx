import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

type ErrorBoundaryProps = {
  fallback: ReactNode | ((error: Error) => ReactNode);
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    const { fallback, children } = this.props;

    if (error) {
      return typeof fallback === 'function' ? fallback(error) : fallback;
    }

    return children;
  }
}
