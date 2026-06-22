/**
 * OAuth token operations for connected mailboxes: exchange an auth code
 * for tokens, refresh an expired access token, look up the connected
 * address, and revoke on disconnect. Raw `fetch` against the providers'
 * token/userinfo endpoints — no SDKs.
 *
 * Server-only (uses client secrets via {@link oauthConfig}).
 *
 * @module lib/oauth/tokens
 */
import { oauthConfig, type OAuthProvider } from './providers';

/** Tokens returned by an authorization-code exchange. */
export interface TokenSet {
  accessToken: string;
  /** Present on the initial consent; some providers omit it on refresh. */
  refreshToken?: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

interface TokenEndpointResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function postToken(
  provider: OAuthProvider,
  body: Record<string, string>,
): Promise<TokenSet> {
  const cfg = oauthConfig(provider);
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      ...body,
    }),
  });
  const data = (await res.json()) as TokenEndpointResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `token request failed (${res.status})`);
  }
  return {
    accessToken: data.access_token,
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    expiresIn: data.expires_in ?? 3600,
  };
}

/** Exchange the callback `code` for an access + refresh token. */
export function exchangeCode(provider: OAuthProvider, code: string): Promise<TokenSet> {
  return postToken(provider, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: oauthConfig(provider).redirectUri,
  });
}

/** Mint a fresh access token from a stored refresh token. */
export function refreshAccessToken(provider: OAuthProvider, refreshToken: string): Promise<TokenSet> {
  return postToken(provider, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}

/**
 * Look up the connected mailbox address (used as the `from` and shown in
 * settings). Google: the OIDC userinfo endpoint. Microsoft: Graph `/me`
 * (`mail`, falling back to `userPrincipalName`).
 */
export async function fetchUserEmail(provider: OAuthProvider, accessToken: string): Promise<string> {
  const url =
    provider === 'google'
      ? 'https://openidconnect.googleapis.com/v1/userinfo'
      : 'https://graph.microsoft.com/v1.0/me';
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`userinfo request failed (${res.status})`);
  const data = (await res.json()) as { email?: string; mail?: string; userPrincipalName?: string };
  const email = data.email ?? data.mail ?? data.userPrincipalName;
  if (!email) throw new Error('provider returned no email address');
  return email;
}

/**
 * Best-effort revoke on disconnect. Google has a revocation endpoint;
 * Microsoft has no simple per-token revoke (tokens lapse / consent is
 * withdrawn in the account portal), so it's a no-op there.
 */
export async function revokeToken(provider: OAuthProvider, token: string): Promise<void> {
  if (provider !== 'google') return;
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch {
    // Disconnect must succeed locally even if the remote revoke fails.
  }
}
