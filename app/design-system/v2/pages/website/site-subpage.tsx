import type { ReactNode } from 'react';

import { Backdrop } from '@/components/ui-v2/backdrop';

import { type SitePage } from './nav-links';
import { SiteFooter } from './site-footer';
import { SiteFounding } from './site-founding';
import { SiteNav } from './site-nav';
import { WaitlistPlanProvider } from './waitlist-plan';

/**
 * The frame of every marketing page that is not the home page (Blocks,
 * Guides): the nav with this page marked current, the hero's sky behind
 * a kicker, an h1 and a lead, the page's own bands, then the waitlist
 * panel, so the nav's Join the waitlist lands on a form here too, and
 * the footer. The nav's Features and Pricing go back to the home page.
 *
 * @module app/design-system/v2/pages/website/site-subpage
 */

export interface SiteSubpageProps {
  page: SitePage;
  /** A word above the title in the brand colour ("Blocks"). */
  kicker: string;
  /** The page's h1. */
  title: string;
  lead: ReactNode;
  /** The page's own bands, between the header and the waitlist. */
  children: ReactNode;
}

/** A marketing sub-page. See {@link SiteSubpageProps}. */
export function SiteSubpage({ page, kicker, title, lead, children }: SiteSubpageProps) {
  return (
    <WaitlistPlanProvider>
      <div className="relative isolate min-h-screen overflow-x-clip bg-field text-zebra-950">
        <a
          href="#main"
          className="sr-only rounded-button bg-field px-4 py-2 type-label text-zebra-950 shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-40 focus-mark"
        >
          Skip to content
        </a>
        <SiteNav page={page} />
        <main id="main" tabIndex={-1} className="outline-none">
          <header className="relative isolate overflow-hidden px-5 pb-12 pt-32 sm:px-8 sm:pb-16 sm:pt-44">
            {/* The hero's sky, fading into the page, so this reads as the same site. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem] mask-b-from-55%">
              <Backdrop contained />
            </div>
            <div className="mx-auto max-w-6xl">
              <p className="type-subheading text-grass-700">{kicker}</p>
              <h1 className="mt-4 max-w-3xl text-balance type-site-hero text-zebra-950">{title}</h1>
              <p className="mt-5 max-w-2xl text-pretty type-site-lead text-zebra-500">{lead}</p>
            </div>
          </header>
          {children}
          <div className="bg-zebra-50">
            <SiteFounding />
          </div>
        </main>
        <SiteFooter />
      </div>
    </WaitlistPlanProvider>
  );
}
