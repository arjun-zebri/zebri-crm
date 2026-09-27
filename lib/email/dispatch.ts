/**
 * Email transport dispatch.
 *
 * One place that knows how to put an email on the wire, given a resolved
 * sender ({@link ResolvedSender}). Couple-facing mail goes out either
 * through Resend (the shared Zebri address, the default) or through an
 * MC's own mailbox over OAuth — Gmail API or Microsoft Graph. Every sender
 * in `lib/email` and the automation `send_email` action funnels through
 * here so both transports behave identically.
 *
 * Every send also gets its text/plain alternative here, derived from the
 * HTML being sent (`./html-to-text`), so no caller can ship an HTML-only
 * email; Graph is the one transport that cannot carry it. The Gmail
 * message itself, header hardening included, is built in `./mime`.
 *
 * Server-only (Resend SDK + provider fetch calls).
 *
 * @module lib/email/dispatch
 */
import { Resend } from 'resend';

import { htmlToText } from './html-to-text';
import { buildMime } from './mime';
import type { OAuthTransport, ResolvedSender } from './sender-identity';

/** A ready-to-send attachment. */
export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

/** Everything a send needs except who it's from (the sender carries that). */
export interface DispatchPayload {
  to: string | string[];
  subject: string;
  html: string;
  /**
   * The text/plain alternative. Leave it out: `dispatchEmail` derives it
   * from `html`, footer and unsubscribe link included. Only a caller with
   * a better plain version than the HTML's own text should pass one.
   */
  text?: string;
  replyTo?: string;
  /** One address or several — an MC can BCC themselves and an assistant. */
  bcc?: string | string[];
  cc?: string[];
  attachments?: EmailAttachment[];
  /**
   * De-duplication key for the provider, when the caller can name this
   * send stably. Resend ignores a repeat of the same key for 24 hours,
   * which is what makes retrying a send that may already have gone out
   * safe. The OAuth transports have no equivalent and ignore it: ask
   * {@link transportDeduplicates} before treating a retry as safe.
   */
  idempotencyKey?: string;
  /**
   * URL for the one-click unsubscribe link (commercial sends only).
   * When supplied, the dispatch layer adds both `List-Unsubscribe` and
   * `List-Unsubscribe-Post` headers per RFC 8058. The URL is validated
   * to reject CR and LF before it reaches a header line, preventing
   * header injection. Omit this for transactional sends.
   */
  listUnsubscribeUrl?: string;
  /**
   * Optional tags for Resend webhook correlation. Resend echoes these back
   * on every webhook event for this message, allowing attribution of bounces
   * and complaints to the correct tenant. Each tag has a name and value;
   * names and values must be ASCII alphanumerics, underscores, or dashes.
   * The OAuth transports ignore this field.
   */
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Will this sender's transport collapse a repeat of the same
 * {@link DispatchPayload.idempotencyKey} into one message?
 *
 * Only Resend will. The Gmail and Graph send endpoints take no
 * idempotency key of any kind, so a caller that retries a send which
 * failed on a thrown request or a timeout (the classic case where the
 * mailbox accepted the message and only the response was lost) puts a
 * second copy in the couple's inbox. Anything deciding whether to retry
 * a send has to ask this first.
 *
 * Written as an allow-list rather than `!== 'oauth'` so a transport
 * added later is assumed unable to deduplicate until somebody has
 * checked its API and said otherwise.
 */
export function transportDeduplicates(sender: ResolvedSender): boolean {
  return sender.transport === 'resend';
}

/**
 * Tag Resend carries on a message that also went to cc or bcc copies.
 *
 * A Resend bounce or complaint event lists the message's `to` recipients
 * and nothing else, not the address that actually bounced. On a message
 * with copies, the one `to` address may be healthy while a cc'd or bcc'd
 * address is the dead one. The webhook reads this tag and refuses to
 * suppress on such a message, so a stranger's dead mailbox can never
 * silence a couple. `send_email` no longer puts copies on anyone's
 * message (every cc, bcc and the MC's own copy is its own message); the
 * tag remains for the manual and transactional sends that still do. Added here, at the one place every
 * Resend send passes, so no send site has to remember it.
 */
export const COPIES_TAG_NAME = 'copies';

/**
 * Tag every automated message that writes a `couple_emails` row carries
 * (`src=auto`), set by `send_email` and the shared send gate.
 *
 * It tells the Resend webhook that a delivery event matching no row is a
 * row not written YET (a fast event beating the log write), not a manual
 * or MC-copy message that is never logged by id. For those events, and
 * only while the event is young, the webhook asks Resend to retry (Phase
 * 5 fix wave, M3).
 */
export const AUTOMATED_TAG = { name: 'src', value: 'auto' } as const;

/**
 * Tag on the MC's own paper-trail copy of a `send_email` step
 * (`mc_copy=1`). The copy is its own message with no `couple_emails` row,
 * so the webhook leaves every event on it alone: it moves no couple's
 * delivery status and suppresses nobody (the MC is not a subscriber, and
 * a full MC inbox must not stop mail to anyone).
 */
export const MC_COPY_TAG_NAME = 'mc_copy';

/** True when `list` names at least one address. */
function hasAddresses(list: string | string[] | undefined): boolean {
  return Array.isArray(list) ? list.length > 0 : Boolean(list);
}

/** The payload's tags, plus {@link COPIES_TAG_NAME} when it has cc or bcc. */
function resendTags(payload: DispatchPayload): Array<{ name: string; value: string }> {
  const tags = [...(payload.tags ?? [])];
  const hasCopies = hasAddresses(payload.bcc) || hasAddresses(payload.cc);
  if (hasCopies && !tags.some((t) => t.name === COPIES_TAG_NAME)) {
    tags.push({ name: COPIES_TAG_NAME, value: '1' });
  }
  return tags;
}

/** Uniform result shape across all transports. */
export interface DispatchResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  /**
   * On a failure, a short machine token for why: Resend's error name
   * (`validation_error`), Gmail's status (`UNAUTHENTICATED`), Graph's
   * error code (`ErrorInvalidRecipients`), `http_<status>` when the
   * provider gave none, or `thrown`. Unlike `error`, which can quote a
   * recipient's address back, this is safe to put in a Slack alert (see
   * {@link failureCode}).
   */
  code?: string;
}

