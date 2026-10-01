import { SAMPLE_PACKAGE, depositOf } from '../brand-doc-parts';
import type { DemoPackage } from '../packages';
import type { Signature } from '../use-onboarding-state';

/**
 * What the replay shows: the nine scenes (when each happened, its
 * headline and one line of detail), the sample couple, and the MC's own
 * details it is built from, signature included.
 *
 * @module app/design-system/v2/pages/onboarding/replay/replay-data
 */

/** One scene of the booking: what the story column says while it plays. */
export interface ReplayStep {
  /** Short, for the progress bar's labels. */
  label: string;
  /** When it happened. The story runs Tuesday afternoon to Friday morning. */
  time: string;
  /** Who did what, as the scene's headline. The MC is never the one typing. */
  headline: string;
  /** One line on what that means for the MC. */
  detail: string;
}

export const STEPS: readonly ReplayStep[] = [
  { label: 'Enquiry', time: 'Tue 2:14 pm', headline: 'Sarah enquires.', detail: 'An email lands from your website. You don’t even need to open it.' },
  { label: 'Lead created', time: 'Tue 2:14 pm', headline: 'Zebri creates the lead.', detail: 'Names, date and venue pulled from the email, and your calendar checked. The 12th is free.' },
  { label: 'Instant reply', time: 'Tue 2:14 pm', headline: 'Zebri replies instantly.', detail: 'From your address, with your open times. Sarah books a call.' },
  { label: 'Video call', time: 'Thu 4:30 pm', headline: 'You talk. Zebri takes the notes.', detail: 'It listens to the call and fills in their record as you go.' },
  { label: 'Proposal', time: 'Thu 5:05 pm', headline: 'Zebri sends the proposal.', detail: 'Built from the call, in your brand. Sarah opens it that evening.' },
  { label: 'Accepted', time: 'Fri 9:12 am', headline: 'Sarah accepts.', detail: 'She picks your package and agrees the deposit in one tap.' },
  { label: 'Contract', time: 'Fri 9:12 am', headline: 'Zebri sends the contract.', detail: 'Every field filled in from the call. Nothing for you to type.' },
  { label: 'Signed', time: 'Fri 9:18 am', headline: 'Sarah signs.', detail: 'Your saved signature countersigns the moment she does.' },
  { label: 'Invoice', time: 'Fri 9:18 am', headline: 'Zebri sends the invoice.', detail: 'For the deposit, the moment they sign. Sarah pays by card.' },
  { label: 'Booked', time: 'Fri 9:20 am', headline: 'You’re booked.', detail: 'Deposit paid and the date locked in your calendar. You didn’t type a word.' },
];

/**
 * The story's real dates, for the documents: the week of the enquiry
 * (Tuesday to Friday) and when the balance falls due, 14 days out.
 */
export const DATES = { issued: '20 Nov 2026', balanceDue: '26 Feb 2027' };

/** The couple who enquire. */
export const CLIENT = { name: 'Sarah Mitchell', first: 'Sarah', initials: 'SM', email: 'sarah.mitchell@gmail.com' };

/** Everything about the MC the replay is built from. */
export interface ReplayData {
  /** The business name, or a stand-in when they left it blank. */
  business: string;
  /** Who countersigns: the MC's own name, else the business. */
  signer: string;
  logoUrl: string | null;
  signature: Signature;
  /** Up to three packages for the couple to choose from. */
  choices: DemoPackage[];
  /** The one they choose: the MC's first package. */
  pkg: DemoPackage;
  /** The deposit percentage, the deposit on it, and what is left after. */
  depositPercent: number;
  due: number;
  balance: number;
}

export function replayData(input: {
  business: string;
  name: string;
  logoUrl: string | null;
  signature: Signature;
  packages: DemoPackage[];
  deposit: number;
}): ReplayData {
  const choices = (input.packages.length ? input.packages : [SAMPLE_PACKAGE]).slice(0, 3);
  const pkg = choices[0] ?? SAMPLE_PACKAGE;
  const due = depositOf(pkg.price, input.deposit);
  const business = input.business.trim() || 'Your business';
  return {
    business,
    signer: input.name.trim() || business,
    logoUrl: input.logoUrl,
    signature: input.signature,
    choices,
    pkg,
    depositPercent: input.deposit,
    due,
    balance: pkg.price - due,
  };
}
