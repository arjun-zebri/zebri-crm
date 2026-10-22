import { CheckIcon } from '@/components/ui-v2/icons';
import { SwipeRow } from '@/components/ui-v2/swipe-row';

import { OFFERS, TRIAL_DAYS, type Offer } from '../dashboard/first-run/plan-pricing';
import { PLANS } from '../onboarding/demo-data';

import { FOUNDING_PRICE } from './founding-offer';
import { PlanCard, type CardProps } from './plan-card';
import { SiteSection } from './site-section';

/**
 * Pricing, read from the same plans the app's plan sheet sells
 * (`first-run/plan-pricing.ts`, and Enterprise from the onboarding plan
 * list), so the site and the product never quote different numbers.
 * Three cards side by side (founder brief, 2026-10-17): Pro, Max and
 * Enterprise, in the page's one card style (founder, 2026-10-18: "match
 * our styling"): the BDM band's white card, straight on the band: plan
 * and price on top, the plan's list under a hairline, and the button at
 * the foot (founder, 2026-10-19: no grey well, the button last). The
 * recommended plan is marked by its badge and the primary button alone,
 * never a heavier edge, so the three stay one family.
 *
 * Before launch nothing is bought here: "Join with Pro" and "Join with
 * Max" land on the waitlist form carrying the plan (`waitlist-plan.tsx`),
 * and Enterprise's "Talk to us" opens an email to the founder, a
 * conversation rather than a queue.
 *
 * The page is for founding members, so the cards show what a founding
 * member pays (founder, 2026-10-19): Max at Pro's offer price
 * (`FOUNDING_PRICE`, `founding-offer.ts`) struck from its usual price,
 * and Max recommended; Pro at its usual price, nothing struck. The app's plan sheet still recommends Pro; a
 * footnote under Max's $79 ("Founding members pay $47") read as a second,
 * confusing price.
 *
 * @module app/design-system/v2/pages/website/site-pricing
 */

const ENTERPRISE = PLANS.find((p) => p.id === 'enterprise');

/**
 * What Enterprise adds over Max, so "Custom" says what it buys (founder,
 * 2026-10-19: the card had no details). The founder's list; each one is
 * an offer, so keep it to what Zebri will actually do.
 */
export const ENTERPRISE_EXTRAS = [
  'Unlimited team members',
  'Help moving your clients in',
  'A named contact at Zebri',
  'Invoiced monthly or yearly',
] as const;

/**
 * The reassurances a pro weighs at the moment of price, under the plans.
 * "Monthly, no lock-in" is in the band's lead, so it is not repeated here.
 */
export const REASSURANCES = [
  `${TRIAL_DAYS}-day free trial when you're in`,
  'Cancel any time, keep your data',
  'No cut of your bookings',
] as const;

/**
 * Who a plan is for, for the site's mixed audience: "MCs and Celebrants",
 * not one trade. A line that already lists ("MCs and small teams") takes
 * a comma instead, so it never reads "MCs and Celebrants and small teams".
 */
export const forEveryone = (o: Offer) =>
  o.for.includes('MCs and ')
    ? o.for.replace('MCs and ', 'MCs, Celebrants and ')
    : o.for.replace('MCs', 'MCs and Celebrants');

/**
 * The plan sheet folds "Everything in Pro" into its first row, to keep
 * every plan at four icon rows; on the site that read as two claims
 * crammed into one tick (founder, 2026-10-19), so it is lifted out as
 * the list's lead line and the rest stands as its own row.
 */
const BUILDS_ON = /^Everything in (\w+), plus /;

/** A plan from the plan sheet, as a card. */
const offerCard = (o: Offer): CardProps => {
  const plus = o.features[0]?.text.match(BUILDS_ON)?.[1];
  // The founding deal lives on Max alone: Max at Pro's offer price, struck from its usual one.
  // Pro shows its usual price with nothing struck (founder, 2026-10-19): at $47 beside Max's $47
  // there was no reason to pick it.
  const founding = o.tier === 'max';
  return {
    name: o.name,
    forWho: forEveryone(o),
    price: `$${founding ? FOUNDING_PRICE : o.was}`,
    ...(founding ? { was: `$${o.was}` } : {}),
    per: founding ? 'a month for your first 12 months' : 'a month',
    ...(plus ? { plus } : {}),
    // Max carries BDM lodgement; said in words so a Celebrant reading Pro never assumes it is there.
    features: [
      ...o.features.map((f) =>
        f.text
          .replace(BUILDS_ON, '')
          .replace(/^Talk to Zebri$/, 'Talk to Zebri, your AI assistant')
          // BDM has its own row below, so the integrations line does not name it twice.
          .replace('Instagram, BDM and calendars', 'Instagram and calendars'),
      ),
      ...(o.tier === 'max' ? ['BDM lodgement, for Celebrants'] : []),
    ],
    cta: `Join with ${o.name}`,
    plan: o.name,
    recommended: o.tier === 'max',
  };
};

/** The pricing band. */
export function SitePricing() {
  const cards = OFFERS.map(offerCard);
  if (ENTERPRISE)
    cards.push({
      name: ENTERPRISE.name,
      forWho: `For ${ENTERPRISE.pitch.toLowerCase()}`,
      // Custom, not "Let's talk": the button already says Talk to us (founder, 2026-10-18: repeated).
      price: 'Custom',
      per: 'Priced with you, by team size',
      plus: 'Max',
      features: [...ENTERPRISE_EXTRAS],
      cta: 'Talk to us',
    });
  return (
    <SiteSection
      id="pricing"
      kicker="Pricing"
      // GST said up front: an Australian buyer looks for it next to the price.
      title="Simple pricing. No lock-in."
      lead="Founding members get Max for the price of Pro for their first 12 months. Monthly, in Australian dollars, GST included."
      centred
    >
      {/* Straight on the white band, the page's resting cards, no gradient box (founder, 2026-10-19). */}
      {/* Phones swipe the plans side by side, as they compare them (founder, 2026-10-19). */}
      <SwipeRow aria-label="Plans" until="md" className="md:grid md:grid-cols-3 md:gap-4 lg:gap-5">
        {cards.map((c) => (
          <PlanCard key={c.name} {...c} />
        ))}
      </SwipeRow>
      {/* On a phone only Pro is in view, and the next card's sliver did not say there were two more. */}
      <p className="mt-4 text-center type-body text-zebra-500 md:hidden">Swipe for Max and Enterprise</p>
      <ul
        aria-label="Every plan"
        className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2"
      >
        {REASSURANCES.map((r) => (
          <li key={r} className="flex items-center gap-2 type-body text-zebra-600">
            <CheckIcon aria-hidden="true" className="size-3.5 text-grass-700" />
            {r}
          </li>
        ))}
      </ul>
    </SiteSection>
  );
}
