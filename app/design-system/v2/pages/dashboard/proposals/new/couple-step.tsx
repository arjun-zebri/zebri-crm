'use client';

import { useState } from 'react';

import { ClientsIcon, UserIcon } from '@/components/ui-v2/icons';
import { Input } from '@/components/ui-v2/input';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';

import { useAccount } from '../../account';
import { STAGES, clientName } from '../../clients/clients-data';
import { coupleName } from '../../payments/payments-data';

/**
 * The first step of New proposal: who it is for, one pick, so a
 * `PropertyChip` as New client's details are. Its menu lists the leads
 * on the Clients page who have no proposal yet, each with their wedding
 * and where they are up to, then Someone new, which opens two
 * name lines led by a person icon (option G) for an enquiry that is not in Zebri yet.
 *
 * @module app/design-system/v2/pages/dashboard/proposals/new/couple-step
 */

/** The pick: a lead's display name, or `NEW` with typed names. */
export const NEW = 'new';

/** The account's leads before the Proposal stage with nothing drafted or sent. */
export function useLeads() {
  const { clients, proposals } = useAccount();
  const taken = new Set(proposals.map((p) => coupleName(p.names)));
  return clients.filter((c) => STAGES.indexOf(c.stage) < STAGES.indexOf('Proposal') && !taken.has(clientName(c)));
}

export interface CoupleStepProps {
  value: string | null;
  onChange: (v: string) => void;
  names: [string, string];
  onNames: (n: [string, string]) => void;
}

/** The couple step. See {@link CoupleStepProps}. */
export function CoupleStep({ value, onChange, names, onNames }: CoupleStepProps) {
  const LEADS = useLeads();
  // Opens on its own the first time, since picking who is the whole step.
  const [open, setOpen] = useState(value === null);
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  return (
    <div className="space-y-6">
      <div className="-mx-2.5">
        <PropertyChip
          icon={ClientsIcon}
          label="Who it's for"
          value={value === NEW ? 'Someone new' : (value ?? undefined)}
          open={open}
          onOpenChange={setOpen}
          size="menu"
        >
          {LEADS.map((c) => (
            <MenuOption
              key={c.id}
              selected={value === clientName(c)}
              description={`${c.date} · ${c.venue} · ${c.stage}`}
              onSelect={() => pick(clientName(c))}
            >
              {clientName(c)}
            </MenuOption>
          ))}
          <MenuOption selected={value === NEW} description="An enquiry that isn’t in Zebri yet" onSelect={() => pick(NEW)}>
            Someone new
          </MenuOption>
        </PropertyChip>
      </div>
      {value === NEW ? (
        <div className="space-y-1">
          <Input icon={UserIcon} label="First partner" value={names[0]} onChange={(e) => onNames([e.target.value, names[1]])} data-autofocus />
          <Input icon={UserIcon} label="Second partner" value={names[1]} onChange={(e) => onNames([names[0], e.target.value])} />
        </div>
      ) : null}
    </div>
  );
}
