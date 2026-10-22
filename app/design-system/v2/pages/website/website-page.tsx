import { SiteFaq } from './site-faq';
import { SiteFeatures } from './site-features';
import { SiteFooter } from './site-footer';
import { SiteFounding } from './site-founding';
import { SiteHero } from './site-hero';
import { SiteNav } from './site-nav';
import { SitePricing } from './site-pricing';
import { WaitlistPlanProvider } from './waitlist-plan';

/**
 * The zebri.com.au marketing page, built to read like Stripe (founder
 * brief, 2026-10-16 and 2026-10-17): white and ink, the brand green only
 * on buttons and small accents, no colour washes. A preview, never
 * deployed from here. Order, as a buyer asks:
 *
 * 1. What is it, and who else uses it? The hero (words beside the
 *    product, an email box, the founding list's size) and the tools it
 *    replaces.
 * 2. Why this one? Five headline features, one picture each: Zebri AI,
 *    Journeys, BDM lodgement, Blocks and Security (on ink).
 * 3. What does it cost, and how do I start? Three plans, the waitlist
 *    and founding offer with the form, the FAQ.
 *
 * No testimonials until real ones exist. This file is an orchestrator only.
 *
 * @module app/design-system/v2/pages/website/website-page
 */

/** The full marketing page. */
export function WebsitePage() {
  return (
    // The provider carries a plan picked on a pricing card to the waitlist form further down.
    <WaitlistPlanProvider>
      <div className="relative isolate min-h-screen overflow-x-clip bg-field text-zebra-950">
        {/* First stop for a keyboard: past the nav, straight to the content. */}
        <a
          href="#main"
          className="sr-only rounded-button bg-field px-4 py-2 type-label text-zebra-950 shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-40 focus-mark"
        >
          Skip to content
        </a>
        <SiteNav />
        <main id="main" tabIndex={-1} className="outline-none">
          <SiteHero />
          <SiteFeatures />
          <SitePricing />
          {/* The close on the faint grey, keeping the bands' white and grey alternating to the end. */}
          <div className="bg-zebra-50">
            <SiteFounding />
          </div>
          <SiteFaq />
        </main>
        <SiteFooter />
      </div>
    </WaitlistPlanProvider>
  );
}
