'use client';

import { useState, type ReactNode } from 'react';

import { formatDate } from '@/components/ui-v2/date-field';
import { Dropdown } from '@/components/ui-v2/dropdown';
import { Input } from '@/components/ui-v2/input';

import type { InvoiceDraft } from '../../account';
import { TODAY, addSpan, daysBetween, type Span, type Unit } from '../dates';
import { money } from '../payments-data';

/**
 * The invoice editor's side: three plain fields, the three things a
 * deposit invoice needs from the MC, each taking any value.
 * - Deposit: a percent, with the dollar amount under it.
 * - Deposit due: a number with a days, weeks or months picker inside the
 *   field, with the date under it.
 * - Balance due before the event: the same way, with its amount and date.
 *
 * Each field's help line is what the number means in money or a date,
 * so nobody does the sum. Dropdowns of presets, segmented presets and a
 * fill-in-the-blanks sentence were all tried: the first two left no
 * room for a custom value, the sentence was too clever to scan.
 *
 * The note comes written on the email and is not edited here, as the
 * contract's wording is not; payment plans and payouts are for later.
 *
 * @module app/design-system/v2/pages/dashboard/payments/modal/invoice-terms
 */

export interface InvoiceTermsProps {
  draft: InvoiceDraft;
  onDraft: (draft: InvoiceDraft) => void;
  /** The package price the percent is of. */
  price: number;
  /** The event date ("YYYY-MM-DD"), to date the balance; null when unknown. */
  eventOn: string | null;
}

/** The balance's lead time when the draft has none. */
export const BALANCE: Span = { count: 14, unit: 'days' };

const UNITS: Unit[] = ['days', 'weeks', 'months'];
/** The most of each unit a field takes. */
const MAX: Record<Unit, number> = { days: 180, weeks: 26, months: 12 };

/** The invoice's side panel. See {@link InvoiceTermsProps}. */
export function InvoiceTerms({ draft, onDraft, price, eventOn }: InvoiceTermsProps) {
  const deposit = Math.round((price * draft.percent) / 100);
  const due = draft.due ?? { count: draft.dueDays, unit: 'days' };
  const balance = draft.balance ?? BALANCE;
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="type-subheading text-zebra-950">Get paid</h3>
        <p className="type-body text-zebra-500">Payment plans and payouts can be set up later.</p>
      </div>
      <NumberField
        label="Deposit"
        value={draft.percent}
        max={100}
        onChange={(percent) => onDraft({ ...draft, percent })}
        help={`${money(deposit)} of ${money(price)}`}
        trailing={<span className="pr-2 type-body text-zebra-400">%</span>}
      />
      <SpanField
        label="Deposit due in"
        span={due}
        onChange={(s) => onDraft({ ...draft, due: s, dueDays: daysBetween(TODAY, addSpan(TODAY, s)) })}
        help={`On ${formatDate(addSpan(TODAY, due))}`}
      />
      <SpanField
        label="Balance due before the event"
        span={balance}
        onChange={(s) => onDraft({ ...draft, balance: s })}
        help={`${money(price - deposit)}${eventOn ? `, on ${formatDate(addSpan(eventOn, balance, -1))}` : ''}`}
      />
    </div>
  );
}

/** A length of time: the number, with a days, weeks or months picker inside the field. */
function SpanField({ label, span, onChange, help }: { label: string; span: Span; onChange: (s: Span) => void; help: string }) {
  return (
    <NumberField
      label={label}
      value={span.count}
      max={MAX[span.unit]}
      onChange={(count) => onChange({ ...span, count })}
      help={help}
      wide
      trailing={
        <Dropdown
          inline
          label={`${label}, unit`}
          value={span.unit}
          options={UNITS.map((u) => ({ value: u, label: span.count === 1 ? u.slice(0, -1) : u }))}
          onChange={(u) => onChange({ unit: u as Unit, count: Math.min(span.count, MAX[u as Unit]) })}
        />
      }
    />
  );
}

/**
 * A whole-number field. The typed text is its own state, so it can sit
 * empty mid-edit while the email keeps the last whole number; leaving
 * the field puts that number back.
 */
function NumberField({
  label,
  value,
  max,
  onChange,
  help,
  trailing,
  wide = false,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
  help: string;
  trailing: ReactNode;
  wide?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  // A value changed from outside (a unit switch capping it) replaces the text.
  if (seen !== value) {
    setSeen(value);
    setText(String(value));
  }
  return (
    <Input
      label={label}
      inputMode="numeric"
      value={text}
      help={help}
      trailing={trailing}
      trailingWide={wide}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 3);
        setText(digits);
        const n = Math.min(max, Number(digits));
        if (n >= 1) onChange(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}
