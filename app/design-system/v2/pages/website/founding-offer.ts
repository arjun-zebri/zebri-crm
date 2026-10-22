import { AccountManagerIcon, CallIcon, MaxPlanIcon, VoteIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';

import { offerOf } from '../dashboard/first-run/plan-pricing';

/**
 * The waitlist and what a founding member gets (founder, 2026-10-19:
 * get people onto a waitlist and let them in a few at a time, as Kinso
 * does, building the hype while the old Zebri is moved onto this one).
 *
 * Everyone let in before the public launch is a founding member. There
 * is no cap: the queue decides when someone gets in, never whether they
 * are founding, so a visitor who joins late is still offered the deal.
 *
 * The perks were five (20% off, Max features free, a call, an account
 * manager, a vote). "20% off" and "Max free" together made the Max card
 * a worse deal than Pro for the same features (2026-10-19 review), so
 * the two are one perk here: Max at Pro's price. The numbers are read
 * from the plan sheet, so the perk and the cards never disagree.
 *
 * @module app/design-system/v2/pages/website/founding-offer
 */

export interface Perk {
  icon: ZebriIcon;
  title: string;
  detail: string;
}

/** What a founding member pays for Max, a month, for their first 12 months. */
export const FOUNDING_PRICE = offerOf('max').monthly;

export const PERKS: readonly Perk[] = [
  {
    icon: MaxPlanIcon,
    title: 'Max for the price of Pro',
    detail: `Every Max feature for $${FOUNDING_PRICE} a month, for your first 12 months.`,
  },
  { icon: CallIcon, title: 'Onboarding call', detail: 'Free, one-on-one, to set Zebri up with you.' },
  { icon: AccountManagerIcon, title: 'Account manager', detail: 'A dedicated person who knows your business.' },
  { icon: VoteIcon, title: 'A vote', detail: 'On what gets built next.' },
];

/**
 * How many places a sign-up moves up the list for each MC or Celebrant
 * who joins with their link. A promise the real waitlist has to keep:
 * build it into the sign-up backend before this line goes live.
 */
export const REFERRAL_JUMP = 10;
