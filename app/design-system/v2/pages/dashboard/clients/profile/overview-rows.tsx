'use client';

import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui-v2/button';
import { CircleDotIcon, EmailIcon, SourceIcon, ChatIcon, MusicIcon, CallIcon } from '@/components/ui-v2/icons';
import {
  CalendarIcon,
  ClientsIcon,
  GuestsIcon,
  MicIcon,
  PackageIcon,
  PaymentsIcon,
  RunSheetIcon,
  VenueIcon,
} from '@/components/ui-v2/icons';
import type { ZebriIcon as ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { PropertyChip } from '@/components/ui-v2/property-chip';

import type { Fact, Person, Tone } from './profile-data';

/**
 * The pieces of the Overview's property sheet: a {@link PropertyRow}
 * (icon, label, value), the {@link JourneyValue} with its progress ring,
 * and {@link PeopleChips}, each a property chip opening a card to
 * call, message or email that person. Icons follow the fact's label, so a new fact shows
 * with a plain dot until it is given one here.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/overview-rows
 */

/** Each fact's icon, by its label: Zebri's own glyphs (2026-10-09). */
const ICONS: Record<string, ZebriIcon> = {
  Date: CalendarIcon,
  Venue: VenueIcon,
  Rehearsal: MicIcon,
  Package: PackageIcon,
  Paid: PaymentsIcon,
  Guests: GuestsIcon,
  'Run sheet': RunSheetIcon,
  // Labels a call's updates use.
  Timeline: RunSheetIcon,
  Speeches: MicIcon,
  'First dance': MusicIcon,
  People: ClientsIcon,
  // New client's own icon for where they found the MC, so the two read as one field.
  Source: SourceIcon,
};

// Dark enough amber for text on white, as elsewhere in the profile.
const TONE_TEXT: Record<Tone, string> = {
  danger: 'text-danger',
  warning: 'text-warning-ink',
};

/** The icon a fact shows. */
export const factIcon = (fact: Fact) => ICONS[fact.label] ?? CircleDotIcon;

/** A value that needs attention takes its colour (missing in red, waiting in amber). */
export const factTone = (fact: Fact) => (fact.tone ? TONE_TEXT[fact.tone] : 'text-zebra-950');

/** One row of the sheet: the icon and label in a fixed column, the value beside them. */
export function PropertyRow({
  icon: Icon,
  label,
  children,
}: {
  icon: ZebriIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="contents">
      <dt className="flex h-9 items-center gap-3 text-zebra-500">
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="flex min-h-9 min-w-0 flex-wrap items-center gap-x-2 gap-y-1">{children}</dd>
    </div>
  );
}

/** A small ring filled to how far along the journey the client is. */
function Ring({ done, total }: { done: number; total: number }) {
  // r = 6 in a 16 box; the arc's length is the circumference.
  const c = 2 * Math.PI * 6;
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 -rotate-90">
      <circle cx="8" cy="8" r="6" fill="none" strokeWidth="2.5" className="stroke-zebra-200" />
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        strokeWidth="2.5"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - done / total)}
        strokeLinecap="round"
        className="stroke-zebra-950"
      />
    </svg>
  );
}

/** The Journey row's value: the journey's name, the ring, then "5 of 7 · Balance invoice next". */
export function JourneyValue({
  name,
  at,
  total,
  next,
}: {
  /** The journey's name, or the menu that changes it. */
  name: ReactNode;
  /** The step they are on, counted from 1. */
  at: number;
  total: number;
  next: string;
}) {
  return (
    <>
      {/* The name first, so it lines up with the values under it; then how far along. */}
      {name}
      <Ring done={at} total={total} />
      <span className="text-zebra-500">
        {at} of {total} · {next} next
      </span>
    </>
  );
}

/** The People row's value: a chip per person, each opening a card with how to reach them. */
export function PeopleChips({ people }: { people: Person[] }) {
  return (
    // The first chip's text, not its edge, lines up with the values above:
    // -ml-2.5 takes back its padding, as the Journey chip does (user,
    // 2026-10-15, overruling the 2026-10-09 edge alignment).
    <div className="-ml-2.5 flex flex-wrap gap-1">
      {people.map((p) => (
        <PersonChip key={p.name} person={p} />
      ))}
    </div>
  );
}

function PersonChip({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const first = person.name.split(' ')[0] ?? person.name;
  // Australian mobile to international form for wa.me: 0412… → 61412….
  const digits = person.phone.replace(/\D/g, '').replace(/^0/, '61');
  const ways: { label: string; icon: ZebriIcon; href: string }[] = [
    { label: `Call ${first}`, icon: CallIcon, href: `tel:${person.phone.replace(/\s/g, '')}` },
    { label: `Message ${first}`, icon: ChatIcon, href: `https://wa.me/${digits}` },
    { label: `Email ${first}`, icon: EmailIcon, href: `mailto:${person.email}` },
  ];
  return (
    <PropertyChip label={person.role} value={person.name} open={open} onOpenChange={setOpen}>
      <p className="type-label text-zebra-950">{person.name}</p>
      <p className="type-body text-zebra-500">
        {person.role} · {person.prefers}
      </p>
      <div className="-ml-2 mt-3 flex gap-1">
        {ways.map(({ label, icon: Icon, href }) => (
          <Button
            key={label}
            variant="ghost"
            square
            aria-label={label}
            onClick={() => window.open(href, '_blank', 'noopener')}
          >
            <Icon aria-hidden="true" className="size-4" />
          </Button>
        ))}
      </div>
    </PropertyChip>
  );
}