/**
 * Reduce a provider's error token to something an alert may carry.
 *
 * Providers name their errors with short identifiers, but nothing
 * promises that, and an alert must never carry a couple's address
 * (`assertNoCouplePii`). Anything that is not a short run of letters,
 * digits, `_`, `.` or `-` becomes `unknown`.
 */
function failureCode(raw: string): string {
  return /^[A-Za-z0-9_.-]{1,64}$/.test(raw) ? raw : 'unknown';
}

/**
 * The text/plain alternative: the caller's own, else derived from the
 * HTML being sent. Derived here, in the one function every transport
 * goes through, so no send site can forget it, and from the final HTML
 * so the text carries the same footer and unsubscribe URL (see
 * `./html-to-text`).
 */
function textPart(payload: DispatchPayload): string {
  return payload.text ?? htmlToText(payload.html);
}

/**
 * Validate a URL for use in a header line.
 *
 * Rejects any URL containing CR (`\r`) or LF (`\n`) to prevent
 * header injection. Returns null if the URL is invalid, the URL
 * itself if valid.
 *
 * This is called before the URL reaches any header output, catching
 * header injection at the narrowest point: one value, one place to
 * validate, no way for a caller to add headers nobody reviewed.
 */
export function validateHeaderUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes('\r') || url.includes('\n')) return null;
  return url;
}

let _resend: Resend | undefined;
/** Lazy Resend client — constructing it eagerly throws without the key in CI. */
function resend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(key);
  }
  return _resend;
}

/**
 * Send `payload` from `sender`, routing to Resend or the MC's mailbox.
 * Never throws — transport errors come back as `{ ok: false, error }`.
 */
export async function dispatchEmail(
  sender: ResolvedSender,
  payload: DispatchPayload,
): Promise<DispatchResult> {
  if (sender.transport === 'oauth') return sendViaOAuth(sender.from, sender.oauth, payload);
  return sendViaResend(sender.from, payload);
}

