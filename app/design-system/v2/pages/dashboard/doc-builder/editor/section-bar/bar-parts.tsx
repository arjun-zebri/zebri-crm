'use client';

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { BAR_RULE } from '@/components/ui-v2/control-styles';
import { ChevronDownIcon } from '@/components/ui-v2/icons';

/**
 * The floating bars' pieces (section, text and bottom bar alike), all on
 * the `Button` primitive so every bar is one style (2026-10-14): a ghost
 * square for an icon, named by its own tooltip; a ghost compact button
 * for a menu that says what it sets ("Background") with a chevron; and
 * `BAR_RULE` between groups. Picked, or its menu open, is the ghost
 * button's `active` (pressed) fill.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/editor/section-bar/bar-parts
 */

export interface BarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Names it, for the tooltip and assistive tech. */
  label: string;
  /** Picked, or its menu open: the pressed fill behind it. */
  on?: boolean | undefined;
  /**
   * False for a button that shows its words already: it is drawn as a
   * labelled button rather than an icon square, with no tooltip.
   */
  tip?: boolean | undefined;
  /**
   * False for a button that opens a menu rather than switching something
   * on: `on` then only shows it open, and is not announced as pressed.
   */
  toggle?: boolean | undefined;
  children: ReactNode;
}

/** An icon (or words) on the bar. Forwards its ref so a popover can hang from it. */
export const BarButton = forwardRef<HTMLButtonElement, BarButtonProps>(function BarButton({ label, on = false, tip = true, toggle = true, children, ...rest }, ref) {
  return (
    <Button
      ref={ref}
      variant="ghost"
      square={tip}
      compact={!tip}
      active={on}
      aria-label={label}
      aria-pressed={toggle ? on : undefined}
      tooltipSide="top"
      {...rest}
    >
      {children}
    </Button>
  );
});

/** A button that opens a menu: what it sets, in words, then a chevron. */
export const BarMenuButton = forwardRef<HTMLButtonElement, Omit<BarButtonProps, 'tip' | 'toggle'> & { lead?: ReactNode }>(function BarMenuButton({ label, lead, children, ...rest }, ref) {
  return (
    <BarButton ref={ref} label={label} tip={false} toggle={false} {...rest}>
      {lead}
      {children}
      <ChevronDownIcon aria-hidden="true" className="size-3.5 text-zebra-400" />
    </BarButton>
  );
});

/** The hairline between groups. */
export function BarRule() {
  return <span aria-hidden="true" className={BAR_RULE} />;
}

/** A round sample of `colour` for a menu row or the button; struck through for none. */
export function Dot({ colour }: { colour: string | null }) {
  return (
    <span
      aria-hidden="true"
      // The MC's own colour, known at runtime.
      style={{ '--dot': colour ?? 'transparent' } as CSSProperties}
      className={`size-4 shrink-0 rounded-pill bg-[var(--dot)] ring-1 ring-inset ring-hairline ${colour ? '' : '[background-image:linear-gradient(135deg,transparent_44%,var(--color-zebra-400)_44%,var(--color-zebra-400)_56%,transparent_56%)]'}`}
    />
  );
}
