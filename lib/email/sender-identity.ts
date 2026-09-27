/**
 * Resolve how a given MC's couple-facing email should be sent.
 *
 * By default mail goes through Resend from the shared Zebri address
 * ({@link DEFAULT_FROM}). An MC who has connected their own mailbox
 * (Settings → Public Page → Email) sends through it over OAuth (Gmail /
 * Microsoft Graph) instead — so the mail lands in their Sent folder and
 * replies come back to them. The choice + tokens live in
 * `user_public_settings`; this module reads that row, refreshes the
 * access token when it's expired, and returns a transport descriptor that
 * {@link dispatchEmail} acts on.
 *
 * Resilience: OAuth is only chosen when the mailbox is connected and the
 * tokens decrypt + refresh cleanly. A connection that is dead for good (a
 * revoked grant, a token that will not decrypt) is marked failed and
 * alerted, and mail goes from the shared address. A transient failure
 * (the settings read, a refresh that errored) is `unavailable` to an
 * automated step, which errors rather than send from an address the MC
 * did not approve ({@link resolveSenderForSend}); the MC-present paths
 * fall back to the shared address ({@link resolveSender}).
 *
 * @module lib/email/sender-identity
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { sendAlert } from '@/lib/alerts';
import { logger } from '@/lib/alerts/logger';
import { decryptSecret, encryptSecret } from '@/lib/crypto/secret-box';
import { isOAuthProvider, type OAuthProvider } from '@/lib/oauth/providers';
import { isPermanentGrantError, refreshAccessToken } from '@/lib/oauth/tokens';
import { composeFromHeader } from '@/lib/settings/public-page';
import type { Database } from '@/types/database';

/** Shared Zebri sending address used whenever no connected mailbox applies. */
export const DEFAULT_FROM = 'Zebri <noreply@app.zebri.com.au>';

/** A live OAuth bearer for sending through the MC's mailbox. */
export interface OAuthTransport {
  provider: OAuthProvider;
  accessToken: string;
}

/** A resolved transport: the shared Resend address, or an MC's mailbox. */
export type ResolvedSender =
  | { transport: 'resend'; from: string }
  | { transport: 'oauth'; from: string; oauth: OAuthTransport };

/** The fixed Resend default, used as the fail-safe everywhere below. */
const RESEND_DEFAULT: { transport: 'resend'; from: string } = { transport: 'resend', from: DEFAULT_FROM };

/** Refresh the access token when it's within this window of expiring. */
const REFRESH_SKEW_MS = 120_000;

/** The settings columns the transport choice is made from. */
const SENDER_COLUMNS =
  'email_mode, oauth_status, oauth_provider, oauth_email, oauth_from_name, oauth_refresh_token_encrypted, oauth_access_token_encrypted, oauth_token_expires_at';

/**
 * The subset {@link describeSender} needs: the choice alone. It leaves the
 * access token out, since nothing on the preview path should hold it.
 */
const CHOICE_COLUMNS =
  'email_mode, oauth_status, oauth_provider, oauth_email, oauth_from_name, oauth_refresh_token_encrypted';

/** The parts of a `user_public_settings` row {@link chooseSender} reads. */
interface SenderSettingsRow {
  email_mode: string | null;
  oauth_status: string | null;
  oauth_provider: string | null;
  oauth_email: string | null;
  oauth_from_name: string | null;
  oauth_refresh_token_encrypted: string | null;
}

/**
 * Which transport and From a send uses, without the live token.
 *
 * What the step envelope shows as the sender. It carries no credential,
 * so it is safe to hand to the page.
 */
export type SenderChoice =
  | { transport: 'resend'; from: string }
  | { transport: 'oauth'; provider: OAuthProvider; from: string };

/**
 * The transport decision itself, from a settings row: the MC's connected
 * mailbox when it is chosen, connected and has a refresh token, else the
 * shared Zebri address. {@link resolveSender} (the send) and
 * {@link describeSender} (the envelope) both decide through this, so the
 * envelope names the sender the send picks.
 */