async function sendViaResend(from: string, payload: DispatchPayload): Promise<DispatchResult> {
  try {
    const validatedUrl = validateHeaderUrl(payload.listUnsubscribeUrl);
    if (payload.listUnsubscribeUrl && !validatedUrl) {
      return {
        ok: false,
        error: 'List-Unsubscribe URL contains invalid characters',
        code: 'invalid_unsubscribe_url',
      };
    }

    const headers = validatedUrl
      ? {
          'List-Unsubscribe': `<${validatedUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      : undefined;

    const tags = resendTags(payload);
    const { data, error } = await resend().emails.send(
      {
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: textPart(payload),
        ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
        ...(payload.bcc ? { bcc: payload.bcc } : {}),
        ...(payload.cc ? { cc: payload.cc } : {}),
        ...(payload.attachments?.length
          ? { attachments: payload.attachments.map((a) => ({ filename: a.filename, content: a.content })) }
          : {}),
        ...(headers ? { headers } : {}),
        ...(tags.length ? { tags } : {}),
      },
      // Omitted entirely (not just undefined) when there is no key, so a
      // caller without a stable id keeps sending exactly as before.
      ...(payload.idempotencyKey ? [{ idempotencyKey: payload.idempotencyKey }] : []),
    );
    if (error || !data?.id) {
      return {
        ok: false,
        error: error?.message ?? 'Resend returned no message id',
        code: failureCode(error?.name ?? 'no_message_id'),
      };
    }
    return { ok: true, messageId: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), code: 'thrown' };
  }
}

// ─── OAuth transports ──────────────────────────────────────────────────

function toList(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to];
}

async function sendViaOAuth(
  from: string,
  oauth: OAuthTransport,
  payload: DispatchPayload,
): Promise<DispatchResult> {
  try {
    return oauth.provider === 'google'
      ? await sendViaGmail(from, oauth.accessToken, payload)
      : await sendViaGraph(from, oauth.accessToken, payload);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), code: 'thrown' };
  }
}

async function sendViaGmail(from: string, accessToken: string, payload: DispatchPayload): Promise<DispatchResult> {
  const raw = Buffer.from(
    buildMime({
      from,
      to: toList(payload.to),
      subject: payload.subject,
      html: payload.html,
      text: textPart(payload),
      replyTo: payload.replyTo,
      cc: payload.cc,
      bcc: payload.bcc ? toList(payload.bcc) : undefined,
      attachments: payload.attachments,
      listUnsubscribeUrl: validateHeaderUrl(payload.listUnsubscribeUrl),
    }),
    'utf8',
  ).toString('base64url');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string; status?: string } };
  if (!res.ok || !data.id) {
    return {
      ok: false,
      error: data.error?.message ?? `Gmail send failed (${res.status})`,
      code: failureCode(data.error?.status ?? `http_${res.status}`),
    };
  }
  return { ok: true, messageId: data.id };
}

async function sendViaGraph(from: string, accessToken: string, payload: DispatchPayload): Promise<DispatchResult> {
  const recipients = (addrs: string[]) => addrs.map((address) => ({ emailAddress: { address } }));
  // HTML only. Graph's `message.body` is one `itemBody` with a single
  // contentType, and sendMail has no multipart/alternative of its own, so
  // there is nowhere to put the text part (audit M2). The HTML carries
  // the same footer and unsubscribe link, which is what the law needs.
  const message: Record<string, unknown> = {
    subject: payload.subject,
    body: { contentType: 'HTML', content: payload.html },
    toRecipients: recipients(toList(payload.to)),
    ...(payload.cc?.length ? { ccRecipients: recipients(payload.cc) } : {}),
    ...(payload.bcc ? { bccRecipients: recipients(toList(payload.bcc)) } : {}),
    ...(payload.replyTo ? { replyTo: recipients([payload.replyTo]) } : {}),
    ...(payload.attachments?.length
      ? {
          attachments: payload.attachments.map((a) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: a.filename,
            contentBytes: a.content.toString('base64'),
          })),
        }
      : {}),
  };
  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });
  // Graph returns 202 Accepted with an empty body on success.
  if (res.status === 202) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
  return {
    ok: false,
    error: data.error?.message ?? `Graph sendMail failed (${res.status})`,
    code: failureCode(data.error?.code ?? `http_${res.status}`),
  };
}
