import type { DocumentsEntry } from '../documents/documents-page';

import { FIRST_RUN_PATH } from './handoff';

/**
 * The first-run dashboard's pages as real URLs, so any one of them can
 * be sent to someone for review: `/design-system/v2/dashboard/new` is
 * Home, `/…/new/clients` Clients, `/…/new/clients/new` Clients with New
 * client open, `/…/new/plan` Home with the plan sheet up, and so on.
 * Payments' tab and Documents' kind ride in the query (`?tab=contracts`). The page reads
 * the URL once on load and pushes a new one on every move, so the
 * browser's Back works and the address bar is always shareable.
 *
 * @module app/design-system/v2/pages/dashboard/first-run/routes
 */

/** Payments' tab, or the kind of document on Documents. */
export type PageTab = 'proposals' | 'contracts' | 'questionnaires' | 'invoices' | 'paperwork';

/** Where a URL lands: the page, its tab, and whether its New (or the plan sheet) opens. */
export interface Route {
  page: string;
  tab?: PageTab | undefined;
  startNew?: boolean | undefined;
  plan?: boolean | undefined;
  /** The old Run sheets page's link: shows where run sheets live now. */
  runSheet?: boolean | undefined;
}

/** "Booking links" ↔ "booking-links". */
const slugOf = (page: string) => page.toLowerCase().replace(/\s+/g, '-');
const pageOf = (slug: string) => {
  const words = slug.split('-').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const TABS: readonly string[] = ['proposals', 'contracts', 'questionnaires', 'invoices', 'paperwork'];
/** The old pages for a kind of document: each lands on its kind in Documents. */
const KINDS: readonly string[] = ['proposals', 'contracts', 'questionnaires'];

/** The route a pathname and query land on. Anything unknown under the base reads as its page name. */
export function routeOf(pathname: string, search: string): Route {
  const rest = pathname.startsWith(FIRST_RUN_PATH) ? pathname.slice(FIRST_RUN_PATH.length) : '';
  const [slug = '', extra] = rest.split('/').filter(Boolean);
  const q = new URLSearchParams(search).get('tab');
  const tab = q && TABS.includes(q) ? (q as PageTab) : undefined;
  if (!slug) return { page: 'Home' };
  if (slug === 'plan') return { page: 'Home', plan: true };
  // Workflows was folded into Journeys (2026-10-14): its old link lands there.
  if (slug === 'workflows') return { page: 'Journeys' };
  // Run sheets have no page any more: they live on each client.
  if (slug === 'run-sheets') return { page: 'Clients', runSheet: true };
  // Proposals, Contracts and Questionnaires are kinds on Documents now.
  if (KINDS.includes(slug)) return { page: 'Documents', tab: slug as PageTab, startNew: extra === 'new' };
  const page = pageOf(slug);
  return {
    page,
    tab,
    startNew: extra === 'new',
  };
}

/** The URL for a route: the reverse of {@link routeOf}. */
export function pathOf({ page, tab, startNew }: Route): string {
  if (page === 'Home') return FIRST_RUN_PATH;
  const base = `${FIRST_RUN_PATH}/${slugOf(page)}${startNew ? '/new' : ''}`;
  return (page === 'Payments' || page === 'Documents') && tab ? `${base}?tab=${tab}` : base;
}

/**
 * Where Documents opens for a route: on its card grid with no kind named,
 * else on that kind (proposals unless the tab names another), with New on
 * arrival, for the client the guide is on.
 */
export function documentsEntry({ tab, startNew }: Pick<Route, 'tab' | 'startNew'>, who?: string): DocumentsEntry | undefined {
  if (!tab && !startNew) return undefined;
  const kind = tab === 'contracts' || tab === 'questionnaires' || tab === 'paperwork' ? tab : 'proposals';
  return {
    kind,
    startNew: startNew ? (kind === 'proposals' && who ? who : true) : undefined,
  };
}
