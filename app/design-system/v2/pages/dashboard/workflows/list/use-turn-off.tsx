'use client';

import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';

import type { Workflow } from '../model';
import type { WorkflowsState } from '../use-workflows-state';

/**
 * The one way a workflow's On switch changes, from the list or the
 * builder. Turning one off while clients are part-way through asks
 * first, because a switch can't say what happens to the emails already
 * lined up for them: let those clients finish (nobody new joins), or
 * stop for everyone. Turning on, or off with nobody on it, just happens.
 *
 * @module app/design-system/v2/pages/dashboard/workflows/list/use-turn-off
 */

export interface TurnOff {
  /** Call from the switch's onChange. */
  toggle: (w: Workflow, on: boolean) => void;
  /** Render once, anywhere in the page. */
  dialog: ReactNode;
}

const plural = (n: number) => `${n} client${n === 1 ? ' is' : 's are'}`;

/** The On switch's behaviour. See {@link TurnOff}. */
export function useTurnOff(state: WorkflowsState): TurnOff {
  const [asking, setAsking] = useState<Workflow | null>(null);
  const off = (w: Workflow, patch: Partial<Workflow>) => state.update(w.id, (x) => ({ ...x, on: false, offSince: 'just now', ...patch }));
  const close = () => setAsking(null);

  const toggle = (w: Workflow, on: boolean) => {
    if (on) state.update(w.id, (x) => ({ ...x, on: true, finishing: false, offSince: undefined }));
    else if (w.clients.length > 0) setAsking(w);
    else off(w, {});
  };

  const dialog = (
    <Dialog open={asking !== null} onClose={close} aria-labelledby="turn-off-title">
      {asking ? (
        <div className="space-y-5 p-6">
          <div className="space-y-1">
            <h2 id="turn-off-title" className="type-subheading text-zebra-950">
              Turn off {asking.name}?
            </h2>
            <p className="type-body text-zebra-500">
              {plural(asking.clients.length)} part-way through it. Nobody new will join either way.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="plain" onClick={close}>
              Keep it on
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                off(asking, { clients: [], finishing: false });
                close();
              }}
            >
              Stop for everyone
            </Button>
            {/* The safe choice is the primary one: nothing already
                promised to a client goes unsent. */}
            <Button
              onClick={() => {
                off(asking, { finishing: true });
                close();
              }}
            >
              Let them finish
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );

  return { toggle, dialog };
}
