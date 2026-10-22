import type { ReactNode } from 'react';

import { IconCircle, type IconCircleIcon } from './icon-circle';

/**
 * Design system v2 empty state (preview): a place with nothing in it yet
 * (a new account's Clients, Proposals or Payments): an optional glyph in
 * a large `IconCircle`, a heading (`type-subheading`), one line of what
 * will live here (`type-body text-zebra-500`) and an optional action,
 * centred on the backdrop. No panel: a white card around "nothing yet"
 * reads as an empty box, and the gradient is calmer.
 *
 * As a page (default) it fills what is left under the title row (the
 * page and its tab panel stretch for it), and its bottom padding lifts
 * it by about half that row (more on a phone, where the row is taller),
 * so it lands on the screen's middle rather than the middle of the space
 * below the title. `compact` drops that, for an empty list inside a
 * panel or dialog.
 *
 * @example
 * ```tsx
 * <EmptyState icon={ClientsIcon} title="No clients yet" body="Couples you add or who enquire show here." action={<Button>New client</Button>} />
 * ```
 *
 * @module components/ui-v2/empty-state
 */

export interface EmptyStateProps {
  title: string;
  /** One line on what will live here. */
  body: string;
  /** A glyph shown in a large icon circle over the title. */
  icon?: IconCircleIcon | undefined;
  /** One action under the words (a primary or secondary Button). */
  action?: ReactNode;
  /** Sized to its content, for inside a panel or dialog, not a whole page. */
  compact?: boolean | undefined;
}

/** v2 empty state. See {@link EmptyStateProps}. */
export function EmptyState({ title, body, icon, action, compact = false }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 px-4 text-center ${
        compact ? 'py-10' : 'min-h-[50vh] flex-1 pb-56 md:pb-16'
      }`}
    >
      {icon ? <IconCircle size="lg" icon={icon} className="mb-3" /> : null}
      <p className="type-subheading text-zebra-950">{title}</p>
      <p className="max-w-md text-balance type-body text-zebra-500">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
