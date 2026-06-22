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
export function oauthConfig(provider: OAuthProvider): OAuthConfig {
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
      // `gmail.send` is send-only (the narrowest scope, best for Google
      // verification); `openid email` gives us the connected address.
      scopes: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'],
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
    // `offline_access` is required to receive a refresh token.
    scopes: ['openid', 'email', 'offline_access', 'https://graph.microsoft.com/Mail.Send'],
    redirectUri,
  };
}

/**
 * Build the provider's consent URL for `state`. `access_type=offline` +
 * `prompt=consent` (Google) guarantee a refresh token on every connect.
 */
export function buildAuthorizeUrl(provider: OAuthProvider, state: string): string {
  const cfg = oauthConfig(provider);
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
