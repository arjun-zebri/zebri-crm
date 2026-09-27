'use client';

/**
 * A collapsed strip at the foot of the couple's Workflow list.
 *
 * Holds what the MC is not working through: finished steps, and stopped
 * workflows. It is the answer to "what did I already do" or "what did I
 * stop", not a to-do, so it starts closed and says how many are inside.
 * One component for both strips so they cannot drift apart.
 *
 * @module app/(dashboard)/couples/couple-list-strip
 */

import { ChevronRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export interface CoupleListStripProps {
  /** What is inside, e.g. "Done". The count is appended. */
  label: string;
  count: number;
  /**
   * Something inside the MC should know about without opening the strip,
   * e.g. "1 partly failed". Shown after the count in `text-warning`.
   */
  warning?: string | null | undefined;
  /** The rows, rendered only while open. */
  children: ReactNode;
}

/** A closed-by-default strip. See {@link CoupleListStripProps}. */
export function CoupleListStrip({ label, count, warning, children }: CoupleListStripProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 py-3 text-body text-text-muted hover:text-text"
      >
        <ChevronRight
          size={16}
          strokeWidth={1.5}
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        />
        {label} ({count})
        {warning ? <span className="text-warning">· {warning}</span> : null}
      </button>
      {open ? (
        <div className="overflow-hidden rounded-control border border-border">{children}</div>
      ) : null}
    </div>
  );
}
