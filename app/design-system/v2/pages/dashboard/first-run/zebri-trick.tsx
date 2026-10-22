'use client';


import { Button } from '@/components/ui-v2/button';
import { IconCircle } from '@/components/ui-v2/icon-circle';
import { CloseIcon, DiscoverIcon } from '@/components/ui-v2/icons';

import type { Trick } from './tricks';
import { TypedLine } from './typed-line';

/**
 * Zebri's answer to Discover Zebri, under Ask Zebri: a line typed out
 * as if Zebri were saying it (`TypedLine`, as the test client's replies
 * are), then Show me, which opens the real page with the real control
 * ringed, and Another for the next one. No box: it reads as Zebri
 * talking, under the prompt it answered. When every trick has been
 * shown it says so and offers nothing more.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/zebri-trick
 */

export interface ZebriTrickProps {
  /** The trick to tell, or null when there are none left. */
  trick: Trick | null;
  onShow: () => void;
  onAnother: () => void;
  onClose: () => void;
}

/** The trick. See {@link ZebriTrickProps}. */
export function ZebriTrick({ trick, onShow, onAnother, onClose }: ZebriTrickProps) {
  return (
    <section
      aria-label="Discover Zebri"
      className="flex items-start gap-3 px-1 motion-safe:animate-rise-in"
    >
      <IconCircle icon={DiscoverIcon} />
      <div className="min-w-0 flex-1 space-y-3 pt-1">
        <p aria-live="polite" className="type-body text-zebra-950">
          {/* Keyed, so Another types the next line from the start. */}
          <TypedLine key={trick?.id ?? 'none'} text={trick ? trick.line : "You've discovered everything for now. More arrives as you add blocks."} />
        </p>
        {trick ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onShow}>
              Show me
            </Button>
            <Button variant="plain" onClick={onAnother}>
              Another
            </Button>
          </div>
        ) : null}
      </div>
      <Button variant="ghost" square aria-label="Close Discover Zebri" onClick={onClose}>
        <CloseIcon aria-hidden="true" className="size-4" />
      </Button>
    </section>
  );
}
