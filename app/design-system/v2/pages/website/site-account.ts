import { DEMO_ACCOUNT, type Account } from '../dashboard/account';

/**
 * The sample business every product picture on the marketing site wears:
 * Jess Taylor, a Celebrant (the hero greets her, Journeys and BDM are a
 * Celebrant's stories, the AI band signs her name). The dashboard's demo
 * account carries the founder's own name, which must never reach the
 * public page (2026-10-18: it showed on three Blocks pictures), so every
 * picture that reads the account gets this one, and the Journeys
 * documents build theirs on it, so the two never name her differently.
 *
 * Mia & Leo are moved to the wedding Journeys books (Sat 13 Mar 2027 at
 * Bendooley Estate): the app's demo has them a day later at Hawthorn
 * Hall, and the deposit invoice read that date (2026-10-18 review).
 *
 * @module app/design-system/v2/pages/website/site-account
 */

/** Where Mia and Leo marry, on every band. */
export const SITE_WEDDING = { date: 'Sat 13 Mar 2027', venue: 'Bendooley Estate' } as const;

/** The demo account as the site shows it: Jess's business, Mia & Leo on their Journeys date. */
export const SITE_ACCOUNT: Account = {
  ...DEMO_ACCOUNT,
  business: 'Jess Taylor Celebrant',
  mc: { name: 'Jess Taylor', role: 'Celebrant' },
  // Jess's own email on every letterhead: the demo's carries the founder's (an invoice read "arjunmc").
  ...(DEMO_ACCOUNT.contact ? { contact: { ...DEMO_ACCOUNT.contact, email: 'hello@jesstaylorcelebrant.com.au' } } : {}),
  clients: DEMO_ACCOUNT.clients.map((c) => (c.id === 'mia-leo' ? { ...c, ...SITE_WEDDING } : c)),
};
