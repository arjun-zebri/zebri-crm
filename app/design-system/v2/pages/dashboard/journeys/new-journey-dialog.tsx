'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { BranchIcon, BriefcaseIcon, JourneysIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';

import type { Journey } from './journeys-data';

/**
 * New journey, built like New client: the type of work it is for as one
 * big line to type, and the journey to start from as a chip that says
 * its value ("From Full weddings"), so a new one is never an empty line.
 * Its steps are then changed on the line itself. No Cancel: Escape, a
 * click outside or Close leave.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/new-journey-dialog
 */

export interface NewJourneyDialogProps {
  open: boolean;
  journeys: Journey[];
  onClose: () => void;
  onCreate: (name: string, from: string) => void;
}

/** The dialog. Keyed by the caller, so each opening starts fresh. See {@link NewJourneyDialogProps}. */
export function NewJourneyDialog({ open, journeys, onClose, onCreate }: NewJourneyDialogProps) {
  const [name, setName] = useState('');
  const [from, setFrom] = useState(journeys[0]?.id ?? '');
  const [picking, setPicking] = useState(false);
  const ok = name.trim().length > 0;
  const source = journeys.find((j) => j.id === from);
  return (
    <Dialog open={open} onClose={onClose} size="form" aria-labelledby="new-journey-title">
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onCreate(name.trim(), from);
        }}
      >
        <DialogHeader id="new-journey-title" icon={JourneysIcon} title="New journey" />
        <DialogBody className="space-y-6">
          <Input
            icon={BriefcaseIcon}
            label="Type of work"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-autofocus
          />
          <div className="-mx-2.5 flex flex-wrap gap-1">
            <PropertyChip icon={BranchIcon} label="Start from" value={source ? `From ${source.name}` : undefined} open={picking} onOpenChange={setPicking} size="menu">
              {journeys.map((j) => (
                <MenuOption key={j.id} selected={j.id === from} onSelect={() => (setFrom(j.id), setPicking(false))}>
                  {j.name}
                </MenuOption>
              ))}
            </PropertyChip>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="submit" disabled={!ok}>
            Create journey
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
