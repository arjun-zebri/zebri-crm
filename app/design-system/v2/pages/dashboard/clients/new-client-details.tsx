'use client';

import { useState } from 'react';

import { formatDate } from '@/components/ui-v2/date-field';
import { CalendarIcon, GuestsIcon, JourneysIcon, PackageIcon, SourceIcon, VenueIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { Input } from '@/components/ui-v2/input';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';
import { RangeCalendar } from '@/components/ui-v2/range-calendar';

import { useAccount } from '../account';
import { useJourneys } from '../journeys/use-journeys';
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
 * Journey comes first and is already set: adding a client is what starts
 * their journey, so the chip shows which one (the journey new clients
 * start on) and the MC can switch it, or pick No journey.
 *
 * @module app/design-system/v2/pages/dashboard/clients/new-client-details
 */

export interface Details {
  date: string;
  venue: string;
  guests: string;
  interest: string;
  source: string;
  /** The journey by name: "" for the default (the one new clients start on), NONE for none. */
  journey: string;
}

/** The journey chip's "No journey". */
export const NONE = '\u0000none';

export const NO_DETAILS: Details = { date: '', venue: '', guests: '', interest: '', source: '', journey: '' };

/** Where enquiries come from for an MC, most common first. Also the Overview's Source menu. */
export const SOURCES = ['Instagram', 'Google', 'Referral', 'Venue', 'Directory listing', 'Expo', 'Other'];

type Which = keyof Details;

/** The chip row. Controlled: the dialog holds the details. */
export function NewClientDetails({ value, onChange }: { value: Details; onChange: (d: Details) => void }) {
  const { clients, packages, journeys: source, today: accountToday } = useAccount();
  // A new account runs on the real date and takes a wedding already past (a celebrant lodging one); the demo keeps its fixed day.
  const today = accountToday ?? TODAY;
  const { journeys } = useJourneys(source);
  const fallback = (journeys.find((j) => j.starts) ?? journeys[0])?.name ?? '';
  const journey = value.journey === NONE ? '' : value.journey || fallback;
  const [open, setOpen] = useState<Which | null>(null);
  const toggle = (w: Which) => (o: boolean) => setOpen(o ? w : null);
  const set = (w: Which, v: string, close = true) => {
    onChange({ ...value, [w]: v });
    if (close) setOpen(null);
  };
  const days = value.date ? daysBetween(today, value.date) : 0;
  const when = days === 0 ? 'today' : days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${days === -1 ? '' : 's'} ago`;
  // Venues the MC has worked before, most will come round again: one click instead of typing.
  const q = value.venue.trim().toLowerCase();
  const venues = [...new Set((clients ?? []).map((c) => c.venue).filter(Boolean))]
    .filter((v) => v.toLowerCase() !== q && v.toLowerCase().includes(q))
    .slice(0, 5);
  // The popover is the field: one option G line to type on, led by the
  // chip's icon, its name the grey placeholder (no box, no label over it).
  // Enter puts it away.
  const line = (w: 'venue' | 'guests', icon: ZebriIcon, label: string, numeric = false) => (
    <div className="px-2">
      <Input
        icon={icon}
        label={label}
        inputMode={numeric ? 'numeric' : undefined}
        autoComplete="off"
        value={value[w]}
        onChange={(e) => set(w, numeric ? e.target.value.replace(/\D/g, '') : e.target.value, false)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          setOpen(null);
        }}
        data-autofocus
      />
    </div>
  );
  return (
    <div className="-mx-2.5 flex flex-wrap gap-1">
      {journeys.length ? (
        <PropertyChip icon={JourneysIcon} label="Journey" value={journey ? `${journey} journey` : undefined} open={open === 'journey'} onOpenChange={toggle('journey')} size="menu">
          {journeys.map((j) => (
            <MenuOption key={j.id} selected={journey === j.name} onSelect={() => set('journey', j.name)}>
              {j.name}
            </MenuOption>
          ))}
          <MenuOption selected={!journey} onSelect={() => set('journey', NONE)}>
            No journey
          </MenuOption>
        </PropertyChip>
      ) : null}
      <PropertyChip
        icon={CalendarIcon}
        label="Event date"
        value={value.date ? `${formatDate(value.date)} · ${when}` : undefined}
        open={open === 'date'}
        onOpenChange={toggle('date')}
      >
        <RangeCalendar from={value.date} to={value.date} today={today} min={accountToday ? undefined : TODAY} onPick={(d) => set('date', d)} />
      </PropertyChip>
      <PropertyChip icon={VenueIcon} label="Venue" value={value.venue.trim() || undefined} open={open === 'venue'} onOpenChange={toggle('venue')} size="menu">
        <div className="w-72">
          {line('venue', VenueIcon, 'Venue')}
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
      <PropertyChip icon={GuestsIcon} label="Guests" value={value.guests ? `${value.guests} guests` : undefined} open={open === 'guests'} onOpenChange={toggle('guests')} size="menu">
        <div className="w-56">{line('guests', GuestsIcon, 'Guests', true)}</div>
      </PropertyChip>
      <PropertyChip icon={PackageIcon} label="Package" value={value.interest || undefined} open={open === 'interest'} onOpenChange={toggle('interest')} size="menu">
        {(packages ?? []).map((p) => (
          <MenuOption key={p.name} selected={value.interest === p.name} onSelect={() => set('interest', value.interest === p.name ? '' : p.name)}>
            {p.name}
          </MenuOption>
        ))}
      </PropertyChip>
      <PropertyChip icon={SourceIcon} label="Found you via" value={value.source ? `Via ${value.source}` : undefined} open={open === 'source'} onOpenChange={toggle('source')} size="menu">
        {SOURCES.map((s) => (
          <MenuOption key={s} selected={value.source === s} onSelect={() => set('source', value.source === s ? '' : s)}>
            {s}
          </MenuOption>
        ))}
      </PropertyChip>
    </div>
  );
}
