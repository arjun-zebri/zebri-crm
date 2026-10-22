'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { RunSheetIcon } from '@/components/ui-v2/icons';

import { RunSheetWorkspace } from './run-sheet-workspace';
import { SHEET_EVENTS } from './run-sheets';

/**
 * A client's run sheet in an `xl` sheet, the client profile's size, in the style of New
 * client (one height throughout). It is the one way a sheet opens,
 * wherever from: the client's Documents, the next event's row on Home,
 * or Build a run sheet, which first asks which event (a sheet always
 * belongs to one). The sheet itself is `run-sheet-workspace.tsx`,
 * reading and saving through the shared store, so every place shows the
 * same sheet. Keyed by the caller, so each opening starts fresh.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-dialog
 */

export interface RunSheetDialogProps {
  open: boolean;
  /** The event's client to open on; `null` starts on the event picker. */
  client: string | null;
  /** The event, under the names; looked up for Home's events when left out. */
  when?: string | undefined;
  onClose: () => void;
}

/** The run sheet dialog. See {@link RunSheetDialogProps}. */
export function RunSheetDialog({ open, client, when, onClose }: RunSheetDialogProps) {
  const [who, setWho] = useState<string | null>(client);
  const [picked, setPicked] = useState(client !== null);
  return (
    <Dialog open={open} onClose={onClose} size="xl" aria-labelledby="run-sheet-title">
      {picked && who ? (
        <RunSheetWorkspace
          key={who}
          client={who}
          when={when ?? SHEET_EVENTS.find((e) => e.client === who)?.detail}
          onClose={onClose}
        />
      ) : (
        <>
          <DialogHeader id="run-sheet-title" icon={RunSheetIcon} title="Run sheet" onClose={onClose} />
          <DialogBody className="flex flex-col gap-6">
          <p className="type-title text-zebra-950 md:type-display">Which event is it for?</p>
          <div role="group" aria-label="Event" className="space-y-2">
            {SHEET_EVENTS.map((e) => (
              <ChoiceCard
                key={e.client}
                selected={who === e.client}
                onClick={() => setWho(e.client)}
                className="py-3"
              >
                <span className="type-label">{e.client}</span>
                <span className="type-body text-zebra-500">{e.detail}</span>
              </ChoiceCard>
            ))}
          </div>
          </DialogBody>
          <DialogFooter>
            <Button disabled={!who} onClick={() => setPicked(true)}>
              Next
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}
