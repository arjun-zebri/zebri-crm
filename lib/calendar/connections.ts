/**
 * Persistence + token lifecycle for external calendar connections
 * (Scheduler Phase A). One row per provider per MC in
 * `calendar_connections`; tokens encrypted at rest with the same
 * secret-box as mailbox credentials.
 *
 * Server-only (decrypts tokens). Never import from a `'use client'`
 * module.
 *
 * @module lib/calendar/connections
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { decryptSecret, encryptSecret } from '@/lib/crypto/secret-box';
import type { OAuthProvider } from '@/lib/oauth/providers';
import { refreshAccessToken, type TokenSet } from '@/lib/oauth/tokens';
import type { Database } from '@/types/database';

/** A stored external calendar connection row. */
export type CalendarConnection =
  Database['public']['Tables']['calendar_connections']['Row'];

/** Refresh this long before nominal expiry so in-flight calls never race it. */
const REFRESH_SKEW_MS = 60_000;

/** Upsert the connection created by an OAuth consent (one per provider). */
export async function saveCalendarConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
  provider: OAuthProvider,
  tokens: TokenSet & { refreshToken: string },
  accountEmail: string,
): Promise<void> {
  const { error } = await supabase.from('calendar_connections').upsert(
    {
      user_id: userId,
      provider,
      account_email: accountEmail,
      access_token_encrypted: encryptSecret(tokens.accessToken),
      refresh_token_encrypted: encryptSecret(tokens.refreshToken),
      token_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      status: 'connected',
      last_error: null,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  );
  if (error) throw error;
}

/** All connections that are currently usable for free/busy + event push. */
export async function listActiveConnections(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CalendarConnection[]> {
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'connected');
  if (error) throw error;
  return data ?? [];
}

/**
 * Return a valid access token for `connection`, refreshing (and
 * persisting the refreshed token) when it is within {@link REFRESH_SKEW_MS}
 * of expiry. A failed refresh marks the row `status='error'` so the
 * Settings UI can surface "reconnect", then rethrows: callers treat it
 * as the provider being unavailable (free/busy fails closed).
 */
export async function getFreshAccessToken(
  supabase: SupabaseClient<Database>,
  connection: CalendarConnection,
): Promise<string> {
  const expiresAt = Date.parse(connection.token_expires_at);
  if (expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return decryptSecret(connection.access_token_encrypted);
  }
  try {
    const refreshed = await refreshAccessToken(
      connection.provider as OAuthProvider,
      decryptSecret(connection.refresh_token_encrypted),
    );
    await supabase
      .from('calendar_connections')
      .update({
        access_token_encrypted: encryptSecret(refreshed.accessToken),
        // Some providers rotate the refresh token on use; keep the new one.
        ...(refreshed.refreshToken
          ? { refresh_token_encrypted: encryptSecret(refreshed.refreshToken) }
          : {}),
        token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);
    return refreshed.accessToken;
  } catch (err) {
    try {
      await supabase
        .from('calendar_connections')
        .update({
          status: 'error',
          last_error: err instanceof Error ? err.message : String(err),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id);
    } catch {
      // Best-effort bookkeeping: the refresh failure is the error that
      // matters, so a failed status write must not replace it.
    }
    throw err;
  }
}
