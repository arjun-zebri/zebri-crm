/**
 * Server actions for the Public Page settings (Settings → Public Page).
 *
 * Persists two things to `user_public_settings`:
 *   1. The MC's branded Zebri subdomain.
 *   2. The email sending mode (shared Zebri address vs the MC's connected
 *      OAuth mailbox) + disconnecting that mailbox.
 *
 * Connecting a mailbox is the OAuth redirect flow in
 * `app/api/oauth/{authorize,callback}` — not a server action. These
 * actions cover the surrounding state. The OAuth tokens live encrypted in
 * the table and are never read here or returned to the client.
 *
 * @module app/(dashboard)/settings/public/actions
 */
'use server';

import { z } from 'zod';

import { logger } from '@/lib/alerts/logger';
import { inMemoryLimiter, PUBLIC_PAGE_RATE_LIMITS } from '@/lib/api/rate-limit';
import { decryptSecret } from '@/lib/crypto/secret-box';
import { isOAuthProvider } from '@/lib/oauth/providers';
import { revokeToken } from '@/lib/oauth/tokens';
import { isValidSubdomain, normalizeSubdomain } from '@/lib/settings/public-page';
import { createClient } from '@/lib/supabase/server';

/** Where couple-facing mail is sent from. */
export type EmailMode = 'zebri' | 'oauth';

/** Generic tagged action result. */
export type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

const subdomainLimiter = inMemoryLimiter(PUBLIC_PAGE_RATE_LIMITS.saveSubdomain);
const mailboxLimiter = inMemoryLimiter(PUBLIC_PAGE_RATE_LIMITS.mailboxMutation);

/** Resolve the signed-in user + RLS client, or a tagged error. */
async function authedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Session expired. Please log in again.' };
  return { ok: true as const, supabase, userId: user.id };
}

const subdomainSchema = z.object({ subdomain: z.string().min(1).max(63) });

/**
 * Save the MC's branded Zebri subdomain. Normalises to a DNS-safe slug,
 * rejects reserved/invalid values, and upserts. Subdomains are globally
 * unique: a unique-index violation (another MC owns it) comes back as a
 * friendly "already taken" message.
 */
export async function saveSubdomainAction(
  input: { subdomain: string },
): Promise<ActionResult<{ subdomain: string }>> {
  const parsed = subdomainSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Enter a valid address.' };

  const auth = await authedUser();
  if (!auth.ok) return auth;

  const limit = await subdomainLimiter.check(`saveSubdomain:${auth.userId}`);
  if (!limit.allowed) return { ok: false, error: 'Too many changes. Please wait a moment.' };

  const subdomain = normalizeSubdomain(parsed.data.subdomain);
  if (!isValidSubdomain(subdomain)) {
    return { ok: false, error: 'Use letters, numbers and hyphens. That word is not available.' };
  }

  const { error } = await auth.supabase
    .from('user_public_settings')
    .upsert({ user_id: auth.userId, subdomain, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'That address is already taken.' };
    logger.error('[settings/public] saveSubdomain failed', { userId: auth.userId, error: error.message });
    return { ok: false, error: 'Could not save. Please try again.' };
  }
  return { ok: true, subdomain };
}

const emailModeSchema = z.object({ mode: z.enum(['zebri', 'oauth']) });

/**
 * Toggle which sender is active. Switching to `oauth` is only allowed once
 * a mailbox has been connected (otherwise the send path would fall back to
 * Zebri anyway), so we reject it with a clear message.
 */
export async function setEmailModeAction(
  input: { mode: EmailMode },
): Promise<ActionResult<{ mode: EmailMode }>> {
  const parsed = emailModeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid selection.' };

  const auth = await authedUser();
  if (!auth.ok) return auth;

  if (parsed.data.mode === 'oauth') {
    const { data } = await auth.supabase
      .from('user_public_settings')
      .select('oauth_status')
      .eq('user_id', auth.userId)
      .maybeSingle();
    if (data?.oauth_status !== 'connected') {
      return { ok: false, error: 'Connect a mailbox first.' };
    }
  }

  const { error } = await auth.supabase
    .from('user_public_settings')
    .upsert(
      { user_id: auth.userId, email_mode: parsed.data.mode, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) {
    logger.error('[settings/public] setEmailMode failed', { userId: auth.userId, error: error.message });
    return { ok: false, error: 'Could not save. Please try again.' };
  }
  return { ok: true, mode: parsed.data.mode };
}

/**
 * Disconnect the connected mailbox: best-effort revoke the token at the
 * provider, then clear all `oauth_*` columns and revert to the shared
 * Zebri address.
 */
export async function disconnectMailboxAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authedUser();
  if (!auth.ok) return auth;

  const limit = await mailboxLimiter.check(`mailboxMutation:${auth.userId}`);
  if (!limit.allowed) return { ok: false, error: 'Too many attempts. Please wait a moment.' };

  const { data: row } = await auth.supabase
    .from('user_public_settings')
    .select('oauth_provider, oauth_refresh_token_encrypted')
    .eq('user_id', auth.userId)
    .maybeSingle();

  // Best-effort remote revoke (must not block the local disconnect).
  if (isOAuthProvider(row?.oauth_provider) && row?.oauth_refresh_token_encrypted) {
    try {
      await revokeToken(row.oauth_provider, decryptSecret(row.oauth_refresh_token_encrypted));
    } catch {
      // ignore — we still clear our side below
    }
  }

  const { error } = await auth.supabase
    .from('user_public_settings')
    .update({
      email_mode: 'zebri',
      oauth_provider: null,
      oauth_email: null,
      oauth_from_name: null,
      oauth_refresh_token_encrypted: null,
      oauth_access_token_encrypted: null,
      oauth_token_expires_at: null,
      oauth_status: 'none',
      oauth_last_error: null,
      oauth_connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', auth.userId);

  if (error) {
    logger.error('[settings/public] disconnectMailbox failed', { userId: auth.userId, error: error.message });
    return { ok: false, error: 'Could not disconnect. Please try again.' };
  }
  return { ok: true };
}
