'use client';

import type { ReactNode } from 'react';

import { IconCircle } from '@/components/ui-v2/icon-circle';
import { MagicIcon } from '@/components/ui-v2/icons';

import { TypedLine } from '../first-run/typed-line';

/**
 * Zebri introducing a block the moment it is added: one line typed out
 * as if said (`TypedLine`, as the test client's replies and the tricks
 * are), led by Zebri's wand, with an optional action beside it. It is
 * the whole of a block's onboarding in words: no tour, no coach marks,
 * nothing to skip. The page under it does the teaching (an example to
 * edit, a connection to make, starters already on).
 *
 * @module app/design-system/v2/pages/dashboard/first-use/zebri-says
 */

export interface ZebriSaysProps {
  /** What Zebri says, payoff first. */
  text: string;
  /** Under the line: a button or link, when the line asks for something. */
  children?: ReactNode;
}

/** The line. See {@link ZebriSaysProps}. */
export function ZebriSays({ text, children }: ZebriSaysProps) {
  return (
    <section aria-label="Zebri" className="flex items-start gap-3 motion-safe:animate-rise-in">
      <IconCircle icon={MagicIcon} />
      <div className="min-w-0 flex-1 space-y-3 pt-1">
        <p aria-live="polite" className="max-w-2xl type-body text-zebra-950">
          {/* Keyed, so a new line types from the start rather than editing the old one. */}
          <TypedLine key={text} text={text} />
        </p>
        {children}
      </div>
    </section>
  );
}
