'use client';

import { Fragment, useState, type ReactNode } from 'react';

import { MenuOption, Popover, PopoverContent, PopoverTrigger } from '@/components/ui-v2/popover';
import { themeRoleCss } from '@/features/proposals';
import type { ProposalTheme } from '@/features/proposals';

import type { BookingTerms } from '../../state/use-doc-editor';

import { bookingParts, type TermSegment } from './booking-line';

/**
 * What saying yes sets going, edited as the sentence the couple reads:
 * "You sign the agreement, then a 25% deposit holds your date. The rest
 * is due a month before the wedding." Each underlined part opens its few
 * choices in place. There is no Accept settings panel to find: the MC
 * changes the terms by changing the words (2026-10-05, direct
 * manipulation; HoneyBook and Qwilr keep these in a panel).
 *
 * Only in the editor, in the Accept section's popover; the couple's
 * page shows the plain sentence (`BookingLine`), word for word the same.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/proposal/booking-terms
 */

const DEPOSITS = [0, 10, 20, 25, 30, 50, 100];
/** The balance choices; the words match `bookingParts`. */
const BALANCE: { days: number; words: string }[] = [
  { days: 14, words: 'two weeks' },
  { days: 30, words: 'a month' },
  { days: 60, words: 'two months' },
];

/** One changeable part of the sentence: underlined, opening its choices. */
function Part<T extends string | number | boolean>({ label, value, options, onPick }: { label: ReactNode; value: T; options: { value: T; words: string }[]; onPick: (v: T) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* Inline in the page's own sentence, so it wears the page's type, not a control's. */}
        <button
          type="button"
          className="cursor-pointer rounded-check underline decoration-current/40 decoration-dotted underline-offset-4 transition-colors duration-150 hover:bg-hover hover:decoration-current focus-mark motion-reduce:transition-none"
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent size="menu" align="center">
        {options.map((o) => (
          <MenuOption key={String(o.value)} selected={o.value === value} onSelect={() => (onPick(o.value), setOpen(false))}>
            {o.words}
          </MenuOption>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export interface BookingTermsProps {
  terms: BookingTerms;
  onTerms: (t: BookingTerms) => void;
  theme: ProposalTheme;
  /** The package most couples pick, for the dollar figure. */
  price: number;
  /** Where it sits: under the Accept button on the page (the default), or inside the section's popover. */
  place?: 'page' | 'popover';
}

/** The editable sentence. See {@link BookingTermsProps}. */
export function BookingTermsSentence({ terms, onTerms, theme, price, place = 'page' }: BookingTermsProps) {
  const set = (patch: Partial<BookingTerms>) => onTerms({ ...terms, ...patch });
  const choose = (seg: TermSegment) => {
    if (seg.part === 'sign')
      return (
        <Part
          label={seg.text}
          value={terms.contract}
          options={[
            { value: true, words: 'They sign your agreement first' },
            { value: false, words: 'No agreement to sign' },
          ]}
          onPick={(contract) => set({ contract })}
        />
      );
    if (seg.part === 'share')
      return (
        <Part
          label={seg.text}
          value={terms.deposit}
          options={DEPOSITS.map((d) => ({ value: d, words: d === 0 ? 'No deposit' : d === 100 ? 'Pay in full' : `${d}% deposit` }))}
          onPick={(deposit) => set({ deposit })}
        />
      );
    return (
      <Part
        label={seg.text}
        value={terms.balanceDays}
        options={BALANCE.map((b) => ({ value: b.days, words: `${b.words.charAt(0).toUpperCase()}${b.words.slice(1)} before` }))}
        onPick={(balanceDays) => set({ balanceDays })}
      />
    );
  };
  return (
    <p
      // The page's paragraph role, at the page's own size, under the Accept button, exactly where the couple reads it.
      style={place === 'page' ? { ...themeRoleCss(theme, 'paragraph'), textAlign: 'center' } : undefined}
      className={place === 'page' ? 'mx-auto max-w-xl px-6 pb-12 opacity-70' : 'type-body text-zebra-700'}
    >
      {bookingParts(terms, price).map((seg, i) => (seg.part ? <Fragment key={i}>{choose(seg)}</Fragment> : <Fragment key={i}>{seg.text}</Fragment>))}
    </p>
  );
}
