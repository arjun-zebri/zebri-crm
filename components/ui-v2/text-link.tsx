import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/**
 * Design system v2 inline text link (preview): black (zebra-950),
 * always underlined, and a step bolder on hover. Colour is never used
 * to mark a link; the underline does, so links stay calm in copy. For
 * an action that does something, use a `Button`.
 *
 * Without an `href` it is a button that looks the same, for an action
 * that belongs inside a sentence and changes only what is shown ("and
 * 14 more" opening the rest of a list; user, 2026-10-15). A `Button`
 * is a control's height and cannot sit in a line of text.
 *
 * @example
 * ```tsx
 * <TextLink href="/signup">Create an account</TextLink>
 * <p className="type-subheading">… <TextLink inheritSize href="/clients/42">Priya & James</TextLink> …</p>
 * <p>Still to come: Occupation and <TextLink inheritSize onClick={showAll}>14 more</TextLink></p>
 * ```
 *
 * @module components/ui-v2/text-link
 */

interface Shared {
  /**
   * Take the size of the surrounding text instead of the 13px label
   * role, for a link inside a larger line (a name in the dashboard
   * headline). It keeps the medium weight so it still reads as a link.
   */
  inheritSize?: boolean | undefined;
}

export type TextLinkProps =
  | (ComponentProps<typeof Link> & Shared)
  | (Omit<ComponentProps<'button'>, 'type'> & Shared & { href?: undefined });

/** v2 text link. See {@link TextLinkProps}. */
export function TextLink({ className, children, inheritSize = false, ...rest }: TextLinkProps) {
  // On touch screens an invisible pad stretches the hit area to 44px tall
  // without moving a pixel of layout: a 13px line is a 20px target, too
  // small for a thumb. Mouse users keep the exact text box.
  const look = `group/link relative inline-grid rounded-check ${inheritSize ? 'font-medium' : 'type-label'} text-zebra-950 underline underline-offset-2 focus-mark pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:top-1/2 pointer-coarse:after:h-11 pointer-coarse:after:-translate-y-1/2 pointer-coarse:after:content-['']${className ? ` ${className}` : ''}`;
  const inner = <Label>{children}</Label>;
  if (rest.href === undefined) {
    const button = rest as Omit<ComponentProps<'button'>, 'type'>;
    return (
      <button type="button" className={look} {...button}>
        {inner}
      </button>
    );
  }
  return (
    <Link className={look} {...(rest as ComponentProps<typeof Link>)}>
      {inner}
    </Link>
  );
}

/**
 * Bold text is wider, so a weight change on hover would nudge the words
 * around the link. Both copies share one grid cell: the invisible
 * semibold copy holds the width, so nothing moves.
 */
function Label({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="col-start-1 row-start-1 group-hover/link:font-semibold">{children}</span>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-semibold">
        {children}
      </span>
    </>
  );
}
