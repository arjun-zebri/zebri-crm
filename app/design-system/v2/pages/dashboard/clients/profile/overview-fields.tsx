'use client';

import { useState, type ReactNode } from 'react';

import { formatDate } from '@/components/ui-v2/date-field';
import { FitInput } from '@/components/ui-v2/fit-input';
import { GuestsIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';
import { Input } from '@/components/ui-v2/input';
import { MenuOption } from '@/components/ui-v2/popover';
import { PropertyChip } from '@/components/ui-v2/property-chip';
import { RangeCalendar } from '@/components/ui-v2/range-calendar';

import { useAccount } from '../../account';
import { TODAY } from '../../payments/dates';
import { money } from '../../payments/payments-data';
import { SOURCES } from '../new-client-details';

import { factTone } from './overview-rows';
import type { Fact } from './profile-data';

/**
 * One editable detail on a client's Overview, entered the way New client
 * enters it (2026-10-09 founder: "copy the new client modal"): the value
 * is a quiet `PropertyChip` (plain text, tinted on hover) that opens
 * only the picker it needs. Date opens a calendar, Guests a number line,
 * Package the MC's packages, Source where enquiries come from. Venue and
 * Rehearsal are fitted words typed in place (Venue's popover of past
 * venues was dropped, user 2026-10-15: a dropdown for one line of text
 * was more than it needed). The chip bleeds
 * left by its padding so its text lines up with the plain values above
 * and below it.
 *
 * Details Zebri works out elsewhere (Paid from invoices, Run sheet from
 * the run sheet) are not fields; {@link isField} says which are.
 *
 * @module app/design-system/v2/pages/dashboard/clients/profile/overview-fields
 */

/** The details the MC enters; the rest are read-only. */
const FIELDS = new Set(['Date', 'Venue', 'Rehearsal', 'Guests', 'Package', 'Source']);

/** "120" → "120 guests"; nothing typed clears it. */
const guests = (typed: string) => {
  const n = typed.replace(/\D/g, '');
  return n ? `${n} guests` : '';
};

/** A new day keeps the time already set: "Sat 10 Oct, 2:30pm" picked to the 17th stays at 2:30pm. */
const withTime = (day: string, was: string) => {
  const time = /,\s*(\d{1,2}(?::\d{2})?\s*[ap]m)$/i.exec(was)?.[1];
  return time ? `${day}, ${time}` : day;
};

/** Whether the MC can change this detail. */
export const isField = (fact: Fact) => FIELDS.has(fact.label);

export interface OverviewFieldProps {
  fact: Fact;
  onChange: (value: string) => void;
}

/** The detail's editor. See {@link OverviewFieldProps}. */
export function OverviewField({ fact, onChange }: OverviewFieldProps) {
  const { packages, today } = useAccount();
  const [open, setOpen] = useState(false);
  const pick = (v: string) => (onChange(v), setOpen(false));
  const chip = (children: ReactNode, size: 'menu' | 'card' = 'menu') => (
    // -ml-2.5 takes back the chip's padding, so its text lines up with the rows'.
    <div className="-ml-2.5 min-w-0">
      <PropertyChip
        quiet
        label={fact.label}
        value={fact.value || undefined}
        tone={fact.tone}
        open={open}
        onOpenChange={setOpen}
        size={size}
      >
        {children}
      </PropertyChip>
    </div>
  );
  // An option G line to type on inside the popover, as New client's: led by
  // the detail's icon, its name the grey placeholder. Enter puts it away.
  const line = (icon: ZebriIcon, numeric = false, value = fact.value) => (
    <div className="px-2">
      <Input
        icon={icon}
        label={fact.label}
        inputMode={numeric ? 'numeric' : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(numeric ? guests(e.target.value) : e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          setOpen(false);
        }}
        data-autofocus
      />
    </div>
  );

  switch (fact.label) {
    case 'Date':
      return chip(
        <RangeCalendar
          from=""
          to=""
          today={today ?? TODAY}
          // A new account (which runs on the real date) can set a wedding already past.
          min={today ? undefined : TODAY}
          onPick={(d) => pick(withTime(formatDate(d), fact.value))}
        />,
        'card',
      );
    case 'Guests':
      return chip(
        <div className="w-56">
          {line(GuestsIcon, true, fact.value.replace(/\D/g, ''))}
        </div>,
      );
    case 'Package':
      return chip(
        <>
          {(packages ?? []).map((p) => {
            const value = `${p.name} · ${money(p.price)}`;
            return (
              <MenuOption key={p.name} selected={fact.value === value} onSelect={() => pick(value)}>
                {p.name}
              </MenuOption>
            );
          })}
        </>,
      );
    case 'Source':
      return chip(
        <>
          {SOURCES.map((s) => (
            <MenuOption key={s} selected={fact.value === s} onSelect={() => pick(s)}>
              {s}
            </MenuOption>
          ))}
        </>,
      );
    default:
      return (
        // Fitted words in place in the row (the row already names it); -ml-2 takes back their inset.
        <FitInput
          aria-label={fact.label}
          placeholder="Add"
          value={fact.value}
          onChange={(e) => onChange(e.target.value)}
          textClassName={`type-body ${factTone(fact)}`}
          className="-ml-2"
        />
      );
  }
}
