import { brandVars } from '../../../onboarding/brand-doc-parts';
import { BrandProposal } from '../../../onboarding/brand-proposal';
import { Packages } from '../../../onboarding/proposal-sections';
import { useAccount } from '../../account';
import { DEPOSIT, MC, PACKAGES } from '../../proposals/templates-data';

import { BlockImageFrame, SCENE_CARD } from './block-image-frame';
import { IMAGE_BRAND } from './image-brand';

/**
 * Proposals product image: the real styled proposal page (`BrandProposal`
 * in the MC's brand, as the onboarding brand step shows it) open at
 * Lily and Oscar's cover, with the same page's packages lifted out on a
 * card in front. Both are laid out at a real page width and shrunk to
 * 55%, so more of the page shows than at real size. The front card sits
 * low and right, clear of the couple's names. The page wears a lighter
 * green than the default, which clashed with the dialog's green primary
 * button.
 *
 * @module app/design-system/v2/pages/dashboard/blocks/images/proposals
 */

const WEDDING = { couple: 'Lily & Oscar', date: 'Saturday 20 March 2027', venue: 'Bendooley Estate', greet: 'Lily and Oscar' };
const OFFER = [PACKAGES.premium, PACKAGES.classic];

/** Proposals block image. */
export function ProposalsImage() {
  // The account's name, as the Booking links image reads it, so the marketing site can give it a sample MC.
  const { business, mc } = useAccount();
  return (
    <BlockImageFrame alt="Lily and Oscar's proposal in the MC's brand, open at the cover, with its packages on a card in front.">
      {/* Laid out at a real page width and shrunk, so more of the page shows.
          The brand arrives as custom properties, the one style, as in the proposal preview. */}
      <div style={brandVars(IMAGE_BRAND)} className={`${SCENE_CARD} left-8 top-6 h-[30rem] w-[32rem] origin-top-left scale-[0.55]`}>
        <BrandProposal business={business} name={mc?.name ?? MC.name} logoUrl={IMAGE_BRAND.logoUrl} packages={OFFER} deposit={DEPOSIT} wedding={WEDDING} hints={false} />
      </div>
      {/* The same page's packages, lifted out in front at the same zoom. */}
      <div style={brandVars(IMAGE_BRAND)} className={`${SCENE_CARD} right-5 top-28 h-[30rem] w-[26rem] origin-top-right scale-[0.55] p-8 font-[family-name:var(--b-body)] shadow-md`}>
        <Packages packages={OFFER} />
      </div>
    </BlockImageFrame>
  );
}
