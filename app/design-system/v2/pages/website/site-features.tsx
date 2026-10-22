import { AiShot } from './ai-shot';
import { BdmShot } from './bdm-shot';
import { BlocksShot } from './blocks-shot';
import { FeatureRow, type FeatureRowProps } from './feature-row';
import { JourneyShot } from './journey-shot';
import { SecurityGrid } from './security-grid';

/**
 * The five headline features, one row each, in the founder's order
 * (2026-10-17): Journeys, BDM lodgement, Blocks, Zebri AI, Security.
 * Alternate rows flip, and Security is a row like the others. Each row
 * is a title, one lead that says what matters (no ticked points,
 * founder 2026-10-19), and one picture of the real product. The rest of the product is left to the plan cards'
 * lists (founder, 2026-10-18: the "Also included" grid was cut).
 *
 * @module app/design-system/v2/pages/website/site-features
 */

/** The rows, in the order a visitor should meet them. */
export const FEATURES: FeatureRowProps[] = [
  {
    id: 'journeys',
    kicker: 'Journeys',
    title: 'Every couple, followed up on time.',
    lead: 'Build your journey once. Zebri sends every email, document and invoice the moment a couple is ready, and nudges them when they go quiet.',
    picture: <JourneyShot />,
    wide: true,
    muted: true,
  },
  {
    id: 'bdm',
    // The founder's claim (2026-10-18): no other app in Australia lodges with BDM directly.
    // Keep it true, as a comparative claim on the site has to be.
    kicker: 'BDM lodgement',
    badge: 'Only in Zebri',
    title: 'Lodge marriages straight from Zebri.',
    lead: 'The only app in Australia that lodges with Births, Deaths and Marriages directly. You send couples one questionnaire to fill in, Zebri checks every answer, and you lodge in one tap.',
    picture: <BdmShot />,
    wide: true,
  },
  {
    id: 'blocks',
    kicker: 'Blocks',
    title: 'Made for what you do.',
    // MCs and Celebrants, as everywhere else on the page and the sign-up form (no DJs: 2026-10-18 review).
    lead: 'Switch on the tools for your kind of work and leave out the rest. 12 blocks at launch, from enquiries to BDM lodgement.',
    picture: <BlocksShot />,
    // Wide, as Journeys is: three outcome cards side by side need the whole row.
    wide: true,
    muted: true,
  },
  {
    id: 'ai',
    kicker: 'Zebri AI',
    title: 'The admin, done before you wake.',
    // "Not a chatbot you have to prompt": Max sells Talk to Zebri, so the line cannot dismiss an assistant outright.
    lead: 'Zebri drafts your replies, nudges couples who go quiet, and updates their record after every call. You just say yes. Not a chatbot you have to prompt.',
    picture: <AiShot />,
    // Wide: three feature cards beside a live panel need the whole row.
    wide: true,
  },
  {
    id: 'security',
    // The nav's word, so the link and the section it lands on match.
    kicker: 'Security',
    title: 'Your couples’ details stay yours.',
    lead: 'Where it lives, who can see it, and what AI does with it.',
    picture: <SecurityGrid />,
    wide: true,
    muted: true,
  },
];

/** The five feature rows. */
export function SiteFeatures() {
  return (
    <>
      {FEATURES.map((f) => (
        <FeatureRow key={f.id} {...f} />
      ))}
    </>
  );
}
