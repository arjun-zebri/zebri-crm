/**
 * Read outreach settings, the mailbox, and derived values (booking link
 * base, this month's Apify spend).
 *
 * @module lib/outreach/services/settings
 */
import { logger } from '@/lib/alerts/logger';
import { decryptSecret } from '@/lib/crypto/secret-box';

import { refreshOutreachToken } from '../gmail/client';
import type { AdminDb, OutreachSettings } from '../types';

/** The single settings row. Throws if the migration's seed row is missing. */
export async function loadSettings(db: AdminDb): Promise<OutreachSettings> {
  const { data, error } = await db.from('outreach_settings').select('*').eq('id', true).single();
  if (error || !data) throw new Error(`outreach_settings: ${error?.message ?? 'missing row'}`);
  return data;
}

/** The connected mailbox, without the token. */
export interface MailboxInfo {
  email: string;
  connectedAt: string;
  lastError: string | null;
  lastPolledAt: string | null;
}

/** Mailbox status for the UI, or null when not connected. */
export async function loadMailboxInfo(db: AdminDb): Promise<MailboxInfo | null> {
  const { data, error } = await db
    .from('outreach_mailbox')
    .select('email, connected_at, last_error, last_polled_at')
    .eq('id', true)
    .maybeSingle();
  if (error) throw new Error(`outreach_mailbox: ${error.message}`);
  return data
    ? { email: data.email, connectedAt: data.connected_at, lastError: data.last_error, lastPolledAt: data.last_polled_at }
    : null;
}

/** Mailbox address + a fresh access token, or null when not connected. */
export async function mailboxAccess(db: AdminDb): Promise<{ email: string; accessToken: string } | null> {
  const { data, error } = await db.from('outreach_mailbox').select('email, refresh_token_enc').eq('id', true).maybeSingle();
  if (error) throw new Error(`outreach_mailbox: ${error.message}`);
  if (!data) return null;
  const accessToken = await refreshOutreachToken(decryptSecret(data.refresh_token_enc));
  return { email: data.email, accessToken };
}

/** Pause sending with a reason the Settings tab shows. */
export async function pauseSending(db: AdminDb, reason: string): Promise<void> {
  const { error } = await db
    .from('outreach_settings')
    .update({ sending_paused: true, paused_reason: reason, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) throw new Error(`pause sending: ${error.message}`);
}

/**
 * Public booking URL for the chosen meeting type (`/book/<share_token>`),
 * or null when none is set. `{{booking_link}}` appends `?ref=`.
 */
export async function bookingBaseUrl(db: AdminDb, settings: OutreachSettings): Promise<string | null> {
  if (!settings.booking_meeting_type_id) return null;
  const { data, error } = await db
    .from('meeting_types')
    .select('share_token')
    .eq('id', settings.booking_meeting_type_id)
    .maybeSingle();
  if (error) throw new Error(`meeting_types: ${error.message}`);
  if (!data) return null;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}/book/${data.share_token}`;
}

/** First instant of the current month, UTC. */
function monthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Apify spend (cents) this calendar month: settled runs at their real cost,
 * plus runs still in flight at their estimate.
 *
 * Why reservations and not `outreach_check_runs.cost_cents`: a run's cost
 * only lands on its row when it finishes, so the old sum hid every run in
 * flight and two batches could together overshoot the cap. The reservation
 * row exists from the moment a run is started (see `outreach_start_ig_batch`).
 */
export async function apifySpendThisMonth(db: AdminDb, now: Date = new Date()): Promise<number> {
  const { data, error } = await db
    .from('outreach_spend_reservations')
    .select('amount_cents, actual_cents')
    .gte('created_at', monthStart(now));
  if (error) throw new Error(`apify spend: ${error.message}`);
  return (data ?? []).reduce((s, r) => s + (r.actual_cents ?? r.amount_cents), 0);
}

/** Editable settings fields. */
export interface SettingsInput {
  sender_name: string;
  signature: string;
  email_ramp: number[];
  email_daily_cap: number;
  ig_daily_cap: number;
  send_window_start: string;
  send_window_end: string;
  send_weekdays: number[];
  apify_monthly_budget_cents: number;
  booking_meeting_type_id: string | null;
}

/** Save settings. */
export async function saveSettings(db: AdminDb, input: SettingsInput): Promise<void> {
  const { error } = await db.from('outreach_settings').update({ ...input, updated_at: new Date().toISOString() }).eq('id', true);
  if (error) throw new Error(`save settings: ${error.message}`);
}

/** Resume sending after a pause. */
export async function resumeSending(db: AdminDb): Promise<void> {
  const { error } = await db
    .from('outreach_settings')
    .update({ sending_paused: false, paused_reason: null, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) throw new Error(`resume: ${error.message}`);
}

/** Google's token revocation endpoint (RFC 7009). */
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

/**
 * Revoke the Google grant behind a refresh token, so the app stops having
 * Gmail access even if the token row is later copied or leaked.
 *
 * Throws on any failure; the caller decides whether that blocks anything.
 */
export async function revokeGoogleGrant(refreshToken: string): Promise<void> {
  const res = await fetch(GOOGLE_REVOKE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken }),
    signal: AbortSignal.timeout(10_000),
  });
  // Google answers 400 for a token that is already revoked; that is the state we want.
  if (!res.ok && res.status !== 400) throw new Error(`revoke: HTTP ${res.status}`);
}

/**
 * Forget the mailbox (tokens included). Pauses sending so nothing queues against it.
 *
 * Why revoke before delete: once the row is gone the refresh token can't be
 * revoked, and the Google grant would live on. A failed revoke is logged and
 * the disconnect still goes ahead, so a Google outage can't trap the founder
 * with a mailbox they can't remove.
 */
export async function disconnectMailbox(db: AdminDb): Promise<void> {
  const { data, error: readErr } = await db.from('outreach_mailbox').select('refresh_token_enc').eq('id', true).maybeSingle();
  if (readErr) throw new Error(`disconnect: ${readErr.message}`);
  if (data) {
    try {
      await revokeGoogleGrant(decryptSecret(data.refresh_token_enc));
    } catch (err) {
      logger.error('[outreach] Google grant revoke failed; disconnecting anyway', { error: String(err) });
    }
  }
  const { error } = await db.from('outreach_mailbox').delete().eq('id', true);
  if (error) throw new Error(`disconnect: ${error.message}`);
  await pauseSending(db, 'Mailbox disconnected.');
}
