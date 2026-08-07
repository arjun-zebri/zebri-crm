import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Foundational error-state primitive (file named `error-state.tsx` to avoid
 * collision with Next.js's reserved `error.tsx` route convention).
 *
 * Per-page Definition of Done requires an explicit error UI for every data
 * view; this is the standard one. Always offer a recovery path
 * (`onRetry` or your own `action`).
 *
 * Errors propagated from `try/catch` should be passed via `error`; the
 * message is rendered only when it is human-safe (no stack traces / PII).
 *
 * @example
 * ```tsx
 * <ErrorState title="Couldn't load couples" onRetry={() => refetch()} />
 * ```
 *
 * @module components/ui/error-state
 */

export interface ErrorStateProps {
  /** Short, user-facing headline. */
  title?: ReactNode;
  /** Optional explanation. If an `Error` is passed via `error`, its
   *  `.message` is shown unless `description` is also provided. */
  description?: ReactNode;
  /** The underlying error — only `.message` is rendered, never the stack. */
  error?: Error | null;
  /** Retry handler. When set, a default retry button is rendered. */
  onRetry?: () => void;
  /** Custom action slot (overrides the default retry button). */
  action?: ReactNode;
  /** Extra classes — prefer tokens over raw colours. */
  className?: string;
}

/** Centered error state with icon, message, and recovery action. */
export function ErrorState({
  title = 'Something went wrong',
  description,
  error,
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  const fallbackMsg = description ?? error?.message;
  const recovery =
    action ??
    (onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className="text-body font-medium text-text underline underline-offset-2 hover:text-text-muted"
      >
        Try again
      </button>
    ) : null);

  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 py-12 text-center${className ? ` ${className}` : ''}`}
    >
      <AlertTriangle className="text-danger" width={28} height={28} aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-section font-semibold text-text">{title}</p>
        {fallbackMsg ? (
          <p className="max-w-prose text-body text-text-muted">{fallbackMsg}</p>
        ) : null}
      </div>
      {recovery ? <div className="pt-2">{recovery}</div> : null}
    </div>
  );
}
