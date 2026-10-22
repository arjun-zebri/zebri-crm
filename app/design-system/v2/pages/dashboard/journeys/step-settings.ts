import type { JSONContent } from '@tiptap/core';

import type { EmailHeader, SignatureId } from '../email/email-data';

import type { JourneyStep } from './journeys-data';

/**
 * The settings a step has beyond when it goes out, by kind: when a
 * proposal expires, who signs a contract, what an invoice asks for and
 * when it is due, when a questionnaire is due back, whether a run sheet
 * also goes to the suppliers, and the hour a timed step goes out. Each
 * is left out of a saved step until the MC changes it, so the readers
 * here hold the defaults, and a journey saved before a setting existed
 * reads the same as a new one.
 *
 * @module app/design-system/v2/pages/dashboard/journeys/step-settings
 */

/** Who signs a contract: both of them or one, and whether the MC countersigns after. */
export type Signers = 'both-you' | 'both' | 'one-you' | 'one';

/** What an invoice asks for: a set share of the package, the full fee, what is left, or the MC's own percent (`amountPct`). */
export type Amount = 'p20' | 'p25' | 'p30' | 'full' | 'rest' | 'custom';

/** How a client can pay an invoice. */
export type Pay = 'card' | 'both';

/**
 * An email the MC sends with a step, or as one: its subject (`{field}`s
 * and all) and its content. Zebri's drafts are plain text in `body`; an
 * email the MC has built in the editor keeps `doc` (text, field chips
 * and blocks), which wins over `body`.
 */
export interface StepEmail {
  subject: string;
  /** The line an inbox shows after the subject, before the email is opened. */
  preheader?: string | undefined;
  body: string;
  doc?: JSONContent | undefined;
  /** Copied in, as typed: "planner@venue.com.au, mum@example.com". */
  cc?: string | undefined;
  bcc?: string | undefined;
  /** Which of the MC's signatures closes it; "full" when unset. */
  signature?: SignatureId | undefined;
  /** The words above the signature; "Warmly," when unset. */
  signOff?: string | undefined;
  /** What heads it; the business name when unset. */
  header?: EmailHeader | undefined;
}

/** Each choice as its menu and chip say it. */
export const SIGNERS: Record<Signers, string> = {
  'both-you': 'Both of them, then you',
  both: 'Both of them',
  'one-you': 'One of them, then you',
  one: 'One of them',
};

export const AMOUNTS: Record<Exclude<Amount, 'custom'>, string> = {
  p20: '20% of the package',
  p25: '25% of the package',
  p30: '30% of the package',
  full: 'The full fee',
  rest: "What's left to pay",
};

/** The set choices an invoice step offers: a deposit its usual shares, a balance what is left. Custom comes after. */
export const amountsFor = (s: JourneyStep): Exclude<Amount, 'custom'>[] =>
  isBalance(s) ? ['rest', 'full'] : ['p20', 'p25', 'p30', 'full'];

/** What an invoice step asks for, as its row says it: "25% of the package", "40% of the package". */
export const amountLabel = (s: JourneyStep) => {
  const a = amountOf(s);
  return a === 'custom' ? `${s.amountPct ?? 25}% of the package` : AMOUNTS[a];
};

const isBalance = (s: JourneyStep) => /balance|final/i.test(`${s.name} ${s.detail}`);

export const PAYS: Record<Pay, string> = { card: 'Card only', both: 'Card or bank transfer' };

/** Days a proposal stays open; 0 is never. */
export const EXPIRIES = [7, 14, 30, 0] as const;

/** Days after it goes out that an invoice is due. */
export const DUE_INS = [3, 7, 14, 30] as const;

/** Weeks before the event that a questionnaire is due back. */
export const DUE_BACKS = [8, 6, 4, 3, 2] as const;

/** The hours a timed step can go out at. */
export const HOURS = ['8:00 am', '9:00 am', '10:00 am', '12:00 pm', '5:00 pm', '7:00 pm'] as const;

/** "14 days", "Never". */
export const expiryLabel = (days: number) => (days ? `After ${days} days` : 'Never');
export const dueInLabel = (days: number) => `${days} days after it goes out`;
export const dueBackLabel = (weeks: number) => `${weeks} weeks before the event`;

/** A step's settings with the defaults filled in. */
export const expiresOf = (s: JourneyStep) => s.expires ?? 14;
export const signersOf = (s: JourneyStep): Signers => s.signers ?? 'both-you';
export const dueInOf = (s: JourneyStep) => s.dueIn ?? 7;
export const payOf = (s: JourneyStep): Pay => s.pay ?? 'both';
export const dueBackOf = (s: JourneyStep) => s.dueBack ?? 4;
export const sendAtOf = (s: JourneyStep) => s.sendAt ?? '9:00 am';

/** What an invoice asks for: a balance asks for what's left, any other the deposit. A choice since retired reads as the deposit. */
export function amountOf(s: JourneyStep): Amount {
  if (s.amount && (s.amount === 'custom' || s.amount in AMOUNTS)) return s.amount;
  if (isBalance(s)) return 'rest';
  return /deposit/i.test(`${s.name} ${s.detail}`) ? 'p25' : 'full';
}
