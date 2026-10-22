import { CalendarSyncIcon, ClientsIcon, DocumentsIcon, JourneysIcon, MessageTextIcon, PaymentsIcon, SparklesIcon } from '@/components/ui-v2/icons';
import type { ZebriIcon } from '@/components/ui-v2/icons/icon-base';

import type { Role, Tier } from '../blocks/catalog';
import { dayMonth, isoOf } from '../payments/dates';



/**
 * What the plan sheet sells and charges: each plan's offer, who it is
 * for, what is in it, and the trial's dates. The launch offer, as the
 * marketing site sells it (founder, 2026-10-19): founding members get Max
 * for the price of Pro's old offer, $47 a month for their first 12 months,
 * struck from its usual $99, and Max is the one recommended. Pro is its
 * usual $59, nothing struck. Monthly only; a yearly option was one
 * decision too many here.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/plan-pricing
 */

export interface Feature {
  icon: ZebriIcon;
  text: string;
}

export interface Offer {
  tier: Tier;
  name: string;
  /** Who it is for, under the name. */
  for: string;
  /** The usual monthly price: struck beside the offer, and what it goes back to after a year. */
  was: number;
  /** What it costs a month for the first 12 months; equal to `was` when there is no offer. */
  monthly: number;
  features: Feature[];
  popular?: boolean;
}

export const OFFERS: Offer[] = [
  {
    tier: 'pro',
    name: 'Pro',
    for: 'For MCs running their own show',
    was: 59,
    monthly: 59,
    features: [
      { icon: ClientsIcon, text: 'Unlimited clients' },
      { icon: DocumentsIcon, text: 'Proposals, contracts and invoices' },
      { icon: PaymentsIcon, text: 'Card payments and automatic reminders' },
      { icon: JourneysIcon, text: 'Journeys that follow up for you' },
    ],
  },
  {
    tier: 'max',
    name: 'Max',
    for: 'For busy MCs and small teams',
    was: 99,
    monthly: 47,
    popular: true,
    features: [
      { icon: SparklesIcon, text: 'Everything in Pro, plus Talk to Zebri' },
      { icon: MessageTextIcon, text: 'SMS and video calls' },
      { icon: CalendarSyncIcon, text: 'Integrations: Instagram, BDM and calendars' },
    ],
  },
];

export const TRIAL_DAYS = 7;
/** The reminder goes this many days before the first charge. */
export const REMIND_DAYS_BEFORE = 2;

/** Who a plan is for, in the account's own trade: "For celebrants running their own show". */
export const forRole = (o: Offer, role: Role = 'MC') => (role === 'MC' ? o.for : o.for.replace('MCs', role === 'Celebrant' ? 'celebrants' : 'DJs'));

/** There is an offer on this plan: a lower price for the first 12 months. */
export const onOffer = (o: Offer) => o.monthly < o.was;

export const offerOf = (tier: Tier) => OFFERS.find((o) => o.tier === tier) ?? OFFERS[0]!;

/** "8 Oct", `days` from now: within the week, so no year. */
export const dayFromNow = (days: number) => dayMonth(isoOf(new Date(Date.now() + days * 86_400_000)));
