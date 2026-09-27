'use client';

/**
 * A note beside a Run now style button while the account-wide workflow
 * stop is on.
 *
 * The stop holds back what the engine does by itself, never what the MC
 * presses. Without this line an MC who has just stopped everything
 * would reasonably expect Send to be held too, and would be surprised
 * when it went.
 *
 * @module components/workflows/account-pause-note
 */

import { Callout } from '@/components/ui/callout';

import { useAccountPause } from './use-account-pause';

export interface AccountPauseNoteProps {
  /** The label on the button that runs the step, e.g. "Send & complete". */
  actionLabel: string;
}

/** Renders only while the stop is on. See {@link AccountPauseNoteProps}. */
export function AccountPauseNote({ actionLabel }: AccountPauseNoteProps) {
  const { paused } = useAccountPause();
  if (!paused) return null;
  return (
    <Callout tone="info">
      All workflows are paused. Pressing {actionLabel} still runs this step, because you chose
      to. Nothing else runs by itself until you resume.
    </Callout>
  );
}
