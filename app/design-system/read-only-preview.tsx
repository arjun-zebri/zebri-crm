import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Renders a composite visually while making it impossible to interact
 * with.
 *
 * The showroom runs against the dev server, which points at the REMOTE
 * Supabase. A composite bound to real mutations would happily write
 * production rows if someone clicked Save in here, so anything whose
 * writes are live is wrapped in this instead of being left clickable.
 *
 * `pointer-events-none` on the content plus `inert` on the wrapper stops
 * mouse, touch, keyboard and focus from reaching it at all.
 *
 * @module app/design-system/read-only-preview
 */
export function ReadOnlyPreview({
  note,
  children,
}: {
  /** Why this one cannot be interactive. Shown in the ribbon. */
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-control border border-border">
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted px-3 py-1.5">
        <Lock className="text-text-subtle" width={12} height={12} strokeWidth={1.5} aria-hidden="true" />
        <span className="text-caption text-text-muted">
          Read-only preview{note ? `. ${note}` : '. Writes are live, so interaction is disabled.'}
        </span>
      </div>
      {/* `inert` removes the subtree from the tab order and the
          accessibility tree; pointer-events-none covers mouse and touch.
          Both are needed: inert alone still allows hover-driven UI. */}
      <div inert className="pointer-events-none select-none bg-surface p-4">
        {children}
      </div>
    </div>
  );
}
