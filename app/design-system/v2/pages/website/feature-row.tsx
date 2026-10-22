import type { ReactNode } from 'react';

import { Badge } from '@/components/ui-v2/badge';

import { Reveal } from './reveal';

/**
 * One headline feature of the marketing page: the words on one side, ONE
 * picture of the product on the other, and at most a couple of small
 * callouts pinned to the picture (founder brief, 2026-10-17: "one image
 * with optional popovers, very clean and minimal"). Rows alternate sides
 * down the page, each a step down from the hero: a 28 to 40px title over
 * a 16px lead, and nothing else (founder, 2026-10-19: no ticked points
 * under the lead; what matters is said in the lead itself). Every row looks the same, Security included (founder
 * brief, 2026-10-17: it was a dark band; now "a feature similar to all
 * the others"). One row may be `wide`: its words centred above and its
 * picture the full width of the page, for a picture that needs the room
 * (Journeys, founder 2026-10-18: its documents were "tiny" in half a row).
 *
 * Rows sit straight on the page, full width, alternating white and a
 * faint grey (`muted`) for rhythm, as Stripe paces its page; the brand
 * gradient is kept for the hero, BDM lodgement (what only Zebri does) and
 * nothing else (founder, 2026-10-19: a gradient box behind every band
 * read as seven separate cards).
 *
 * @module app/design-system/v2/pages/website/feature-row
 */

/** A small note pinned over the picture, pointing at what matters in it. */
export interface Callout {
  title: string;
  detail: string;
  /** Where it sits over the picture. Literal classes, so Tailwind emits them. */
  at: string;
}

export interface FeatureRowProps {
  id: string;
  kicker: string;
  title: string;
  lead: string;
  /** The one picture: a real slice of the app, already framed and `inert`. */
  picture: ReactNode;
  callouts?: Callout[];
  /** Picture on the left on wide screens. */
  flip?: boolean;
  /** Words centred above, picture the full width below. */
  wide?: boolean;
  /**
   * A pill beside the kicker for what only Zebri does ("Only in Zebri" on
   * BDM lodgement), so the claim is seen, not buried in a sentence.
   */
  badge?: string;
  /** A faint grey band, full width, alternating with white down the page. */
  muted?: boolean;
}

/** A callout card. Hidden below `lg`, where it would cover the picture. */
function CalloutCard({ c }: { c: Callout }) {
  return (
    <div
      className={`absolute z-10 hidden max-w-60 gap-2.5 rounded-panel bg-field px-3.5 py-3 shadow-lg ring-1 ring-hairline lg:flex ${c.at}`}
    >
      <span className="mt-1.5 size-2 shrink-0 rounded-pill bg-grass-500 ring-4 ring-grass-100" />
      <span>
        <span className="block type-label text-zebra-950">{c.title}</span>
        <span className="block type-body text-zebra-500">{c.detail}</span>
      </span>
    </div>
  );
}

/** A headline feature. See {@link FeatureRowProps}. */
export function FeatureRow({
  id,
  kicker,
  title,
  lead,
  picture,
  callouts = [],
  flip = false,
  wide = false,
  badge,
  muted = false,
}: FeatureRowProps) {
  // "site-" so the id never meets the app's own: the hero's live dashboard renders a "blocks-title" too.
  const titleId = `site-${id}-title`;
  const words = (
    <>
      <div className={`flex items-center gap-3 ${wide ? 'justify-center' : ''}`}>
        <p className="type-label text-grass-700">{kicker}</p>
        {badge ? <Badge tone="grass">{badge}</Badge> : null}
      </div>
      <h2 id={titleId} className="mt-3 text-balance type-site-title text-zebra-950">
        {title}
      </h2>
      <p className="mt-4 text-pretty type-lead text-zebra-500">{lead}</p>
    </>
  );
  if (wide) {
    return (
      <section
        id={id}
        aria-labelledby={titleId}
        className={`scroll-mt-16 px-5 py-16 sm:px-8 sm:py-24 ${muted ? 'bg-zebra-50' : ''}`}
      >
        <Reveal>
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">{words}</div>
            <div className="relative mt-14 lg:mt-16">{picture}</div>
          </div>
        </Reveal>
      </section>
    );
  }
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={`scroll-mt-16 px-5 py-16 sm:px-8 sm:py-24 ${muted ? 'bg-zebra-50' : ''}`}
    >
      <Reveal>
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div className={flip ? 'lg:order-2' : ''}>{words}</div>
          <div className="relative">
            {/* One frame, the shot's own, as in the hero: a grey matte round it made a box in a box. */}
            {picture}
            {callouts.map((c) => (
              <CalloutCard key={c.title} c={c} />
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
