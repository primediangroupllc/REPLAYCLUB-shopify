import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** When true, render a full-screen overlay (use for modals over the page). */
  overlay?: boolean;
  label?: string;
}

interface State {
  hasError: boolean;
}

/**
 * Catches dynamic-import / chunk-load failures from React.lazy boundaries.
 *
 * After a deploy the bundle hashes change; returning users with stale HTML or
 * a stale service worker may try to fetch a chunk that no longer exists. The
 * normal Suspense fallback never resolves, leaving the user stuck on a dim
 * Radix Dialog overlay with no content.
 *
 * This boundary detects that case and offers a visible "Refresh" CTA so the
 * user can recover instead of being stranded.
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const msg = String((error as Error)?.message ?? error ?? "");
    const isChunkError =
      /Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|dynamically imported module/i.test(
        msg,
      );
    if (isChunkError) {
      // Auto-reload once per session to silently recover.
      try {
        const KEY = "rc-chunk-reloaded";
        if (typeof sessionStorage !== "undefined" && !sessionStorage.getItem(KEY)) {
          sessionStorage.setItem(KEY, "1");
          window.location.reload();
        }
      } catch {
        /* no-op */
      }
    }
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("[ChunkErrorBoundary]", error);
  }

  reset = () => {
    try {
      sessionStorage.removeItem("rc-chunk-reloaded");
    } catch {
      /* no-op */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const label = this.props.label ?? "This screen failed to load.";
    if (this.props.overlay) {
      return (
        <div
          role="alertdialog"
          aria-live="assertive"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm px-6 text-center"
        >
          <p className="text-foreground text-base font-medium mb-4">{label}</p>
          <p className="text-muted-foreground text-sm mb-6 max-w-sm">
            We just shipped an update. Refresh to load the latest version.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="px-5 py-2 rounded-md bg-foreground text-background text-sm font-semibold hover:opacity-90"
          >
            Refresh page
          </button>
        </div>
      );
    }
    return (
      <div className="py-12 px-6 text-center">
        <p className="text-foreground text-sm mb-3">{label}</p>
        <button
          type="button"
          onClick={this.reset}
          className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-semibold"
        >
          Refresh
        </button>
      </div>
    );
  }
}

/**
 * Visible Suspense fallback for the booking modal. Replaces the previous
 * `fallback={null}` so the user sees progress (spinner + label) instead of
 * a dim void while the BookingModal chunk is loading.
 */
export function BookingChunkLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="w-10 h-10 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      <p className="mt-4 text-foreground text-sm font-medium">Loading booking…</p>
    </div>
  );
}
