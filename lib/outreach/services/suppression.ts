/**
 * Global suppression list: addresses and Instagram handles we must never
 * contact again, whatever row or re-import they arrive under.
 *
 * Why global: opt-outs used to live only on the prospect row, so a
 * re-import under a different merge key created a new row that could be
 * mailed. The Spam Act makes the opt-out a property of the address, not
 * of our spreadsheet.
 *
 * Also the single gate for "may we contact this person right now"
 * ({@link sendBlockReason}). The send path calls it immediately before
 * each email, so a stale enrolment can't send after an opt-out.
 *
 * @module lib/outreach/services/suppression
 */
import { hasContactDetails } from '../render';
import type { AdminDb, Prospect } from '../types';

/** What a suppression entry is keyed on. */
export type SuppressionKind = 'email' | 'instagram';

/** Why an address is suppressed. */
export type SuppressionReason = 'opted_out' | 'bounced' | 'complained' | 'manual';

/**
 * Why a message may not be sent now. A short machine string the send
 * path records as the skip reason.
 */
export type SendBlockReason = 'suppressed' | 'existing_customer' | 'unconfirmed_email' | 'no_sender_identity';

/** Chunk size for `.in()` lookups, to keep the request URL short. */
const IN_CHUNK = 200;

/**
 * Canonical form of an email for the suppression list and for matching.
 * Lower-cased and trimmed, so `Jane@X.com ` and `jane@x.com` are one person.
 *
 * @returns The normalised address, or null when there is none.
 */
export function normaliseEmail(email: string | null | undefined): string | null {
  const v = email?.trim().toLowerCase();
  return v ? v : null;
}

/**
 * Canonical form of an Instagram handle: no leading "@", lower-cased.
 * Instagram handles are case-insensitive, so this must match how they are
 * compared everywhere else.
 *
 * @returns The normalised handle, or null when there is none.
 */
export function normaliseHandle(handle: string | null | undefined): string | null {
  const v = handle?.trim().replace(/^@+/, '').toLowerCase();
  return v ? v : null;
}

/**
 * Record one or more addresses as suppressed.
 *
 * Why the reason is overwritten for opt-outs and complaints but not for
 * bounces: an opt-out must stay visible even if the address bounced
 * earlier, and a bounce must never downgrade an existing opt-out.
 *
 * @param source - Free text for the audit trail, for example "stop reply" or "gmail poll".
 */
export async function suppressAddress(
  db: AdminDb,
  input: { email?: string | null; instagram?: string | null },
  reason: SuppressionReason,
  source: string,
): Promise<void> {
  const rows: { kind: SuppressionKind; value: string; reason: SuppressionReason; source: string }[] = [];
  const email = normaliseEmail(input.email);
  const handle = normaliseHandle(input.instagram);
  if (email) rows.push({ kind: 'email', value: email, reason, source });
  if (handle) rows.push({ kind: 'instagram', value: handle, reason, source });
  if (rows.length === 0) return;
  // Why not ignoreDuplicates for opt-outs: they must replace an earlier bounce reason.
  const overwrite = reason !== 'bounced';
  const { error } = await db.from('outreach_suppression').upsert(rows, {
    onConflict: 'kind,value',
    ignoreDuplicates: !overwrite,
  });
  if (error) throw new Error(`suppress address: ${error.message}`);
}

/** Which of the given values are on the list, per kind. */
export interface SuppressedSet {
  emails: Set<string>;
  handles: Set<string>;
}

/**
 * Look up which emails and handles are suppressed. Chunked so a large
 * import doesn't build one enormous `.in()` filter.
 *
 * `includeBounced: false` asks "did this PERSON say stop?" rather than
 * "can this ADDRESS take mail?". A bounce rules out one email address, not
 * the person, so it must not put them on do-not-contact or block their
 * Instagram steps.
 */
