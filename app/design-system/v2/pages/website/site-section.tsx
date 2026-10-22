import type { ReactNode } from 'react';

import { Reveal } from './reveal';

/**
 * One band of the marketing page: a short coloured kicker, a big title
 * and a lead line, then its content. Built to read like Stripe or Attio
 * (founder pick, 2026-10-16): the title carries the band at
 * `type-site-title`, the lead sits at 16px, and there is room around
 * both. No uppercase eyebrows and no boxed header. The header is set
 * exactly as a wide `FeatureRow`'s (13px kicker, 16px lead, the same
 * band padding), so a band built on this never reads as a different
 * page (2026-10-18 review: Pricing's kicker was a size larger).
 *
 * `tone="dark"` is a plain ink band (no glow: the page is Stripe-clean,
 * founder brief 2026-10-17), for a band that should change register.
 *
 * @module app/design-system/v2/pages/website/site-section
 */

export interface SiteSectionProps {
  /** Anchor the nav links to. */
  id?: string;
  /** A few words above the title, in the brand colour. */
  kicker: string;
  title: ReactNode;
  /** One or two sentences under the title. */
  lead?: string;
  /** Centre the heading (pricing, security); the default is left. */
  centred?: boolean;
  tone?: 'light' | 'dark';
  /** A faint grey band, as a `muted` feature row is. */
  muted?: boolean;
  children: ReactNode;
}

const TONES = {
  light: { band: '', kicker: 'text-grass-700', title: 'text-zebra-950', lead: 'text-zebra-500' },
  dark: {
    band: 'bg-zebra-950',
    kicker: 'text-grass-300',
    title: 'text-zebra-50',
    lead: 'text-zebra-400',
  },
} as const;

/** A page band. See {@link SiteSectionProps}. */
export function SiteSection({
  id,
  kicker,
  title,
  lead,
  centred = false,
  tone = 'light',
  muted = false,
  children,
}: SiteSectionProps) {
  // "site-", as a feature row's: the hero's live dashboard renders ids of its own.
  const headingId = id ? `site-${id}-title` : undefined;
  const t = TONES[tone];
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`scroll-mt-16 px-5 py-16 sm:px-8 sm:py-24 ${t.band} ${muted ? 'bg-zebra-50' : ''}`}
    >
      <Reveal>
        <div className="mx-auto max-w-6xl">
          <header className={`max-w-2xl ${centred ? 'mx-auto text-center' : ''}`}>
            <p className={`type-label ${t.kicker}`}>{kicker}</p>
            <h2 id={headingId} className={`mt-3 text-balance type-site-title ${t.title}`}>
              {title}
            </h2>
            {lead ? (
              <p
                className={`mt-4 text-pretty type-lead ${t.lead}`}
              >
                {lead}
              </p>
            ) : null}
          </header>
          <div className="mt-14 lg:mt-16">{children}</div>
        </div>
      </Reveal>
    </section>
  );
}
