import Link from 'next/link';
import type { ComponentProps } from 'react';

/**
 * Design system v2 inline text link (preview): black (zebra-950),
 * always underlined, and a step bolder on hover. Colour is never used
 * to mark a link; the underline does, so links stay calm in copy. For
 * an action that does something, use a `Button`.
 *
 * @example
 * ```tsx
 * <TextLink href="/signup">Create an account</TextLink>
 * <p className="type-subheading">… <TextLink inheritSize href="/clients/42">Priya & James</TextLink> …</p>
 * ```
 *
 * @module components/ui-v2/text-link
 */

export type TextLinkProps = ComponentProps<typeof Link> & {
  /**
   * Take the size of the surrounding text instead of the 13px label
   * role, for a link inside a larger line (a name in the dashboard
   * headline). It keeps the medium weight so it still reads as a link.
   */
  inheritSize?: boolean | undefined;
};

/** v2 text link. See {@link TextLinkProps}. */
export function TextLink({ className, children, inheritSize = false, ...rest }: TextLinkProps) {
  return (
    <Link
      className={`group/link inline-grid rounded-check ${inheritSize ? 'font-medium' : 'type-label'} text-zebra-950 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grass-500${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {/* Bold text is wider, so a weight change on hover would nudge the
          words around the link. Both copies share one grid cell: the
          invisible semibold copy holds the width, so nothing moves. */}
      <span className="col-start-1 row-start-1 group-hover/link:font-semibold">{children}</span>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-semibold">
        {children}
      </span>
    </Link>
  );
}
