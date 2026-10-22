'use client';

import { useState } from 'react';

import { ClientsIcon, EmailIcon, MessageIcon, MessageTextIcon } from '@/components/ui-v2/icons';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';

/**
 * The detail chips over a drafted message (the Payments reminder, the
 * Proposals nudge): who it goes to, how, and in what tone, each a
 * `PropertyChip` as New client's details are ("To Ella & Noah", "By
 * email", "Friendly tone"). A pick rewrites the draft, which is the
 * caller's job; this row only holds the choices.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/message-chips
 */

/** A partner the message can go to, with the hint under their name (an email, "opened last time"). */
export interface Recipient {
  first: string;
  hint: string;
}

export const CHANNELS = ['Email', 'SMS'] as const;
export type Channel = (typeof CHANNELS)[number];

export interface MessageChipsProps<T extends string> {
  people: Recipient[];
  to: string[];
  onTo: (to: string[]) => void;
  via: Channel;
  onVia: (via: Channel) => void;
  tones: readonly T[];
  tone: T;
  onTone: (tone: T) => void;
  disabled?: boolean | undefined;
}

type Which = 'to' | 'via' | 'tone';

/** The chip row. See {@link MessageChipsProps}. */
export function MessageChips<T extends string>({ people, to, onTo, via, onVia, tones, tone, onTone, disabled = false }: MessageChipsProps<T>) {
  const [open, setOpen] = useState<Which | null>(null);
  const toggle = (w: Which) => (o: boolean) => setOpen(o ? w : null);
  return (
    <div className="-mx-2.5 flex flex-wrap gap-1">
      <PropertyChip
        icon={ClientsIcon}
        label="To"
        value={to.length ? `To ${to.join(' & ')}` : undefined}
        tone={to.length ? undefined : 'danger'}
        open={open === 'to'}
        onOpenChange={toggle('to')}
        size="menu"
        disabled={disabled}
      >
        {/* Several can be picked, so a pick leaves the menu open. */}
        {people.map((p) => (
          <MenuOption
            key={p.first}
            selected={to.includes(p.first)}
            description={p.hint}
            onSelect={() => onTo(to.includes(p.first) ? to.filter((f) => f !== p.first) : people.map((x) => x.first).filter((f) => f === p.first || to.includes(f)))}
          >
            {p.first}
          </MenuOption>
        ))}
      </PropertyChip>
      <PropertyChip
        icon={via === 'Email' ? EmailIcon : MessageIcon}
        label="Via"
        value={via === 'Email' ? 'By email' : 'By SMS'}
        open={open === 'via'}
        onOpenChange={toggle('via')}
        size="menu"
        disabled={disabled}
      >
        {CHANNELS.map((c) => (
          <MenuOption
            key={c}
            selected={via === c}
            onSelect={() => {
              onVia(c);
              setOpen(null);
            }}
          >
            {c}
          </MenuOption>
        ))}
      </PropertyChip>
      <PropertyChip icon={MessageTextIcon} label="Tone" value={`${tone} tone`} open={open === 'tone'} onOpenChange={toggle('tone')} size="menu" disabled={disabled}>
        {tones.map((t) => (
          <MenuOption
            key={t}
            selected={tone === t}
            onSelect={() => {
              onTone(t);
              setOpen(null);
            }}
          >
            {t}
          </MenuOption>
        ))}
      </PropertyChip>
    </div>
  );
}
