/**
 * The marketing page's section anchors: the nav's short list and the
 * footer's full one. A plain module rather than an export of the nav,
 * which is a client component: a server component importing a constant
 * from a client module gets a reference, not the array.
 *
 * @module app/design-system/v2/pages/website/nav-links
 */

/**
 * The marketing page's path. Section links carry it (`/…/website#bdm`),
 * so the same links work from the page itself (the browser only scrolls)
 * and from the site's other pages (Blocks, Guides), which go home first.
 */
export const SITE_PATH = '/design-system/v2/website';

/** Blocks: every block in the catalogue (`blocks-page.tsx`), reached from the Blocks band's See all. */
export const BLOCKS_PATH = `${SITE_PATH}/blocks`;

/** Guides: answers to what MCs and Celebrants search for (`guides-page.tsx`). */
export const GUIDES_PATH = `${SITE_PATH}/guides`;

/** The site's pages of their own, for the nav's current mark off the home page. */
export type SitePage = 'blocks' | 'guides';

/** A section of the marketing page, by its `id`. */
export const sectionHref = (id: string) => `${SITE_PATH}#${id}`;

export interface NavLink {
  href: string;
  label: string;
  /** The home page's bands that light this link as current (the nav's section mark). */
  lights: readonly string[];
  /** The page of its own this link is current on. */
  page?: SitePage;
}

const link = (id: string, label: string, lights: readonly string[] = [id]): NavLink => ({
  href: sectionHref(id),
  label,
  lights,
});

/**
 * The nav's four (founder, 2026-10-19): Features, Guides, Blocks,
 * Pricing. Features lands on Journeys, the first feature band, and stays
 * lit through every feature band. Guides and Blocks are pages of their
 * own (search engines rank pages, not a single long scroll); Blocks
 * lists every block. The bands, FAQ included, are
 * all in the footer.
 */
export const NAV_LINKS: readonly NavLink[] = [
  link('journeys', 'Features', ['journeys', 'bdm', 'blocks', 'ai', 'security']),
  { href: GUIDES_PATH, label: 'Guides', lights: [], page: 'guides' },
  { href: BLOCKS_PATH, label: 'Blocks', lights: [], page: 'blocks' },
  link('pricing', 'Pricing'),
];

/**
 * The footer's Product column: every feature band, in page order, with
 * the nav's labels where they share one. Blocks goes to its page, not
 * the band, so the footer never offers two links called Blocks.
 */
export const FOOTER_PRODUCT_LINKS: readonly NavLink[] = [
  link('journeys', 'Journeys'),
  link('bdm', 'BDM lodgement'),
  { href: BLOCKS_PATH, label: 'Blocks', lights: [], page: 'blocks' },
  link('ai', 'Zebri AI'),
  link('security', 'Security'),
  link('pricing', 'Pricing'),
];
