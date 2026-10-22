import type { ReactNode } from 'react';

/**
 * Design system v2 group label (preview): the quiet name over a group of
 * rows or controls ("Today", "Get paid", "Arrange"), in `type-body
 * text-zebra-400`, the one group-label style in v2 (menus use the same
 * look as `MENU_LABEL`). Not a heading by look; choose the element by
 * where it sits in the page's outline with `as`: `h3` or `h4` when it
 * heads a section, `p` (default) or `div` when it only labels.
 *
 * @example
 * ```tsx
 * <GroupLabel as="h3" id="today">Today</GroupLabel>
 * <ul aria-labelledby="today">…</ul>
 * ```
 *
 * @module components/ui-v2/group-label
 */

export interface GroupLabelProps {
  /** The element to render; `p` by default. */
  as?: 'h2' | 'h3' | 'h4' | 'p' | 'div' | undefined;
  /** For a list's `aria-labelledby`. */
  id?: string | undefined;
  /** Placement only (margins, padding). */
  className?: string | undefined;
  children: ReactNode;
}

/** v2 group label. See {@link GroupLabelProps}. */
export function GroupLabel({ as: Tag = 'p', id, className, children }: GroupLabelProps) {
  return (
    <Tag id={id} className={`type-body text-zebra-400${className ? ` ${className}` : ''}`}>
      {children}
    </Tag>
  );
}
