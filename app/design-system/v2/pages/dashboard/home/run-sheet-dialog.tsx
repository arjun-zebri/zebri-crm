'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { ChoiceCard } from '@/components/ui-v2/choice-card';
import { Dialog } from '@/components/ui-v2/dialog';

import type { RunSheetItem } from '../demo-activity';

import { DialogBody, DialogFooter, DialogHeader, DoneView, useSend } from './dialog-parts';
import { RunSheetEditor, type EditRow } from './run-sheet-editor';
import { SHEET_EVENTS, sheetFor } from './run-sheets';

/**
 * A run sheet in an `md` dialog (one height throughout). From Build a
 * run sheet it starts by asking which event; from the next event's row
 * on Home it opens straight onto that event's sheet. The sheet is rows
 * to edit (see `run-sheet-editor.tsx`), filled from what is saved or
 * from Zebri's draft. Save hands the rows back and lands on a done view.
 * Keyed by the caller, so each opening starts fresh.
 *
 * @module app/design-system/v2/pages/dashboard/home/run-sheet-dialog
 */

export interface RunSheetDialogProps {
  open: boolean;
  /** The event's client to open on; `null` starts on the event picker. */
  client: string | null;
  /** Sheets saved this visit, by client. */
  saved: Record<string, RunSheetItem[]>;
  onSave: (client: string, items: RunSheetItem[]) => void;
  onClose: () => void;
}

const toRows = (items: RunSheetItem[]): EditRow[] => items.map((it, key) => ({ ...it, key }));

/** The run sheet dialog. See {@link RunSheetDialogProps}. */
export function RunSheetDialog({ open, client, saved, onSave, onClose }: RunSheetDialogProps) {
  const [who, setWho] = useState<string | null>(client);
  const [step, setStep] = useState<'pick' | 'edit' | 'saved'>(client ? 'edit' : 'pick');
  const [rows, setRows] = useState<EditRow[]>(() =>
    client ? toRows(sheetFor(client, saved)) : [],
  );
  const { busy, send } = useSend();
  const toConfirm = rows.filter((r) => !r.done).length;
  const save = () =>
    send(() => {
      if (!who) return;
      onSave(
        who,
        rows
          .filter((r) => r.time.trim() || r.moment.trim())
          .map(({ time, moment, done }) => ({ time, moment, done })),
      );
      setStep('saved');
    });
  return (
    <Dialog open={open} onClose={onClose} size="md" aria-labelledby="run-sheet-title">
      <DialogHeader
        id="run-sheet-title"
        title={step === 'pick' ? 'Build a run sheet' : `${who}'s run sheet`}
        note={
          step === 'edit' ? (toConfirm ? `${toConfirm} to confirm` : 'All confirmed') : undefined
        }
      />
      {step === 'saved' ? (
        <DoneView
          title={`Run sheet saved for ${who}`}
          detail="Your venue and suppliers see the changes straight away, and Zebri asks the couple to confirm what's still open."
        />
      ) : (
        <DialogBody>
          {step === 'pick' ? (
            <fieldset className="space-y-2">
              <legend className="pb-2 type-body text-zebra-500">Which event is it for?</legend>
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
            </fieldset>
          ) : (
            <RunSheetEditor rows={rows} onChange={setRows} disabled={busy} />
          )}
        </DialogBody>
      )}
      <DialogFooter>
        {step === 'pick' ? (
          <>
            <Button variant="plain" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!who}
              onClick={() => {
                if (!who) return;
                setRows(toRows(sheetFor(who, saved)));
                setStep('edit');
              }}
            >
              Next
            </Button>
          </>
        ) : step === 'edit' ? (
          <>
            <Button
              variant="plain"
              onClick={client ? onClose : () => setStep('pick')}
              disabled={busy}
            >
              {client ? 'Cancel' : 'Back'}
            </Button>
            <Button loading={busy} onClick={save}>
              Save run sheet
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Done</Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