function chooseSender(row: SenderSettingsRow | null, businessName: string): SenderChoice {
  if (
    !row ||
    row.email_mode !== 'oauth' ||
    row.oauth_status !== 'connected' ||
    !isOAuthProvider(row.oauth_provider) ||
    !row.oauth_email ||
    !row.oauth_refresh_token_encrypted
  ) {
    return RESEND_DEFAULT;
  }
  return {
    transport: 'oauth',
    provider: row.oauth_provider,
    from: composeFromHeader(row.oauth_from_name || businessName, row.oauth_email),
  };
}

/**
 * The sender a couple-facing email from `userId` would go out from, for
 * display. Reads the same row {@link resolveSender} reads and decides the
 * same way, but never decrypts, refreshes or writes anything: it runs on
 * every preview.
 *
 * It cannot foresee a connection that breaks between the preview and the
 * send. When it does, the send does not quietly switch address: a
 * transient failure errors the step, and a dead connection is marked
 * failed first, so the next envelope names the shared address too.
 *
 * @param supabase     The MC's own RLS client (or any client).
 * @param userId       The sending MC's user id.
 * @param businessName Display name fallback for the `from` header.
 */
export async function describeSender(
  supabase: SupabaseClient<Database>,
  userId: string,
  businessName: string,
): Promise<SenderChoice> {
  try {
    const { data, error } = await supabase
      .from('user_public_settings')
      .select(CHOICE_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return RESEND_DEFAULT;
    return chooseSender(data, businessName);
  } catch {
    return RESEND_DEFAULT;
  }
}

/**
 * The send path's answer: the sender to use, or why the MC's mailbox
 * could not be reached right now.
 *
 * - `ok`: the connected mailbox, or the shared Zebri address when none is
 *   connected (including one this call just found permanently broken and
 *   marked failed, see {@link resolveSenderForSend}).
 * - `unavailable`: a transient failure reaching the MC's mailbox. `reason`
 *   is a short code, safe for logs and step errors.
 */
export type SenderResolution =
  | { status: 'ok'; sender: ResolvedSender }
  | { status: 'unavailable'; reason: 'settings_unreadable' | 'token_refresh_failed' };

/** Why a connected mailbox was marked failed. Safe for an alert. */
type DisconnectReason = 'grant_revoked' | 'token_unreadable';

/**
 * Mark the MC's mailbox connection failed and say so once.
 *
 * Flips `oauth_status` from `connected` to `failed` (with the reason in
 * `oauth_last_error`, which Settings shows), so every later send and the
 * step envelope name the shared address honestly, and Settings asks the
 * MC to reconnect. Conditional on the row still being `connected`: only
 * the call that actually flips it raises `mailbox_disconnected`, so two
 * sends racing on the same dead token alert once. Never throws.
 */
async function markMailboxFailed(
  supabase: SupabaseClient<Database>,
  userId: string,
  provider: OAuthProvider,
  reason: DisconnectReason,
): Promise<void> {
  try {
    const { data } = await supabase
      .from('user_public_settings')
      .update({
        oauth_status: 'failed',
        oauth_last_error:
          reason === 'grant_revoked'
            ? 'The mailbox connection was revoked or expired. Reconnect it to send from it again.'
            : 'The saved mailbox connection could not be read. Reconnect it to send from it again.',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('oauth_status', 'connected')
      .select('user_id');
    if (!data?.length) return;
    await sendAlert({ type: 'mailbox_disconnected', severity: 'warn', userId, provider, reason });
  } catch (err) {
    logger.error('[sender-identity] could not mark the mailbox failed', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Resolve the transport for an automated couple-facing send, telling a
 * transient failure apart from a dead connection (Phase 5 fix wave, M7).
 *
 * Before this, every failure to reach the MC's mailbox (a settings read
 * that errored, a token that would not decrypt, a refresh that failed)
 * silently became a send from the shared Zebri address, with
 * `oauth_status` still `connected`, while the step envelope the MC
 * approved named their own mailbox. Now:
 *
 * - no row, or no connected mailbox: the shared address (`ok`).
 * - the settings read fails, or a refresh fails for any reason but a
 *   revoked grant: `unavailable`. The caller errors the step, so the MC
 *   sees it and nothing goes from an address they did not approve.
 * - a revoked or expired grant (`invalid_grant`) or a token that cannot
 *   be decrypted: permanent. The connection is marked failed and alerted
 *   once ({@link markMailboxFailed}), then the shared address is used,
 *   which is what the envelope and every later send now say too.
 *
 * @param supabase     Supabase client (RLS or admin).
 * @param userId       The sending MC's user id.
 * @param businessName Display name fallback for the `from` header.
 */
export async function resolveSenderForSend(
  supabase: SupabaseClient<Database>,
  userId: string,
  businessName: string,
): Promise<SenderResolution> {
  let data;
  try {
    const res = await supabase
      .from('user_public_settings')
      .select(SENDER_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();
    if (res.error) return { status: 'unavailable', reason: 'settings_unreadable' };
    data = res.data;
  } catch {
    return { status: 'unavailable', reason: 'settings_unreadable' };
  }
  if (!data) return { status: 'ok', sender: RESEND_DEFAULT };
  const choice = chooseSender(data, businessName);
  // Narrowed again for the compiler: `chooseSender` only answers oauth
  // when the refresh token is present.
  if (choice.transport === 'resend' || !data.oauth_refresh_token_encrypted) {
    return { status: 'ok', sender: RESEND_DEFAULT };
  }
  const { provider, from } = choice;

  // Use the cached access token while it's comfortably valid; otherwise
  // mint a fresh one from the refresh token and persist it.
  const expiresAt = data.oauth_token_expires_at ? Date.parse(data.oauth_token_expires_at) : 0;
  let accessToken: string | null = null;
  let refreshToken: string;
  try {
    if (data.oauth_access_token_encrypted && expiresAt - Date.now() > REFRESH_SKEW_MS) {
      accessToken = decryptSecret(data.oauth_access_token_encrypted);
    }
    refreshToken = accessToken ? '' : decryptSecret(data.oauth_refresh_token_encrypted);
  } catch {
    // A token we stored and cannot read back (a rotated EMAIL_CRED_KEY, a
    // corrupted value) will fail identically on every send.
    await markMailboxFailed(supabase, userId, provider, 'token_unreadable');
    return { status: 'ok', sender: RESEND_DEFAULT };
  }

  if (!accessToken) {
    let refreshed;
    try {
      refreshed = await refreshAccessToken(provider, refreshToken);
    } catch (err) {
      if (isPermanentGrantError(err)) {
        await markMailboxFailed(supabase, userId, provider, 'grant_revoked');
        return { status: 'ok', sender: RESEND_DEFAULT };
      }
      return { status: 'unavailable', reason: 'token_refresh_failed' };
    }
    accessToken = refreshed.accessToken;
    // Best-effort: a failed write-back only means the next send refreshes
    // again; the token in hand is good for this one.
    try {
      await supabase
        .from('user_public_settings')
        .update({
          oauth_access_token_encrypted: encryptSecret(refreshed.accessToken),
          oauth_token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
          ...(refreshed.refreshToken ? { oauth_refresh_token_encrypted: encryptSecret(refreshed.refreshToken) } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } catch {
      // See above.
    }
  }

  return { status: 'ok', sender: { transport: 'oauth', from, oauth: { provider, accessToken } } };
}

/**
 * Resolve the transport for a couple-facing email sent by `userId`, for
 * the paths where the MC is present (manual sends from the app, public
 * page and booking emails, notifications). Accepts either an RLS-scoped
 * or a service-role Supabase client.
 *
 * Decides through {@link resolveSenderForSend}, so a dead connection is
 * marked failed and alerted here too. A transient failure still falls
 * back to the shared address, logged: these sends answer a person who is
 * waiting, and a manual send reports its own result on screen. Automated
 * workflow steps use {@link resolveSenderForSend} directly and error
 * instead.
 *
 * @param supabase     Supabase client (RLS or admin).
 * @param userId       The sending MC's user id.
 * @param businessName Display name fallback for the `from` header.
 * @returns The MC's connected mailbox, or {@link RESEND_DEFAULT}.
 */
export async function resolveSender(
  supabase: SupabaseClient<Database>,
  userId: string,
  businessName: string,
): Promise<ResolvedSender> {
  const res = await resolveSenderForSend(supabase, userId, businessName);
  if (res.status === 'ok') return res.sender;
  logger.warn('[sender-identity] mailbox unreachable, sending from the shared address', {
    userId,
    reason: res.reason,
  });
  return RESEND_DEFAULT;
}
