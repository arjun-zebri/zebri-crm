'use client';

import { CalendarDays, MapPin, Megaphone, Package, Users, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { formatDate } from '@/components/ui-v2/date-field';
import { InlineInput } from '@/components/ui-v2/inline-input';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';
import { RangeCalendar } from '@/components/ui-v2/range-calendar';

import { useAccount } from '../account';
import { TODAY, daysBetween } from '../payments/dates';

/**
 * The detail chips under New client's names: the event's date and venue,
 * roughly how many guests, the package they asked about, and how they
 * found the MC. Each is a `PropertyChip` that opens only the picker it
 * needs (a calendar with no past days, a line to type on with the MC's
 * past venues under it, a list), so the
 * card stays one name until the MC wants to say more. Where they found
 * the MC is what tells them which marketing works, so it is asked here,
 * at the enquiry, while they still remember.
 *
 * @module app/design-system/v2/pages/dashboard/clients/new-client-details
 */

export interface Details {
  date: string;
  venue: string;
  guests: string;
  interest: string;
  source: string;
}

export const NO_DETAILS: Details = { date: '', venue: '', guests: '', interest: '', source: '' };

/** Where enquiries come from for an MC, most common first. */
const SOURCES = ['Instagram', 'Google', 'Referral', 'Venue', 'Directory listing', 'Expo', 'Other'];

type Which = keyof Details;

/** The chip row. Controlled: the dialog holds the details. */
export function NewClientDetails({ value, onChange }: { value: Details; onChange: (d: Details) => void }) {
  const { clients, packages } = useAccount();
  const [open, setOpen] = useState<Which | null>(null);
  const toggle = (w: Which) => (o: boolean) => setOpen(o ? w : null);
  const set = (w: Which, v: string, close = true) => {
    onChange({ ...value, [w]: v });
    if (close) setOpen(null);
  };
  const days = value.date ? daysBetween(TODAY, value.date) : 0;
  // Venues the MC has worked before, most will come round again: one click instead of typing.
  const q = value.venue.trim().toLowerCase();
  const venues = [...new Set((clients ?? []).map((c) => c.venue).filter(Boolean))]
    .filter((v) => v.toLowerCase() !== q && v.toLowerCase().includes(q))
    .slice(0, 5);
  // The popover is the field: one borderless line to type on, led by the
  // chip's icon, with no second label or box (the chip already says what
  // it is). Enter puts it away.
  const line = (w: 'venue' | 'guests', Icon: LucideIcon, label: string, placeholder: string, numeric = false) => (
    <div className="flex h-8 items-center gap-2 px-2">
      <Icon aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0 text-zebra-400" />
      <InlineInput
        aria-label={label}
        placeholder={placeholder}
        inputMode={numeric ? 'numeric' : undefined}
        autoComplete="off"
        value={value[w]}
        onChange={(e) => set(w, numeric ? e.target.value.replace(/\D/g, '') : e.target.value, false)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          setOpen(null);
        }}
        className="min-w-0 flex-1 type-body"
        data-autofocus
      />
    </div>
  );
  return (
    <div className="-mx-2.5 flex flex-wrap gap-1">
      <PropertyChip
        icon={CalendarDays}
        label="Event date"
        value={value.date ? `${formatDate(value.date)} · in ${days} day${days === 1 ? '' : 's'}` : undefined}
        open={open === 'date'}
        onOpenChange={toggle('date')}
      >
        <RangeCalendar from={value.date} to={value.date} today={TODAY} min={TODAY} onPick={(d) => set('date', d)} />
      </PropertyChip>
      <PropertyChip icon={MapPin} label="Venue" value={value.venue.trim() || undefined} open={open === 'venue'} onOpenChange={toggle('venue')} size="menu">
        <div className="w-72">
          {line('venue', MapPin, 'Venue', "Where it's on")}
          {venues.length ? (
            <div className="mt-1">
              {venues.map((v) => (
                <MenuOption key={v} onSelect={() => set('venue', v)}>
                  {v}
                </MenuOption>
              ))}
            </div>
          ) : null}
        </div>
      </PropertyChip>
      <PropertyChip icon={Users} label="Guests" value={value.guests ? `${value.guests} guests` : undefined} open={open === 'guests'} onOpenChange={toggle('guests')} size="menu">
        <div className="w-56">{line('guests', Users, 'Guests', 'About how many guests', true)}</div>
      </PropertyChip>
      <PropertyChip icon={Package} label="Package" value={value.interest || undefined} open={open === 'interest'} onOpenChange={toggle('interest')} size="menu">
        {(packages ?? []).map((p) => (
          <MenuOption key={p.name} selected={value.interest === p.name} onSelect={() => set('interest', value.interest === p.name ? '' : p.name)}>
            {p.name}
          </MenuOption>
        ))}
      </PropertyChip>
      <PropertyChip icon={Megaphone} label="Found you via" value={value.source ? `Via ${value.source}` : undefined} open={open === 'source'} onOpenChange={toggle('source')} size="menu">
        {SOURCES.map((s) => (
          <MenuOption key={s} selected={value.source === s} onSelect={() => set('source', value.source === s ? '' : s)}>
            {s}
          </MenuOption>
        ))}
      </PropertyChip>
    </div>
  );
}
