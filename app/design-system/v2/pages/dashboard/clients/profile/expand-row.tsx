import type { ReactNode } from 'react';

/**
 * A row in one of the profile's single-column lists (Activity,
 * Documents) that opens its details right under itself, since the
 * sections no longer have a panel beside the list (2026-10-09 founder
 * mockups). The open row sits on a grey fill; the row's own `trailing`
 * content (a date) stays on the right. One open at a time is the
 * caller's to keep.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/expand-row
 */

export interface ExpandRowProps {
  open: boolean;
  onToggle: () => void;
  /** What opens under the row. */
  detail: ReactNode;
  children: ReactNode;
}

/** An expanding row. Put it in a `<ul className="-mx-3">` so its fill overhangs the text edge. */
export function ExpandRow({ open, onToggle, detail, children }: ExpandRowProps) {
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        // The ROW recipe, but an open row rests on the pressed fill.
        className={`flex w-full cursor-pointer items-center gap-4 rounded-button px-3 py-2.5 text-left transition-colors duration-150 focus-mark motion-reduce:transition-none ${
          open ? 'bg-pressed' : 'hover:bg-hover'
        }`}
      >
        {children}
      </button>
      {open ? <div className="px-3 pb-6 pt-4">{detail}</div> : null}
    </li>
  );
}
