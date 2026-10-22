'use client';

import type { ReactNode } from 'react';

import { Button, type ButtonVariant } from '@/components/ui-v2/button';
import { ArrowForwardIcon } from '@/components/ui-v2/icons';

import { sectionHref } from './nav-links';
import { useWaitlistPlan } from './waitlist-plan';

/**
 * A `Button` that scrolls to a section of the marketing page (the
 * waitlist form, mostly). The page is one long scroll, so every call
 * to action lands on the same form rather than opening a modal: the
 * live site's modal was cut off on phones (zebri-landing, cdb47d2).
 *
 * @module app/design-system/v2/pages/website/jump-button
 */

/** The waitlist form's anchor, shared by every call to action. */
export const EARLY_ACCESS_ID = 'early-access';

export interface JumpButtonProps {
  /** The section's `id`. */
  to: string;
  variant?: ButtonVariant;
  /**
   * An arrow after the label, for the "Join the waitlist" buttons: the
   * page's one action reads the same wherever it appears (founder brief,
   * 2026-10-17). `Button`'s own `icon` leads the label; an arrow follows.
   */
  arrow?: boolean;
  /** A plan to carry to the waitlist form ("Max"), from a pricing card. */
  plan?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}

/** Scrolls smoothly to `to`, or jumps under reduced motion. */
export function JumpButton({
  to,
  variant = 'primary',
  arrow = false,
  plan,
  className,
  children,
}: JumpButtonProps) {
  const { setPlan } = useWaitlistPlan();
  function jump() {
    if (plan) setPlan(plan);
    const target = document.getElementById(to);
    // On another page of the site (the Blocks list), the section is on the home page: go there.
    if (!target) return window.location.assign(sectionHref(to));
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
    // Called only where it exists (test DOMs lack it); the focus below must still land.
    target.scrollIntoView?.({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    // Move focus with the view, so a keyboard user lands in the form too.
    target.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true });
  }
  return (
    <Button variant={variant} onClick={jump} className={className}>
      {children}
      {arrow ? <ArrowForwardIcon aria-hidden="true" className="size-4" /> : null}
    </Button>
  );
}
