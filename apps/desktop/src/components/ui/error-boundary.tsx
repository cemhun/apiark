import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional label shown in the fallback UI, e.g. "Environments view". */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render/runtime errors in its subtree and shows a readable error
 * screen instead of letting React unmount the whole app to a blank white
 * page. Click "Reload" to recover without restarting the app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-auto p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-(--color-error)" />
        <h2 className="text-sm font-semibold text-(--color-text-primary)">
          {this.props.label ? `${this.props.label} crashed` : "Something went wrong"}
        </h2>
        <pre className="max-w-2xl overflow-auto whitespace-pre-wrap rounded-lg bg-(--color-elevated) p-3 text-left text-xs text-(--color-error)">
          {error.stack ?? error.message}
        </pre>
        <button
          onClick={() => this.setState({ error: null })}
          className="rounded-lg bg-(--color-accent) px-4 py-2 text-xs font-medium text-white hover:bg-(--color-accent-hover)"
        >
          Try again
        </button>
      </div>
    );
  }
}

