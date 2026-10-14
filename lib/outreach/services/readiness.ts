/**
 * Database side of readiness: gathers the facts `lib/outreach/readiness`
 * judges. Used by the Settings and Campaigns checklists and by the
 * Activate guard in `admin-ops`.
 *
 * @module lib/outreach/services/readiness
 */
import { readinessItems, type ReadinessFacts, type ReadinessItem } from '../readiness';
import { templateFields } from '../render';
import type { AdminDb } from '../types';

import { loadMailboxInfo, loadSettings } from './settings';

/** Which channels and links the templates in a scope need. */
export interface TemplateUsage {
  usesEmail: boolean;
  usesBooking: boolean;
}

/**
 * What the sequences in a scope need. Campaign activation passes the
 * sequence ids from its arms (archived ones included, since a campaign
 * can still reference them). The Settings checklist passes nothing,
 * meaning every live sequence.
 *
 * @param db - Admin client.
 * @param sequenceIds - Sequences to inspect, or undefined for every live sequence.
 * @returns Whether any step sends email and whether any active template links to booking.
 */
export async function templateUsage(db: AdminDb, sequenceIds?: string[]): Promise<TemplateUsage> {
  let ids: string[];
  if (sequenceIds) {
    ids = sequenceIds;
  } else {
    const { data, error } = await db.from('outreach_sequences').select('id').is('archived_at', null);
    if (error) throw new Error(`sequences: ${error.message}`);
    ids = (data ?? []).map((s) => s.id);
  }
  if (ids.length === 0) return { usesEmail: false, usesBooking: false };

  const { data: steps, error: stepErr } = await db.from('outreach_sequence_steps').select('id, channel').in('sequence_id', ids);
  if (stepErr) throw new Error(`steps: ${stepErr.message}`);
  const stepRows = steps ?? [];
  const usesEmail = stepRows.some((s) => s.channel === 'email');
  if (stepRows.length === 0) return { usesEmail, usesBooking: false };

  const { data: variants, error: varErr } = await db
    .from('outreach_variants')
    .select('body, subject')
    .in('step_id', stepRows.map((s) => s.id))
    .eq('active', true);
  if (varErr) throw new Error(`variants: ${varErr.message}`);
  const usesBooking = (variants ?? []).some((v) => templateFields(`${v.body} ${v.subject ?? ''}`).fields.includes('booking_link'));
  return { usesEmail, usesBooking };
}

/**
 * Facts about the account that do not depend on which sequences a campaign uses.
 *
 * @param db - Admin client.
 * @returns Mailbox, identity, booking, lookup and pause facts.
 */
export async function loadReadinessFacts(db: AdminDb): Promise<Omit<ReadinessFacts, 'usesEmail' | 'usesBooking'>> {
  const settings = await loadSettings(db);
  const mailbox = await loadMailboxInfo(db);
  return {
    mailboxConnected: mailbox !== null,
    // Why: the same env vars the OAuth client reads, so the checklist can say "not set up" before a connect click fails.
    gmailConfigured: !!process.env.OUTREACH_GOOGLE_CLIENT_ID && !!process.env.OUTREACH_GOOGLE_CLIENT_SECRET,
    senderName: settings.sender_name.trim(),
    signature: settings.signature.trim(),
    bookingPageSet: settings.booking_meeting_type_id !== null,
    // Why: the same env var the Settings view reads, so the checklist and the warning agree.
    apifyConfigured: !!process.env.APIFY_TOKEN,
    sendingPaused: settings.sending_paused,
  };
}

/** The Settings checklist payload. */
export interface ReadinessSnapshot {
  items: ReadinessItem[];
  sendingPaused: boolean;
  pausedReason: string | null;
  /** Global scope: whether any live template uses email or {{booking_link}}. */
  usesEmail: boolean;
  usesBooking: boolean;
}

/**
 * Readiness across every live sequence, for the Settings and Campaigns checklists.
 *
 * @param db - Admin client.
 * @returns Rows in setup order plus the pause state for the banner.
 */
export async function loadReadiness(db: AdminDb): Promise<ReadinessSnapshot> {
  const facts = await loadReadinessFacts(db);
  const usage = await templateUsage(db);
  const settings = await loadSettings(db);
  return {
    items: readinessItems({ ...facts, ...usage }),
    sendingPaused: facts.sendingPaused,
    pausedReason: settings.paused_reason,
    ...usage,
  };
}
