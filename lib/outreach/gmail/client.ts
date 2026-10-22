/**
 * Gmail API access for the founder's outreach mailbox.
 *
 * Uses its own Google OAuth client (`OUTREACH_GOOGLE_CLIENT_ID/SECRET`),
 * created as an *Internal* app in the Zebri Workspace. Internal apps can
 * hold the restricted `gmail.readonly` scope without Google's app
 * verification, and keeping it apart from the customer-facing OAuth
 * client means outreach can never widen what MCs are asked to grant.
 *
 * Raw `fetch`, no SDK, matching `lib/oauth/tokens`. Server-only.
 *
 * @module lib/outreach/gmail/client
 */

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Per-request ceiling. A stalled Gmail call used to hang the whole tick
 * with its message stuck in 'sending'. Past this, the outcome is unknown,
 * which the send path treats as "maybe sent" (see `isDefinitiveRefusal`).
 */
export const GMAIL_TIMEOUT_MS = 15_000;

/** Scopes requested for the outreach mailbox. */
export const OUTREACH_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

/**
 * A Gmail or token endpoint error. `permanent` means the grant is dead.
 * `status` 0 means no response came back (timeout or network failure).
 */
export class GmailError extends Error {
  constructor(message: string, readonly status: number, readonly permanent: boolean) {
    super(message);
    this.name = 'GmailError';
  }
}

/**
 * True when Gmail answered with a 4xx, so the message definitely was not
 * sent. Anything else (no response, 5xx) may or may not have sent it, so
 * the send path must not requeue it blindly.
 */
export function isDefinitiveRefusal(err: unknown): boolean {
  return err instanceof GmailError && err.status >= 400 && err.status < 500;
}

/** Fetch with a timeout; transport failures become status-0 GmailErrors. */
async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(GMAIL_TIMEOUT_MS) });
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    throw new GmailError(`Gmail request failed: ${why}`, 0, false);
  }
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.OUTREACH_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.OUTREACH_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new GmailError('OUTREACH_GOOGLE_CLIENT_ID/SECRET not set', 500, true);
  return { clientId, clientSecret };
}

/** Callback URL registered on the Internal OAuth client. */
export function outreachRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}/api/admin/outreach/gmail/callback`;
}

/** Consent URL. `prompt=consent` guarantees a refresh token on reconnect. */
export function buildOutreachAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: credentials().clientId,
    redirect_uri: outreachRedirectUri(),
    response_type: 'code',
    scope: OUTREACH_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = credentials();
  const res = await timedFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new GmailError(data.error_description || data.error || `token ${res.status}`, res.status, data.error === 'invalid_grant');
  }
  return data;
}

/** Exchange the consent code; returns tokens and the granted scopes. */
export async function exchangeOutreachCode(code: string): Promise<{ accessToken: string; refreshToken: string | null; scopes: string[] }> {
  const t = await postToken({ grant_type: 'authorization_code', code, redirect_uri: outreachRedirectUri() });
  return { accessToken: t.access_token!, refreshToken: t.refresh_token ?? null, scopes: (t.scope ?? '').split(' ').filter(Boolean) };
}

/** Fresh access token from the stored refresh token. */
export async function refreshOutreachToken(refreshToken: string): Promise<string> {
  return (await postToken({ grant_type: 'refresh_token', refresh_token: refreshToken })).access_token!;
}

/** Thin authenticated Gmail client bound to one access token. */
export class GmailClient {
  constructor(private readonly accessToken: string) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await timedFetch(`${GMAIL}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${this.accessToken}`, 'content-type': 'application/json', ...init?.headers },
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      throw new GmailError(`Gmail ${res.status}: ${text}`, res.status, res.status === 401);
    }
    return (await res.json()) as T;
  }

  /** The connected address. */
  async profileEmail(): Promise<string> {
    return (await this.call<{ emailAddress: string }>('/profile')).emailAddress.toLowerCase();
  }

  /** Send a base64url raw message, optionally into an existing thread. */
  send(raw: string, threadId?: string | null): Promise<{ id: string; threadId: string }> {
    return this.call('/messages/send', { method: 'POST', body: JSON.stringify(threadId ? { raw, threadId } : { raw }) });
  }

  /** Thread with header metadata only (no bodies). */
  thread(threadId: string): Promise<GmailThread> {
    const headers = ['From', 'Content-Type', 'Auto-Submitted', 'Subject', 'Message-ID'].map((h) => `metadataHeaders=${h}`).join('&');
    return this.call(`/threads/${encodeURIComponent(threadId)}?format=metadata&${headers}`);
  }

  /** Message ids matching a Gmail search query. */
  async search(q: string, max = 100): Promise<{ id: string; threadId: string }[]> {
    const r = await this.call<{ messages?: { id: string; threadId: string }[] }>(`/messages?q=${encodeURIComponent(q)}&maxResults=${max}`);
    return r.messages ?? [];
  }

  /** One message in full, for reading the reply text. */
  message(id: string): Promise<GmailMessage> {
    return this.call(`/messages/${encodeURIComponent(id)}?format=full`);
  }
}

/** Gmail message payload part (recursive). */
export interface GmailPart {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string };
  parts?: GmailPart[];
}

/** A Gmail message resource (subset). */
export interface GmailMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: GmailPart;
}

/** A Gmail thread resource (subset). */
export interface GmailThread {
  id: string;
  messages?: GmailMessage[];
}

/** Header value from a message, case-insensitive. */
export function headerOf(msg: GmailMessage, name: string): string | null {
  const h = msg.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

/** First text/plain body in a message tree, decoded. */
export function plainTextOf(part: GmailPart | undefined): string {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf8');
  }
  for (const p of part.parts ?? []) {
    const t = plainTextOf(p);
    if (t) return t;
  }
  return '';
}
