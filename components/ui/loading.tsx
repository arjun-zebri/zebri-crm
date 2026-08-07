import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Foundational loading primitive.
 *
 * Per-page Definition of Done (roadmap §5) requires an explicit loading state
 * for every data view — use this (or compose a skeleton from its tokens)
 * rather than ad-hoc spinners.
 *
 * @example
 * ```tsx
 * if (isLoading) return <Loading label="Loading couples" />
 * ```
 *
 * @module components/ui/loading
 */

export interface LoadingProps {
  /** Visible label rendered below the spinner. Also used as the ARIA label. */
  label?: ReactNode;
  /** Spinner size in px. Defaults to 20 (medium). */
  size?: number;
  /** Layout: `center` fills the container, `inline` is for buttons / list rows. */
  variant?: 'center' | 'inline';
  /** Extra classes — prefer tokens (`text-text-muted`) over raw colours. */
  className?: string;
}

/** Spinner + optional label, accessible (`role="status"`). */
export function Loading({
  label,
  size = 20,
  variant = 'center',
  className,
}: LoadingProps) {
  const wrapper =
    variant === 'inline'
      ? 'inline-flex items-center gap-2 text-text-muted'
      : 'flex flex-col items-center justify-center gap-2 py-8 text-text-muted';
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={typeof label === 'string' ? label : 'Loading'}
      className={`${wrapper}${className ? ` ${className}` : ''}`}
    >
      <Loader2
        className="animate-spin"
        width={size}
        height={size}
        aria-hidden="true"
      />
      {label ? <span className="text-body">{label}</span> : null}
    </div>
  );
}
