/**
 * Server actions for calendar connections (Settings → Public Page → Calendars).
 *
 * Manages OAuth calendar connections (Google Calendar, Outlook Calendar).
 * Tokens are encrypted at rest in `calendar_connections` and are never
 * returned to the client. Disconnect performs a best-effort revoke at the
 * provider before clearing the local row.
 *
 * @module app/(dashboard)/settings/calendar/actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter, PUBLIC_PAGE_RATE_LIMITS } from '@/lib/api/rate-limit';
import { decryptSecret } from '@/lib/crypto/secret-box';
import { isOAuthProvider } from '@/lib/oauth/providers';
import { revokeToken } from '@/lib/oauth/tokens';
import { createClient } from '@/lib/supabase/server';

/** Generic tagged action result. */
export type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Summary of a single calendar connection for display in settings.
 * Token columns are never included in the response.
 */
export interface CalendarConnectionSummary {
  /** OAuth provider (google or microsoft). */
  provider: 'google' | 'microsoft';
  /** Connected account email address. */
  accountEmail: string;
  /** Connection status. */
  status: 'connected' | 'error';
  /** ISO timestamp when the connection was established. */
  connectedAt: string;
}

const disconnectLimiter = inMemoryLimiter(PUBLIC_PAGE_RATE_LIMITS.mailboxMutation);

/** Resolve the signed-in user + RLS client, or a tagged error. */
async function authedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Session expired. Please log in again.' };
  return { ok: true as const, supabase, userId: user.id };
}

/**
 * List all calendar connections for the signed-in user. Returns provider,
 * email, status, and connected timestamp (never tokens).
 */
export async function listCalendarConnectionsAction(): Promise<
  ActionResult<{ connections: CalendarConnectionSummary[] }>
> {
  const auth = await authedUser();
  if (!auth.ok) return auth;

  const { data, error } = await auth.supabase
    .from('calendar_connections')
    .select('provider, account_email, status, connected_at')
    .eq('user_id', auth.userId);

  if (error) {
    logger.error('[settings/calendar] listConnections failed', { userId: auth.userId, error: error.message });
    return { ok: false, error: 'Could not load calendar connections.' };
  }

  const connections: CalendarConnectionSummary[] = (data ?? []).map((row) => ({
    provider: row.provider as 'google' | 'microsoft',
    accountEmail: row.account_email,
    status: row.status as 'connected' | 'error',
    connectedAt: row.connected_at,
  }));

  return { ok: true, connections };
}

const disconnectSchema = z.enum(['google', 'microsoft']);

/**
 * Disconnect a calendar connection: best-effort revoke the token at the
 * provider, then delete the row. For Google, decrypt and revoke the refresh
 * token server-side. For Microsoft, revoke is a no-op (no per-token revoke
 * available); the connection is simply cleared locally.
 */
export async function disconnectCalendarAction(provider: unknown): Promise<ActionResult<object>> {
  const parsed = disconnectSchema.safeParse(provider);
  if (!parsed.success) return { ok: false, error: 'Invalid provider.' };

  const auth = await authedUser();
  if (!auth.ok) return auth;

  if (!isOAuthProvider(parsed.data)) {
    return { ok: false, error: 'Invalid provider.' };
  }

  const limit = await disconnectLimiter.check(`calendarDisconnect:${auth.userId}`);
  if (!limit.allowed) return { ok: false, error: 'Too many attempts. Please wait a moment.' };

  const { data: row } = await auth.supabase
    .from('calendar_connections')
    .select('refresh_token_encrypted, provider')
    .eq('user_id', auth.userId)
    .eq('provider', parsed.data)
    .maybeSingle();

  // Best-effort remote revoke (must not block the local disconnect).
  if (isOAuthProvider(row?.provider) && row?.refresh_token_encrypted) {
    try {
      await revokeToken(row.provider, decryptSecret(row.refresh_token_encrypted));
    } catch {
      // ignore: we still clear our side below
    }
  }

  const { error } = await auth.supabase
    .from('calendar_connections')
    .delete()
    .eq('user_id', auth.userId)
    .eq('provider', parsed.data);

  if (error) {
    logger.error('[settings/calendar] disconnectCalendar failed', { userId: auth.userId, error: error.message });
    return { ok: false, error: 'Could not disconnect. Please try again.' };
  }
  return { ok: true };
}
