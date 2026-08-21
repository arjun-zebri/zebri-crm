/**
 * OAuth provider configuration for "connect your own mailbox" (Gmail /
 * Outlook). Reads client credentials from the environment and builds the
 * authorize URLs. Server-only (holds client secrets) — never import from
 * a `'use client'` module.
 *
 * @module lib/oauth/providers
 */

/** The mailbox providers an MC can connect. */
export type OAuthProvider = 'google' | 'microsoft';

/** Narrowing guard for an untrusted `?provider=` value. */
export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return value === 'google' || value === 'microsoft';
}

/** What a consent grant is for: sending mail or calendar access. */
export type OAuthPurpose = 'email' | 'calendar';

/** Narrowing guard for an untrusted `?purpose=` value. */
export function isOAuthPurpose(value: unknown): value is OAuthPurpose {
  return value === 'email' || value === 'calendar';
}

/**
 * Where to send the MC after the consent round trip.
 *
 * A closed set, never a caller-supplied path: the value survives a redirect
 * to a third-party consent screen and back, so echoing arbitrary input here
 * would be an open redirect.
 */
export type OAuthReturnTo = 'settings' | 'calendar';

/** Narrowing guard for an untrusted `?return=` value or cookie. */
export function isOAuthReturnTo(value: unknown): value is OAuthReturnTo {
  return value === 'settings' || value === 'calendar';
}

/** Resolved per-provider config (endpoints, scopes, client credentials). */
export interface OAuthConfig {
  provider: OAuthProvider;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri: string;
}

/** The callback every provider redirects back to after consent. */
export function oauthRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}/api/oauth/callback`;
}

/**
 * Build the {@link OAuthConfig} for `provider` from env. Throws if the
 * credentials are missing so a misconfigured deploy fails fast.
 */
export function oauthConfig(
  provider: OAuthProvider,
  purpose: OAuthPurpose = 'email',
): OAuthConfig {
  const redirectUri = oauthRedirectUri();
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('GOOGLE_OAUTH_CLIENT_ID/SECRET not set');
    return {
      provider,
      clientId,
      clientSecret,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes:
        purpose === 'calendar'
          ? [
              'openid',
              'email',
              // events: create/update bookings (incl. conferenceData for Meet
              // links). freebusy: availability reads. Narrowest pair that
              // covers Phase A + C, best posture for Google verification.
              'https://www.googleapis.com/auth/calendar.events',
              'https://www.googleapis.com/auth/calendar.freebusy',
            ]
          : ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'],
      redirectUri,
    };
  }
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('MICROSOFT_OAUTH_CLIENT_ID/SECRET not set');
  const tenant = process.env.MICROSOFT_OAUTH_TENANT || 'common';
  return {
    provider,
    clientId,
    clientSecret,
    authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    scopes:
      purpose === 'calendar'
        ? ['openid', 'email', 'offline_access', 'https://graph.microsoft.com/Calendars.ReadWrite']
        : ['openid', 'email', 'offline_access', 'https://graph.microsoft.com/Mail.Send'],
    redirectUri,
  };
}

/**
 * Build the provider's consent URL for `state`. `access_type=offline` +
 * `prompt=consent` (Google) guarantee a refresh token on every connect.
 */
export function buildAuthorizeUrl(
  provider: OAuthProvider,
  state: string,
  purpose: OAuthPurpose = 'email',
): string {
  const cfg = oauthConfig(provider, purpose);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: cfg.scopes.join(' '),
    state,
  });
  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
    params.set('include_granted_scopes', 'true');
  } else {
    params.set('response_mode', 'query');
  }
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

/**
 * Parse a round-tripped OAuth `state` ("<provider>.<purpose>.<random>").
 * States minted before the purpose dimension existed have only
 * "<provider>.<random>"; those default to 'email' so in-flight consents
 * keep working across the deploy.
 */
export function parseOAuthState(
  state: string,
): { provider: OAuthProvider; purpose: OAuthPurpose } | null {
  const [first, second] = state.split('.');
  if (!isOAuthProvider(first)) return null;
  if (isOAuthPurpose(second)) return { provider: first, purpose: second };
  if (second) return { provider: first, purpose: 'email' };
  return null;
}
