'use client';

import { useState } from 'react';

import { Button } from '@/components/ui-v2/button';
import { Dialog } from '@/components/ui-v2/dialog';
import { DialogBody, DialogFooter, DialogHeader } from '@/components/ui-v2/dialog-parts';
import { EmptyState } from '@/components/ui-v2/empty-state';
import { ClientsIcon, StartIcon, UserPlusIcon } from '@/components/ui-v2/icons';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';

import { useAccount } from '../account';
import { clientName } from '../clients/clients-data';

import type { Journey } from './journeys-data';

/**
 * Add a client to a journey by hand: which client, and the step they
 * start at (the first, or later for a couple who booked another way),
 * each a chip that says its value, as New client's details are. A client
 * is only ever on one journey, so one already on another moves across.
 * It says how clients normally arrive: new enquiries start on the
 * journey marked for them, by themselves. No Cancel: Escape, a click
 * outside or Close leave.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/add-client-dialog
 */

export interface AddClientDialogProps {
  open: boolean;
  journey: Journey;
  journeys: Journey[];
  onClose: () => void;
  onAdd: (client: { id: string; name: string }, step: string) => void;
}

/** The dialog. Keyed by the caller, so each opening starts fresh. See {@link AddClientDialogProps}. */
export function AddClientDialog({ open, journey, journeys, onClose, onAdd }: AddClientDialogProps) {
  const here = new Set(journey.people.map((p) => p.id));
  const clients = useAccount().clients.filter((c) => !here.has(c.id));
  const steps = journey.steps.filter((s) => s.kind !== 'day');
  const [client, setClient] = useState(clients[0]?.id ?? '');
  const [step, setStep] = useState(steps[0]?.id ?? '');
  const [picking, setPicking] = useState<'client' | 'step' | null>(null);
  const toggle = (w: 'client' | 'step') => (o: boolean) => setPicking(o ? w : null);
  const chosen = clients.find((c) => c.id === client);
  const at = steps.find((s) => s.id === step);
  const elsewhere = journeys.find((j) => j.id !== journey.id && j.people.some((p) => p.id === client));
  const starts = journeys.find((j) => j.starts);
  return (
    <Dialog open={open} onClose={onClose} size="form" aria-labelledby="add-client-title">
      <DialogHeader id="add-client-title" icon={UserPlusIcon} title={`Add a client to ${journey.name}`} />
      <DialogBody className="space-y-6">
        <p className="type-lead text-zebra-500">
          New enquiries start on {starts?.name ?? 'your first journey'} by themselves. Add a client here when they came another way.
        </p>
        {clients.length ? (
          <div className="space-y-3">
            <div className="-mx-2.5 flex flex-wrap gap-1">
              <PropertyChip icon={ClientsIcon} label="Client" value={chosen ? clientName(chosen) : undefined} open={picking === 'client'} onOpenChange={toggle('client')} size="menu">
                {clients.map((c) => (
                  <MenuOption key={c.id} selected={c.id === client} onSelect={() => (setClient(c.id), setPicking(null))}>
                    {clientName(c)}
                  </MenuOption>
                ))}
              </PropertyChip>
              <PropertyChip icon={StartIcon} label="Start at" value={at ? `Starts at ${at.name}` : undefined} open={picking === 'step'} onOpenChange={toggle('step')} size="menu">
                {steps.map((s) => (
                  <MenuOption key={s.id} selected={s.id === step} description={s.detail} onSelect={() => (setStep(s.id), setPicking(null))}>
                    {s.name}
                  </MenuOption>
                ))}
              </PropertyChip>
            </div>
            {elsewhere ? <p className="type-body text-zebra-500">They come off {elsewhere.name} and get nothing more from it.</p> : null}
          </div>
        ) : (
          <EmptyState compact title="No one to add" body="Every client is already on this journey." />
        )}
      </DialogBody>
      <DialogFooter>
        <Button disabled={!chosen} onClick={() => chosen && onAdd({ id: chosen.id, name: clientName(chosen) }, step)}>
          Add client
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
