import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Foundational empty-state primitive.
 *
 * Every list / collection view must render this (or compose from its tokens)
 * when there is no data — per-page Definition of Done. Helpful empties
 * always explain what to do next (the `action` slot).
 *
 * @example
 * ```tsx
 * <Empty
 *   icon={Heart}
 *   title="No couples yet"
 *   description="Add your first couple to start tracking enquiries."
 *   action={<Button onClick={openNewCoupleModal}>New couple</Button>}
 * />
 * ```
 *
 * @module components/ui/empty
 */

export interface EmptyProps {
  /** lucide-react icon component rendered above the title. Optional. */
  icon?: LucideIcon;
  /** Short, scannable heading. */
  title: ReactNode;
  /** One- or two-sentence helper text. */
  description?: ReactNode;
  /** Primary call-to-action (typically a button). */
  action?: ReactNode;
  /** Extra classes — prefer tokens over raw colours. */
  className?: string;
}

/** Centered empty-state with optional icon, description, and call-to-action. */
export function Empty({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-12 text-center${className ? ` ${className}` : ''}`}
    >
      {Icon ? (
        <Icon className="text-text-subtle" width={28} height={28} aria-hidden="true" />
      ) : null}
      <div className="space-y-1">
        <p className="text-section font-semibold text-text">{title}</p>
        {description ? (
          <p className="max-w-prose text-body text-text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
