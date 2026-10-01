import { brandVars, type DocProps } from './brand-doc-parts';
import { BrandProposal } from './brand-proposal';
import type { Brand } from './use-onboarding-state';

/**
 * The brand step's canvas: the MC's proposal as the couple sees it,
 * floating on a plain soft surface that fills the space beside the
 * controls. The page scrolls inside the canvas and fades out under a
 * wash of the canvas colour at the bottom edge, so the step never grows
 * past the panel. It is there to look at, not to design.
 *
 * The brand values are the MC's, chosen at runtime, so they cannot be
 * Tailwind classes. They are CSS custom properties on the canvas (the
 * one `style` here), read by arbitrary-value classes in the page, which
 * transition their colours so every change fades rather than snaps.
 *
 * @module app/design-system/v2/pages/onboarding/brand-preview
 */
export function BrandPreview({ brand, ...doc }: { brand: Brand } & Omit<DocProps, 'logoUrl'>) {
  return (
    <figure style={brandVars(brand)} aria-label="Live preview of your proposal" className="relative min-h-[28rem] min-w-0 flex-1 overflow-hidden bg-zebra-50 lg:min-h-0">
      <div tabIndex={0} aria-label="Proposal page, scrolls" className="absolute inset-0 overflow-y-auto overscroll-contain px-4 pt-10 pb-20 focus-visible:outline-none sm:px-10">
        <div className="mx-auto max-w-md overflow-hidden rounded-check shadow-xl ring-1 ring-zebra-950/5">
          <BrandProposal {...doc} logoUrl={brand.logoUrl} />
        </div>
      </div>
      {/* The page runs on past the fold: a wash of the canvas colour rises
          over it, so whatever is under the edge (a button, a card) fades
          out softly instead of being cut off. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zebra-50 via-zebra-50/85 to-transparent" />
    </figure>
  );
}
