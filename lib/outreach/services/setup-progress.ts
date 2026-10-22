/**
 * Database side of the setup guide: counts the facts `lib/outreach/setup`
 * judges. Every read is a head count (no rows come back), so the Today
 * page stays cheap to refresh.
 *
 * Account facts (mailbox, identity, booking, lookups) come from the
 * readiness loader, so the guide and the checklist always agree.
 *
 * @module lib/outreach/services/setup-progress
 */
import { deriveSetup, type SetupFacts, type SetupState } from '../setup';
import type { AdminDb } from '../types';

import { loadReadinessFacts, templateUsage } from './readiness';

/** Turns a head-count query result into a number, or throws with the table name. */
function countOf(label: string, res: { count: number | null; error: { message: string } | null }): number {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return res.count ?? 0;
}

/**
 * Gather every fact the setup guide judges. Runs the counts in parallel.
 *
 * @param db - Admin client.
 * @returns Facts for {@link deriveSetup}.
 */
export async function loadSetupFacts(db: AdminDb): Promise<SetupFacts> {
  const [account, usage, prospects, checked, sequences, launched] = await Promise.all([
    loadReadinessFacts(db),
    templateUsage(db),
    db.from('outreach_prospects').select('id', { count: 'exact', head: true }),
    db.from('outreach_prospects').select('id', { count: 'exact', head: true }).neq('verdict', 'unchecked'),
    db.from('outreach_sequences').select('id', { count: 'exact', head: true }).is('archived_at', null),
    db.from('outreach_campaigns').select('id', { count: 'exact', head: true }).in('status', ['active', 'paused', 'finished']),
  ]);
  return {
    mailboxConnected: account.mailboxConnected,
    gmailConfigured: account.gmailConfigured,
    senderName: account.senderName,
    signature: account.signature,
    bookingPageSet: account.bookingPageSet,
    apifyConfigured: account.apifyConfigured,
    usesBooking: usage.usesBooking,
    prospectCount: countOf('prospects', prospects),
    checkedCount: countOf('checked', checked),
    sequenceCount: countOf('sequences', sequences),
    launchedCampaignCount: countOf('campaigns', launched),
  };
}

/**
 * The setup guide's full state for the Today page.
 *
 * @param db - Admin client.
 * @returns Steps, done count and the optional row.
 */
export async function loadSetupProgress(db: AdminDb): Promise<SetupState> {
  return deriveSetup(await loadSetupFacts(db));
}
