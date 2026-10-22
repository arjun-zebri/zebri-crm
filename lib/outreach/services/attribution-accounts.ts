/**
 * Account-side attribution: a recent signup matched by email, and a linked
 * account whose subscription went active.
 *
 * Both are idempotent. A signup is re-checked on every pass until its
 * sequence is stopped and its stage moved, so a pass that failed half-way
 * is finished by the next one. The old flow linked the account first and
 * skipped the stop on every later pass, which stranded a half-finished
 * attribution for good.
 *
 * @module lib/outreach/services/attribution-accounts
 */
import { sendAlert } from '@/lib/alerts/send-alert';
import { subscriptionPlan, subscriptionStatus } from '@/lib/auth/entitlements';

import type { AdminDb } from '../types';

import { autoAdvance, recordEvent, stopActiveEnrollment } from './events';

const SIGNUP_LOOKBACK_DAYS = 7;
const USER_PAGE = 200;
/** Pages of auth users read per pass. Beyond this, signups are reported, not silently dropped. */
const MAX_USER_PAGES = 50;
const PAYING_CHECKS_PER_TICK = 50;
const ID_CHUNK = 200;

/** Auth users created within the lookback window, with a usable email. */
async function recentUsers(db: AdminDb, since: number): Promise<{ id: string; email: string }[]> {
  const out: { id: string; email: string }[] = [];
  for (let page = 1; page <= MAX_USER_PAGES; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: USER_PAGE });
    if (error) throw new Error(`list users: ${error.message}`);
    for (const u of data.users) {
      if (u.email && Date.parse(u.created_at) >= since) out.push({ id: u.id, email: u.email.toLowerCase() });
    }
    if (data.users.length < USER_PAGE) return out;
  }
  void sendAlert({
    type: 'app_error', severity: 'error', source: 'outreach.attribution',
    message: `Over ${MAX_USER_PAGES * USER_PAGE} accounts: signup attribution only checked the first ${MAX_USER_PAGES * USER_PAGE}.`,
  });
  return out;
}

/**
 * Link recent signups to prospects by email, and finish the stop and stage
 * move for each. Returns how many signups were newly recorded.
 */
export async function attributeSignups(db: AdminDb): Promise<{ signedUp: number }> {
  const users = await recentUsers(db, Date.now() - SIGNUP_LOOKBACK_DAYS * 86_400_000);
  if (users.length === 0) return { signedUp: 0 };
  const byEmail = new Map(users.map((u) => [u.email, u]));

  const prospects: { id: string; email: string | null; linked_user_id: string | null }[] = [];
  const emails = [...byEmail.keys()];
  for (let i = 0; i < emails.length; i += ID_CHUNK) {
    const { data, error } = await db
      .from('outreach_prospects')
      .select('id, email, linked_user_id')
      .in('email', emails.slice(i, i + ID_CHUNK));
    if (error) throw new Error(`signup match: ${error.message}`);
    prospects.push(...(data ?? []));
  }

  const alreadySignedUp = new Set<string>();
  const ids = prospects.map((p) => p.id);
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const { data, error } = await db
      .from('outreach_events')
      .select('prospect_id')
      .eq('type', 'signed_up')
      .in('prospect_id', ids.slice(i, i + ID_CHUNK));
    if (error) throw new Error(`signup events: ${error.message}`);
    for (const r of data ?? []) if (r.prospect_id) alreadySignedUp.add(r.prospect_id);
  }

  let signedUp = 0;
  for (const p of prospects) {
    const user = p.email ? byEmail.get(p.email.toLowerCase()) : undefined;
    // Linked to a different account already: leave it be.
    if (!user || (p.linked_user_id && p.linked_user_id !== user.id)) continue;
    if (!p.linked_user_id) {
      const { error } = await db.from('outreach_prospects').update({ linked_user_id: user.id }).eq('id', p.id).is('linked_user_id', null);
      if (error) throw new Error(`link user: ${error.message}`);
    }
    if (!alreadySignedUp.has(p.id)) {
      await recordEvent(db, { prospectId: p.id, type: 'signed_up', payload: { user_id: user.id, matched_by: 'email' } });
      signedUp++;
    }
    await stopActiveEnrollment(db, p.id, 'signed_up');
    await autoAdvance(db, p.id, 'signed_up');
  }
  return { signedUp };
}

/** Mark linked users whose subscription went active as paying. Returns the count. */
export async function attributePaying(db: AdminDb): Promise<number> {
  const { data: linked, error } = await db
    .from('outreach_prospects')
    .select('id, linked_user_id')
    .not('linked_user_id', 'is', null)
    .neq('stage', 'paying')
    .order('updated_at', { ascending: true })
    .limit(PAYING_CHECKS_PER_TICK);
  if (error) throw new Error(`linked prospects: ${error.message}`);
  let paying = 0;
  for (const p of linked ?? []) {
    const { data, error: uErr } = await db.auth.admin.getUserById(p.linked_user_id!);
    if (uErr || !data.user) continue;
    // Rotate through linked prospects so a large set is covered over ticks.
    await db.from('outreach_prospects').update({ updated_at: new Date().toISOString() }).eq('id', p.id);
    if (subscriptionStatus(data.user) !== 'active') continue;
    await recordEvent(db, { prospectId: p.id, type: 'paying', payload: { user_id: data.user.id, plan: subscriptionPlan(data.user) ?? null } });
    await autoAdvance(db, p.id, 'paying');
    paying++;
  }
  return paying;
}
