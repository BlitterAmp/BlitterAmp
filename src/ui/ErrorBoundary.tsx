import { Component, type ReactNode } from "react";

/** Last line of defense: a render error in any view must degrade to a
 * message instead of unmounting the whole player into a white window. The
 * error lands in the webview console, which diagnostics capture. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("view crashed:", error, info.componentStack ?? "");
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <div className="alert alert-error max-w-lg">
          <span>
            Something went wrong rendering this view: {this.state.error.message}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}
