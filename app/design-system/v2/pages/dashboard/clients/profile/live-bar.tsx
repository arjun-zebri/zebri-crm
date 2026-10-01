'use client';

import { Button } from '@/components/ui-v2/button';

import { GUTTER } from './profile-header';
import { useElapsed } from './video-tile';

/**
 * A slim bar under the header while a call runs and the MC is looking
 * at another section: who the call is with, how long it has run, and the
 * way back to it. The call itself never stops for a section change.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/live-bar
 */

export interface LiveBarProps {
  who: string;
  startedAt: number;
  onReturn: () => void;
}

/** The bar. See {@link LiveBarProps}. */
export function LiveBar({ who, startedAt, onReturn }: LiveBarProps) {
  const clock = useElapsed(startedAt);
  return (
    <div className={`flex items-center gap-3 border-b border-zebra-200 bg-grass-50 py-2 type-body ${GUTTER}`}>
      <span aria-hidden="true" className="size-2 shrink-0 rounded-pill bg-danger motion-safe:animate-pulse" />
      <span className="min-w-0 truncate text-zebra-950">On a call with {who}</span>
      <span className="tabular-nums text-zebra-500">{clock}</span>
      <Button variant="secondary" onClick={onReturn} className="ml-auto">
        Back to the call
      </Button>
    </div>
  );
}
