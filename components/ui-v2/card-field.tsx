'use client';

import { useId } from 'react';
import { SiAmericanexpress, SiMastercard, SiVisa } from 'react-icons/si';

import { Field } from './field';

/**
 * Design system v2 card field (preview): a payment card as ONE control,
 * the way Stripe's card element and every premium checkout shows it:
 * the number, then expiry and CVC on the same line inside the same box,
 * with the card brands at the right until a number is typed. Three
 * separate labelled boxes read as a form to fill in, and a lock icon in
 * the number read as a scam page trying to look safe.
 *
 * The number groups itself in fours and the expiry slashes itself as it
 * is typed. Focus anywhere in it lights the whole box, as one field.
 * The live product swaps this for Stripe Elements; the look is the spec.
 *
 * @example
 * ```tsx
 * <CardField value={card} onChange={setCard} error={error} />
 * ```
 *
 * @module components/ui-v2/card-field
 */

export interface CardValue {
  number: string;
  expiry: string;
  cvc: string;
}

export interface CardFieldProps {
  value: CardValue;
  onChange: (v: CardValue) => void;
  /** One message for the whole card ("Check the card number"). */
  error?: string | undefined;
  /** Visible label; "Card" by default. */
  label?: string | undefined;
}

const digits = (s: string) => s.replace(/\D/g, '');
/** "4242424242424242" → "4242 4242 4242 4242". */
const groups = (s: string) => digits(s).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
/** "1229" → "12 / 29". */
const expiry = (s: string) => {
  const d = digits(s).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
};

const PART = 'min-w-0 bg-transparent type-body text-zebra-950 placeholder:text-zebra-400 focus-visible:outline-none';

/** v2 card field. See {@link CardFieldProps}. */
export function CardField({ value, onChange, error, label = 'Card' }: CardFieldProps) {
  const id = useId();
  const set = (part: Partial<CardValue>) => onChange({ ...value, ...part });
  return (
    <Field id={id} label={label} error={error}>
      <div
        // No box, as every v2 field (see control-styles): the error is the Field's message.
        className="flex h-9 items-center gap-3"
      >
        <input
          id={id}
          aria-label="Card number"
          aria-invalid={error ? true : undefined}
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="Card number"
          value={value.number}
          onChange={(e) => set({ number: groups(e.target.value) })}
          className={`${PART} flex-1`}
        />
        {/* The brands sit where the number will run to, and leave once it is typed. */}
        {value.number ? null : (
          <span aria-hidden="true" className="flex shrink-0 items-center gap-1.5 text-zebra-300">
            <SiVisa className="size-5" />
            <SiMastercard className="size-4" />
            <SiAmericanexpress className="size-4" />
          </span>
        )}
        <input
          aria-label="Expiry"
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM / YY"
          value={value.expiry}
          onChange={(e) => set({ expiry: expiry(e.target.value) })}
          className={`${PART} w-16 shrink-0`}
        />
        <input
          aria-label="CVC"
          inputMode="numeric"
          autoComplete="cc-csc"
          placeholder="CVC"
          value={value.cvc}
          onChange={(e) => set({ cvc: digits(e.target.value).slice(0, 4) })}
          className={`${PART} w-10 shrink-0`}
        />
      </div>
    </Field>
  );
}

/** Whether a card is complete enough to send, or the one thing to fix. */
export function cardProblem(card: CardValue): string | undefined {
  if (digits(card.number).length < 12) return 'Check the card number.';
  if (!/^\d{2} \/ \d{2}$/.test(card.expiry)) return 'Add the expiry, MM / YY.';
  if (!/^\d{3,4}$/.test(card.cvc)) return 'Add the 3 or 4 digit CVC.';
  return undefined;
}
