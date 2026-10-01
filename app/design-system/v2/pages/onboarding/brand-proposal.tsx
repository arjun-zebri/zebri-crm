import { createContext, useContext, type ReactNode } from 'react';

import { WEDDING, type DocProps, type Wedding } from './brand-doc-parts';
import { CoverPhoto, Portrait, VideoSlot } from './proposal-media';
import { Accept, HowItWorks, Packages, SectionHead, Testimonial } from './proposal-sections';

/**
 * The brand step's sample proposal: a whole Qwilr-style web page in the
 * MC's brand, in the order a couple reads it: a navbar with their logo
 * and business name, a cover photo with the couple's names, a welcome
 * signed by the MC, a video hello, how it works with a
 * photo gallery, the packages, a couple's words, and the accept block.
 *
 * This is the out-of-the-box template, so it has to look finished on
 * its own. Each section is a `Block`: hovering one outlines it, a quiet
 * hint that every block is a separate piece the MC can move and restyle
 * later in the proposal builder (not here). Sections an editor jumps to
 * carry `data-part` ("welcome", "packages").
 *
 * The dashboard's Proposals page reuses it as each proposal's preview
 * and template thumbnail, passing its own couple, headline and packages;
 * the onboarding leaves them at the demo wedding's defaults.
 *
 * @module app/design-system/v2/pages/onboarding/brand-proposal
 */

/** Whether sections outline on hover; off where the page is only being looked at. */
const HintContext = createContext(true);

/** One section of the page, outlined on hover to show it is its own block. */
function Block({ children, flush = false, part }: { children: ReactNode; flush?: boolean; part?: string }) {
  const hint = useContext(HintContext);
  return (
    <section
      data-part={part}
      className={`${hint ? 'outline-1 -outline-offset-4 outline-dashed outline-transparent transition-[outline-color] duration-200 hover:outline-zebra-300' : ''} ${flush ? '' : 'px-8 py-8'}`}
    >
      {children}
    </section>
  );
}

export interface BrandProposalProps extends DocProps {
  /** Who it is for; the onboarding's demo wedding when left out. */
  wedding?: Wedding | undefined;
  /** The welcome's heading. */
  headline?: string | undefined;
  /** Outline each section on hover (the onboarding's hint that blocks move); off for a plain preview. */
  hints?: boolean | undefined;
  /** The welcome note as the MC wrote it; {@link welcomeFor} when left out. */
  welcome?: string | undefined;
  /** What the MC is to the couple, under their name: "MC", "celebrant", "DJ". */
  role?: string | undefined;
}

/** The welcome note a new proposal starts with, greeting the couple by name. */
export const welcomeFor = (greet: string) =>
  `Hi ${greet}, thank you for thinking of me for your event. You'll have a room full of people you love, and my job is to make every moment land, from the first entrance to the last dance.`;

export function BrandProposal({ business, name, logoUrl, packages, deposit, wedding = WEDDING, headline = 'Your day, beautifully run', hints = true, welcome, role = 'MC' }: BrandProposalProps) {
  const mc = name.trim() || 'Your name';
  const firstName = mc.split(/\s+/)[0];
  return (
    <HintContext.Provider value={hints}>
    <article className="bg-field pb-4 font-[family-name:var(--b-body)]">
      <Block flush>
        {/* The page's own navbar: the MC's logo and business name, as their
            site header would show it. The logo is shown as uploaded, on
            white, never recoloured. */}
        <nav aria-label="Proposal header" className="flex h-14 items-center gap-3 border-b border-zebra-200 px-6">
          {logoUrl ? (
            // An object URL from the file the MC just dropped: next/image cannot take it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-7 w-auto max-w-24 object-contain" />
          ) : null}
          <span className="truncate type-subheading text-zebra-950 font-[family-name:var(--b-heading)]">{business.trim() || 'Your business'}</span>
        </nav>
        <CoverPhoto>
          <p className="type-eyebrow opacity-80">A proposal for</p>
          <h2 className="mt-1 type-hero font-[family-name:var(--b-heading)]">{wedding.couple}</h2>
          <p className="mt-3 type-body opacity-80">
            {wedding.date} · {wedding.venue}
          </p>
        </CoverPhoto>
      </Block>

      <Block part="welcome">
        <div className="space-y-4">
          <SectionHead eyebrow="Welcome">{headline}</SectionHead>
          <p className="whitespace-pre-line type-body text-zebra-700">{welcome ?? welcomeFor(wedding.greet)}</p>
          <div className="flex items-center gap-3 pt-2">
            <Portrait />
            <span>
              <span className="block type-subheading text-zebra-950 font-[family-name:var(--b-heading)]">{mc}</span>
              {/* The business only when it is not just their name again. */}
              <span className="block type-body text-zebra-500">
                Your {role}
                {business.trim() && business.trim() !== mc ? `, ${business.trim()}` : ''}
              </span>
            </span>
          </div>
        </div>
      </Block>

      <Block>
        <VideoSlot caption={`A quick hello from ${firstName}`} />
      </Block>

      <Block>
        <HowItWorks />
      </Block>

      <Block part="packages">
        <Packages packages={packages} />
      </Block>

      <Block>
        <Testimonial />
      </Block>

      <Block>
        <Accept packages={packages} deposit={deposit} wedding={wedding} />
      </Block>
    </article>
    </HintContext.Provider>
  );
}
