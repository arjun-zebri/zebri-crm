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
 * tokens decrypt + refresh cleanly. Any missing row, query error, decrypt
 * failure, or refresh failure falls back to Resend so a send is never
 * blocked by this lookup.
 *
 * @module lib/email/sender-identity
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { decryptSecret, encryptSecret } from '@/lib/crypto/secret-box';
import { isOAuthProvider, type OAuthProvider } from '@/lib/oauth/providers';
import { refreshAccessToken } from '@/lib/oauth/tokens';
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
const RESEND_DEFAULT: ResolvedSender = { transport: 'resend', from: DEFAULT_FROM };

/** Refresh the access token when it's within this window of expiring. */
const REFRESH_SKEW_MS = 120_000;

/**
 * Resolve the transport for a couple-facing email sent by `userId`.
 * Accepts either an RLS-scoped or a service-role Supabase client (the row
 * is read by `user_id`, which works under both, and the access-token
 * refresh writes back to the same row).
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
  try {
    const { data, error } = await supabase
      .from('user_public_settings')
      .select(
        'email_mode, oauth_status, oauth_provider, oauth_email, oauth_from_name, oauth_refresh_token_encrypted, oauth_access_token_encrypted, oauth_token_expires_at',
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return RESEND_DEFAULT;
    if (
      data.email_mode !== 'oauth' ||
      data.oauth_status !== 'connected' ||
      !isOAuthProvider(data.oauth_provider) ||
      !data.oauth_email ||
      !data.oauth_refresh_token_encrypted
    ) {
      return RESEND_DEFAULT;
    }

    const provider = data.oauth_provider;
    const from = composeFromHeader(data.oauth_from_name || businessName, data.oauth_email);

    // Use the cached access token while it's comfortably valid; otherwise
    // mint a fresh one from the refresh token and persist it.
    const expiresAt = data.oauth_token_expires_at ? Date.parse(data.oauth_token_expires_at) : 0;
    let accessToken: string | null = null;
    if (data.oauth_access_token_encrypted && expiresAt - Date.now() > REFRESH_SKEW_MS) {
      accessToken = decryptSecret(data.oauth_access_token_encrypted);
    }
    if (!accessToken) {
      const refreshed = await refreshAccessToken(provider, decryptSecret(data.oauth_refresh_token_encrypted));
      accessToken = refreshed.accessToken;
      await supabase
        .from('user_public_settings')
        .update({
          oauth_access_token_encrypted: encryptSecret(refreshed.accessToken),
          oauth_token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
          ...(refreshed.refreshToken ? { oauth_refresh_token_encrypted: encryptSecret(refreshed.refreshToken) } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }

    return { transport: 'oauth', from, oauth: { provider, accessToken } };
  } catch {
    // Never let a config lookup / token refresh take down a send.
    return RESEND_DEFAULT;
  }
}
