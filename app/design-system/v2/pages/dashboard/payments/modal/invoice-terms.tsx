'use client';

import { CalendarClockIcon, HourglassIcon, PaymentsIcon } from '@/components/ui-v2/icons';
import { readAmount, type Amount } from '@/components/ui-v2/value-menu';
import { ValuePicker } from '@/components/ui-v2/value-picker';

import type { BalanceFrom, InvoiceDraft } from '../../account';
import { TODAY, addSpan, daysBetween, spanText, type Span, type Unit } from '../dates';

import { SETTING_ROWS, SettingRow } from './setting-row';

/**
 * The invoice editor's side: the three things a deposit invoice needs
 * from the MC, each a named row (see `SettingRow`) holding a
 * `ValuePicker`: the common choices, or type any other.
 * - Deposit: a percent of the package.
 * - Due in: days, weeks or months from today.
 * - Balance due: days, weeks or months before the event, or after this
 *   invoice (for a booking with no date yet); the button says the whole
 *   phrase, so it never wraps apart from its words.
 *
 * A tinted number with a unit menu beside it, a stepper, a settings list
 * and a sentence were all tried; the picker won (user, 2026-10-15). It is
 * the same panel the onboarding's first invoice opens.
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

/** The deposit's common percents. */
export const DEPOSITS: Amount<'%'>[] = [10, 20, 25, 30, 50].map((n) => ({ n, unit: '%' }));
const DUE: Span[] = [3, 7, 14, 30].map((count) => ({ count, unit: 'days' }));
const LEAD: Span[] = [...[7, 14, 30].map((count) => ({ count, unit: 'days' as const })), { count: 2, unit: 'months' }];

/** "25%" typed as a deposit: a percent, 0 for none. */
export const readPercent = (text: string, min = 1) => readAmount(text, ['%'] as const, { '%': 100 }, min);
const readSpan = (text: string): Span[] => readAmount(text, UNITS, MAX).map(({ n, unit }) => ({ count: n, unit }));

/** The invoice's side panel. See {@link InvoiceTermsProps}. */
// `price` and `eventOn` are kept on the props for the invoice preview's
// callers; the rows no longer spell out amounts or dates (user, 2026-10-14).
export function InvoiceTerms({ draft, onDraft }: InvoiceTermsProps) {
  const due = draft.due ?? { count: draft.dueDays, unit: 'days' };
  const balance = draft.balance ?? BALANCE;
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="type-subheading text-zebra-950">Get paid</h3>
        <p className="type-body text-zebra-500">Payment plans and payouts can be set up later.</p>
      </div>
      <div className={SETTING_ROWS}>
        <SettingRow label="Deposit" icon={PaymentsIcon}>
          <ValuePicker
            label="Deposit"
            value={{ n: draft.percent, unit: '%' as const }}
            presets={DEPOSITS}
            show={({ n }) => `${n}%`}
            read={readPercent}
            placeholder="Type a percent…"
            onPick={({ n }) => onDraft({ ...draft, percent: n })}
          />
        </SettingRow>
        <SettingRow label="Due in" icon={CalendarClockIcon}>
          <SpanPicker label="Due in" span={due} presets={DUE} onChange={(s) => onDraft({ ...draft, due: s, dueDays: daysBetween(TODAY, addSpan(TODAY, s)) })} />
        </SettingRow>
        <SettingRow label="Balance due" icon={HourglassIcon}>
          <BalancePicker span={balance} from={draft.balanceFrom ?? 'event'} onChange={(b, balanceFrom) => onDraft({ ...draft, balance: b, balanceFrom })} />
        </SettingRow>
      </div>
    </div>
  );
}

/** A length of time: the common ones, or type any in days, weeks or months. */
function SpanPicker({ label, span, presets, onChange }: { label: string; span: Span; presets: readonly Span[]; onChange: (s: Span) => void }) {
  return <ValuePicker label={label} value={span} presets={presets} show={spanText} read={readSpan} onPick={onChange} />;
}

/** How the balance's anchor reads after its time. */
export const BALANCE_FROM: Record<BalanceFrom, string> = { event: 'before the event', invoice: 'after this invoice' };

type Balance = { span: Span; from: BalanceFrom };

/** The balance: a time, and what it counts from, in one menu. */
function BalancePicker({ span, from, onChange }: { span: Span; from: BalanceFrom; onChange: (s: Span, from: BalanceFrom) => void }) {
  const value: Balance = { span, from };
  return (
    <ValuePicker
      label="Balance due"
      value={value}
      presets={LEAD.map((s) => ({ span: s, from }))}
      show={(b) => `${spanText(b.span)} ${BALANCE_FROM[b.from]}`}
      row={(b) => spanText(b.span)}
      read={(t) => readSpan(t).map((s) => ({ span: s, from }))}
      also={(['event', 'invoice'] as const).map((f) => ({ label: BALANCE_FROM[f].replace(/^./, (c) => c.toUpperCase()), value: { span, from: f }, selected: f === from }))}
      onPick={(b) => onChange(b.span, b.from)}
    />
  );
}
