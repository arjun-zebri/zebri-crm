'use client';

import { useId, useState } from 'react';

import { DialogBody, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { CallIcon } from '@/components/ui-v2/icons';

import { AMELIA_JACK_CALLS } from '../dashboard/clients/profile/amelia-jack-calls';
import { CallUpdates } from '../dashboard/clients/profile/call-updates';
import type { Verdict } from '../dashboard/clients/profile/calls-data';

/**
 * Zebri AI, video calls: what Zebri heard on Amelia and Jack's Final
 * numbers call, as the app's own `CallUpdates` with the words each
 * update was heard in under it (`quotes`): each detail's old value
 * struck through before the new one, dismiss and apply, Apply all. The
 * founder (2026-10-18) cut the summary and the record card under it,
 * which said the same four changes again.
 *
 * @module app/design-system/v2/pages/website/ai-call-panel
 */

const CALL = AMELIA_JACK_CALLS.next;

/** The call's updates window. */
export function AiCallPanel() {
  // Each window is shown twice (the slide and the desktop panel), so its title id is its own.
  const titleId = useId();
  const [decisions, setDecisions] = useState<Record<string, Verdict>>({});
  const decide = (id: string, v: Verdict | null) =>
    setDecisions((d) => {
      const next = { ...d };
      if (v) next[id] = v;
      else delete next[id];
      return next;
    });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DialogHeader
        id={titleId}
        icon={CallIcon}
        title={CALL.title}
        // The couple only from sm: on a phone the call's title needs the room.
        aside={
          <>
            <span className="max-sm:hidden">Amelia &amp; Jack · </span>
            {AMELIA_JACK_CALLS.nextLength}
          </>
        }
        closable={false}
      />
      <DialogBody underBar>
        <CallUpdates updates={CALL.updates} decisions={decisions} onDecide={decide} quotes />
      </DialogBody>
    </div>
  );
}