export async function suppressedValues(
  db: AdminDb,
  emails: (string | null | undefined)[],
  handles: (string | null | undefined)[],
  opts: { includeBounced?: boolean } = {},
): Promise<SuppressedSet> {
  const includeBounced = opts.includeBounced ?? true;
  const out: SuppressedSet = { emails: new Set(), handles: new Set() };
  const queries: [SuppressionKind, string[]][] = [
    ['email', [...new Set(emails.map((e) => normaliseEmail(e)).filter((v): v is string => v !== null))]],
    ['instagram', [...new Set(handles.map((h) => normaliseHandle(h)).filter((v): v is string => v !== null))]],
  ];
  for (const [kind, values] of queries) {
    for (let i = 0; i < values.length; i += IN_CHUNK) {
      const { data, error } = await db
        .from('outreach_suppression')
        .select('value')
        .eq('kind', kind)
        .in('value', values.slice(i, i + IN_CHUNK))
        .in('reason', includeBounced ? ['opted_out', 'bounced', 'complained', 'manual'] : ['opted_out', 'complained', 'manual']);
      if (error) throw new Error(`suppression lookup: ${error.message}`);
      for (const row of data ?? []) (kind === 'email' ? out.emails : out.handles).add(row.value);
    }
  }
  return out;
}

/**
 * True when an address or handle in `p` is on the list, judged against a
 * set already looked up with {@link suppressedValues}.
 */
export function matchesSuppressed(set: SuppressedSet, p: { email: string | null; instagram_handle: string | null }): boolean {
  const email = normaliseEmail(p.email);
  const handle = normaliseHandle(p.instagram_handle);
  return (email !== null && set.emails.has(email)) || (handle !== null && set.handles.has(handle));
}

/**
 * True when the prospect's email or handle is on the list. By default a
 * bounced address counts (right for "may this email go out?"); pass
 * `includeBounced: false` for "has this person asked not to be contacted?".
 */
export async function isSuppressed(
  db: AdminDb,
  prospect: Pick<Prospect, 'email' | 'instagram_handle'>,
  opts: { includeBounced?: boolean } = {},
): Promise<boolean> {
  const hit = await suppressedValues(db, [prospect.email ?? ''], [prospect.instagram_handle ?? ''], opts);
  return matchesSuppressed(hit, prospect);
}

/**
 * True when this person is already a Zebri customer: linked to a user, or
 * their email matches an auth account. Existing customers are never
 * cold-emailed. Checked by an RPC because `auth.users` isn't reachable
 * through PostgREST.
 */
export async function isExistingCustomer(db: AdminDb, prospect: Pick<Prospect, 'email' | 'linked_user_id'>): Promise<boolean> {
  if (prospect.linked_user_id) return true;
  const email = normaliseEmail(prospect.email);
  if (!email) return false;
  const { data, error } = await db.rpc('outreach_is_existing_customer', { p_email: email });
  if (error) throw new Error(`existing customer check: ${error.message}`);
  return data === true;
}

/**
 * Why this prospect may not be emailed right now, or null when it may.
 *
 * Checks, in order: the do-not-contact flag and the global list, existing
 * customers, an email the founder hasn't confirmed (scraped addresses are
 * suggestions only), and the sender identity the footer must show.
 *
 * Email-only: the send path calls this before each email. It does not
 * gate Instagram, which the founder sends by hand.
 *
 * @returns A machine reason, or null when the email may go out.
 */
export async function sendBlockReason(db: AdminDb, prospect: Prospect): Promise<string | null> {
  if (prospect.do_not_contact || (await isSuppressed(db, prospect))) return 'suppressed';
  if (await isExistingCustomer(db, prospect)) return 'existing_customer';
  // Why: a scraped address may belong to a third party (a hostile site can plant one), so it
  // is mailed only after the founder confirms it.
  if (!prospect.email || prospect.email_source === 'found') return 'unconfirmed_email';
  const { data, error } = await db.from('outreach_settings').select('sender_name, signature').eq('id', true).single();
  if (error || !data) throw new Error(`outreach_settings: ${error?.message ?? 'missing row'}`);
  if (data.sender_name.trim() === '' || !hasContactDetails(data.signature)) return 'no_sender_identity';
  return null;
}
