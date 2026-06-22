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
 * Server-only (Resend SDK + provider fetch calls).
 *
 * @module lib/email/dispatch
 */
import { Resend } from 'resend';

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
  replyTo?: string;
  bcc?: string;
  cc?: string[];
  attachments?: EmailAttachment[];
}

/** Uniform result shape across all transports. */
export interface DispatchResult {
  ok: boolean;
  messageId?: string;
  error?: string;
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
    const { data, error } = await resend().emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      ...(payload.bcc ? { bcc: payload.bcc } : {}),
      ...(payload.cc ? { cc: payload.cc } : {}),
      ...(payload.attachments?.length
        ? { attachments: payload.attachments.map((a) => ({ filename: a.filename, content: a.content })) }
        : {}),
    });
    if (error || !data?.id) return { ok: false, error: error?.message ?? 'Resend returned no message id' };
    return { ok: true, messageId: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
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
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** RFC 2047 encoded-word for a header value that may contain non-ASCII. */
function encodeHeaderWord(value: string): string {
   
  if (!/[^\x00-\x7F]/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/** Build an RFC-822 message (multipart/mixed when there are attachments). */
function buildMime(from: string, payload: DispatchPayload): string {
  const headers: string[] = [
    `From: ${from}`,
    `To: ${toList(payload.to).join(', ')}`,
    `Subject: ${encodeHeaderWord(payload.subject)}`,
    'MIME-Version: 1.0',
  ];
  if (payload.replyTo) headers.push(`Reply-To: ${payload.replyTo}`);
  if (payload.cc?.length) headers.push(`Cc: ${payload.cc.join(', ')}`);
  if (payload.bcc) headers.push(`Bcc: ${payload.bcc}`);

  if (!payload.attachments?.length) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    return `${headers.join('\r\n')}\r\n\r\n${payload.html}`;
  }

  const boundary = `zebri_${Buffer.from(`${payload.subject}${from}`).toString('base64').replace(/[^a-z0-9]/gi, '').slice(0, 24)}`;
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  const parts: string[] = [
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    payload.html,
  ];
  for (const a of payload.attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: application/octet-stream; name="${a.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${a.filename}"`,
      '',
      a.content.toString('base64').replace(/(.{76})/g, '$1\r\n'),
    );
  }
  parts.push(`--${boundary}--`);
  return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
}

async function sendViaGmail(from: string, accessToken: string, payload: DispatchPayload): Promise<DispatchResult> {
  const raw = Buffer.from(buildMime(from, payload), 'utf8').toString('base64url');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) return { ok: false, error: data.error?.message ?? `Gmail send failed (${res.status})` };
  return { ok: true, messageId: data.id };
}

async function sendViaGraph(from: string, accessToken: string, payload: DispatchPayload): Promise<DispatchResult> {
  const recipients = (addrs: string[]) => addrs.map((address) => ({ emailAddress: { address } }));
  const message: Record<string, unknown> = {
    subject: payload.subject,
    body: { contentType: 'HTML', content: payload.html },
    toRecipients: recipients(toList(payload.to)),
    ...(payload.cc?.length ? { ccRecipients: recipients(payload.cc) } : {}),
    ...(payload.bcc ? { bccRecipients: recipients([payload.bcc]) } : {}),
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
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return { ok: false, error: data.error?.message ?? `Graph sendMail failed (${res.status})` };
}
