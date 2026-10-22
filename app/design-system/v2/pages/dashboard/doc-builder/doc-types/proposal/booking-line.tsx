'use client';

import { themeRoleCss } from '@/features/proposals';
import type { ProposalTheme } from '@/features/proposals';

import { money } from '../../../payments/payments-data';
import type { BookingTerms } from '../../state/use-doc-editor';

/**
 * The line under the Accept button that tells the couple what saying yes
 * means: sign, pay the deposit, the rest before the day. Read from the
 * booking terms, so changing the deposit in the Accept settings changes
 * this sentence on the page at once (2026-10-04 audit: nothing near
 * Accept said what happens next). Drawn in the page's own paragraph
 * style, so it reads as part of the proposal, not editor chrome.
 *
 * @module app/design-system/v2/pages/dashboard/doc-builder/doc-types/proposal/booking-line
 */

const BALANCE: Record<number, string> = { 14: 'two weeks', 30: 'a month', 60: 'two months' };

/** The parts of the sentence the MC can change, by name. */
export type TermPart = 'sign' | 'share' | 'balance';

/** One run of the sentence: plain words, or a changeable part's words. */
export type TermSegment = { text: string; part?: TermPart | undefined };

const cap = (t: string) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`;

/**
 * The booking sentence as runs of words, the changeable ones named. The
 * couple's plain line and the MC's editable line are both drawn from it,
 * so they never say different things.
 */
export function bookingParts(terms: BookingTerms, price: number): TermSegment[] {
  const d = terms.deposit;
  const held = price && d ? ` (${money(Math.round((price * d) / 100))})` : '';
  const due = BALANCE[terms.balanceDays] ?? `${terms.balanceDays} days`;
  const sign: TermSegment = { part: 'sign', text: terms.contract ? 'You sign the agreement' : 'No agreement to sign' };
  const balance: TermSegment[] = [{ text: ` is due ` }, { part: 'balance', text: due }, { text: ' before the wedding.' }];
  if (d === 0)
    return [
      sign,
      { text: terms.contract ? ' and your date is held. ' : '. Your date is held as soon as you say yes. ' },
      { part: 'share', text: 'Nothing is paid today' },
      { text: '; the full amount' },
      ...balance,
    ];
  const share = d === 100 ? 'payment in full' : `a ${d}% deposit`;
  return [
    sign,
    { text: terms.contract ? ', then ' : '. ' },
    { part: 'share', text: terms.contract ? share : cap(share) },
    { text: `${held} holds your date.` },
    ...(d < 100 ? [{ text: ' The rest' }, ...balance] : []),
  ];
}

/** The sentence for `terms`, with the deposit in dollars when `price` is known. */
export function bookingSentence(terms: BookingTerms, price: number): string {
  return bookingParts(terms, price)
    .map((s) => s.text)
    .join('');
}

export interface BookingLineProps {
  terms: BookingTerms;
  theme: ProposalTheme;
  /** The package most couples pick, for the dollar figure. */
  price: number;
}

/** The booking line. See {@link BookingLineProps}. */
export function BookingLine({ terms, theme, price }: BookingLineProps) {
  return (
    <p
      // The page's paragraph role, at the page's own size; muted by opacity so it sits under the button.
      style={{ ...themeRoleCss(theme, 'paragraph'), textAlign: 'center' }}
      className="mx-auto max-w-xl px-6 pb-12 opacity-70"
    >
      {bookingSentence(terms, price)}
    </p>
  );
}
