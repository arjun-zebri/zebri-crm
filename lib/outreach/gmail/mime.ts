/**
 * Build the raw RFC 5322 message the Gmail API sends.
 *
 * Plain text only: from a personal inbox, HTML and tracking pixels read
 * as bulk mail, which is exactly what this channel avoids. Follow-ups set
 * `In-Reply-To` / `References` so Gmail threads them under the first
 * email, the way a person's own follow-up looks.
 *
 * Pure.
 *
 * @module lib/outreach/gmail/mime
 */

/** Inputs for one outgoing email. */
export interface MimeInput {
  from: { name: string; email: string };
  to: string;
  subject: string;
  body: string;
  /** RFC Message-ID of the message being followed up, for threading. */
  inReplyTo?: string | null;
  /** Message-ID to stamp on this message, so replies can be matched. */
  messageId: string;
}

/** RFC 2047 encode a header value when it isn't plain ASCII. */
export function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/** Refuse CR/LF in header values (header injection). */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/** Build the raw message and return it base64url-encoded for `users.messages.send`. */
export function buildRawEmail(input: MimeInput): string {
  const fromName = encodeHeader(headerSafe(input.from.name));
  const headers = [
    `From: ${fromName ? `${fromName} ` : ''}<${headerSafe(input.from.email)}>`,
    `To: <${headerSafe(input.to)}>`,
    `Subject: ${encodeHeader(headerSafe(input.subject))}`,
    `Message-ID: ${headerSafe(input.messageId)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    `List-Unsubscribe: <mailto:${headerSafe(input.from.email)}?subject=unsubscribe>`,
  ];
  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${headerSafe(input.inReplyTo)}`, `References: ${headerSafe(input.inReplyTo)}`);
  }
  const body = Buffer.from(input.body.replace(/\r?\n/g, '\r\n'), 'utf8')
    .toString('base64')
    .replace(/.{76}/g, '$&\r\n');
  const raw = `${headers.join('\r\n')}\r\n\r\n${body}`;
  return Buffer.from(raw, 'utf8').toString('base64url');
}

/** A fresh Message-ID on the sender's domain. */
export function newMessageId(senderEmail: string, random: () => string = () => crypto.randomUUID()): string {
  const domain = senderEmail.split('@')[1] ?? 'zebri.com.au';
  return `<${random()}@${domain}>`;
}

/** Subject for a follow-up in the same thread. */
export function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}
